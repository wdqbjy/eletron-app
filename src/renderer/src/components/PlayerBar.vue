<template>
  <div class="player-bar app-region-no-drag">
    <!-- 左侧：当前歌曲封面 + 信息（current-track） -->
    <div class="current-track">
      <button
        class="current-cover"
        title="查看歌词"
        :disabled="!current"
        @click="player.setShowPlayerPage(true)"
      >
        <img
          v-if="current?.cover"
          :src="current.cover"
          :alt="current.title"
          class="cover-img"
          @error="onCoverError"
        />
        <span v-else class="cover-letter">{{ current?.title ? current.title.charAt(0) : '♪' }}</span>
      </button>
      <div class="current-info">
        <h4 class="title">{{ current?.title || '未在播放' }}</h4>
        <p class="author">{{ subtitle }}</p>
      </div>
    </div>

    <!-- 中间：控制键 + 进度条 -->
    <div class="player-controls">
      <div class="control-buttons">
        <button
          class="control-btn mode-btn"
          :class="{ active: player.playMode !== 'order' }"
          :title="player.playModeLabel"
          @click="player.togglePlayMode()"
        >
          <span class="mode-icon" v-html="player.playModeIcon"></span>
        </button>
        <button class="control-btn" title="上一首" :disabled="!current" @click="playerApi.playPrevious()">
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
        </button>
        <button
          class="control-btn play"
          :disabled="!current || player.isLoading"
          :title="player.isPlaying ? '暂停' : '播放'"
          @click="playerApi.togglePlayPause()"
        >
          <span v-if="player.isLoading" class="mini-spinner"></span>
          <svg v-else-if="player.isPlaying" viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>
          <svg v-else viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M8 5v14l11-7z"/></svg>
        </button>
        <button class="control-btn" title="下一首" :disabled="!current" @click="playerApi.playNext()">
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
        </button>
        <!-- 隐形占位：与左侧模式按钮等宽，使播放按钮精确居于行的正中（即播放器水平中心） -->
        <span class="control-spacer" aria-hidden="true"></span>
      </div>

      <div class="progress-container">
        <span class="progress-time">{{ player.progressTime }}</span>
        <div class="progress-track" ref="trackEl" @click="onTrackClick">
          <div class="progress-buffer" :style="{ width: player.buffered + '%' }"></div>
          <div class="progress-fill" :style="{ width: player.progressPct + '%' }"></div>
        </div>
        <span class="progress-time">{{ player.totalTime }}</span>
      </div>
      <p v-if="player.audioError" class="player-error">{{ player.audioError }}</p>
    </div>

    <!-- 右侧：音量控制 + 操作（歌单 / 播放队列）。宽度与左侧对等，使中间控制区真正居中 -->
    <div class="player-actions">
      <div class="volume-control">
        <button
          class="action-btn volume-btn"
          :title="player.volume === 0 ? '取消静音' : '静音'"
          @click="playerApi.toggleMute()"
        >
          <svg v-if="player.volume === 0" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
            <path d="M11 5 6 9H3v6h3l5 4z"/>
            <line x1="22" y1="9" x2="16" y2="15"/>
            <line x1="16" y1="9" x2="22" y2="15"/>
          </svg>
          <svg v-else-if="volumeVal < 0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
            <path d="M11 5 6 9H3v6h3l5 4z"/>
            <path d="M15.5 8.5a5 5 0 0 1 0 7"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
            <path d="M11 5 6 9H3v6h3l5 4z"/>
            <path d="M15.5 8.5a5 5 0 0 1 0 7"/>
            <path d="M18.5 5.5a9 9 0 0 1 0 13"/>
          </svg>
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="volumeVal"
          class="volume-slider"
          :style="{ '--vol-pct': volumeVal * 100 + '%' }"
          title="音量"
          @input="onVolumeInput"
        />
      </div>
      <button class="action-btn" title="添加到歌单" :disabled="!current" @click="openPlaylistModal">
        <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
      </button>
      <button
        class="action-btn"
        :class="{ active: player.showQueuePanel }"
        title="播放队列"
        @click="player.toggleQueuePanel()"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
          <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
          <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>
      </button>
    </div>
    <!-- 播放队列面板（点右上列表面板图标弹出） -->
    <QueuePanel v-if="player.showQueuePanel" />
  </div>

  <!-- 添加到歌单 / 歌单管理弹窗 -->
  <PlaylistManager v-if="playlistStore.showPlaylistModal" />
  <!-- 多P卡片「添加到歌单」分P选择弹窗 -->
  <AddPMusicModal v-if="playlistStore.showPAddModal" />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { usePlayerStore } from '../stores/player'
import { usePlaylistStore } from '../stores/playlist'
import { useAudioPlayer } from '../composables/useAudioPlayer'
import QueuePanel from './QueuePanel.vue'
import PlaylistManager from './PlaylistManager.vue'
import AddPMusicModal from './AddPMusicModal.vue'

const player = usePlayerStore()
const playerApi = useAudioPlayer()
const playlistStore = usePlaylistStore()

const current = computed(() => player.current)

function openPlaylistModal() {
  if (!current.value) return
  playlistStore.openPlaylistModal(current.value)
}
const subtitle = computed(() => (current.value ? current.value.author : '从首页推荐点击播放歌曲'))

const trackEl = ref<HTMLDivElement | null>(null)

