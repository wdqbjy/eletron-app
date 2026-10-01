<template>
  <div class="qp-panel">
    <header class="qp-head">
      <span class="qp-title">{{ player.currentSeries?.title || '播放队列' }} <em class="qp-count">{{ player.queue.length }} {{ player.currentSeries ? '集' : '首' }}</em></span>
      <span class="qp-actions">
        <button class="qp-tool" title="清空队列" @click="clear">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
        </button>
      </span>
    </header>
    <ul v-if="player.queue.length" class="qp-list">
      <li
        v-for="(m, i) in player.queue"
        :key="m.bvid + ':' + (m.cid ?? '')"
        class="qp-item"
        :class="{ active: isActive(m) }"
      >
        <span class="qp-order">{{ i + 1 }}</span>
        <button class="qp-main" @click="play(i)">
          <img v-if="m.cover" :src="m.cover" :alt="m.title" class="qp-cover" />
          <span v-else class="qp-cover qp-letter">{{ m.title.charAt(0) }}</span>
          <span class="qp-meta">
            <span class="qp-name">{{ m.title }}</span>
            <span class="qp-author">{{ m.author }}</span>
          </span>
        </button>
        <button
          class="qp-remove"
          :title="m.bvid === player.current?.bvid ? '从队列移除' : '移除'"
          @click="remove(m)"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
      </li>
    </ul>
    <p v-else class="qp-empty">队列为空，去首页推荐点一首歌吧</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { usePlayerStore } from '../stores/player'
import { useAudioPlayer } from '../composables/useAudioPlayer'
import type { RecommendedMusic } from '../apis/bilibili'

const player = usePlayerStore()
const playerApi = useAudioPlayer()

// ===== 点击外部关闭：面板与触发按钮之外任意 pointerdown 均关闭（capture 确保不被 stopPropagation 拦截） =====
function onDocPointerDown(e: PointerEvent) {
  const t = e.target as HTMLElement | null
  if (!t) return
  if (t.closest('.qp-panel')) return
  if (t.closest('[data-queue-toggle]')) return
  player.showQueuePanel = false
}
onMounted(() => document.addEventListener('pointerdown', onDocPointerDown, true))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocPointerDown, true))

/** 当前曲目匹配：分P合集同 bvid 多 cid，须按 cid 精确区分 */
function isActive(m: { bvid: string; cid?: number }): boolean {
  const c = player.current
  if (!c) return false
  if (m.bvid !== c.bvid) return false
  if (m.cid && c.cid) return m.cid === c.cid
  return true
}

function play(index: number) {
  const m = player.queue[index]
  // 无 bvid 的项（历史脏数据）不可播，忽略；传入当前队列避免覆盖清空
  if (m?.bvid) playerApi.playMusic(m, { queue: player.queue })
}
function remove(m: RecommendedMusic) {
  // 多P队列按 bvid+cid 精确移除单分P，不再误删整个合集
  const wasPlaying =
    player.current?.bvid === m.bvid && (player.current?.cid ?? null) === (m.cid ?? null)
  const idx = player.queue.findIndex(
    (q) => q.bvid === m.bvid && (q.cid ?? null) === (m.cid ?? null)
  )
  player.removeFromQueue(m.bvid, m.cid)
  // 删除的正是正在播放的分P：自动切到相邻下一首（队尾则退到新的末尾）
  if (wasPlaying && player.queue.length > 0) {
    const nextIdx = Math.min(idx >= 0 ? idx : 0, player.queue.length - 1)
    const next = player.queue[nextIdx]
    if (next) playerApi.playMusic(next, { queue: player.queue })
  }
}
function clear() {
  if (player.queue.length && confirm('清空播放队列？')) player.clearQueue()
}
</script>

