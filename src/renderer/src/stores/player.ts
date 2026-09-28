import { defineStore } from 'pinia'
import type { RecommendedMusic } from '../apis/bilibili'

const PLAY_HISTORY_KEY = 'app-play-history'
const PLAY_HISTORY_MAX = 50
const VOLUME_KEY = 'app-player-volume'

function loadPlayHistory(): RecommendedMusic[] {
  try {
    const raw = localStorage.getItem(PLAY_HISTORY_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) ? parsed : []
  } catch (_) {
    return []
  }
}

function persistPlayHistory(list: RecommendedMusic[]) {
  try {
    localStorage.setItem(PLAY_HISTORY_KEY, JSON.stringify(list.slice(0, PLAY_HISTORY_MAX)))
  } catch (_) {}
}

/** 音量持久化：0~1，缺省为 1（满音量） */
function loadVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEY)
    const v = raw ? parseFloat(raw) : NaN
    return isNaN(v) ? 1 : Math.min(1, Math.max(0, v))
  } catch (_) {
    return 1
  }
}
function persistVolume(v: number) {
  try {
    localStorage.setItem(VOLUME_KEY, String(v))
  } catch (_) {}
}

/** 播放模式：order=顺序、loop=列表循环、single=单曲循环、shuffle=随机 */
export type PlayMode = 'order' | 'loop' | 'single' | 'shuffle'
export const PLAY_MODES: PlayMode[] = ['order', 'loop', 'single', 'shuffle']

/** 各模式元信息（图标为内联 SVG） */
const PLAY_MODE_META: Record<PlayMode, { label: string; icon: string }> = {
  // 顺序：双向水平箭头
  order: {
    label: '顺序播放',
    icon:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><polyline points="17 1 21 5 17 9"/><path d="M3 5h18"/><polyline points="7 23 3 19 7 15"/><path d="M21 19H3"/></svg>'
  },
  // 列表循环：环形箭头
  loop: {
    label: '列表循环',
    icon:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>'
  },
  // 随机：交叉箭头
  shuffle: {
    label: '随机播放',
    icon:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>'
  },
  // 单曲循环：循环箭头中央一个 "1"
  single: {
    label: '单曲循环',
    icon:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/><text x="12" y="15.5" text-anchor="middle" dominant-baseline="middle" fill="currentColor" stroke="none" font-size="8" font-weight="700" font-family="Arial, sans-serif">1</text></svg>'
  }
}

/**
 * 播放器 store（当前曲目 + 播放状态 + 进度 + 播放模式）
 * 真实音频由 useAudioPlayer（composable，持有单个 HTMLAudioElement）驱动，
 * 这里只存 UI 需要读取的状态。首页推荐卡片「播放」→ useAudioPlayer().playMusic()。
 */
