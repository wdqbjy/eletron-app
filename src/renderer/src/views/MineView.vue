<template>
  <div class="page mine-page">
    <!-- 标题 + Tab -->
    <header class="page-header">
      <h2 class="page-title text-gradient">我的</h2>
      <nav class="page-tabs">
        <button
          v-for="t in tabs"
          :key="t.key"
          class="tab-btn"
          :class="{ active: activeTab === t.key }"
          @click="activeTab = t.key"
        >
          {{ t.label }}
        </button>
      </nav>
    </header>

    <!-- ==== 我的 Tab ==== -->
    <template v-if="activeTab === 'mine'">
      <!-- 未登录卡片 -->
      <div class="login-card">
        <div class="avatar-large">
          <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
            <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5z"/>
          </svg>
        </div>
        <div class="login-info">
          <div class="login-status">未登录</div>
          <div class="login-hint">登录后可同步你的 B 站收藏夹</div>
        </div>
        <button class="login-btn" @click="handleLogin">
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
          </svg>
          登录 B 站
        </button>
      </div>

      <!-- 操作卡片组 -->
      <div class="action-grid">
        <div
          class="action-card"
          v-for="item in actions"
          :key="item.key"
          @click="onActionClick(item.key)"
        >
          <div class="action-icon" :style="{ background: item.iconBg }">
            <span v-html="item.icon"></span>
          </div>
          <div class="action-text">
            <div class="action-title">{{ item.title }}</div>
            <div class="action-sub">{{ item.sub }}</div>
          </div>
        </div>
      </div>
    </template>

    <!-- ==== 历史 Tab ==== -->
    <template v-else-if="activeTab === 'history'">
      <div class="list-header">
        <h3 class="list-title">播放历史</h3>
        <button class="clear-btn" @click="clearHistory">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
          </svg>
          清空历史
        </button>
      </div>

      <div class="history-list">
        <div
          class="history-item"
          v-for="(item, idx) in historyList"
          :key="item.title + idx"
          @click="playHistory(item)"
        >
          <span class="rank">{{ idx + 1 }}</span>
          <div class="cover-sm" :style="{ background: item.cover }"></div>
          <div class="history-info">
            <div class="history-title">{{ item.title }}</div>
            <div class="history-up">{{ item.up }}</div>
          </div>
          <span class="history-duration">{{ item.duration }}</span>
        </div>
      </div>
    </template>

    <!-- ==== 设置 Tab ==== -->
    <template v-else>
      <!-- 主题设置卡片 -->
      <div class="setting-card">
        <h4 class="setting-card-title">主题设置</h4>

        <div class="setting-row">
          <div class="setting-row-label">
            <span class="row-title">主题模式</span>
          </div>
          <div class="mode-switch">
            <button
              class="mode-btn"
              :class="{ active: themeStore.theme === 'dark' }"
              @click="themeStore.set('dark')"
            >深色</button>
            <button
              class="mode-btn"
              :class="{ active: themeStore.theme === 'light' }"
              @click="themeStore.set('light')"
            >浅色</button>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-row-label">
            <span class="row-title">主题颜色</span>
            <span class="row-desc">选择 Apple Music 主题可启用封面模糊背景</span>
          </div>
          <div class="color-dots">
            <button
              v-for="c in themeColors"
              :key="c.key"
              class="color-dot"
              :class="{ active: themeStore.color === c.key }"
              :style="{ background: c.color }"
              :title="c.label"
              @click="themeStore.setColor(c.key)"
            >
              <svg v-if="themeStore.color === c.key" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="14" height="14" style="color:#fff">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </button>
            <span class="color-current-label">{{ currentColorLabel }}</span>
          </div>
        </div>
      </div>

      <!-- 播放设置卡片 -->
      <div class="setting-card">
        <h4 class="setting-card-title">播放设置</h4>

        <div class="setting-row">
          <div class="setting-row-label">
            <span class="row-title">默认播放音质</span>
          </div>
          <div class="select-wrap">
            <select v-model="quality" class="select">
              <option value="auto">自动（最高可用）</option>
              <option value="hires">Hi-Res 无损</option>
              <option value="lossless">无损 FLAC</option>
              <option value="high">高音质 320K</option>
              <option value="standard">标准 128K</option>
            </select>
            <svg class="select-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-row-label">
            <span class="row-title">大屏播放页频谱可视化</span>
          </div>
          <label class="switch">
            <input
              type="checkbox"
              :checked="settingsStore.visualizerEnabled"
              @change="settingsStore.setVisualizerEnabled(($event.target as HTMLInputElement).checked)"
            />
            <span class="switch-track"><span class="switch-thumb"></span></span>
          </label>
        </div>

        <div class="setting-row" :class="{ 'is-disabled': !settingsStore.visualizerEnabled }">
          <div class="setting-row-label">
            <span class="row-title">可视化激进度</span>
            <span class="row-desc">控制波形振幅强度、密度、触发阈值</span>
          </div>
          <div class="slider-row">
            <input
              type="range"
              min="0"
              max="100"
              :value="Math.round(settingsStore.audioVisualizerIntensity * 100)"
              :disabled="!settingsStore.visualizerEnabled"
              class="slider"
              @input="settingsStore.setAudioVisualizerIntensity(Number(($event.target as HTMLInputElement).value) / 100)"
            />
            <span class="slider-value">{{ Math.round(settingsStore.audioVisualizerIntensity * 100) }}%</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useThemeStore } from '../stores/theme'
