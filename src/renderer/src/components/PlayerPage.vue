<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player'
import { useSettingsStore } from '../stores/settings'
import { useAudioPlayer, buildEpisodes } from '../composables/useAudioPlayer'
import { getMusicEpisodes, getMusicInfo } from '../apis/bilibili'
import { formatDuration, fixCoverUrl } from '../utils/bilibili'
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
const { togglePlayPause, playPrevious, playNext, seekToTime, playMusic } = useAudioPlayer()

// 窗口控制
const winIpc = window as any
const isMaximized = ref(false)
// 与 TopBar 同一开关；macOS 用系统交通灯
const showWindowControls = computed(
  () =>
    !(/mac/i.test(navigator.platform || '') || /mac os x/i.test(navigator.userAgent)) &&
    settings.windowControlsEnabled !== false
)

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

// ===== 分P列表（合集）面板 =====
const showEpisodes = ref(false)
const episodesLoading = ref(false)

/** 分P列表面板是否展示当前视频的完整分P（合集>1集时自动可开） */
const isEpisodeMode = () => player.queueIsEpisodes && player.queue.length > 1

/** 当前播放的分P是否命中列表项（分P共用同一 bvid，须按 cid 区分） */
function isCurrentEpisode(ep: { cid?: number }): boolean {
  const c = player.current
  return !!c && !!(ep.cid) && ep.cid === c.cid
}

/** 打开面板：若队列尚未展开当前视频的分P，则主动拉取稿件的 pages 填充分P列表 */
async function toggleEpisodes() {
  const c = player.current
  if (!c) return
  if (showEpisodes.value) {
    showEpisodes.value = false
    return
  }
  showEpisodes.value = true
  if (player.queueIsEpisodes && player.queue[0]?.bvid === c.bvid) return // 已展开，直接用
  episodesLoading.value = true
  try {
    // 分P列表优先用专用接口 /x/player/pagelist，失败退回 view 的 data.pages
    let pages: Array<{ cid: number; part: string; duration: number }> = []
    try {
      const epRes = await getMusicEpisodes(c.bvid)
      if (epRes?.code === 0 && Array.isArray(epRes.data)) pages = epRes.data
    } catch (_) {}
    if (pages.length <= 1) {
      const info = await getMusicInfo(c.bvid)
      pages = info?.data?.pages ?? []
    }
    if (pages.length > 1) {
      player.setQueue(buildEpisodes(c, pages))
      player.setQueueIsEpisodes(true)
    }
  } catch (e) {
    console.error('[PlayerPage] 获取分P列表失败:', e)
  } finally {
    episodesLoading.value = false
  }
}

