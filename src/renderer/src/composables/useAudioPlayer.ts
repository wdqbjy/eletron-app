import { usePlayerStore } from '../stores/player'
import type { PlayMode } from '../stores/player'
import { useRecommendStore } from '../stores/recommend'
import { getMusicInfo, getMusicPlayUrl } from '../apis/bilibili'
import type { RecommendedMusic } from '../apis/bilibili'
import { selectAudioUrl } from '../utils/audio'

/**
 * 真实音频播放 composable（对齐 pink-music 的 useAudioPlayer.js）
 * - 模块级单例 <audio> 元素；跨曲目播放时复用并重新绑定监听。
 * - 播放源：主进程 /x/player/playurl → 渲染层 selectAudioUrl 择优。
 * - 底部 PlayerBar / 首页卡片共用这里。UI 状态统一落到 player store。
 */
let audioInstance: HTMLAudioElement | null = null
let existingListeners: Record<string, (e: any) => void> = {}
/** 加载超时：网络 stall / 流地址无效时，避免播放器无限转圈 */
let loadingTimer: ReturnType<typeof setTimeout> | null = null
const LOAD_TIMEOUT_MS = 12000

function clearLoadingTimer() {
  if (loadingTimer) {
    clearTimeout(loadingTimer)
    loadingTimer = null
  }
}

function getAudio(): HTMLAudioElement {
  if (!audioInstance) {
    audioInstance = new Audio()
    audioInstance.preload = 'metadata'
    // 不加 crossOrigin：B 站 CDN 未下发 CORS 头，匿名模式会导致解码被拒。我们无需 Web Audio 分析。
  }
  return audioInstance
}

/**
 * 把真实音频地址包装成主进程代理地址。渲染层 <audio> 原生请求不带 B 站 Referer，
 * CDN 会 403；改为经主进程 biliaudio:// 协议拉流（复用 axios 的 Referer/UA）。
 */
function toPlayableSrc(realUrl: string): string {
  return 'biliaudio://audio/?u=' + encodeURIComponent(realUrl)
}

function unbindAll() {
  const audio = getAudio()
  Object.entries(existingListeners).forEach(([event, handler]) => {
    try {
      audio.removeEventListener(event, handler)
    } catch (_) {}
  })
  existingListeners = {}
}

function currentPlayList(): RecommendedMusic[] {
  // 首页推荐是当前唯一曲目来源；将来接入歌单/搜索后在此扩展
  return useRecommendStore().items
}

function findIndex(list: RecommendedMusic[], bvid?: string): number {
  return list.findIndex((m) => m.bvid === bvid)
}

function getRandomIndex(max: number): number {
  return Math.floor(Math.random() * max)
}

/**
 * 按播放模式决定“下一首”的索引（对齐 pink-music useAudioPlayer.getNextMusicIndex）。
 * @returns ≥0 可播；-1 表示无切（例如 order 模式播到结尾 → 停止）
 */
function getNextMusicIndex(
  list: RecommendedMusic[],
  mode: PlayMode,
  currentBvid?: string
): number {
  if (!list.length) return -1
  const idx = findIndex(list, currentBvid)
  switch (mode) {
    case 'single':
      return idx >= 0 ? idx : 0
    case 'shuffle': {
      if (idx < 0) return getRandomIndex(list.length)
      let next = getRandomIndex(list.length)
      while (list.length > 1 && next === idx) next = getRandomIndex(list.length)
      return next
    }
    case 'loop':
      return idx >= 0 ? (idx + 1) % list.length : 0
    case 'order':
    default:
      return idx >= 0 && idx < list.length - 1 ? idx + 1 : -1
  }
}

/** 返回某 index 位置的曲目，越界返回 undefined */
function musicAt(list: RecommendedMusic[], index: number): RecommendedMusic | undefined {
  return index >= 0 && index < list.length ? list[index] : undefined
}

/** 上一首索引：shuffle 随机，其余回退一位（到头回绕到末尾） */
function getPreviousMusicIndex(list: RecommendedMusic[], mode: PlayMode, currentBvid?: string): number {
  if (!list.length) return -1
  const idx = findIndex(list, currentBvid)
  if (mode === 'shuffle') {
    if (idx < 0) return getRandomIndex(list.length)
    let prev = getRandomIndex(list.length)
    while (list.length > 1 && prev === idx) prev = getRandomIndex(list.length)
    return prev
  }
  return idx > 0 ? idx - 1 : list.length - 1
}

