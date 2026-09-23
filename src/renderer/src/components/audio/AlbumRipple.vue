<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { getAnalyser, isAnalyserReady } from '../../utils/audioAnalyser'

/**
 * 大屏播放页 · 封面周围扩散的音频波纹（移植 pink-music AlbumRipple.vue）。
 * 多个同心圆从封面中心向外扩散，整层 canvas 用 ctx.filter blur 模糊化，
 * 与歌词/封面形成主次分层。激进度 intensity 0-1 控制模糊/透明度/环密度/触发阈值。
 * Apple Music 主题隐藏波纹。
 */
const props = defineProps<{
  intensity?: number
}>()

const domCanvas = ref<HTMLCanvasElement | null>(null)

let ctx: CanvasRenderingContext2D | null = null
let WIDTH = 0
let HEIGHT = 0
let isDark = true
let themeColor = ''
let isAppleMusic = false

function readTheme() {
  const style = getComputedStyle(document.documentElement)
  themeColor = (style.getPropertyValue('--brand') || '#FF69B4').trim()
  isDark = !document.documentElement.classList.contains('light')
  isAppleMusic = document.documentElement.getAttribute('data-color') === 'apple-music'
}

const RING_LIFE = 1.6
const SPAWN_COOLDOWN = 0.25
const RIPPLE_MAX_RADIUS = 220

function getDerivedParams() {
  const t = Math.max(0, Math.min(1, props.intensity != null ? props.intensity : 0))
  const blurT = Math.pow(t, 0.7)
  const thresholdT = Math.sqrt(t)
  return {
    blurPx: 1.5 + blurT * 14.5,
    spawnThreshold: 0.6 - thresholdT * 0.45,
    alphaBoost: 0.4 + t * 1.2,
    maxRings: Math.round(2 + t * 8)
  }
}

interface Ring { startTime: number; intensity: number }
const rings: Ring[] = []
let lastSpawnTime = -Infinity
let lastEnergy = 0
let themeObserver: MutationObserver | null = null
let resizeObserver: ResizeObserver | null = null
let animationId: number | null = null
let startTimestamp = 0
let isActive = false
let dataArray: Uint8Array<ArrayBuffer> | null = null

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
}

function spawnRing(intensity: number) {
  const { maxRings } = getDerivedParams()
  const ring = rings.length < maxRings
    ? { startTime: performance.now() / 1000, intensity }
    : rings.shift()!
  ring.startTime = performance.now() / 1000
  ring.intensity = intensity
  rings.push(ring)
}

function getLowFreqEnergy() {
  const analyser = getAnalyser()
  if (!analyser) return 0
  const bins = analyser.frequencyBinCount
  if (!dataArray || dataArray.length !== bins) {
    dataArray = new Uint8Array(bins)
  }
  analyser.getByteFrequencyData(dataArray)
  let sum = 0
  const N = Math.min(8, bins)
  for (let i = 0; i < N; i++) sum += dataArray[i]
  return sum / N / 255
}

function drawFrame() {
  if (!ctx || !WIDTH) {
    animationId = null
    return
  }
  if (!startTimestamp) startTimestamp = performance.now()
  const tNow = performance.now() / 1000

  const { blurPx, spawnThreshold, alphaBoost } = getDerivedParams()

  const analyser = getAnalyser()
  if (analyser && dataArray) {
    const energy = getLowFreqEnergy()
    if (
      energy > spawnThreshold &&
      energy > lastEnergy + 0.05 &&
      tNow - lastSpawnTime > SPAWN_COOLDOWN
    ) {
      spawnRing(energy)
      lastSpawnTime = tNow
    }
    lastEnergy = energy
  }

  ctx.clearRect(0, 0, WIDTH, HEIGHT)
  const cx = WIDTH / 2
  const cy = HEIGHT / 2

  ctx.filter = `blur(${blurPx}px)`
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i]
    const age = tNow - ring.startTime
    if (age >= RING_LIFE) continue

    const lifeT = age / RING_LIFE
    const radius = lifeT < 0.25
      ? RIPPLE_MAX_RADIUS * (lifeT * 2.4)
      : RIPPLE_MAX_RADIUS * (0.6 + (lifeT - 0.25) * 0.57)

    const baseAlpha = Math.pow(1 - lifeT, 1.4) * ring.intensity * alphaBoost
    const alpha = baseAlpha * (isDark ? 0.9 : 0.55)

    const widthBoost = (Math.sin(lifeT * Math.PI) * 2 + 1.5) * (0.8 + alphaBoost * 0.4)
    ctx.lineWidth = widthBoost
    ctx.strokeStyle = themeColor
    ctx.globalAlpha = alpha

    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.filter = 'none'
  ctx.globalAlpha = 1

  for (let i = rings.length - 1; i >= 0; i--) {
    if (tNow - rings[i].startTime >= RING_LIFE) rings.splice(i, 1)
  }

  if (isActive) animationId = requestAnimationFrame(drawFrame)
}

function start() {
  if (animationId) return
  const analyser = getAnalyser()
  if (!analyser) return
  dataArray = new Uint8Array(analyser.frequencyBinCount)
  isActive = true
  startTimestamp = 0
  animationId = requestAnimationFrame(drawFrame)
}

function stop() {
  isActive = false
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
}

let checkInterval: ReturnType<typeof setInterval> | null = null
function watchAnalyser() {
  if (checkInterval) return
  checkInterval = setInterval(() => {
    if (!isAnalyserReady()) return
    if (checkInterval) clearInterval(checkInterval)
    checkInterval = null
    if (!isActive) start()
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
  else watchAnalyser()
})

onBeforeUnmount(() => {
  stop()
  if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null }
  if (themeObserver) { themeObserver.disconnect(); themeObserver = null }
  if (checkInterval) { clearInterval(checkInterval); checkInterval = null }
})
</script>

<template>
  <div
    :class="['album-ripple', { 'is-dark': isDark, 'is-light': !isDark, 'is-apple-music': isAppleMusic }]"
  >
    <canvas ref="domCanvas" class="album-ripple-canvas"></canvas>
  </div>
</template>

<style scoped>
.album-ripple {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 600px;
  height: 600px;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 0;
}
.album-ripple-canvas {
  display: block;
  width: 100%;
  height: 100%;
  will-change: filter;
  transform: translateZ(0);
}
.album-ripple.is-apple-music {
  display: none !important;
}
</style>