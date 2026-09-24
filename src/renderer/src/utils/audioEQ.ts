/**
 * 10 段图示均衡器引擎（Web Audio API）
 *
 * - 10 个 ISO 频点的 peaking BiquadFilter 串联，Q=1.0；
 * - 输入/输出各一个 GainNode 作为链的两端，音频图接入点；
 * - 关闭均衡器时不 bypass 节点，而是把全部频段 gain 平滑到 0dB（peaking 0dB 等于透明）；
 * - 增益变化用 setTargetAtTime(10ms) 平滑，避免咔哒爆音；
 * - 链为 AudioContext 级单例：切歌重建 MediaElementSource 时 EQ 配置保持。
 */

/** 10 个频点（Hz）与 UI 标签 */
export const EQ_BANDS: ReadonlyArray<{ freq: number; label: string }> = [
  { freq: 31, label: '31' },
  { freq: 62, label: '62' },
  { freq: 125, label: '125' },
  { freq: 250, label: '250' },
  { freq: 500, label: '500' },
  { freq: 1000, label: '1K' },
  { freq: 2000, label: '2K' },
  { freq: 4000, label: '4K' },
  { freq: 8000, label: '8K' },
  { freq: 16000, label: '16K' }
]

export const EQ_DB_MIN = -12
export const EQ_DB_MAX = 12
export const EQ_DB_STEP = 0.5
export const EQ_BAND_COUNT = EQ_BANDS.length

/** 预置增益（dB，长度 10）。bass 由原始 +8 降到 +5，给压缩器留头空间 */
export const EQ_PRESETS: Record<string, number[]> = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  pop: [-1, 2, 4, 4, 1, -1, -1, 1, 2, 3],
  rock: [4, 3, 1, 0, -1, -1, 1, 3, 4, 4],
  jazz: [3, 2, 1, 2, -1, -1, 0, 1, 2, 3],
  classical: [4, 3, 2, 0, 0, 0, -1, -1, -1, -2],
  electronic: [5, 3, 0, 0, -2, 1, 0, 1, 4, 5],
  vocal: [-2, -1, 0, 3, 5, 5, 3, 0, -1, -2],
  bass: [5, 4, 3, 1, 0, 0, 0, 0, 0, 0]
}

export const EQ_PRESET_KEYS = [
  'flat',
  'pop',
  'rock',
  'jazz',
  'classical',
  'electronic',
  'vocal',
  'bass'
]

export const EQ_PRESET_LABELS: Record<string, string> = {
  flat: '默认',
  pop: '流行',
  rock: '摇滚',
  jazz: '爵士',
  classical: '古典',
  electronic: '电子',
  vocal: '人声',
  bass: '低音增强'
}

let audioContext: BaseAudioContext | null = null
let eqInput: GainNode | null = null
let eqOutput: GainNode | null = null
let filters: BiquadFilterNode[] = []

/** AudioContext 尚未创建时的挂起状态，store 启动时同步，建链后一次性生效 */
let pendingEnabled = true
let pendingBands: number[] = EQ_PRESETS.flat.slice()

function clampDb(v: number): number {
  const n = Number(v)
  if (isNaN(n)) return 0
  return Math.max(EQ_DB_MIN, Math.min(EQ_DB_MAX, n))
}

/** 建链：eqInput → 10×peaking → eqOutput（幂等，同 ctx 只建一次） */
function buildChain(ctx: BaseAudioContext): void {
  const input = ctx.createGain()
  const output = ctx.createGain()
  const built = EQ_BANDS.map((band) => {
    const f = ctx.createBiquadFilter()
    f.type = 'peaking'
    f.frequency.value = band.freq
    f.Q.value = 1.0
    f.gain.value = 0
    return f
  })
  let node: AudioNode = input
  for (const f of built) {
    node.connect(f)
    node = f
  }
  node.connect(output)
  // 全部接好后再发布到模块单例，避免半链被外部读到
  eqInput = input
  eqOutput = output
  filters = built
}

/** 按 pending 状态把增益平滑写入滤波器 */
function applyToFilters(): void {
  if (!audioContext || filters.length === 0) return
  const now = audioContext.currentTime
  filters.forEach((f, i) => {
    // 关闭时目标一律 0dB（peaking 0dB 透明）
    const target = pendingEnabled ? clampDb(pendingBands[i] ?? 0) : 0
    f.gain.setTargetAtTime(target, now, 0.01)
  })
}

/**
 * 在给定 AudioContext 上初始化 EQ 单例（音频图首次接线时调用，幂等）。
 * 返回接入节点；失败返回 null 时调用方应直连 analyser。
 */
export function initEQ(ctx: BaseAudioContext): { input: GainNode; output: GainNode } | null {
  if (filters.length > 0 && audioContext === ctx && eqInput && eqOutput) {
    return { input: eqInput, output: eqOutput }
  }
  try {
    audioContext = ctx
    buildChain(ctx)
    applyToFilters()
    return eqInput && eqOutput ? { input: eqInput, output: eqOutput } : null
  } catch (e) {
    console.error('[audioEQ] init 失败:', e)
    return null
  }
}

/**
 * 更新 EQ 目标状态（store 任意写操作 / 启动同步时调用）。
 * Context 未就绪时只更新 pending，建链后自动生效。
 */
export function setEQTargetState(enabled: boolean, bands: number[]): void {
  pendingEnabled = !!enabled
  pendingBands = (bands && bands.length === EQ_BAND_COUNT ? bands : EQ_PRESETS.flat).map(clampDb)
  applyToFilters()
}

export function isEQReady(): boolean {
  return filters.length > 0 && !!eqInput && !!eqOutput
}

/** 释放 EQ 节点（AudioContext 关闭时一并调用） */
export function destroyEQ(): void {
  try {
    filters.forEach((f) => f.disconnect())
  } catch (_) {}
  try {
    eqInput?.disconnect()
  } catch (_) {}
  try {
    eqOutput?.disconnect()
  } catch (_) {}
  audioContext = null
  eqInput = null
  eqOutput = null
  filters = []
}
