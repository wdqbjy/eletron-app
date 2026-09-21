import { defineStore } from 'pinia'
import type { RecommendedMusic } from '../apis/bilibili'

/** 播放模式：order=顺序、loop=列表循环、single=单曲循环、shuffle=随机 */
export type PlayMode = 'order' | 'loop' | 'single' | 'shuffle'
export const PLAY_MODES: PlayMode[] = ['order', 'loop', 'single', 'shuffle']

/** 各模式元信息（图标为内联 SVG，对应 pink-music App.vue 的 playModes） */
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
    playMode: 'order' as PlayMode
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
    /** 循环切换播放模式：order → loop → single → shuffle → order */
    togglePlayMode() {
      const idx = PLAY_MODES.indexOf(this.playMode)
      this.playMode = PLAY_MODES[(idx + 1) % PLAY_MODES.length]
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