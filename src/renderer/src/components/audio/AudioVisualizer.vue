<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { getAnalyser, isAnalyserReady } from '../../utils/audioAnalyser'

/**
 * 大屏播放页音频频谱可视化（移植 pink-music AudioVisualizer.vue）。
 * - 横向居中频谱条，左右镜像，中心对应低频（"鼓点在中央"），主题色 glow。
 * - 深色较高透明度+glow；浅色降透明度；Apple Music 主题背景透明让封面衬底露出来。
 * - 暂停时条形平滑下滑到 0。
 * 颜色读 CSS 变量 --brand，主题切换用 MutationObserver 监听 class/数据属性自动重读。
 */
const domCanvas = ref<HTMLCanvasElement | null>(null)

// === 主题色（懒读 + MutationObserver 监听主题变化） ===
let themeColor = ''
let isDark = true
let isAppleMusic = false

function readTheme() {
  const style = getComputedStyle(document.documentElement)
  themeColor = (style.getPropertyValue('--brand') || '#FF69B4').trim()
  isDark = !document.documentElement.classList.contains('light')
  isAppleMusic = document.documentElement.getAttribute('data-color') === 'apple-music'
}

// === 渲染状态 ===
let ctx: CanvasRenderingContext2D | null = null
let bufferLength = 0
let dataArray: Uint8Array<ArrayBuffer> | null = null
let WIDTH = 0
let HEIGHT = 0
let midX = 0
let baseY = 0
let maxBarHeight = 0
let isPlaying = false
let animationId: number | null = null
let resizeObserver: ResizeObserver | null = null
let themeObserver: MutationObserver | null = null

// 平滑后的频谱值（让条形不会跳变）
const smoothed: number[] = []
const SMOOTH_FACTOR_DOWN = 0.18 // 下落慢一点，音乐感更强
const SMOOTH_FACTOR_UP = 0.55

function resizeCanvas() {
  const canvas = domCanvas.value
  if (!canvas || !ctx) return
  const rect = canvas.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.max(1, Math.floor(rect.width * dpr))
  canvas.height = Math.max(1, Math.floor(rect.height * dpr))
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  WIDTH = rect.width
  HEIGHT = rect.height
  midX = WIDTH / 2
  baseY = HEIGHT * 0.97
  maxBarHeight = HEIGHT * 0.18
}

function ensureDataArray() {
  const analyser = getAnalyser()
  if (!analyser) {
    bufferLength = 0
    dataArray = null
    return false
  }
  if (bufferLength !== analyser.frequencyBinCount) {
    bufferLength = analyser.frequencyBinCount
    dataArray = new Uint8Array(bufferLength)
    for (let i = 0; i < bufferLength; i++) smoothed[i] = 0
  }
  return true
}

