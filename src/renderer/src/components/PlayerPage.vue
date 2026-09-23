<script setup lang="ts">
import { ref } from 'vue'
import { usePlayerStore } from '../stores/player'
import { useSettingsStore } from '../stores/settings'
import { useAudioPlayer } from '../composables/useAudioPlayer'
import { formatDuration, fixCoverUrl } from '../utils/bilibili'
import LyricDisplay from './player/LyricDisplay.vue'
import AudioVisualizer from './audio/AudioVisualizer.vue'
import AlbumRipple from './audio/AlbumRipple.vue'

/**
 * 点播放器封面弹出的歌词大「播放页」—— 对齐 pink-music App.vue 的大屏播放页：
 * 左=大封面（带低音波纹）+标题+进度+控制，右=歌词；整屏背景为音频频谱可视化
 * （可视化关闭时用当前封面模糊作背景）。v-if 由 player.showPlayerPage 驱动，
 * <Teleport to="body"> 挂到 body 下避免被应用内层叠上下文影响。
 */
const player = usePlayerStore()
const settings = useSettingsStore()
const { togglePlayPause, playPrevious, playNext, seekToTime } = useAudioPlayer()

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
  player.setCurrentTime(Number((e.target as HTMLInputElement).value))
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

        <!-- 返回 == -->
        <button class="back-btn" @click.stop="closePlayerPage">
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
          <span>返回</span>
        </button>

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
                    @error="($event.target as HTMLImageElement).src='https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400'"
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
                  </div>
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

.player-page-content {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.player-page-layout {
  display: grid;
  grid-template-columns: minmax(0, 420px) minmax(0, 1fr);
  gap: 48px;
  align-items: center;
  width: 100%;
  max-width: 1000px;
  padding: 0 40px;
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

.big-progress { width: 100%; max-width: 380px; }
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
  width: 100%;
  height: 100%;
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

.big-control-buttons { width: 100%; }
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
</style>