import { useSettingsStore } from '../stores/settings'

const themeStore = useThemeStore()
const settingsStore = useSettingsStore()

const activeTab = ref<'mine' | 'history' | 'settings'>('mine')

const tabs = [
  { key: 'mine', label: '我的' },
  { key: 'history', label: '历史' },
  { key: 'settings', label: '设置' }
] as const

// ============ 操作卡片（我的 tab） ============
const actions = [
  {
    key: 'history',
    title: '播放历史',
    sub: '6 首',
    iconBg: 'var(--brand-grad)',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'
  },
  {
    key: 'settings',
    title: '设置',
    sub: '主题、音质、缓存',
    iconBg: 'var(--brand-grad)',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
  },
  {
    key: 'download',
    title: '下载管理',
    sub: '管理已下载音乐',
    iconBg: 'var(--brand-grad)',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
  }
]

// ============ 播放历史 ============
interface HistoryItem {
  title: string
  up: string
  duration: string
  cover: string
}

const historyList = ref<HistoryItem[]>([
  {
    title: '【经典老歌】1~100',
    up: '16姐的茶话会',
    duration: '440:41',
    cover: 'linear-gradient(135deg, #8b0000 0%, #dc143c 50%, #ff6347 100%)'
  },
  {
    title: '"都曾被民谣一瞬间击中过"【那些值得火遍全网的宝藏歌曲合集 part 6】音乐推荐 | 音乐可视化 | 动态歌词',
    up: 'Music小铁匠',
    duration: '41:15',
    cover: 'linear-gradient(135deg, #1a3a5c 0%, #2e86c1 50%, #5dade2 100%)'
  },
  {
    title: '【周杰伦】50首精选合集/后台播放/无损音质/HIFI音质/华语流行音乐才是最叼的',
    up: '超级爱下雨天',
    duration: '222:28',
    cover: 'linear-gradient(135deg, #2d1b0e 0%, #b8860b 50%, #ffd700 100%)'
  },
  {
    title: '【4K珍藏】陈小春《街角的晚风》珍稀神级现场!',
    up: 'B612音乐',
    duration: '4:02',
    cover: 'linear-gradient(135deg, #4a0e4e 0%, #8b4d8b 50%, #dda0dd 100%)'
  },
  {
    title: '【4K Hi-Res】鼓楼-赵雷 这是个拥挤的地方 而我却很孤单',
    up: '你去巴黎我在北京',
    duration: '4:42',
    cover: 'linear-gradient(135deg, #0c1445 0%, #1e3a5f 50%, #4169e1 100%)'
  }
])

// ============ 设置状态 ============
// 主题模式 + 主题色：唯一来源 = theme store（与顶栏、刷新、全局联动，对齐 pink-music）
// 主题色（6 色，含 Apple Music，完全照搬 pink-music 色板）
const themeColors = [
  { key: 'pink', label: '粉色', color: '#FF69B4' },
  { key: 'purple', label: '紫色', color: '#A855F7' },
  { key: 'blue', label: '蓝色', color: '#3B82F6' },
  { key: 'green', label: '绿色', color: '#22C55E' },
  { key: 'orange', label: '橙色', color: '#F97316' },
  { key: 'apple-music', label: 'Apple Music', color: '#FF3B30' }
] as const

