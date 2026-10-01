import { defineStore } from 'pinia'
import { setEQTargetState, EQ_PRESETS, EQ_BAND_COUNT, EQ_PRESET_KEYS } from '../utils/audioEQ'

/**
 * 应用设置
 *
 * 字段：
 * - visualizerEnabled / audioVisualizerIntensity：大屏频谱可视化开关与激进度
 * - audioQuality：默认播放/下载音质 auto|lossless|high|medium|low
 * - eqEnabled / eqBands(10) / eqPreset：10 段图示均衡器
 * - windowControlsEnabled：是否显示自定义窗口最小化/最大化/关闭按钮
 * - lyricDisplayMode：歌词附注模式 original|romaji|translation
 *
 * 持久化：localStorage JSON（key app-settings-v1），首次启动从旧的两个
 * 可视化独立 key 迁移。EQ 写入时同步音频引擎（AudioContext 未就绪则挂起）。
 */

export type AudioQuality = 'auto' | 'lossless' | 'high' | 'medium' | 'low'
export type LyricDisplayMode = 'original' | 'romaji' | 'translation'

const SETTINGS_KEY = 'app-settings-v1'
// 旧版独立 key（迁移用）
const LEGACY_ENABLED_KEY = 'app-visualizer-enabled'
const LEGACY_INTENSITY_KEY = 'app-visualizer-intensity'

const QUALITIES: AudioQuality[] = ['auto', 'lossless', 'high', 'medium', 'low']
const LYRIC_MODES: LyricDisplayMode[] = ['original', 'romaji', 'translation']

interface SettingsState {
  visualizerEnabled: boolean
  audioVisualizerIntensity: number
  audioQuality: AudioQuality
  eqEnabled: boolean
  eqBands: number[]
  eqPreset: string
  windowControlsEnabled: boolean
  lyricDisplayMode: LyricDisplayMode
}

function defaults(): SettingsState {
  return {
    visualizerEnabled: true,
    audioVisualizerIntensity: 0.6,
    audioQuality: 'auto',
    eqEnabled: false,
    eqBands: EQ_PRESETS.flat.slice(),
    eqPreset: 'flat',
    windowControlsEnabled: true,
    lyricDisplayMode: 'original'
  }
}

function clamp01(v: unknown): number {
  const n = Number(v)
  return isNaN(n) ? 0.6 : Math.max(0, Math.min(1, n))
}

function normalizeBands(v: unknown): number[] {
  const d = EQ_PRESETS.flat
  if (!Array.isArray(v)) return d.slice()
  const out = d.map((fallback, i) => {
    const n = Number(v[i])
    return isNaN(n) ? fallback : Math.max(-12, Math.min(12, n))
  })
  while (out.length < EQ_BAND_COUNT) out.push(0)
  return out.slice(0, EQ_BAND_COUNT)
}

