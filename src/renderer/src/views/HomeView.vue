<template>
  <div class="page home-page">
    <!-- Hero Banner（深色卡片 + 渐变标题） -->
    <div class="hero">
      <h2 class="hero-title text-gradient">欢迎使用 Dark Music</h2>
      <p class="hero-sub">从 B 站发现并播放你喜欢的音乐</p>
    </div>

    <!-- 推荐音乐（B 站音乐区推荐） -->
    <section class="section">
      <header class="section-header">
        <h3>推荐音乐</h3>
        <button
          class="refresh-btn"
          title="刷新推荐"
          @click="recommendStore.load()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            width="18"
            height="18"
            :class="{ spinning: recommendStore.loading }"
          >
            <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
          </svg>
        </button>
      </header>

      <!-- 加载中 -->
      <div v-if="recommendStore.loading" class="loading">
        <div class="loading-spinner"></div>
        <p class="loading-text">加载中...</p>
      </div>

      <!-- 空态 / 错误态 -->
      <div v-else-if="recommendStore.items.length === 0" class="loading">
        <p class="loading-text">{{ recommendStore.error || '暂无推荐音乐，点击右上角刷新重试' }}</p>
      </div>

      <!-- 推荐卡片网格 -->
      <div v-else class="recommend-grid">
        <div
          v-for="(music, index) in recommendStore.items"
          :key="music.bvid"
          class="music-card"
          :style="{ '--card-index': index }"
          @click="playMusic(music)"
        >
          <div class="card-cover">
            <img
              :src="music.cover"
              :alt="music.title"
              loading="lazy"
              decoding="async"
              @error="onCoverError"
            />
            <span v-if="music.rec_reason" class="rec-reason-badge">{{ music.rec_reason }}</span>
            <span v-if="episodeCount[music.bvid] > 1" class="p-badge">{{ episodeCount[music.bvid] }} P</span>
            <div class="play-overlay">
              <button class="play-button" title="播放" @click.stop="playMusic(music)">
                <svg viewBox="0 0 24 24" fill="white" width="20" height="20"><path d="M8 5v14l11-7z"/></svg>
              </button>
              <button class="download-button" title="下载" @click.stop="downloadMusic(music)">
                <svg viewBox="0 0 24 24" fill="white" width="16" height="16"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
              </button>
              <button class="add-button" title="添加到歌单" @click.stop="addToPlaylist(music)">
                <svg viewBox="0 0 24 24" fill="white" width="16" height="16"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
              </button>
            </div>
          </div>
          <h4 class="card-title">{{ music.title }}</h4>
          <p class="card-artist">{{ music.author }}</p>
          <div class="music-card-meta">
            <span>{{ formatPlayCount(music.playCount) }} 播放</span>
            <span class="dot">·</span>
            <span>{{ formatDuration(music.duration) }}</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch, onMounted } from 'vue'
import { useRecommendStore } from '../stores/recommend'
import { usePlaylistStore } from '../stores/playlist'
import { useAudioPlayer } from '../composables/useAudioPlayer'
import { useDownload } from '../composables/useDownload'
import { formatPlayCount, formatDuration } from '../utils/bilibili'
import { COVER_FALLBACK } from '../utils/coverFallback'
import { getMusicEpisodes } from '../apis/bilibili'
import type { RecommendedMusic } from '../apis/bilibili'

const recommendStore = useRecommendStore()
const playlistStore = usePlaylistStore()
const audioPlayer = useAudioPlayer()
const { downloadMusic } = useDownload()

// bvid → 分P 数（仅 >1 时显示角标）。推荐接口的 archives 不带 videos 字段，
// 所以只能对每张卡片单独拉 /x/player/pagelist 才知道它是不是合集（用于「N P」徽标）。
const episodeCount = reactive<Record<string, number>>({})

// 并发拉取分P数：一次小批 4 张，避免 20 张卡片同时请求被 B 站风控降级
async function fillEpisodeCounts(items: RecommendedMusic[]): Promise<void> {
  const todo = items.filter((m) => !(m.bvid in episodeCount)).map((m) => m.bvid)
  const CONCURRENCY = 4
  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    const batch = todo.slice(i, i + CONCURRENCY)
    await Promise.all(
      batch.map(async (bvid) => {
        try {
          const res = await getMusicEpisodes(bvid)
          if (res?.code === 0 && Array.isArray(res.data) && res.data.length > 1) {
            episodeCount[bvid] = res.data.length
          }
        } catch (_) {}
      })
    )
  }
}

// 推荐列表变化（含点刷新）后，为出现的卡片补齐分P角标数据
watch(
  () => recommendStore.items,
  (items) => {
    if (items.length) fillEpisodeCounts(items)
  }
)

const fallbackCover = COVER_FALLBACK

// 点击推荐卡片：拉取真实音频流并播放（底部播放栏随之点亮）
function playMusic(music: RecommendedMusic): void {
  audioPlayer.playMusic(music)
}

// 卡片「添加到歌单」：拉分P → 多P开分P弹窗，单P直接单曲弹窗
function addToPlaylist(music: RecommendedMusic): void {
  playlistStore.openAddFlow(music)
}

function onCoverError(e: Event): void {
  ;(e.target as HTMLImageElement).src = fallbackCover
}

onMounted(() => {
  recommendStore.load()
})
</script>

<style scoped>
/* ============ 页面排版 ============ */
.page {
  padding: 24px 28px 120px;
  max-width: 1200px;
  margin: 0 auto;
}

