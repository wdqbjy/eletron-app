<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player'
import { useSettingsStore } from '../stores/settings'
import { useLyricStore } from '../stores/lyric'
import { useAudioPlayer } from '../composables/useAudioPlayer'
import { formatDuration, fixCoverUrl } from '../utils/bilibili'
import { COVER_FALLBACK } from '../utils/coverFallback'
import LyricDisplay from './player/LyricDisplay.vue'
import AudioVisualizer from './audio/AudioVisualizer.vue'
import AlbumRipple from './audio/AlbumRipple.vue'

/**
 * 点播放器封面弹出的歌词大「播放页」：
 * 左=大封面（带低音波纹）+标题+进度+控制，右=歌词；整屏背景为音频频谱可视化
 * （可视化关闭时用当前封面模糊作背景）。v-if 由 player.showPlayerPage 驱动，
 * <Teleport to="body"> 挂到 body 下避免被应用内层叠上下文影响。
 */
const player = usePlayerStore()
const settings = useSettingsStore()
const lyricStore = useLyricStore()
const { togglePlayPause, playPrevious, playNext, seekToTime } = useAudioPlayer()

// 窗口控制
const winIpc = window as any
const isMaximized = ref(false)
// 与 TopBar 同一开关（mac 上主进程 frame:false 同样没有系统交通灯，需显示自定义按钮）
const showWindowControls = computed(() => settings.windowControlsEnabled !== false)

const checkMaximized = async (): Promise<void> => {
  if (winIpc.electronMyAPI) {
    try {
      isMaximized.value = await winIpc.electronMyAPI.isMaximized()
    } catch (err) {
      console.error('Failed to get window state:', err)
    }
  }
}

const handleMinimize = (): void => winIpc.electronMyAPI && winIpc.electronMyAPI.minimize()
const handleMaximize = (): void => {
  if (winIpc.electronMyAPI) {
    winIpc.electronMyAPI.maximize()
    setTimeout(checkMaximized, 100)
  }
}
const handleClose = (): void => winIpc.electronMyAPI && winIpc.electronMyAPI.close()

let resizeTimer: ReturnType<typeof setTimeout> | null = null
const handleResize = (): void => {
  if (resizeTimer) clearTimeout(resizeTimer)
  resizeTimer = setTimeout(checkMaximized, 100)
}

onMounted(() => {
  checkMaximized()
  window.addEventListener('resize', handleResize)
})
onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (resizeTimer) clearTimeout(resizeTimer)
})

// 拖动期间禁用 .progress-fill 的 transition
const isSeeking = ref(false)
function onSeekStart() { isSeeking.value = true }
function onSeekEnd() { isSeeking.value = false }

function closePlayerPage() {
  player.setShowPlayerPage(false)
}

function seekTo(timeSec: number) {
  seekToTime(timeSec)
}

function onProgressInput(e: Event) {
  // 点击轨道/拖动中即时 seek：Electron(Chromium) 点击轨道只触发 input、
  // 不触发 change，seek 只绑 change 会导致点击进度条永远不生效
  seekTo(Number((e.target as HTMLInputElement).value))
}
function onProgressChange(e: Event) {
  seekTo(Number((e.target as HTMLInputElement).value))
}

