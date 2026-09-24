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
          @click="remove(m.bvid)"
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
import { usePlayerStore } from '../stores/player'
import { useAudioPlayer } from '../composables/useAudioPlayer'

const player = usePlayerStore()
const playerApi = useAudioPlayer()

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
  if (m) playerApi.playMusic(m)
}
function remove(bvid: string) {
  player.removeFromQueue(bvid)
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
  background: rgba(var(--bg-rgb, 0,0,0), 0.92);
  color: var(--chrome-text, #222);
  backdrop-filter: blur(20px) saturate(1.3);
  -webkit-backdrop-filter: blur(20px) saturate(1.3);
  border: 1px solid var(--chrome-border, rgba(0,0,0,.1));
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
  padding: 8px;
  /* 关键：在 max-height 容器内让列表自身可滚动，避免长合集（如 100 集）撑爆面板后被 overflow:hidden 裁掉 */
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  /* 分集之间留出 gap，清晰分开、不再「堆积」 */
  gap: 6px;
}
.qp-item {
  display: flex;
  align-items: center;
  gap: 10px;
  /* 加大内边距，分集之间留出可见空隙 */
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--chrome-hover, rgba(255,255,255,0.03));
  /* 给每集一条很淡的下边界，进一步强化「每条分开」的视觉 */
  border: 1px solid var(--chrome-border, rgba(255,255,255,0.05));
}
.qp-item:hover {
  background: var(--chrome-hover, rgba(0,0,0,.05));
  border-color: rgba(var(--brand-rgb, 236,109,164), 0.25);
}
.qp-item.active {
  background: rgba(var(--brand-rgb, 236,109,164), 0.14);
  border-color: rgba(var(--brand-rgb, 236,109,164), 0.4);
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
</style>