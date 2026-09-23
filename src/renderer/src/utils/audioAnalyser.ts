/**
 * 音频分析器单例：把 <audio> 元素接到 Web Audio API 的 AnalyserNode，
 * 供大屏播放页的频谱可视化（AudioVisualizer / AlbumRipple）读取。
 *
 * 移植自 pink-music utils/audioAnalyser.js，去掉 EQ 链（那是独立的"音效"功能）。
 * 信号链路：source → analyser → destination（analyser 必须连到 destination，
 * 否则 createMediaElementSource 会重路由音频，听不到声音）。
 *
 * 关键约束：
 * 1. 一份 <audio> 只能 createMediaElementSource 一次（本应用 audio 是模块级单例）。
 * 2. AudioContext 受自动播放策略约束，须由用户手势创建/resume——首次播放/打开大屏时 lazy 创建。
 * 3. 跨源电台：必须 media 带 CORS 头 + audio.crossOrigin='anonymous'，否则 analyser 读到零（见主进程 biliaudio 协议）。
 */

let audioContext: AudioContext | null = null
let currentSource: MediaElementAudioSourceNode | null = null
let currentAudio: HTMLAudioElement | null = null
let analyser: AnalyserNode | null = null

function ensureContext(): AudioContext | null {
  if (audioContext) return audioContext
  const Ctor = window.AudioContext || (window as any).webkitAudioContext
  if (!Ctor) return null
  audioContext = new Ctor()
  return audioContext
}

/**
 * 把一个 HTMLAudioElement 接到分析器（同一元素重复调用直接复用）。
 * 返回 analyser，失败返回 null。
 */
export function attachAudioAnalyser(audioEl: HTMLAudioElement | null): AnalyserNode | null {
  if (!audioEl) return null
  const ctx = ensureContext()
  if (!ctx) return null

  // 自动播放策略：很多浏览器要求 AudioContext 处于 running 状态
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }

  // 同一个 audio 元素重复调用时直接复用旧 source
  if (currentAudio === audioEl && currentSource && analyser) {
    return analyser
  }

  try {
    if (currentSource) {
      try { currentSource.disconnect() } catch (_) {}
    }
    if (analyser) {
      try { analyser.disconnect() } catch (_) {}
    }
    currentAudio = audioEl
    currentSource = ctx.createMediaElementSource(audioEl)
    analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.75
    // 必须接 destination，否则没有声音
    currentSource.connect(analyser)
    analyser.connect(ctx.destination)
    return analyser
  } catch (err) {
    console.error('[audioAnalyser] attach 失败:', err)
    return null
  }
}

export function getAnalyser(): AnalyserNode | null {
  return analyser
}

export function getAudioContext(): AudioContext | null {
  return audioContext
}

export function isAnalyserReady(): boolean {
  return !!analyser && !!currentAudio
}

/** 释放资源（应用退出时调用） */
export function destroyAudioAnalyser(): void {
  try { if (currentSource) currentSource.disconnect() } catch (_) {}
  try { if (analyser) analyser.disconnect() } catch (_) {}
  if (audioContext) {
    audioContext.close().catch(() => {})
  }
  audioContext = null
  currentSource = null
  currentAudio = null
  analyser = null
}