/* ============ Hero Banner ============ */
.hero {
  position: relative;
  padding: 40px 36px;
  border-radius: 20px;
  background: linear-gradient(135deg, #1e1525 0%, #2a1a2e 40%, #1a1820 100%);
  border: 1px solid rgba(var(--brand-rgb), 0.12);
  overflow: hidden;
}

.hero::before {
  content: '';
  position: absolute;
  top: -60%;
  right: -10%;
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(var(--brand-rgb), 0.18) 0%, transparent 70%);
  pointer-events: none;
}

.hero::after {
  content: '';
  position: absolute;
  bottom: -40%;
  left: 10%;
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, rgba(var(--brand-rgb-2), 0.12) 0%, transparent 70%);
  pointer-events: none;
}

.hero-title {
  font-size: 32px;
  font-weight: 800;
  margin: 0 0 10px;
  letter-spacing: 0.5px;
}

.hero-sub {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.55);
  margin: 0;
}

/* ============ Section ============ */
.section {
  margin-top: 36px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.section-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
}

.refresh-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, transform 0.3s ease;
}

.refresh-btn:hover {
  background: rgba(var(--brand-rgb), 0.2);
  color: var(--brand);
}

.refresh-btn:active {
  transform: scale(0.9);
}

.refresh-btn svg.spinning {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ============ 加载 / 空态 ============ */
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 60px 0;
}

.loading-spinner {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.12);
  border-top-color: var(--brand);
  animation: spin 0.8s linear infinite;
}

.loading-text {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.45);
  margin: 0;
}

/* ============ 推荐网格 + 卡片 ============ */
/* gap 24px，避免卡片「堆积」感 */
.recommend-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 24px;
}

.music-card {
  background: rgba(255, 255, 255, 0.035);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  padding: 12px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  min-width: 0;
  /* 入场级联动画：--card-index 由模板按行序注入，P0 封顶 8 张 */
  animation: cardEnter 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc(min(var(--card-index, 0), 8) * 45ms);
  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.28s ease, border-color 0.28s ease;
}

@keyframes cardEnter {
  from {
    opacity: 0;
    transform: translateY(18px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.music-card:hover {
  transform: translateY(-8px) scale(1.02);
  box-shadow: 0 8px 30px var(--brand-glow-2);
  border-color: rgba(var(--brand-rgb), 0.3);
}

.music-card:active {
  transform: translateY(-4px) scale(0.99);
  transition-duration: 0.1s;
}

/* ============ 封面 ============ */
.card-cover {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 12px;
  background: var(--brand-grad);
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.card-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.45s ease;
}

.music-card:hover .card-cover img {
  transform: scale(1.08);
}

.card-cover::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.4) 0%, transparent 50%);
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: 1;
}

.music-card:hover .card-cover::before {
  opacity: 1;
}

/* 推荐理由角标 */
.rec-reason-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 3px 9px;
  font-size: 10px;
  font-weight: 600;
  color: #fff;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: 999px;
  letter-spacing: 0.3px;
  pointer-events: none;
  z-index: 2;
}

/* 分P数徽标（封面左下角）：「N P」 */
.p-badge {
  position: absolute;
  bottom: 8px;
  left: 8px;
  padding: 3px 8px;
  font-size: 10px;
  font-weight: 600;
  color: #fff;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: 999px;
  letter-spacing: 0.3px;
  pointer-events: none;
  z-index: 2;
}

/* ============ 播放操作条（hover 弹出） ============ */
.play-overlay {
  position: absolute;
  bottom: 10px;
  right: 10px;
  display: flex;
  gap: 8px;
  opacity: 0;
  transform: translateY(20px) scale(0.8);
  transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 2;
}

.music-card:hover .play-overlay {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.play-button {
  width: 44px;
  height: 44px;
  background: var(--brand-grad);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px var(--brand-glow-2);
  border: none;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.play-button:hover {
  transform: scale(1.1);
}

.play-button:active {
  transform: scale(0.88);
}

.download-button {
  width: 34px;
  height: 34px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.2);
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease;
}

.download-button:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: scale(1.1);
}

.download-button:active {
  transform: scale(0.88);
}

/* 「添加到歌单」：与下载按钮同规格（pink-music p-add-btn） */
.add-button {
  width: 34px;
  height: 34px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.2);
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease;
}

.add-button:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: scale(1.1);
}

.add-button:active {
  transform: scale(0.88);
}

/* ============ 卡片文字信息 ============ */
.card-title {
  margin: 10px 0 0;
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-artist {
  margin: 3px 0 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.music-card-meta {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 4px;
  font-variant-numeric: tabular-nums;
}

.music-card-meta .dot {
  opacity: 0.6;
}

/* ============ 浅色模式覆盖 ============ */
.light .hero {
  background: linear-gradient(135deg, #2a1a2e 0%, #1e1525 40%, #1a1820 100%);
  border-color: rgba(var(--brand-rgb), 0.15);
}

.light .section-header h3 {
  color: rgba(24, 24, 28, 0.86);
}

.light .refresh-btn {
  background: rgba(0, 0, 0, 0.06);
  color: rgba(24, 24, 28, 0.6);
}

.light .refresh-btn:hover {
  background: rgba(var(--brand-rgb), 0.2);
  color: var(--brand-2);
}

.light .music-card {
  background: rgba(255, 255, 255, 0.65);
  border-color: rgba(0, 0, 0, 0.06);
}

.light .music-card:hover {
  border-color: rgba(var(--brand-rgb), 0.3);
}

.light .card-title {
  color: rgba(24, 24, 28, 0.86);
}

.light .card-artist {
  color: rgba(40, 40, 46, 0.55);
}

.light .music-card-meta {
  color: rgba(40, 40, 46, 0.5);
}

.light .loading-text {
  color: rgba(40, 40, 46, 0.55);
}
</style>