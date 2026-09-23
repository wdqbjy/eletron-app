import { defineStore } from 'pinia'

const ENABLED_KEY = 'app-visualizer-enabled'
const INTENSITY_KEY = 'app-visualizer-intensity'

/**
 * 应用设置（对齐 pink-music stores/settings.js 的可视化部分）：
 * - visualizerEnabled：大屏播放页音频频谱可视化开关
 * - audioVisualizerIntensity：激进度 0-1（模糊/密度/触发阈值/环数）
 * 均 localStorage 持久化。
 */
export const useSettingsStore = defineStore('settings', {
  state: (): { visualizerEnabled: boolean; audioVisualizerIntensity: number } => ({
    visualizerEnabled: true,
    audioVisualizerIntensity: 0.6
  }),
  actions: {
    init() {
      const en = localStorage.getItem(ENABLED_KEY)
      if (en === '0') this.visualizerEnabled = false
      else if (en === '1') this.visualizerEnabled = true
      const inten = parseFloat(localStorage.getItem(INTENSITY_KEY) || '')
      if (!isNaN(inten) && inten >= 0 && inten <= 1) {
        this.audioVisualizerIntensity = inten
      }
    },
    setVisualizerEnabled(v: boolean) {
      this.visualizerEnabled = v
      localStorage.setItem(ENABLED_KEY, v ? '1' : '0')
    },
    setAudioVisualizerIntensity(v: number) {
      this.audioVisualizerIntensity = Math.max(0, Math.min(1, v))
      localStorage.setItem(INTENSITY_KEY, String(this.audioVisualizerIntensity))
    }
  }
})