// 当前选中颜色的中文标签（显示在色板右侧，辅助用户确认）
const currentColorLabel = computed(() => {
  const found = themeColors.find(c => c.key === themeStore.color)
  return found ? found.label : ''
})

// 播放设置（可视化开关/激进度：唯一来源 = settings store，立即生效并持久化）
const quality = ref('auto')

// ============ 事件 ============
const onActionClick = (key: string): void => {
  if (key === 'history') activeTab.value = 'history'
  else if (key === 'settings') activeTab.value = 'settings'
}

const clearHistory = (): void => {
  console.log('清空播放历史')
  historyList.value = []
}

const playHistory = (item: HistoryItem): void => {
  console.log('重新播放:', item.title)
}

const handleLogin = (): void => {
  console.log('登录 B 站')
}
</script>

<style scoped>
.page {
  padding: 24px 28px 120px;
  max-width: 1200px;
  margin: 0 auto;
}

/* ============ 头部：标题 + Tab ============ */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.page-title {
  font-size: 28px;
  font-weight: 800;
  margin: 0;
  letter-spacing: 0.5px;
}

.page-tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 18px;
}

.tab-btn {
  padding: 6px 18px;
  font-size: 13px;
  font-weight: 500;
  border: none;
  border-radius: 14px;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn:hover {
  color: rgba(255, 255, 255, 0.85);
  background: rgba(255, 255, 255, 0.06);
}

.tab-btn.active {
  color: #fff;
  background: var(--brand-grad);
  box-shadow: 0 2px 10px rgba(var(--brand-rgb), 0.35);
}

/* ============ 登录卡片 ============ */
.login-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 28px;
  border-radius: 20px;
  background: linear-gradient(135deg, rgba(30, 21, 37, 0.9) 0%, rgba(42, 26, 46, 0.9) 100%);
  border: 1px solid rgba(var(--brand-rgb), 0.15);
  overflow: hidden;
  margin-bottom: 24px;
}

.login-card::after {
  content: '';
  position: absolute;
  top: -50%;
  right: -10%;
  width: 260px;
  height: 260px;
  background: radial-gradient(circle, rgba(var(--brand-rgb), 0.12) 0%, transparent 70%);
  pointer-events: none;
}

.avatar-large {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(var(--brand-rgb), 0.35) 0%, rgba(var(--brand-rgb-2), 0.25) 100%);
  border: 2px solid rgba(var(--brand-rgb), 0.4);
  color: rgba(255, 255, 255, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.login-info {
  flex: 1;
  min-width: 0;
}

.login-status {
  font-size: 18px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
}

.login-hint {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 4px;
}

.login-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  background: var(--brand-grad);
  border: none;
  border-radius: 18px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(var(--brand-rgb), 0.4);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.login-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(var(--brand-rgb), 0.5);
}

/* ============ 操作卡片组 ============ */
.action-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.action-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 22px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(255, 255, 255, 0.06);
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease;
}

.action-card:hover {
  transform: translateY(-3px);
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(var(--brand-rgb), 0.25);
}

.action-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}

.action-text {
  min-width: 0;
}

.action-title {
  font-size: 15px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.action-sub {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  margin-top: 3px;
}

/* ============ 列表公共头部 ============ */
.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.list-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  color: rgba(255, 255, 255, 0.9);
}

.clear-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.clear-btn:hover {
  color: #fff;
  background: rgba(232, 17, 35, 0.2);
  border-color: rgba(232, 17, 35, 0.4);
}

/* ============ 播放历史列表 ============ */
.history-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.history-item:hover {
  background: rgba(var(--brand-rgb), 0.08);
  border-color: rgba(var(--brand-rgb), 0.25);
}

.rank {
  width: 24px;
  font-size: 14px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.35);
  text-align: center;
  flex-shrink: 0;
}

.history-item:nth-child(1) .rank {
  color: var(--brand);
  font-size: 18px;
}

.history-item:nth-child(2) .rank {
  color: rgba(var(--brand-rgb), 0.75);
}

.history-item:nth-child(3) .rank {
  color: rgba(var(--brand-rgb), 0.5);
}

.cover-sm {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  flex-shrink: 0;
}

.history-info {
  flex: 1;
  min-width: 0;
}