export const usePlayerStore = defineStore('player', {
  state: () => ({
    current: null as RecommendedMusic | null,
    isPlaying: false,
    isLoading: false,
    audioError: '',
    currentTime: 0,
    duration: 0,
    buffered: 0,
    playMode: 'order' as PlayMode,
    /** 歌词大页是否打开（点播放器封面弹出） */
    showPlayerPage: false,
    /** 播放队列（当前可切歌的列表，初始取自推荐；底部播放器的「队列」面板据此渲染） */
    queue: [] as RecommendedMusic[],
    /** 队列是否来自多分P(合集)视频展开（同一 bvid 多 cid）。播单曲时切回推荐队列 */
    queueIsEpisodes: false,
    showQueuePanel: false,
    /** 播放历史：最新在前，最多 50 条，localStorage 持久化 */
    playHistory: loadPlayHistory(),
    /** 音量 0~1，持久化到 localStorage；lastVolume 用于取消静音时恢复 */
    volume: loadVolume(),
    lastVolume: loadVolume() || 1,
    /**
     * 当前多分P合集信息。
     * 点击合集卡片时由 useAudioPlayer 填充：title=视频标题(如「民谣100首」)，episodes=展开后的分P。
     * 播放单曲时置空。底部「歌曲管理/队列」面板据此显示合集名。
     */
    currentSeries: null as { title: string; episodes: RecommendedMusic[] } | null
  }),
  getters: {
    hasCurrent: (s): boolean => !!s.current,
    progressPct: (s): number =>
      s.duration > 0 ? Math.min(100, Math.max(0, (s.currentTime / s.duration) * 100)) : 0,
    progressTime: (s): string => formatClock(s.currentTime),
    totalTime: (s): string => (s.duration > 0 ? formatClock(s.duration) : '0:00'),
    playModeIcon: (s): string => PLAY_MODE_META[s.playMode].icon,
    playModeLabel: (s): string => PLAY_MODE_META[s.playMode].label
  },
  actions: {
    setCurrent(track: RecommendedMusic | null) {
      this.current = track
    },
    clear() {
      this.current = null
      this.isPlaying = false
      this.isLoading = false
      this.audioError = ''
      this.currentTime = 0
      this.duration = 0
      this.buffered = 0
    },
    setIsPlaying(v: boolean) {
      this.isPlaying = v
    },
    setIsLoading(v: boolean) {
      this.isLoading = v
    },
    setAudioError(msg: string) {
      this.audioError = msg
    },
    setCurrentTime(v: number) {
      this.currentTime = v
    },
    setDuration(v: number) {
      this.duration = v
    },
    setBuffered(v: number) {
      this.buffered = v
    },
    /** 打开/关闭歌词大页 */
    setShowPlayerPage(v: boolean) {
      this.showPlayerPage = v
    },
    /** 循环切换播放模式：order → loop → single → shuffle → order */
    togglePlayMode() {
      const idx = PLAY_MODES.indexOf(this.playMode)
      this.playMode = PLAY_MODES[(idx + 1) % PLAY_MODES.length]
    },
    // ===== 播放队列 =====
    setQueue(list: RecommendedMusic[]) {
      this.queue = list
    },
    setQueueIsEpisodes(v: boolean) {
      this.queueIsEpisodes = v
    },
    setShowQueuePanel(v: boolean) {
      this.showQueuePanel = v
    },
    toggleQueuePanel() {
      this.showQueuePanel = !this.showQueuePanel
    },
    removeFromQueue(bvid: string) {
      this.queue = this.queue.filter((m) => m.bvid !== bvid)
    },
    clearQueue() {
      this.queue = []
    },
    /** 设置当前合集信息（多分P卡片点击时调用）；传 null 清空（播单曲时） */
    setCurrentSeries(series: { title: string; episodes: RecommendedMusic[] } | null) {
      this.currentSeries = series
    },
    // ===== 播放历史 =====
    /** 记录一次播放：按 bvid 去重置顶，上限 50 条并落盘 */
    recordPlayHistory(music: RecommendedMusic) {
      if (!music?.bvid) return
      this.playHistory = this.playHistory.filter((m) => m.bvid !== music.bvid)
      this.playHistory.unshift(music)
      if (this.playHistory.length > PLAY_HISTORY_MAX) {
        this.playHistory = this.playHistory.slice(0, PLAY_HISTORY_MAX)
      }
      persistPlayHistory(this.playHistory)
    },
    clearPlayHistory() {
      this.playHistory = []
      persistPlayHistory(this.playHistory)
    },
    // ===== 音量 =====
    /** 设置音量 0~1；>0 时同步记录 lastVolume，0 视为静音 */
    setVolume(v: number) {
      const clamped = Math.min(1, Math.max(0, v))
      this.volume = clamped
      if (clamped > 0) this.lastVolume = clamped
      persistVolume(clamped)
    },
    /** 静音/取消静音：记录当前音量后归零，或恢复上次非零音量 */
    toggleMute() {
      if (this.volume > 0) {
        this.lastVolume = this.volume
        this.volume = 0
      } else {
        this.volume = this.lastVolume > 0 ? this.lastVolume : 1
      }
      persistVolume(this.volume)
    }
  }
})

/** 秒 → 'm:ss'（与 utils/bilibili.formatDuration 一致，此处独立避免循环依赖） */
function formatClock(sec: number): string {
  if (!sec || isNaN(sec) || sec < 0) return '0:00'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}