<style scoped>
.qp-panel {
  position: absolute;
  right: 12px;
  bottom: 80px;
  width: 320px;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  background: rgba(20, 20, 24, 0.82);
  color: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(20px) saturate(1.3);
  -webkit-backdrop-filter: blur(20px) saturate(1.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  z-index: 820;
}
.qp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--chrome-border, rgba(0,0,0,.08));
}
.qp-title {
  font-size: 14px;
  font-weight: 600;
}
.qp-count {
  font-style: normal;
  font-size: 11px;
  color: var(--chrome-text-faint, #999);
  margin-left: 6px;
}
.qp-actions {
  display: flex;
  gap: 4px;
}
.qp-tool {
  border: none;
  background: transparent;
  color: var(--chrome-text-soft, #888);
  width: 26px;
  height: 26px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.qp-tool:hover {
  background: var(--chrome-hover, rgba(0,0,0,.06));
  color: #e81123;
}
.qp-list {
  list-style: none;
  margin: 0;
  padding: 8px 8px 12px;
  /* 关键：在 max-height 容器内让列表自身可滚动 */
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  /* 上下渐隐遮罩，滚动时边缘柔和不生硬 */
  -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 10px, #000 calc(100% - 10px), transparent 100%);
  mask-image: linear-gradient(to bottom, transparent 0, #000 10px, #000 calc(100% - 10px), transparent 100%);
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.18) transparent;
}
/* 自定义滚动条：细、半透明、hover 品牌色 */
.qp-list::-webkit-scrollbar {
  width: 6px;
}
.qp-list::-webkit-scrollbar-track {
  background: transparent;
}
.qp-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.16);
  border-radius: 3px;
  border: none;
}
.qp-list::-webkit-scrollbar-thumb:hover {
  background: rgba(var(--brand-rgb, 236, 109, 164), 0.6);
}
.qp-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.05);
  position: relative;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.qp-item:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(var(--brand-rgb, 236, 109, 164), 0.3);
}
.qp-item.active {
  background: rgba(var(--brand-rgb, 236, 109, 164), 0.16);
  border-color: rgba(var(--brand-rgb, 236, 109, 164), 0.45);
}
/* 激活项左侧品牌色细条，快速定位正在播放 */
.qp-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--brand, #ec6da4);
}
.qp-order {
  width: 18px;
  text-align: center;
  font-size: 11px;
  color: var(--chrome-text-faint, #888);
  flex-shrink: 0;
}
.qp-main {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: transparent;
  padding: 0;
  text-align: left;
  cursor: pointer;
  min-width: 0;
}
.qp-cover {
  width: 34px;
  height: 34px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
  background: var(--brand-grad);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
}
.qp-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.qp-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--chrome-text, #222);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.qp-item.active .qp-name {
  color: var(--brand, #ec6da4);
}
.qp-author {
  font-size: 11px;
  color: var(--chrome-text-faint, #999);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.qp-remove {
  border: none;
  background: transparent;
  color: var(--chrome-text-faint, #a0a0a0);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.qp-remove:hover {
  color: #e81123;
  background: rgba(232, 17, 35, 0.08);
}
.qp-empty {
  text-align: center;
  color: var(--chrome-text-faint, #999);
  font-size: 12px;
  padding: 28px 12px;
}

/* ===== 浅色模式：面板改为浅色毛玻璃，文字/滚动条/项底全部反转 ===== */
:global(.light) .qp-panel {
  background: rgba(252, 252, 254, 0.86);
  color: rgba(30, 30, 36, 0.88);
  border-color: rgba(0, 0, 0, 0.08);
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.12);
}
:global(.light) .qp-head {
  border-bottom-color: rgba(0, 0, 0, 0.08);
}
:global(.light) .qp-tool {
  color: rgba(0, 0, 0, 0.5);
}
:global(.light) .qp-tool:hover {
  background: rgba(0, 0, 0, 0.06);
}
:global(.light) .qp-list {
  scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
}
:global(.light) .qp-list::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.18);
}
:global(.light) .qp-item {
  background: rgba(0, 0, 0, 0.025);
  border-color: rgba(0, 0, 0, 0.06);
}
:global(.light) .qp-item:hover {
  background: rgba(0, 0, 0, 0.05);
}
:global(.light) .qp-name {
  color: rgba(30, 30, 36, 0.88);
}
:global(.light) .qp-order,
:global(.light) .qp-author {
  color: rgba(0, 0, 0, 0.45);
}
:global(.light) .qp-remove {
  color: rgba(0, 0, 0, 0.4);
}
:global(.light) .qp-empty {
  color: rgba(0, 0, 0, 0.4);
}
</style>