.history-title {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-up {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 3px;
}

.history-duration {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.35);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

/* ============ 设置卡片 ============ */
.setting-card {
  margin-bottom: 20px;
  padding: 4px 0;
}

.setting-card-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.45);
  margin: 0 0 6px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 18px 22px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  margin-bottom: 10px;
}

.setting-row-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.row-title {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

.row-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

/* 可视化关闭时整行置灰 */
.setting-row.is-disabled {
  opacity: 0.45;
}
.setting-row.is-disabled .slider {
  cursor: not-allowed;
}

/* —— 主题模式 toggle —— */
.mode-switch {
  display: inline-flex;
  gap: 6px;
  padding: 4px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16px;
}

.mode-btn {
  padding: 6px 18px;
  font-size: 13px;
  font-weight: 500;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: all 0.2s ease;
}

.mode-btn.active {
  color: #fff;
  background: var(--brand-grad);
  box-shadow: 0 2px 10px rgba(var(--brand-rgb), 0.35);
}

.mode-btn:not(.active):hover {
  color: rgba(255, 255, 255, 0.85);
}

/* —— 主题色点选 —— */
.color-dots {
  display: flex;
  gap: 10px;
  align-items: center;
}

.color-current-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.55);
  margin-left: 4px;
  min-width: 60px;
}

.light .color-current-label {
  color: rgba(40, 40, 46, 0.55);
}

.color-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.color-dot:hover {
  transform: scale(1.12);
}

.color-dot.active {
  border-color: #fff;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.12);
  transform: scale(1.1);
}

/* —— select 下拉 —— */
.select-wrap {
  position: relative;
}

.select {
  appearance: none;
  -webkit-appearance: none;
  padding: 8px 34px 8px 14px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.88);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 0.18s ease;
}

.select:hover,
.select:focus {
  border-color: rgba(var(--brand-rgb), 0.4);
  outline: none;
}

.select option {
  background: #1e1e24;
  color: #fff;
}

.select-arrow {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: rgba(255, 255, 255, 0.4);
}

/* —— switch 开关 —— */
.switch {
  position: relative;
  display: inline-flex;
  cursor: pointer;
}

.switch input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.switch-track {
  width: 44px;
  height: 24px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  position: relative;
  transition: background-color 0.22s ease;
}

.switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.22s ease, background 0.22s ease;
}

.switch input:checked + .switch-track {
  background: var(--brand-grad);
}

.switch input:checked + .switch-track .switch-thumb {
  transform: translateX(20px);
}

/* —— slider —— */
.slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.slider {
  width: 160px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--brand-grad);
  cursor: pointer;
  border: 2px solid #1e1e24;
  box-shadow: 0 0 0 2px rgba(var(--brand-rgb), 0.3);
}

.slider-value {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.55);
  font-variant-numeric: tabular-nums;
  min-width: 36px;
}

.apply-btn {
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 500;
  color: #fff;
  background: rgba(var(--brand-rgb), 0.25);
  border: 1px solid rgba(var(--brand-rgb), 0.4);
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.18s ease;
}

.apply-btn:hover {
  background: rgba(var(--brand-rgb), 0.4);
}

/* ============ 浅色模式适配 ============ */
.light .page-title {
  color: var(--brand-2);
}

.light .tab-btn {
  color: rgba(24, 24, 28, 0.55);
}

.light .tab-btn:hover {
  color: rgba(24, 24, 28, 0.85);
  background: rgba(0, 0, 0, 0.05);
}

.light .page-tabs {
  background: rgba(0, 0, 0, 0.04);
}

.light .login-card {
  background: linear-gradient(135deg, #fafafa 0%, #f4f4f6 100%);
  border-color: rgba(var(--brand-rgb-2), 0.2);
}

.light .login-status {
  color: rgba(24, 24, 28, 0.88);
}

.light .login-hint {
  color: rgba(40, 40, 46, 0.5);
}

.light .action-card {
  background: rgba(0, 0, 0, 0.03);
  border-color: rgba(0, 0, 0, 0.06);
}

.light .action-card:hover {
  background: rgba(0, 0, 0, 0.06);
  border-color: rgba(var(--brand-rgb-2), 0.3);
}

.light .action-title {
  color: rgba(24, 24, 28, 0.88);
}

.light .action-sub {
  color: rgba(40, 40, 46, 0.5);
}
</style>