function drawFrame() {
  if (!ctx || !WIDTH) {
    animationId = null
    return
  }

  const analyser = getAnalyser()
  if (!analyser || !dataArray) {
    ctx.clearRect(0, 0, WIDTH, HEIGHT)
    animationId = null
    return
  }

  analyser.getByteFrequencyData(dataArray)

  // 残影拖尾
  ctx.fillStyle = isDark ? 'rgba(10, 10, 20, 0.22)' : 'rgba(248, 250, 252, 0.28)'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // 取前 128 个 bin
  const startBin = 2
  const endBin = Math.min(bufferLength, 128)
  const usable = endBin - startBin
  if (usable <= 0) {
    animationId = isPlaying ? requestAnimationFrame(drawFrame) : null
    return
  }

  const totalCount = 64
  const step = WIDTH / totalCount
  const realBarWidth = Math.max(2, Math.floor(step * 0.55))
  const realGap = Math.floor(step - realBarWidth)
  const half = totalCount / 2

  ctx.shadowBlur = isDark ? 14 : 0
  ctx.shadowColor = themeColor
  ctx.globalAlpha = isDark ? 0.75 : 0.35
  ctx.fillStyle = themeColor

  let peak = 0
  for (let i = 0; i < totalCount; i++) {
    const distFromCenter = Math.abs(i - half + 0.5) / half
    const bandIdx = Math.floor(distFromCenter * half)
    const segStart = startBin + Math.floor((bandIdx * usable) / half)
    const segEnd = startBin + Math.floor(((bandIdx + 1) * usable) / half)
    let sum = 0
    let n = 0
    for (let k = segStart; k < segEnd && k < bufferLength; k++) {
      sum += dataArray[k]
      n++
    }
    const raw = n > 0 ? sum / n : 0
    const prev = smoothed[i] || 0
    const next = raw >= prev
      ? prev + (raw - prev) * SMOOTH_FACTOR_UP
      : prev + (raw - prev) * SMOOTH_FACTOR_DOWN
    smoothed[i] = next
    if (next > peak) peak = next

    const boosted = Math.sqrt(next / 255)
    const h = Math.max(2, boosted * maxBarHeight * 1.6)
    const y = baseY - h
    const x = Math.floor(i * step + realGap / 2)
    ctx.fillRect(x, y, realBarWidth, h)
  }

  // 中心高亮：峰值"心跳"
  const peakH = Math.max(2, Math.sqrt(peak / 255) * maxBarHeight * 1.6)
  ctx.shadowBlur = isDark ? 22 : 0
  ctx.fillRect(midX - 2, baseY - peakH, 4, peakH)
  ctx.shadowBlur = 0
  ctx.globalAlpha = 1

  animationId = isPlaying ? requestAnimationFrame(drawFrame) : null
}

function start() {
  if (animationId) return
  if (!ensureDataArray()) return
  isPlaying = true
  animationId = requestAnimationFrame(drawFrame)
}

function stop() {
  isPlaying = false
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
}

// analyser 延迟就绪，轮询启动
let checkInterval: ReturnType<typeof setInterval> | null = null
function watchAnalyserReady() {
  if (checkInterval) return
  checkInterval = setInterval(() => {
    if (!isAnalyserReady()) return
    if (checkInterval) clearInterval(checkInterval)
    checkInterval = null
    if (!isPlaying) start()
  }, 200)
}

onMounted(() => {
  readTheme()
  const canvas = domCanvas.value
  if (!canvas) return
  ctx = canvas.getContext('2d')
  resizeCanvas()

  resizeObserver = new ResizeObserver(() => resizeCanvas())
  resizeObserver.observe(canvas)

  themeObserver = new MutationObserver(() => readTheme())
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-color']
  })

  if (isAnalyserReady()) start()
  else watchAnalyserReady()
})

onBeforeUnmount(() => {
  stop()
  if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null }
  if (themeObserver) { themeObserver.disconnect(); themeObserver = null }
  if (checkInterval) { clearInterval(checkInterval); checkInterval = null }
})

defineExpose({ start, stop })
</script>

<template>
  <div :class="['audio-visualizer', { 'is-dark': isDark, 'is-light': !isDark, 'is-apple-music': isAppleMusic }]">
    <div class="audio-visualizer-base"></div>
    <canvas ref="domCanvas" class="audio-visualizer-canvas"></canvas>
  </div>
</template>

<style scoped>
.audio-visualizer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
  background: linear-gradient(180deg, #0a0a14 0%, #14102a 100%);
  overflow: hidden;
  transition: background 0.3s ease;
}
.audio-visualizer.is-light {
  background: linear-gradient(180deg, #FAFAFC 0%, #F0E8F4 100%);
}
.audio-visualizer.is-apple-music {
  background: transparent !important;
}
.audio-visualizer.is-apple-music .audio-visualizer-base {
  display: none !important;
}
.audio-visualizer-base {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at 50% 100%,
    var(--brand, #FF69B4) 0%,
    transparent 60%
  );
  opacity: 0.18;
  mix-blend-mode: screen;
  transition: opacity 0.3s ease;
}
.audio-visualizer.is-light .audio-visualizer-base {
  opacity: 0.12;
  mix-blend-mode: multiply;
}
.audio-visualizer-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>