// 封面兜底图
function cover(url: string): string {
  return fixCoverUrl(url)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="pp">
      <div v-if="player.showPlayerPage && player.current" class="player-page" @click="closePlayerPage">
        <!-- 顶部轨道小封面：供歌词 low 模式下仍能看到封面手感；这里做整屏可视化背景 -->
        <div v-if="!settings.visualizerEnabled" class="player-page-cover-bg" aria-hidden="true">
          <img :src="cover(player.current.cover)" @error="($event.target as HTMLImageElement).style.display = 'none'">
        </div>

        <!-- 音频频谱可视化背景 -->
        <AudioVisualizer v-if="settings.visualizerEnabled" />

        <!-- 返回 -->
        <button class="back-btn" @click.stop="closePlayerPage">
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
          <span>返回</span>
        </button>

        <!-- 窗口控制（与返回按钮同一水平线，右上角；随「窗口设置」开关隐藏，macOS 用系统交通灯） -->
        <div v-if="showWindowControls" class="window-controls" @click.stop>
          <button class="wc-btn" @click="handleMinimize" title="最小化">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M4 12H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
          <button class="wc-btn" @click="handleMaximize" :title="isMaximized ? '还原' : '最大化'">
            <svg v-if="!isMaximized" width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M3 3H21V21H3V3Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
            </svg>
            <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M5 5H19V19H5V5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
              <path d="M8 2V5M16 2V5M8 19V22M16 19V22" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
          <button class="wc-btn wc-close" @click="handleClose" title="关闭">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
        </div>

        <!-- 主体 -->
        <div class="player-page-content" @click.stop>
          <div class="player-page-layout">
            <!-- 左：封面 + 标题 + 进度 + 控制 -->
            <div class="player-page-left">
              <div class="album-art-zone">
                <div class="album-art">
                  <img
                    :src="cover(player.current.cover)"
                    :alt="player.current.title"
                    @error="($event.target as HTMLImageElement).src=COVER_FALLBACK"
                  >
                </div>
                <AlbumRipple
                  v-if="settings.visualizerEnabled"
                  :intensity="settings.audioVisualizerIntensity"
                />
              </div>

              <div class="track-info">
                <h2 class="track-title">{{ player.current.title }}</h2>
                <h3 class="track-artist">{{ player.current.author }}</h3>
              </div>

              <div class="big-progress">
                <div class="progress-container">
                  <span class="progress-time">{{ formatDuration(player.currentTime) }}</span>
                  <div class="progress-bar-wrapper" :class="{ seeking: isSeeking }">
                    <input
                      type="range"
                      min="0"
                      :max="player.duration || 100"
                      :value="player.currentTime"
                      @input="onProgressInput"
                      @change="onProgressChange"
                      @pointerdown="onSeekStart"
                      @pointerup="onSeekEnd"
                      @pointercancel="onSeekEnd"
                      class="progress-slider"
                    />
                    <div class="progress-bar">
                      <div
                        class="progress-fill"
                        :style="{ width: (player.duration > 0 ? (player.currentTime / player.duration) * 100 : 0) + '%' }"
                      ></div>
                    </div>
                  </div>
                  <span class="progress-time">{{ formatDuration(player.duration) }}</span>
                </div>
              </div>

              <div class="big-control-buttons">
                <div class="big-control-row">
                  <div class="big-control-side">
                    <button
                      class="big-control-btn"
                      :class="{ active: player.playMode !== 'order' }"
                      :title="player.playModeLabel"
                      @click="player.togglePlayMode()"
                    >
                      <span class="mode-icon" v-html="player.playModeIcon"></span>
                    </button>
                    <button class="big-control-btn" @click="playPrevious">
                      <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
                    </button>
                  </div>
                  <button class="big-control-btn play" @click="togglePlayPause">
                    <svg v-if="player.isPlaying" viewBox="0 0 24 24" fill="currentColor" width="30" height="30"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                    <svg v-else viewBox="0 0 24 24" fill="currentColor" width="30" height="30"><path d="M8 5v14l11-7z"/></svg>
                  </button>
                  <div class="big-control-side">
                    <button class="big-control-btn" @click="playNext">
                      <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                    </button>
                    <!-- 与左侧模式按钮等宽的隐形占位，使播放键居中（与主播放器栏一致） -->
                    <span class="big-control-spacer" aria-hidden="true"></span>
                  </div>
                </div>

                <!-- 歌词校准（±0.5s，按曲目记忆）：放在播放操作下方 -->
                <div class="lyric-cal-row">
                  <button class="cal-btn" title="歌词延后 0.5s" @click="lyricStore.adjustLyricOffset(-500)">« 0.5s</button>
                  <button
                    class="cal-badge"
                    :class="{ adjusted: lyricStore.currentOffset !== 0 }"
                    title="歌词偏移量，点击归零"
                    @click="lyricStore.resetLyricOffset()"
                  >
                    {{ lyricStore.currentOffset > 0 ? '+' : '' }}{{ (lyricStore.currentOffset / 1000).toFixed(1) }}s
                  </button>
                  <button class="cal-btn" title="歌词提前 0.5s（歌词比歌声慢就点这边）" @click="lyricStore.adjustLyricOffset(500)">0.5s »</button>
                </div>
              </div>
            </div>

            <!-- 右：歌词 -->
            <div class="player-page-right">
              <LyricDisplay :currentTime="player.currentTime" :onSeek="seekTo" :large="true" />
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.player-page {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.85);
  z-index: 1000;
  overflow: hidden;
}
.pp-enter-active, .pp-leave-active { transition: opacity 0.25s ease; }
.pp-enter-from, .pp-leave-to { opacity: 0; }

/* 可视化关闭时的模糊封面背景 */
.player-page-cover-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background: #0a0a14;
}
.player-page-cover-bg img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.35;
  filter: blur(60px) saturate(1.2);
  transform: scale(1.2);
}

.back-btn {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 18px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 13px;
  cursor: pointer;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  transition: background 0.2s;
}
.back-btn:hover { background: rgba(0, 0, 0, 0.55); }

