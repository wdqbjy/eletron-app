import { usePlayerStore } from '../stores/player'
import type { PlayMode } from '../stores/player'
import { useRecommendStore } from '../stores/recommend'
import { useSettingsStore } from '../stores/settings'
import { getMusicInfo, getMusicEpisodes, getMusicPlayUrl } from '../apis/bilibili'
import type { RecommendedMusic } from '../apis/bilibili'
import { selectAudioInfo } from '../utils/audio'
import { attachAudioAnalyser } from '../utils/audioAnalyser'

/**
 * 真实音频播放 composable
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
    // 走 biliaudio:// 代理（主进程已补 CORS 头），必须设 crossOrigin 匿名，
    // 否则 Web Audio AnalyserNode 无法读取频谱（播放特效）。设于任何 src 之前。
    audioInstance.crossOrigin = 'anonymous'
    // 首次创建后接到分析器（单例元素只 attach 一次）
    attachAudioAnalyser(audioInstance)
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
  // 多分P合集：在分P队列内切歌；单曲：用推荐列表作切歌源
  const p = usePlayerStore()
  if (p.queueIsEpisodes) return p.queue
  const rec = useRecommendStore().items
  return rec.length ? rec : p.queue
}

/**
 * 定位当前曲目在列表中的索引。
 * 多分P(合集)里所有曲目共享同一 bvid、只在 cid 上区分，
 * 因此先按 (bvid,cid) 精确匹配，失败再退回仅按 bvid。
 */
function findIndex(list: RecommendedMusic[], current?: RecommendedMusic | null): number {
  if (!current) return -1
  if (current.cid) {
    const byCid = list.findIndex((m) => m.bvid === current.bvid && m.cid === current.cid)
    if (byCid >= 0) return byCid
  }
  return list.findIndex((m) => m.bvid === current.bvid)
}

function getRandomIndex(max: number): number {
  return Math.floor(Math.random() * max)
}

/**
 * 按播放模式决定“下一首”的索引。
 * @returns ≥0 可播；-1 表示无切（例如 order 模式播到结尾 → 停止）
 */
function getNextMusicIndex(
  list: RecommendedMusic[],
  mode: PlayMode,
  current?: RecommendedMusic | null
): number {
  if (!list.length) return -1
  const idx = findIndex(list, current)
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
function getPreviousMusicIndex(
  list: RecommendedMusic[],
  mode: PlayMode,
  current?: RecommendedMusic | null
): number {
  if (!list.length) return -1
  const idx = findIndex(list, current)
  if (mode === 'shuffle') {
    if (idx < 0) return getRandomIndex(list.length)
    let prev = getRandomIndex(list.length)
    while (list.length > 1 && prev === idx) prev = getRandomIndex(list.length)
    return prev
  }
  return idx > 0 ? idx - 1 : list.length - 1
}

/**
 * 把 /x/web-interface/view 返回的分P列表构造成可播放的 RecommendedMusic 列表。
 * 每集：cid 各异、title 用分P标题、duration 用分P时长；其余元信息继承整稿。
 */
export function buildEpisodes(music: RecommendedMusic, pages: Array<{ cid: number; part: string; duration: number }>): RecommendedMusic[] {
  return pages.map((p) => ({
    bvid: music.bvid,
    aid: music.aid,
    cid: p.cid,
    title: p.part || music.title,
    author: music.author,
    cover: music.cover,
    duration: p.duration || music.duration || 180,
    playCount: music.playCount,
    pubdate: music.pubdate,
    rec_reason: music.rec_reason
  }))
}

export function useAudioPlayer() {
  const player = usePlayerStore()
  const settings = useSettingsStore()

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
        const nextIndex = getNextMusicIndex(list, player.playMode, player.current)
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
      // 分P列表优先走专用接口 /x/player/pagelist，失败退回 view 的 data.pages
      let pages: Array<{ cid: number; part: string; duration: number }> = []
      try {
        const epRes = await getMusicEpisodes(music.bvid)
        if (epRes?.code === 0 && Array.isArray(epRes.data)) pages = epRes.data
      } catch (_) {}
      if (pages.length <= 1) pages = musicInfo?.data?.pages ?? []
      let cid = music.cid || musicInfo?.data?.cid
      // 诊断日志：在 DevTools 控制台据此判断为何合集没展开（pages.length<=1 即走单曲分支）
      console.log(
        `[Player] playMusic 诊断 bvid=${music.bvid} music.cid=${music.cid ?? '(无)'} ` +
          `musicInfo.code=${musicInfo?.code} musicInfo.data?.cid=${musicInfo?.data?.cid} ` +
          `musicInfo.data?.pages?.length=${musicInfo?.data?.pages?.length ?? '(无)'} ` +
          `pages.length=${pages.length}`
      )
      if (pages.length > 1) {
        // 多分P(合集)：把所有分P展开成播放队列，切歌在分P内循环
        const eps = buildEpisodes(music, pages)
        player.setQueue(eps)
        player.setQueueIsEpisodes(true)
        // 构造合集信息：title 取稿件标题（如「民谣100首」），底部「歌曲管理」面板据此显示合集名
        player.setCurrentSeries({
          title: musicInfo?.data?.title || music.title,
          episodes: eps
        })
        // 自动弹出底部队列面板，让用户直接看到合集曲目
        player.setShowQueuePanel(true)
        // 关键诊断：用户可在 DevTools 看到合集是否真正进了队列/面板
        console.log(
          `[Player] 多分P合集「${musicInfo?.data?.title || music.title}」展开完成：` +
            `pages.length=${pages.length} eps.length=${eps.length} ` +
            `player.queue.length=${player.queue.length} showQueuePanel=${player.showQueuePanel}`
        )
        // 定位当前播放的分P：music.cid 通常已在分P内，否则取整稿首P
        const idx = eps.findIndex((e) => e.cid === (music.cid ?? musicInfo?.data?.cid))
        const target = idx >= 0 ? eps[idx] : eps[0]
        cid = target.cid
        // current 携带正确的分P cid/标题/时长，切歌才能按 cid 精确定位
        player.setCurrent(target)
      } else {
        // 单曲：队列只放当前曲目（单曲不铺底推荐列表到队列面板）
        player.setQueueIsEpisodes(false)
        player.setCurrentSeries(null)
        player.setQueue([music])
      }
      if (cid) {
        const playUrl = await getMusicPlayUrl(music.bvid, cid)
        console.log('[Player] playurl code=', playUrl?.code, 'msg=', playUrl?.message)
        if (playUrl?.code === 0) {
          // 按设置的音质档选流（auto 优先 FLAC/杜比，high/medium/low 取对应码率）
          audioSrc = selectAudioInfo(playUrl.data, settings.audioQuality)?.url ?? null
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
    const nextIndex = getNextMusicIndex(list, player.playMode, player.current)
    const next = musicAt(list, nextIndex)
    if (next) playMusic(next)
  }

  function playPrevious() {
    const list = currentPlayList()
    const prev = musicAt(list, getPreviousMusicIndex(list, player.playMode, player.current))
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