/** 同步 EQ 目标状态到音频引擎（Context 未建时引擎内部挂起，建链后生效） */
function syncEQ(enabled: boolean, bands: number[]): void {
  try {
    setEQTargetState(enabled, bands)
  } catch (e) {
    console.error('[Settings] EQ 引擎同步失败:', e)
  }
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => defaults(),
  actions: {
    /** 启动时从 localStorage 读取（含旧 key 迁移），并把 EQ 状态灌进音频引擎 */
    init() {
      const s = defaults()

      // 1) 新版 JSON
      let hasNewData = false
      try {
        const raw = localStorage.getItem(SETTINGS_KEY)
        hasNewData = !!raw
        if (raw) {
          const j = JSON.parse(raw)
          if (typeof j.visualizerEnabled === 'boolean') s.visualizerEnabled = j.visualizerEnabled
          if (j.audioVisualizerIntensity !== undefined) s.audioVisualizerIntensity = clamp01(j.audioVisualizerIntensity)
          if (QUALITIES.includes(j.audioQuality)) s.audioQuality = j.audioQuality
          if (typeof j.eqEnabled === 'boolean') s.eqEnabled = j.eqEnabled
          if (j.eqBands !== undefined) s.eqBands = normalizeBands(j.eqBands)
          if (EQ_PRESET_KEYS.includes(j.eqPreset)) s.eqPreset = j.eqPreset
          if (typeof j.windowControlsEnabled === 'boolean') s.windowControlsEnabled = j.windowControlsEnabled
          if (LYRIC_MODES.includes(j.lyricDisplayMode)) s.lyricDisplayMode = j.lyricDisplayMode
        }
      } catch (e) {
        console.warn('[Settings] 读取设置失败，使用默认值:', e)
      }

      // 2) 旧版独立 key 迁移（仅新版 JSON 从未写过时才采用，迁移后删除旧 key 防止重启回灌）
      const legacyEn = localStorage.getItem(LEGACY_ENABLED_KEY)
      if (!hasNewData && legacyEn !== null) s.visualizerEnabled = legacyEn === '1'
      const legacyInten = parseFloat(localStorage.getItem(LEGACY_INTENSITY_KEY) || '')
      if (!hasNewData && !isNaN(legacyInten)) s.audioVisualizerIntensity = clamp01(legacyInten)
      if (legacyEn !== null) localStorage.removeItem(LEGACY_ENABLED_KEY)
      if (localStorage.getItem(LEGACY_INTENSITY_KEY) !== null) {
        localStorage.removeItem(LEGACY_INTENSITY_KEY)
      }

      this.$patch(s)
      this.persist()
      syncEQ(this.eqEnabled, this.eqBands)
    },

    persist() {
      const data: SettingsState = {
        visualizerEnabled: this.visualizerEnabled,
        audioVisualizerIntensity: this.audioVisualizerIntensity,
        audioQuality: this.audioQuality,
        eqEnabled: this.eqEnabled,
        eqBands: this.eqBands.slice(),
        eqPreset: this.eqPreset,
        windowControlsEnabled: this.windowControlsEnabled,
        lyricDisplayMode: this.lyricDisplayMode
      }
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(data))
      } catch (e) {
        console.warn('[Settings] 持久化失败:', e)
      }
    },

    // ===== 可视化 =====
    setVisualizerEnabled(v: boolean) {
      this.visualizerEnabled = !!v
      this.persist()
    },
    setAudioVisualizerIntensity(v: number) {
      this.audioVisualizerIntensity = Math.max(0, Math.min(1, Number(v) || 0))
      this.persist()
    },

    // ===== 播放音质 =====
    setAudioQuality(q: AudioQuality) {
      if (!QUALITIES.includes(q)) return
      this.audioQuality = q
      this.persist()
    },

    // ===== 均衡器 =====
    setEQEnabled(enabled: boolean) {
      this.eqEnabled = !!enabled
      syncEQ(this.eqEnabled, this.eqBands)
      this.persist()
    },
    /** 应用预置：立即写 store/引擎（live 动作） */
    applyEQPreset(presetKey: string) {
      if (!EQ_PRESETS[presetKey]) return
      this.eqPreset = presetKey
      this.eqBands = EQ_PRESETS[presetKey].slice()
      syncEQ(this.eqEnabled, this.eqBands)
      this.persist()
    },
    /** 提交用户在 10 个滑块上的草稿值 */
    commitEQBands(bands: number[]) {
      this.eqBands = normalizeBands(bands)
      // 与任一预置完全一致则回显预置名，否则标记为自定义
      const matched = EQ_PRESET_KEYS.find((k) =>
        EQ_PRESETS[k].every((v, i) => Math.abs(v - this.eqBands[i]) < 0.001)
      )
      this.eqPreset = matched || 'custom'
      syncEQ(this.eqEnabled, this.eqBands)
      this.persist()
    },
    /** 重置：开启 + 默认预置 + 全部 0dB */
    resetEQ() {
      this.eqEnabled = true
      this.eqPreset = 'flat'
      this.eqBands = EQ_PRESETS.flat.slice()
      syncEQ(true, this.eqBands)
      this.persist()
    },

    // ===== 窗口 =====
    setWindowControlsEnabled(v: boolean) {
      this.windowControlsEnabled = !!v
      this.persist()
    },

    // ===== 歌词 =====
    setLyricDisplayMode(mode: LyricDisplayMode) {
      if (!LYRIC_MODES.includes(mode)) return
      this.lyricDisplayMode = mode
      this.persist()
    }
  }
})
