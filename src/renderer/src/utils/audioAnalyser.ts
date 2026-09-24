/**
 * 音频分析器单例：把 <audio> 元素接到 Web Audio API 的音频图。
 *
 * 信号链路（含 EQ 与安全限幅压缩器）：
 *   MediaElementSource → EQ 输入增益 → [10× peaking BiquadFilter] → EQ 输出增益
 *                    → AnalyserNode(fftSize=256)
 *                    → DynamicsCompressor（防 EQ 正增益削波）
 *                    → ctx.destination
 * AnalyserNode 是直通节点，放在链尾读到的是 EQ 后频谱，不影响声音。
 *
 * 关键约束：
 * 1. 一份 <audio> 只能 createMediaElementSource 一次（本应用 audio 是模块级单例）。
 * 2. AudioContext 受自动播放策略约束，须由用户手势创建/resume——首次播放/打开大屏时 lazy 创建。
 * 3. 跨源电台：必须 media 带 CORS 头 + audio.crossOrigin='anonymous'，否则 analyser 读到零（见主进程 biliaudio 协议）。
 * 4. EQ 链是 ctx 级单例，切歌重建 source 时 EQ 配置保持（增益由 settings store 经 audioEQ.setEQTargetState 驱动）。
 */

import { initEQ, destroyEQ } from './audioEQ'

let audioContext: AudioContext | null = null
let currentSource: MediaElementAudioSourceNode | null = null
let currentAudio: HTMLAudioElement | null = null
let analyser: AnalyserNode | null = null
let compressor: DynamicsCompressorNode | null = null

function ensureContext(): AudioContext | null {
  if (audioContext) return audioContext
  const Ctor = window.AudioContext || (window as any).webkitAudioContext
  if (!Ctor) return null
  audioContext = new Ctor()
  return audioContext
}

/**
 * 把一个 HTMLAudioElement 接到音频图（同一元素重复调用直接复用）。
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

  // 同一个 audio 元素重复调用时直接复用旧 source（整图单例，不重建）
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
    if (compressor) {
      try { compressor.disconnect() } catch (_) {}
    }

    currentAudio = audioEl
    currentSource = ctx.createMediaElementSource(audioEl)
    analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.75

    // EQ 链（initEQ 幂等，已建过则复用，增益状态由 settings store 保持）
    const eq = initEQ(ctx)

    // 安全限幅压缩器：EQ 正增益可能削波
    compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = -6
    compressor.knee.value = 6
    compressor.ratio.value = 4
    compressor.attack.value = 0.003
    compressor.release.value = 0.25

    // 接线：source → (EQ 链) → analyser → compressor → destination
    if (eq) {
      currentSource.connect(eq.input)
      eq.output.connect(analyser)
    } else {
      // EQ 初始化失败时降级直连，保证有声音
      currentSource.connect(analyser)
    }
    analyser.connect(compressor)
    compressor.connect(ctx.destination)
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
  try { if (compressor) compressor.disconnect() } catch (_) {}
  destroyEQ()
  if (audioContext) {
    audioContext.close().catch(() => {})
  }
  audioContext = null
  currentSource = null
  currentAudio = null
  analyser = null
  compressor = null
}