export function useAudioPlayer() {
  const player = usePlayerStore()

  function bindListeners(music: RecommendedMusic) {
    unbindAll()
    const audio = getAudio()
    const listeners: Record<string, (e: any) => void> = {
      loadedmetadata: () => {
        clearLoadingTimer()
        player.setDuration(audio.duration || music.duration || 180)
        player.setIsLoading(false)
      },
      loadstart: () => {
        clearLoadingTimer()
      },
      stalling: () => {
        // 网络缓冲中：不立即结束加载态，交给超时兜底
      },
      waiting: () => {
        // 等待数据：同上
      },
      timeupdate: () => {
        player.setCurrentTime(audio.currentTime)
        // 缓冲进度
        if (audio.buffered.length > 0) {
          const end = audio.buffered.end(audio.buffered.length - 1)
          const d = audio.duration || 1
          player.setBuffered(Math.round((end / d) * 100))
        }
      },
      canplaythrough: () => {
        clearLoadingTimer()
        player.setIsLoading(false)
        player.setBuffered(100)
      },
      ended: () => {
        // 按播放模式自动切下一首；无可切则停止
        const list = currentPlayList()
        const nextIndex = getNextMusicIndex(list, player.playMode, player.current?.bvid)
        const next = musicAt(list, nextIndex)
        if (next) {
          playMusic(next)
        } else {
          player.setIsPlaying(false)
          player.setCurrentTime(0)
        }
      },
      error: (e: any) => {
        clearLoadingTimer()
        player.setIsLoading(false)
        const code = e?.target?.error?.code
        console.error('[Player] 音频加载失败 code=', code, 'src=', audio.src)
        player.setAudioError('音频加载失败（' + (code ?? '未知错误') + '），可能无可用音轨或网络受限')
      }
    }
    Object.entries(listeners).forEach(([event, handler]) => audio.addEventListener(event, handler))
    existingListeners = listeners
  }

  async function playMusic(music: RecommendedMusic) {
    clearLoadingTimer()
    try {
      if (!getAudio().paused) getAudio().pause()
    } catch (_) {}

    player.setCurrent(music)
    player.setIsPlaying(false)
    player.setIsLoading(true)
    player.setAudioError('')
    player.setCurrentTime(0)
    player.setDuration(music.duration || 180)
    player.setBuffered(0)

    let audioSrc: string | null = null
    try {
      const musicInfo = await getMusicInfo(music.bvid)
      const cid = music.cid || musicInfo?.data?.cid
      if (cid) {
        const playUrl = await getMusicPlayUrl(music.bvid, cid)
        console.log('[Player] playurl code=', playUrl?.code, 'msg=', playUrl?.message)
        if (playUrl?.code === 0) {
          audioSrc = selectAudioUrl(playUrl.data)
        } else if (playUrl?.code === -101 || playUrl?.code === -412) {
          console.warn('[Player] playurl 风控/未登录: ', playUrl?.code, playUrl?.message)
        }
      }
    } catch (e) {
      console.error('[Player] 取流失败:', e)
    }

    if (!audioSrc) {
      player.setIsLoading(false)
      player.setAudioError('无法获取音频地址（可能未登录或无专职音轨）')
      return
    }
    console.log('[Player] 实际播放地址(截断):', audioSrc.slice(0, 90) + '...')

    bindListeners(music)
    // 看门狗：超过阈值仍没出 loadedmetadata/canplaythrough/error → 超时兜底
    clearLoadingTimer()
    loadingTimer = setTimeout(() => {
      if (player.isLoading) {
        player.setIsLoading(false)
        player.setAudioError('音频加载超时，请重试或换一首')
      }
    }, LOAD_TIMEOUT_MS)

    const audio = getAudio()
    audio.src = toPlayableSrc(audioSrc)
    console.log('[Player] 播放源(biliaudio代理):', toPlayableSrc(audioSrc).slice(0, 80) + '...')
    try {
      await audio.play()
      player.setIsPlaying(true)
    } catch (err: any) {
      clearLoadingTimer()
      player.setIsLoading(false)
      if (err?.name === 'NotAllowedError') {
        player.setAudioError('浏览器阻止了自动播放，请点击播放按钮')
      }
    }
  }

  function togglePlayPause() {
    const audio = getAudio()
    if (!player.current) return
    if (player.isPlaying) {
      audio.pause()
      player.setIsPlaying(false)
    } else {
      audio.play().then(
        () => player.setIsPlaying(true),
        () => player.setIsPlaying(false)
      )
    }
  }

  function playNext() {
    const list = currentPlayList()
    const nextIndex = getNextMusicIndex(list, player.playMode, player.current?.bvid)
    const next = musicAt(list, nextIndex)
    if (next) playMusic(next)
  }

  function playPrevious() {
    const list = currentPlayList()
    const prev = musicAt(list, getPreviousMusicIndex(list, player.playMode, player.current?.bvid))
    if (prev) playMusic(prev)
  }

  function seekToTime(sec: number) {
    const audio = getAudio()
    if (!isNaN(sec) && sec >= 0 && audio.duration) {
      audio.currentTime = sec
      player.setCurrentTime(sec)
    }
  }

  return { playMusic, togglePlayPause, playNext, playPrevious, seekToTime }
}