function onTrackClick(e: MouseEvent): void {
  if (!trackEl.value || !current.value) return
  const rect = trackEl.value.getBoundingClientRect()
  const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
  playerApi.seekToTime(ratio * player.duration)
}

/** 本地镜像音量：滑块由本地 ref 驱动，避免 :value 直接绑 store 造成拖动往返卡顿 */
const volumeVal = ref(player.volume)
function onVolumeInput(e: Event): void {
  const v = parseFloat((e.target as HTMLInputElement).value)
  if (isNaN(v)) return
  volumeVal.value = v
  playerApi.setVolume(v)
}
// 静音/取消静音等来自 store 的变化反向同步到滑块
watch(
  () => player.volume,
  (v) => {
    if (Math.abs(v - volumeVal.value) > 0.001) volumeVal.value = v
  }
)

const onCoverError = (e: Event): void => {
  ;(e.target as HTMLImageElement).style.display = 'none'
}
</script>

<style scoped>
.player-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 72px;
  z-index: 800;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 20px;
  /* 顶部一线品牌色晕 + 与页面同源的磨砂底色：深浅模式 / 主题色整体联动 */
  background:
    linear-gradient(180deg,
      rgba(var(--brand-rgb), 0.1) 0%,
      rgba(var(--brand-rgb), 0.02) 42%,
      rgba(var(--brand-rgb), 0) 100%),
    rgba(var(--bg-rgb), 0.86);
  border-top: 1px solid var(--chrome-border);
  backdrop-filter: blur(20px) saturate(1.4);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
  transition: background 0.25s ease, border-color 0.25s ease;
}
.app-region-no-drag {
  -webkit-app-region: no-drag;
}
.current-track {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 200px;
  flex-shrink: 0;
  min-width: 0;
}
.current-cover {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  border: none;
  background: var(--brand-grad);
  color: #fff;
  font-size: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  cursor: pointer;
  padding: 0;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
.current-cover:hover:not(:disabled) {
  transform: scale(1.06);
  box-shadow: 0 4px 14px rgba(var(--brand-rgb), 0.35);
}
.current-cover:disabled {
  cursor: default;
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.current-info {
  min-width: 0;
}
.current-info .title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--chrome-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.current-info .author {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--chrome-text-faint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.player-controls {
  /* 绝对定位居中：相对整个播放器宽度真正居中，不受左右两侧内容宽度影响 */
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 460px;
  max-width: calc(100% - 440px);
}
.control-buttons {
  display: flex;
  align-items: center;
  gap: 14px;
  justify-content: center;
}
/* 与 .control-btn 同宽的隐形占位，平衡左侧模式按钮，保证播放键居中 */
.control-spacer {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
}
.control-btn {
  width: 34px;
  height: 34px;
  border: none;
  background: transparent;
  color: var(--chrome-text-soft);
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.16s ease, color 0.16s ease;
}
.control-btn:hover:not(:disabled) {
  background: var(--chrome-hover);
  color: var(--brand);
}
.mode-btn.active {
  color: var(--brand);
}
.mode-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}
.control-btn.play {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--brand-grad);
  color: #fff;
  box-shadow: 0 4px 16px rgba(var(--brand-rgb), 0.4);
}
.control-btn.play:hover:not(:disabled) {
  color: #fff;
  opacity: 0.9;
  transform: scale(1.05);
}
.control-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.mini-spinner {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--chrome-track-strong);
  border-top-color: var(--chrome-text);
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.progress-container {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  max-width: 460px;
}
.progress-time {
  font-size: 11px;
  color: var(--chrome-text-faint);
  font-variant-numeric: tabular-nums;
  min-width: 34px;
}
.progress-track {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--chrome-track);
  overflow: hidden;
  cursor: pointer;
  position: relative;
}
.progress-track:hover {
  height: 6px;
}
.progress-buffer {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: var(--chrome-track-strong);
  border-radius: 2px;
}
.progress-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: linear-gradient(90deg, var(--brand) 0%, var(--brand-2) 100%);
  border-radius: 2px;
}
.player-error {
  margin: 0;
  font-size: 11px;
  color: #ff6b6b;
  max-width: 460px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.player-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  flex-shrink: 0;
  width: auto;
}
.volume-control {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 6px;
  border-radius: 16px;
  transition: background 0.18s ease;
}
.volume-control:hover {
  background: var(--chrome-hover, rgba(255, 255, 255, 0.06));
}
.volume-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 96px;
  height: 6px;
  border-radius: 6px;
  /* 填充轨：品牌色到当前音量位置，之后为弱轨道色 */
  background: linear-gradient(
    to right,
    var(--brand, #ec6da4) 0%,
    var(--brand, #ec6da4) var(--vol-pct, 100%),
    var(--chrome-border, rgba(255, 255, 255, 0.18)) var(--vol-pct, 100%),
    var(--chrome-border, rgba(255, 255, 255, 0.18)) 100%
  );
  outline: none;
  cursor: pointer;
}
.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid var(--brand, #ec6da4);
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.35);
  transition: transform 0.12s ease;
}
.volume-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}
.volume-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid var(--brand, #ec6da4);
}
.action-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--chrome-text-soft);
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.action-btn:hover:not(:disabled) {
  background: var(--chrome-hover);
  color: var(--brand);
}
.action-btn.active {
  background: var(--chrome-hover);
  color: var(--brand);
}
.action-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
</style>