/** 点击某分P：切换到对应分P播放 */
function playEpisode(ep: any) {
  if (ep?.cid) playMusic(ep)
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

        <!-- 分P列表（合集）开关 -->
        <button class="eps-toggle" :class="{ active: showEpisodes }" @click.stop="toggleEpisodes" title="分P列表/歌单管理">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
          <span class="eps-toggle-label">{{ isEpisodeMode() ? player.queue.length + ' 集' : '分P列表' }}</span>
        </button>

        <!-- 分P列表面板 -->
        <div v-if="showEpisodes" class="eps-panel" @click.stop>
          <header class="eps-panel-head">
            <h3 class="eps-panel-title">分P列表</h3>
            <span v-if="isEpisodeMode()" class="eps-count">{{ player.queue.length }} 集</span>
            <button class="eps-close" title="关闭" @click="showEpisodes = false">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </header>
          <p v-if="episodesLoading" class="eps-empty">加载分P列表...</p>
          <ul v-else-if="isEpisodeMode()" class="eps-list">
            <li
              v-for="(ep, i) in player.queue"
              :key="(ep.cid ?? '') + '.' + i"
              class="eps-item"
              :class="{ active: isCurrentEpisode(ep) }"
              @click="playEpisode(ep)"
            >
              <span class="eps-idx">{{ i + 1 }}</span>
              <span class="eps-title">{{ ep.title }}</span>
              <span class="eps-dur">{{ formatDuration(ep.duration) }}</span>
            </li>
          </ul>
          <p v-else class="eps-empty">当前视频没有分P</p>
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

/* 窗口控制（右上角，与返回按钮同一水平线 top: 16px） */
.window-controls {
  position: absolute;
  top: 0px;
  right: 0px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  background: rgba(0, 0, 0, 0.35);
  border-radius: 18px;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.wc-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 28px;
  background: transparent;
  border: none;
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: background 0.18s, color 0.18s;
}
.wc-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}
.wc-btn.wc-close:hover {
  background: rgba(232, 17, 35, 0.7);
  color: #fff;
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

/* ===== 分P列表(合集) 开关 + 面板 ===== */
.eps-toggle {
  position: absolute;
  top: 16px;
  right: 128px;
  z-index: 12;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 18px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  cursor: pointer;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  transition: background 0.2s, color 0.2s;
}
.eps-toggle:hover, .eps-toggle.active {
  background: var(--brand-grad);
  border-color: transparent;
  color: #fff;
}
.eps-toggle-label { font-variant-numeric: tabular-nums; }

.eps-panel {
  position: absolute;
  top: 60px;
  right: 16px;
  z-index: 15;
  width: 340px;
  max-height: 66vh;
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  background: rgba(18, 18, 24, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 16px 44px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(18px) saturate(1.2);
  -webkit-backdrop-filter: blur(18px) saturate(1.2);
  overflow: hidden;
}
.eps-panel-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.eps-panel-title { margin: 0; font-size: 14px; font-weight: 600; color: #fff; flex: 1; }
.eps-count { font-size: 11px; color: rgba(255, 255, 255, 0.45); }
.eps-close {
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.eps-close:hover { background: rgba(255, 255, 255, 0.12); color: #fff; }
.eps-list {
  list-style: none;
  margin: 0;
  padding: 6px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.eps-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.82);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}
.eps-item:hover { background: rgba(255, 255, 255, 0.08); }
.eps-item.active {
  background: rgba(var(--brand-rgb), 0.22);
  color: #fff;
}
.eps-idx { width: 20px; text-align: center; font-size: 11px; color: rgba(255, 255, 255, 0.4); flex-shrink: 0; }
.eps-item.active .eps-idx { color: var(--brand); font-weight: 700; }
.eps-title { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.eps-dur { font-size: 11px; color: rgba(255, 255, 255, 0.4); font-variant-numeric: tabular-nums; flex-shrink: 0; }
.eps-empty { text-align: center; color: rgba(255, 255, 255, 0.45); font-size: 12px; padding: 26px 14px; }

.light .eps-toggle { color: rgba(24, 24, 28, 0.85); background: rgba(255, 255, 255, 0.7); border-color: rgba(0, 0, 0, 0.1); }
.light .eps-panel { background: rgba(255, 255, 255, 0.94); border-color: rgba(0, 0, 0, 0.1); }
.light .eps-panel-title { color: rgba(24, 24, 28, 0.92); }
.light .eps-count { color: rgba(40, 40, 46, 0.5); }
.light .eps-item { color: rgba(40, 40, 46, 0.8); }
.light .eps-item:hover { background: rgba(0, 0, 0, 0.06); }
.light .eps-idx { color: rgba(40, 40, 46, 0.45); }
.light .eps-dur { color: rgba(40, 40, 46, 0.45); }
.light .eps-empty { color: rgba(40, 40, 46, 0.5); }
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
.light .window-controls {
  background: rgba(255, 255, 255, 0.7);
  border-color: rgba(0, 0, 0, 0.1);
}
.light .wc-btn { color: rgba(40, 40, 46, 0.7); }
.light .wc-btn:hover { background: rgba(0, 0, 0, 0.08); color: rgba(24, 24, 28, 0.95); }
</style>