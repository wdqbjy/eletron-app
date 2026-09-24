<template>
  <Teleport to="body">
    <div v-if="downloadStore.showDownloadManager" class="dm-overlay" @click.self="close">
      <div class="dm-modal">
        <header class="dm-head">
          <h3 class="dm-title">下载管理</h3>
          <button class="dm-close" title="关闭" @click="close">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </header>

        <div class="dm-actions">
          <button class="dm-action" @click="openDownloadFolder">
            <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15">
              <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
            </svg>
            <span>打开下载目录</span>
          </button>
          <button
            class="dm-action"
            :disabled="downloadStore.tasks.length === 0"
            @click="clearTasks"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
            <span>清空记录</span>
          </button>
        </div>

        <div class="dm-list">
          <p v-if="downloadStore.tasks.length === 0" class="dm-empty">暂无下载任务</p>
          <div
            v-for="task in downloadStore.tasks"
            :key="task.id"
            class="dm-item"
            :class="task.status"
          >
            <div class="dm-item-info">
              <div class="dm-item-title">{{ task.title }}</div>
              <div class="dm-item-meta">
                <span class="dm-quality">{{ qualityLabel(task.quality) }}</span>
                <span>{{ formatFileSize(task.totalBytes) }}</span>
                <span>{{ formatTime(task.createdTime) }}</span>
              </div>
            </div>
            <div class="dm-item-status">
              <span class="dm-status-text" :class="task.status">{{ statusText(task.status) }}</span>
            </div>
            <div
              v-if="task.status === 'downloading' || task.status === 'waiting'"
              class="dm-progress"
            >
              <div class="dm-progress-bar">
                <div class="dm-progress-fill" :style="{ width: task.progress + '%' }"></div>
              </div>
              <span class="dm-progress-text">{{ task.progress }}%</span>
            </div>
            <div v-if="task.status === 'error' && task.error" class="dm-error">{{ task.error }}</div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useDownloadStore } from '../stores/download'
import { openDownloadFolder } from '../apis/download'
import type { DownloadStatus } from '../apis/download'

const downloadStore = useDownloadStore()

function close(): void {
  downloadStore.setShowDownloadManager(false)
}

async function clearTasks(): Promise<void> {
  if (confirm('确定要清空所有下载记录吗？\n已下载的文件不会被删除，仅清空历史列表。')) {
    await downloadStore.clearTasks()
  }
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '-'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatTime(timestamp: number): string {
  if (!timestamp) return '-'
  const d = new Date(timestamp)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const STATUS_MAP: Record<DownloadStatus, string> = {
  waiting: '等待中',
  downloading: '下载中',
  completed: '已完成',
  error: '失败'
}
function statusText(status: DownloadStatus): string {
  return STATUS_MAP[status] || status
}

// 与 MineView 音质枚举对齐：auto/hires/lossless/high/standard
const QUALITY_LABELS: Record<string, string> = {
  auto: '自动',
  hires: 'Hi-Res',
  lossless: '无损',
  high: '高音质',
  standard: '标准',
  medium: '中音质',
  low: '低音质'
}
function qualityLabel(q: string): string {
  return QUALITY_LABELS[q || 'auto'] || '自动'
}
</script>

<style scoped>
.dm-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}

.dm-modal {
  width: 90%;
  max-width: 620px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  background: var(--color-background, #fff);
  color: var(--chrome-text, #222);
  border: 1px solid var(--chrome-border, rgba(0, 0, 0, 0.08));
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
  overflow: hidden;
  animation: dmEnter 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes dmEnter {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.dm-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--chrome-border, rgba(0, 0, 0, 0.08));
}

.dm-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--chrome-text, #222);
}

.dm-close {
  border: none;
  background: transparent;
  color: var(--chrome-text-soft, #888);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, color 0.15s ease;
}

.dm-close:hover {
  background: var(--chrome-hover, rgba(0, 0, 0, 0.06));
  color: var(--chrome-text, #222);
}

.dm-actions {
  display: flex;
  gap: 10px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--chrome-border, rgba(0, 0, 0, 0.08));
}

.dm-action {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  font-size: 12.5px;
  color: var(--chrome-text, #222);
  background: var(--chrome-hover, rgba(0, 0, 0, 0.04));
  border: 1px solid var(--chrome-border, rgba(0, 0, 0, 0.08));
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
}

.dm-action:hover:not(:disabled) {
  border-color: var(--brand, #ec6da4);
  color: var(--brand, #ec6da4);
}

.dm-action:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.dm-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 20px 20px;
}

.dm-empty {
  text-align: center;
  padding: 48px 0;
  margin: 0;
  font-size: 13px;
  color: var(--chrome-text-faint, #999);
}

.dm-item {
  padding: 13px 14px;
  background: var(--chrome-hover, rgba(0, 0, 0, 0.03));
  border: 1px solid var(--chrome-border, rgba(0, 0, 0, 0.06));
  border-radius: 10px;
  margin-bottom: 10px;
}

.dm-item.completed {
  border-color: rgba(72, 187, 120, 0.35);
}

.dm-item.error {
  border-color: rgba(232, 17, 35, 0.35);
}

.dm-item-info {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 6px;
}

.dm-item-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--chrome-text, #222);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.dm-item-meta {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 11.5px;
  color: var(--chrome-text-faint, #999);
  margin-top: 3px;
}

.dm-quality {
  padding: 2px 7px;
  background: var(--brand-grad);
  color: #fff;
  border-radius: 5px;
  font-size: 10.5px;
  font-weight: 600;
}

.dm-item-status {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 4px;
}

.dm-status-text {
  font-size: 12px;
  font-weight: 600;
  color: var(--chrome-text-soft, #888);
}

.dm-status-text.waiting {
  color: var(--chrome-text-faint, #999);
}

.dm-status-text.downloading {
  color: var(--brand, #ec6da4);
}

.dm-status-text.completed {
  color: #48bb78;
}

.dm-status-text.error {
  color: #e81123;
}

.dm-progress {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dm-progress-bar {
  flex: 1;
  height: 4px;
  background: var(--chrome-track, rgba(0, 0, 0, 0.1));
  border-radius: 2px;
  overflow: hidden;
}

.dm-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--brand, #ec6da4), var(--brand-2, #f093b0));
  border-radius: 2px;
  transition: width 0.25s ease;
}

.dm-progress-text {
  font-size: 11.5px;
  color: var(--chrome-text-faint, #999);
  min-width: 36px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.dm-error {
  margin-top: 7px;
  font-size: 11.5px;
  color: #e81123;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