/* 窗口控制：与主窗口 TopBar 完全一致（扁平、无药丸背景、34×44 矩形按钮） */
.window-controls {
  position: absolute;
  top: 0px;
  right: 0px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 2px;
  padding-left: 8px;
  margin-left: 8px;
}
.wc-btn {
  width: 34px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--chrome-text-soft);
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease;
}
.wc-btn:hover {
  background: var(--chrome-hover);
  color: var(--chrome-text);
}
/* 与 TopBar 一致的按压/微缩放反馈 */
.wc-btn svg {
  transition: transform 0.16s ease;
}
.wc-btn:hover svg {
  transform: scale(1.08);
}
.wc-btn:active svg {
  transform: scale(0.82);
}
.wc-btn:focus-visible {
  outline: 2px solid var(--brand, #ec6da4);
  outline-offset: -2px;
  border-radius: 6px;
}
.wc-btn.wc-close:hover {
  background: #e81123;
  color: #ffffff;
}
.wc-btn.wc-close:active {
  background: #c50f1f;
  color: #ffffff;
}

.player-page-content {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ===== 分P列表(合集) 已移除 ===== */

.player-page-layout {
  display: grid;
  grid-template-columns: minmax(0, 420px) minmax(0, 1fr);
  gap: 48px;
  align-items: center;
  width: 100%;
  max-width: 1000px;
  padding: 0 40px;
  /* 整体上移一点 */
  transform: translateY(-12px);
}

/* ===== 左栏 ===== */
.player-page-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}
.album-art-zone {
  position: relative;
  width: 300px;
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.album-art {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 16px 46px rgba(0, 0, 0, 0.5);
  background: var(--brand-grad);
}
.album-art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.track-info { text-align: center; }
.track-title {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  margin: 0;
  line-height: 1.35;
  max-width: 420px;
}
.track-artist {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  margin: 4px 0 0;
}

.big-progress {
  width: 100%;
  max-width: 380px;
  /* 进度条上移，封面/波纹保持原位 */
  transform: translateY(-14px);
}
.progress-container {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}
.progress-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  min-width: 34px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.progress-bar-wrapper { flex: 1; position: relative; height: 4px; }
.progress-slider {
  position: absolute;
  left: 0;
  top: 50%;
  width: 100%;
  /* 隐形命中区扩到 16px（视觉条仍 4px）：点击/拖动不再难点中 */
  height: 16px;
  transform: translateY(-50%);
  margin: 0;
  opacity: 0;
  cursor: pointer;
  z-index: 2;
}
.progress-bar {
  position: absolute;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
}
.progress-fill {
  position: absolute;
  height: 100%;
  background: var(--brand-grad);
  border-radius: 2px;
  transition: width 0.1s linear;
}
.progress-bar-wrapper.seeking .progress-fill { transition: none; }

.big-control-buttons {
  width: 100%;
  /* 播放操作（含校准行）上移，封面/波纹保持原位 */
  transform: translateY(-14px);
}

/* 歌词校准行（±0.5s）：播放操作下方，低调半透明 */
.lyric-cal-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 16px;
}
.cal-btn {
  padding: 5px 12px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s;
}
.cal-btn:hover {
  color: #fff;
  background: var(--brand, #ec6da4);
  border-color: transparent;
}
.cal-badge {
  min-width: 52px;
  padding: 5px 10px;
  font-size: 12px;
  text-align: center;
  color: rgba(255, 255, 255, 0.45);
  background: transparent;
  border: 1px dashed rgba(255, 255, 255, 0.18);
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s;
}
.cal-badge:hover { color: #fff; border-color: rgba(255, 255, 255, 0.4); }
.cal-badge.adjusted {
  color: #fff;
  background: var(--brand-grad, linear-gradient(135deg, #f78bb8, #ec6da4));
  border-color: transparent;
}

.big-control-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
}
.big-control-side {
  display: flex;
  align-items: center;
  gap: 16px;
}
/* 与 .big-control-btn 等宽的隐形占位，平衡左侧模式按钮，保证播放键居中 */
.big-control-spacer {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
}
.big-control-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s, color 0.2s;
}
.big-control-btn:hover { transform: scale(1.1); color: #fff; }
.big-control-btn.active { color: var(--brand); }
.big-control-btn.play {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--brand-grad);
  color: #fff;
  box-shadow: 0 8px 24px rgba(var(--brand-rgb), 0.45);
}
.big-control-btn.play:hover { transform: scale(1.06); color: #fff; }
.mode-icon { display: flex; align-items: center; justify-content: center; }

/* ===== 右栏 ===== */
.player-page-right {
  min-height: 0;
  height: 100%;
  display: flex;
  align-items: center;
  /* 歌词列上移，底部不再贴边 */
  transform: translateY(-16px);
}

/* 浅色模式：文字颜色适配 */
.light .track-title { color: rgba(24, 24, 28, 0.9); }
.light .track-artist { color: rgba(40, 40, 46, 0.55); }
.light .progress-time { color: rgba(40, 40, 46, 0.55); }
.light .big-control-btn { color: rgba(40, 40, 46, 0.7); }
.light .back-btn {
  color: rgba(24, 24, 28, 0.85);
  background: rgba(255, 255, 255, 0.7);
  border-color: rgba(0, 0, 0, 0.1);
}
.light .window-controls {
  background: transparent;
  border: none;
}
</style>