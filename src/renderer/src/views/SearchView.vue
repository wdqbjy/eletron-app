<template>
  <div class="page search-page">
    <!-- 搜索框 -->
    <div class="search-box">
      <input
        v-model="searchStore.query"
        type="text"
        placeholder="搜索音乐..."
        @keyup.enter="onSearch"
      />
      <button class="search-btn" :disabled="searchStore.loading" @click="onSearch">
        <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
      </button>
    </div>

    <!-- 加载中 -->
    <div v-if="searchStore.loading" class="loading">
      <div class="loading-spinner"></div>
      <p class="loading-text">搜索中...</p>
    </div>

    <!-- 空结果 -->
    <div v-else-if="searchStore.searched && searchStore.results.length === 0" class="loading">
      <p class="loading-text">未找到相关音乐</p>
    </div>

    <!-- 初始态：未搜索 -->
    <div v-else-if="!searchStore.searched" class="loading">
      <p class="loading-text">输入关键词，搜索你喜欢的音乐</p>
    </div>

    <!-- 搜索结果卡片网格 -->
    <div v-else class="search-grid">
      <div
        v-for="(music, index) in searchStore.results"
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
          <span v-if="music.videos > 1" class="p-badge">{{ music.videos }} P</span>
          <div class="play-overlay">
            <button class="play-button" title="播放" @click.stop="playMusic(music)">
              <svg viewBox="0 0 24 24" fill="white" width="20" height="20"><path d="M8 5v14l11-7z"/></svg>
            </button>
            <button class="download-button" title="下载" @click.stop="downloadMusic(toMusic(music))">
              <svg viewBox="0 0 24 24" fill="white" width="16" height="16"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            </button>
          </div>
        </div>
        <h4 class="card-title">{{ music.title }}</h4>
        <p class="card-artist">{{ music.author }}</p>
        <div class="music-card-meta">
          <span>{{ formatPlayCount(music.play) }} 播放</span>
          <span class="dot">·</span>
          <span>{{ formatDuration(parseDuration(music.duration)) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSearchStore } from '../stores/search'
import { useMusic } from '../composables/useMusic'
import { useAudioPlayer } from '../composables/useAudioPlayer'
import { useDownload } from '../composables/useDownload'
import { formatPlayCount, formatDuration, parseDuration } from '../utils/bilibili'
import type { SearchResultItem, RecommendedMusic } from '../apis/bilibili'

const searchStore = useSearchStore()
const { handleSearch } = useMusic()
const audioPlayer = useAudioPlayer()
const { downloadMusic } = useDownload()

const fallbackCover =
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400'

/** 搜索结果项 → 播放器接受的 RecommendedMusic（duration 从 mm:ss 字符串转秒） */
function toMusic(item: SearchResultItem): RecommendedMusic {
  return {
    bvid: item.bvid,
    aid: item.aid,
    title: item.title,
    author: item.author,
    cover: item.cover,
    duration: parseDuration(item.duration) || 180,
    playCount: item.play,
    pubdate: item.pubdate,
    rec_reason: ''
  }
}

function playMusic(item: SearchResultItem): void {
  audioPlayer.playMusic(toMusic(item))
}

function onCoverError(e: Event): void {
  ;(e.target as HTMLImageElement).src = fallbackCover
}

async function onSearch(): Promise<void> {
  await handleSearch()
}
</script>

<style scoped>
/* ============ 页面排版 ============ */
.page {
  padding: 24px 28px 120px;
  max-width: 1200px;
  margin: 0 auto;
}

/* ============ 搜索框 ============ */
.search-box {
  display: flex;
  align-items: center;
  gap: 0;
  width: 100%;
  max-width: 480px;
  margin: 12px auto 28px;
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(20px) saturate(1.3);
  -webkit-backdrop-filter: blur(20px) saturate(1.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  padding: 4px 6px 4px 20px;
  transition: max-width 0.4s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.3s ease, box-shadow 0.3s ease;
  animation: searchBoxEnter 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
}

/* 聚焦：边框高亮 + 辉光环 + 宽度微微展开 */
.search-box:focus-within {
  border-color: var(--brand, #ec6da4);
  box-shadow: 0 4px 24px var(--brand-glow-2), 0 0 0 3px rgba(var(--brand-rgb), 0.15);
  max-width: 720px;
}

@keyframes searchBoxEnter {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.search-box input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  padding: 8px 0;
}

.search-box input::placeholder {
  color: rgba(255, 255, 255, 0.35);
}

.search-btn {
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.15s ease, color 0.2s ease;
}

.search-btn:hover:not(:disabled) {
  transform: scale(1.1);
  color: var(--brand, #ec6da4);
}

.search-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.search-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ============ 搜索结果网格 + 卡片（对齐 HomeView 推荐卡片） ============ */
.search-grid {
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

/* 分P数徽标 */
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

/* ============ 浅色模式 ============ */
.light .search-box {
  background: rgba(0, 0, 0, 0.04);
  border-color: rgba(0, 0, 0, 0.1);
}

.light .search-box input {
  color: rgba(24, 24, 28, 0.9);
}

.light .search-box input::placeholder {
  color: rgba(24, 24, 28, 0.35);
}

.light .search-btn {
  color: rgba(24, 24, 28, 0.5);
}

.light .search-btn:hover:not(:disabled) {
  color: var(--brand-2, #ec6da4);
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

/* ============ 响应式：窄屏收成 4 列 ============ */
@media (max-width: 1100px) {
  .search-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 760px) {
  .search-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
