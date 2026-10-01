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
      <!-- 登录卡片：未登录=登录入口；已登录=账号信息 + 退出（登录态与 TopBar 共享 user store） -->
      <div class="login-card">
        <template v-if="userStore.isLoggedIn">
          <div class="avatar-large">{{ avatarText }}</div>
          <div class="login-info">
            <div class="login-status">{{ userStore.userInfo?.uname }}</div>
            <div class="login-hint">已登录 B 站账号 · UID {{ userStore.userInfo?.mid }}</div>
          </div>
          <button class="login-btn logout-btn" @click="handleLogout">退出登录</button>
        </template>
        <template v-else>
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
        </template>
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
            <div class="action-sub">{{ item.key === 'history' ? historySub : item.key === 'download' ? downloadSub : item.sub }}</div>
          </div>
        </div>
      </div>
    </template>

    <!-- ==== 历史 Tab ==== -->
    <template v-else-if="activeTab === 'history'">
      <div class="list-header">
        <h3 class="list-title">播放历史</h3>
        <button v-if="playerStore.playHistory.length" class="clear-btn btn-danger" @click="clearHistory">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
          </svg>
          清空历史
        </button>
      </div>

      <div v-if="playerStore.playHistory.length" class="history-list">
        <div
          class="history-item"
          v-for="(item, idx) in playerStore.playHistory"
          :key="item.bvid + '-' + idx"
          @click="playMusic(item)"
        >
          <span class="rank">{{ idx + 1 }}</span>
          <img class="cover-sm" :src="item.cover" :alt="item.title" loading="lazy" />
          <div class="history-info">
            <div class="history-title">{{ item.title }}</div>
            <div class="history-up">{{ item.author }}</div>
          </div>
          <span class="history-duration">{{ formatDuration(item.duration) }}</span>
        </div>
      </div>
      <p v-else class="history-empty">暂无播放历史，去首页听几首歌吧</p>
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
            <span class="row-desc">在线播放与下载共用；无损/杜比需登录账号</span>
          </div>
          <AppSelect
            :model-value="settingsStore.audioQuality"
            :options="qualityOptions"
            @update:model-value="settingsStore.setAudioQuality($event as AudioQuality)"
          />
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
              :value="pendingIntensity"
              :disabled="!settingsStore.visualizerEnabled"
              class="slider"
              @input="pendingIntensity = Number(($event.target as HTMLInputElement).value)"
            />
            <span class="slider-value">{{ pendingIntensity }}%</span>
            <button
              class="mini-btn btn-apply"
              :class="{ 'is-active': intensityDirty }"
              :disabled="!settingsStore.visualizerEnabled"
              @click="applyIntensity"
            >应用</button>
            <button v-if="intensityDirty" class="mini-btn btn-reset" @click="resetIntensity">撤销</button>
          </div>
        </div>
      </div>

      <!-- 音频均衡器卡片 -->
      <div class="setting-card">
        <h4 class="setting-card-title">音频均衡器</h4>

        <div class="setting-row">
          <div class="setting-row-label">
            <span class="row-title">启用均衡器</span>
            <span class="row-desc">10 段频段调节，立即作用于正在播放的声音</span>
          </div>
          <label class="switch">
            <input
              type="checkbox"
              :checked="settingsStore.eqEnabled"
              @change="settingsStore.setEQEnabled(($event.target as HTMLInputElement).checked)"
            />
            <span class="switch-track"><span class="switch-thumb"></span></span>
          </label>
        </div>

        <div class="eq-body" :class="{ 'is-disabled': !settingsStore.eqEnabled }">
          <div class="eq-toolbar">
            <AppSelect
              :model-value="settingsStore.eqPreset"
              :options="eqPresetOptions"
              :disabled="!settingsStore.eqEnabled"
              @update:model-value="onPresetChange($event)"
            />
            <div class="eq-toolbar-actions">
              <button class="mini-btn btn-secondary" :disabled="!settingsStore.eqEnabled" @click="onResetEQ">重置</button>
              <button
                class="mini-btn btn-apply"
                :class="{ 'is-active': eqDirty }"
                :disabled="!settingsStore.eqEnabled"
                @click="applyEQ"
              >应用</button>
              <button v-if="eqDirty" class="mini-btn btn-reset" @click="revertEQ">撤销</button>
            </div>
          </div>

          <div class="eq-bands">
            <div v-for="(band, i) in EQ_BANDS" :key="band.freq" class="eq-band">
              <span class="eq-db" :class="dbClass(pendingBands[i])">{{ formatDb(pendingBands[i]) }}</span>
              <div class="eq-slider-wrap">
                <div class="eq-track-zero"></div>
                <input
                  type="range"
                  orient="vertical"
                  :min="EQ_DB_MIN"
                  :max="EQ_DB_MAX"
                  :step="EQ_DB_STEP"
                  :disabled="!settingsStore.eqEnabled"
                  :value="pendingBands[i]"
                  class="eq-slider"
                  :data-pos="pendingBands[i] > 0 ? 'pos' : pendingBands[i] < 0 ? 'neg' : 'zero'"
                  @input="onBandInput(i, Number(($event.target as HTMLInputElement).value))"
                />
              </div>
              <span class="eq-freq">{{ band.label }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 窗口设置卡片 -->
      <div class="setting-card">
        <h4 class="setting-card-title">窗口设置</h4>
        <div class="setting-row">
          <div class="setting-row-label">
            <span class="row-title">窗口控制按钮</span>
            <span class="row-desc">在右上角显示最小化、最大化、关闭按钮（macOS 使用系统交通灯）</span>
          </div>
          <label class="switch">
            <input
              type="checkbox"
              :checked="settingsStore.windowControlsEnabled"
              @change="settingsStore.setWindowControlsEnabled(($event.target as HTMLInputElement).checked)"
            />
            <span class="switch-track"><span class="switch-thumb"></span></span>
          </label>
        </div>
      </div>

      <!-- 歌词设置卡片 -->
      <div class="setting-card">
        <h4 class="setting-card-title">歌词设置</h4>
        <div class="setting-row">
          <div class="setting-row-label">
            <span class="row-title">歌词显示模式</span>
          </div>
          <AppSelect
            :model-value="settingsStore.lyricDisplayMode"
            :options="lyricModeOptions"
            @update:model-value="settingsStore.setLyricDisplayMode($event as LyricDisplayMode)"
          />
        </div>
        <p class="setting-hint">主行始终显示原文，选中的罗马音/翻译以小字附注在原文下方。部分歌曲可能没有罗马音或翻译数据，将自动只显示原文。</p>
      </div>

      <!-- 下载设置 -->
      <div class="setting-card">
        <h4 class="setting-card-title">下载设置</h4>
        <div class="setting-row">
          <div class="setting-row-label">
            <span class="row-title">下载目录</span>
            <span class="row-desc path-text" :title="downloadDirectory">{{ downloadDirectory || '未设置' }}</span>
          </div>
          <button class="mini-btn" :disabled="isBrowsingDir" @click="browseDownloadDirectory">
            {{ isBrowsingDir ? '选择中…' : '浏览' }}
          </button>
        </div>
      </div>

      <!-- 缓存管理 -->
      <div class="setting-card">
        <h4 class="setting-card-title">缓存管理</h4>
        <div class="setting-row">
          <div class="setting-row-label">
            <span class="row-title">当前缓存大小</span>
            <span class="row-desc">
              <template v-if="isCalculatingCache">计算中…</template>
              <template v-else>{{ formatFileSize(cacheSize) }}</template>
            </span>
          </div>
          <button class="mini-btn btn-danger" :disabled="isClearingCache" @click="showClearCacheConfirm = true">
            {{ isClearingCache ? '清理中…' : '清理缓存' }}
          </button>
        </div>
      </div>

      <!-- 关于 -->
      <div class="setting-card">
        <h4 class="setting-card-title">关于</h4>
        <div class="setting-row about-row">
          <div class="about-content">
            <div class="about-header">
              <img class="about-logo" :src="logoImg" alt="logo" />
              <span class="logo-text text-gradient">{{ appInfo.name }}</span>
              <span class="version" v-if="appInfo.version">v{{ appInfo.version }}</span>
            </div>
            <p class="about-desc">一款优雅的 B 站音乐播放器，让你发现并享受喜欢的音乐。</p>
            <div class="about-update">
              <button class="update-check-btn" :disabled="updateChecking" @click="checkForUpdate">
                {{ updateChecking ? '检查中…' : '检查更新' }}
              </button>
              <span v-if="updateStatus" class="update-status">{{ updateStatus }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>

  <!-- 清理缓存确认 -->
  <div v-if="showClearCacheConfirm" class="modal-overlay" @click="showClearCacheConfirm = false">
    <div class="modal small-modal" @click.stop>
      <h2>确认清理缓存</h2>
      <p>清理缓存将删除已缓存的音频、应用临时文件与网络缓存，<b>不会影响你的下载文件</b>，此操作不可恢复。</p>
      <div class="modal-buttons">
        <button class="mini-btn" @click="showClearCacheConfirm = false">取消</button>
        <button class="mini-btn btn-danger" @click="clearCache">确认清理</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useThemeStore } from '../stores/theme'
import { useSettingsStore } from '../stores/settings'
import type { AudioQuality, LyricDisplayMode } from '../stores/settings'
import { useDownloadStore } from '../stores/download'
import { useUserStore } from '../stores/user'
import { useRecommendStore } from '../stores/recommend'
import { usePlayerStore } from '../stores/player'
import { useAudioPlayer } from '../composables/useAudioPlayer'
import AppSelect from '../components/common/AppSelect.vue'
import logoImg from '../assets/logo.png'
import {
  EQ_BANDS,
  EQ_DB_MIN,
  EQ_DB_MAX,
  EQ_DB_STEP,
  EQ_PRESET_KEYS,
  EQ_PRESET_LABELS
} from '../utils/audioEQ'

const themeStore = useThemeStore()
const settingsStore = useSettingsStore()
const downloadStore = useDownloadStore()
const userStore = useUserStore()
const recommendStore = useRecommendStore()

// 下载管理卡片副标题：有任务时显示任务数 / 进行中数
const downloadSub = computed(() => {
  const total = downloadStore.tasks.length
  if (!total) return '管理已下载音乐'
  const active = downloadStore.tasks.filter((t) => t.status === 'downloading' || t.status === 'waiting').length
  return active > 0 ? `${active} 个下载中 · 共 ${total} 个任务` : `共 ${total} 个任务`
})

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
    sub: '暂无记录', // 动态显示 historySub（真实条数）
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

// ============ 播放器 store + 播放控制（播放历史列表点击播放用；歌单模块已迁至 PlaylistView） ============
const playerStore = usePlayerStore()
const { playMusic } = useAudioPlayer()

// ============ 播放历史（真实数据：player store 播放时记录，localStorage 持久化） ============
const historySub = computed(() => {
  const n = playerStore.playHistory.length
  return n > 0 ? `${n} 首` : '暂无记录'
})

/** 秒 → mm:ss（播放历史行时长显示用） */
function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// ============ 设置状态 ============
// 主题模式 + 主题色：唯一来源 = theme store（与顶栏、刷新、全局联动）
// 主题色（6 色，含 Apple Music）
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

// ============ 自定义下拉选项 ============
const qualityOptions = [
  { value: 'auto', label: '自动（最高可用）' },
  { value: 'lossless', label: '无损音质' },
  { value: 'high', label: '高音质' },
  { value: 'medium', label: '中音质' },
  { value: 'low', label: '低音质' }
]

// EQ 预置选项；手动调过滑块时追加「自定义」
const eqPresetOptions = computed(() => {
  const list = EQ_PRESET_KEYS.map((key) => ({ value: key, label: EQ_PRESET_LABELS[key] }))
  if (settingsStore.eqPreset === 'custom' && !list.some((o) => o.value === 'custom')) {
    list.push({ value: 'custom', label: '自定义' })
  }
  return list
})

const lyricModeOptions = [
  { value: 'original', label: '原文（无翻译）' },
  { value: 'romaji', label: '原文 + 罗马音' },
  { value: 'translation', label: '原文 + 中文翻译' }
]

// 已登录头像取用户名首字
const avatarText = computed(() => (userStore.userInfo?.uname || '?').slice(0, 1).toUpperCase())

// ============ 可视化激进度：草稿 + 应用/撤销（draft-apply 交互） ============
const pendingIntensity = ref(Math.round(settingsStore.audioVisualizerIntensity * 100))
const intensityDirty = computed(
  () => pendingIntensity.value !== Math.round(settingsStore.audioVisualizerIntensity * 100)
)
function applyIntensity(): void {
  settingsStore.setAudioVisualizerIntensity(pendingIntensity.value / 100)
}
function resetIntensity(): void {
  pendingIntensity.value = Math.round(settingsStore.audioVisualizerIntensity * 100)
}

// ============ 均衡器：10 段滑块草稿 + 预置/重置(live) + 应用/撤销 ============
const pendingBands = ref<number[]>(settingsStore.eqBands.slice())
const eqDirty = computed(() =>
  pendingBands.value.some((v, i) => Math.abs(v - settingsStore.eqBands[i]) > 0.001)
)

// store 值被外部（预置/重置）改写后，同步回草稿
watch(
  () => settingsStore.eqBands,
  (bands) => {
    pendingBands.value = bands.slice()
  },
  { deep: true }
)

function onBandInput(index: number, value: number): void {
  // 数组整体替换以触发响应式
  pendingBands.value = pendingBands.value.map((v, i) => (i === index ? value : v))
}

/** 预置为 live 动作：立即写入 store/引擎，再同步草稿 */
function onPresetChange(presetKey: string): void {
  settingsStore.applyEQPreset(presetKey)
}

/** 重置为 live 动作：开启 + 平直 0dB */
function onResetEQ(): void {
  settingsStore.resetEQ()
}

/** 提交草稿到 store（立即作用于音频引擎） */
function applyEQ(): void {
  if (!eqDirty.value) return
  settingsStore.commitEQBands(pendingBands.value)
}

/** 撤销草稿，回到 store 当前值 */
function revertEQ(): void {
  pendingBands.value = settingsStore.eqBands.slice()
}

function formatDb(v: number): string {
  const n = Math.round(v * 10) / 10
  if (n > 0) return '+' + n.toFixed(1)
  if (n < 0) return n.toFixed(1)
  return '0'
}

function dbClass(v: number): '' | 'is-pos' | 'is-neg' {
  if (v > 0) return 'is-pos'
  if (v < 0) return 'is-neg'
  return ''
}

// ============ 事件 ============
const onActionClick = (key: string): void => {
  if (key === 'history') activeTab.value = 'history'
  else if (key === 'settings') activeTab.value = 'settings'
  else if (key === 'download') downloadStore.setShowDownloadManager(true)
}

const clearHistory = (): void => {
  playerStore.clearPlayHistory()
}

/** 唤起 TopBar 里的扫码登录弹窗（开关在 user store 共享） */
const handleLogin = (): void => {
  userStore.openLoginModal()
}

/** 注销：清 cookie + 推荐流回到匿名态，与 TopBar 注销走同一 store */
const handleLogout = async (): Promise<void> => {
  try {
    await userStore.logout()
    await recommendStore.load()
  } catch (e) {
    console.error('[MineView] 注销失败:', e)
  }
}

// ============ 下载设置：下载目录（浏览/展示当前路径） ============
const downloadDirectory = ref('')
const isBrowsingDir = ref(false)

async function loadDownloadDirectory(): Promise<void> {
  try {
    const res = await (window as any).electronMyAPI?.download?.getDirectory?.()
    if (res?.code === 0 && res?.data) downloadDirectory.value = res.data
  } catch (e) {
    console.error('[MineView] 获取下载目录失败:', e)
  }
}

async function browseDownloadDirectory(): Promise<void> {
  if (isBrowsingDir.value) return
  isBrowsingDir.value = true
  try {
    const api = (window as any).electronMyAPI?.download
    const sel = await api?.selectDirectory?.()
    if (sel?.code === 0 && sel?.data && !sel.data.canceled && sel.data.path) {
      const set = await api?.setDirectory?.(sel.data.path)
      if (set?.code === 0) downloadDirectory.value = sel.data.path
    }
  } catch (e) {
    console.error('[MineView] 选择下载目录失败:', e)
  } finally {
    isBrowsingDir.value = false
  }
}

// ============ 缓存管理：大小统计 + 清理（含确认弹窗） ============
const cacheSize = ref(0)
const isCalculatingCache = ref(false)
const isClearingCache = ref(false)
const showClearCacheConfirm = ref(false)

function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

async function loadCacheSize(): Promise<void> {
  if (isCalculatingCache.value) return
  isCalculatingCache.value = true
  try {
    const res = await (window as any).electronMyAPI?.app?.getCacheSize?.()
    if (res?.code === 0) cacheSize.value = res.size || 0
  } catch (e) {
    console.error('[MineView] 计算缓存大小失败:', e)
  } finally {
    isCalculatingCache.value = false
  }
}

async function clearCache(): Promise<void> {
  if (isClearingCache.value) return
  isClearingCache.value = true
  try {
    const res = await (window as any).electronMyAPI?.app?.clearCache?.()
    if (res?.code === 0) {
      // 清理后重新统计，避免 UI 与实际磁盘不符
      await loadCacheSize()
    }
  } catch (e) {
    console.error('[MineView] 清理缓存失败:', e)
  } finally {
    isClearingCache.value = false
    showClearCacheConfirm.value = false
  }
}

// ============ 关于：应用信息 ============
const appInfo = ref<{ name: string; version: string }>({ name: 'Dark Music', version: '' })

async function loadAppInfo(): Promise<void> {
  try {
    const res = await (window as any).electronMyAPI?.app?.getInfo?.()
    if (res?.code === 0 && res?.data) appInfo.value = res.data
  } catch (e) {
    console.error('[MineView] 获取应用信息失败:', e)
  }
}

// ============ 关于：检查更新 ============
const updateChecking = ref(false)
const updateStatus = ref('')

async function checkForUpdate(): Promise<void> {
  if (updateChecking.value) return
  updateChecking.value = true
  updateStatus.value = ''
  try {
    const api = (window as any).electronMyAPI
    if (!api?.checkForUpdates) {
      updateStatus.value = '当前环境不支持检查更新'
      return
    }
    const res = await api.checkForUpdates()
    if (res?.success) {
      // 主进程 autoDownload=true：发现新版本会自动下载，装好等用户确认
      updateStatus.value = '已是最新，或有新版本时将自动下载并在安装前提示你'
    } else {
      updateStatus.value = res?.message || '检查更新失败'
    }
  } catch (e: any) {
    updateStatus.value = e?.message || '检查更新失败'
  } finally {
    updateChecking.value = false
  }
}

// 进入设置 tab 时按需拉取一次
watch(activeTab, (tab) => {
  if (tab === 'settings') {
    loadDownloadDirectory()
    loadCacheSize()
    loadAppInfo()
  }
})
// 如果挂载时已在设置 tab（不太可能但兜底）
if (activeTab.value === 'settings') {
  loadDownloadDirectory()
  loadCacheSize()
  loadAppInfo()
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

/* 已登录态的「退出登录」用幽灵按钮，与渐变登录按钮区分 */
.logout-btn {
  background: transparent;
  color: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: none;
  flex-shrink: 0;
}

.logout-btn:hover {
  color: #ff6b6b;
  border-color: rgba(255, 107, 107, 0.5);
  background: rgba(255, 107, 107, 0.08);
  box-shadow: none;
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

/* 序号样式：基础 .rank 已全局化，这里只保留历史列表前三名的强调色 */
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
  object-fit: cover;
}

/* 历史 tab 空状态（原复用歌单的 pl-empty，歌单迁出后独立成类） */
.history-empty {
  padding: 32px 0;
  text-align: center;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.35);
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

/* —— 设置卡片 / 播放历史：浅色模式（与顶部框架同一套浅底体系） —— */
.light .setting-card-title {
  color: rgba(40, 40, 46, 0.45);
}

.light .setting-row {
  background: rgba(0, 0, 0, 0.03);
  border-color: rgba(0, 0, 0, 0.06);
}

.light .row-title {
  color: rgba(24, 24, 28, 0.9);
}

.light .row-desc {
  color: rgba(40, 40, 46, 0.5);
}

.light .mode-switch {
  background: rgba(0, 0, 0, 0.05);
}

.light .mode-btn {
  color: rgba(24, 24, 28, 0.55);
}

.light .mode-btn:not(.active):hover {
  color: rgba(24, 24, 28, 0.85);
}

.light .switch-track {
  background: rgba(0, 0, 0, 0.15);
}

.light .slider {
  background: rgba(0, 0, 0, 0.12);
}

.light .slider::-webkit-slider-thumb {
  border-color: #ffffff;
}

.light .slider-value {
  color: rgba(40, 40, 46, 0.55);
}

.light .history-item {
  background: rgba(0, 0, 0, 0.03);
  border-color: rgba(0, 0, 0, 0.05);
}

/* 共享行样式（history-title/history-up/history-duration/rank）及其浅色覆盖已全局化 */

/* ============ 设置区小按钮（应用/撤销/重置） ============ */
.slider-row {
  gap: 8px;
}

/* 有未应用修改时，「应用」高亮+脉冲 */
.mini-btn.btn-apply.is-active {
  color: #fff;
  border-color: transparent;
  background: var(--brand-grad);
  box-shadow: 0 2px 12px rgba(var(--brand-rgb), 0.4);
  animation: apply-pulse 1.6s ease-in-out infinite;
}

@keyframes apply-pulse {
  0%,
  100% {
    box-shadow: 0 2px 12px rgba(var(--brand-rgb), 0.35);
  }
  50% {
    box-shadow: 0 2px 20px rgba(var(--brand-rgb), 0.65);
  }
}

/* ============ 均衡器 ============ */
.eq-body {
  margin: 4px 0 6px;
  padding: 16px 18px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  transition: opacity 0.2s ease;
}

.eq-body.is-disabled {
  opacity: 0.45;
  pointer-events: none;
}

.eq-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}

.eq-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.eq-bands {
  display: flex;
  gap: 6px;
}

.eq-band {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.eq-db {
  height: 16px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  font-variant-numeric: tabular-nums;
}

.eq-db.is-pos {
  color: var(--brand);
}

.eq-db.is-neg {
  color: #5fb3d4;
}

.eq-slider-wrap {
  position: relative;
  width: 28px;
  height: 140px;
  display: flex;
  justify-content: center;
}

/* 0dB 参考横线 */
.eq-track-zero {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
  background: rgba(255, 255, 255, 0.22);
  pointer-events: none;
}

.eq-slider {
  -webkit-appearance: slider-vertical;
  appearance: slider-vertical;
  writing-mode: vertical-lr;
  direction: rtl;
  width: 24px;
  height: 140px;
  margin: 0;
  background: transparent;
  cursor: pointer;
}

.eq-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 10px;
  border-radius: 2px;
  background: #2a2a2a;
  border: 1px solid var(--brand);
  cursor: pointer;
}

.eq-slider[data-pos='pos']::-webkit-slider-thumb {
  border-color: var(--brand);
}

.eq-slider[data-pos='neg']::-webkit-slider-thumb {
  border-color: #5fb3d4;
}

.eq-slider[data-pos='zero']::-webkit-slider-thumb {
  border-color: rgba(255, 255, 255, 0.35);
}

.eq-freq {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.45);
  letter-spacing: 0.3px;
}

/* ============ 歌词设置提示 ============ */
.setting-hint {
  margin: 2px 4px 0;
  font-size: 12px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.4);
}

/* ============ 新增控件的浅色模式 ============ */
.light .eq-body {
  background: rgba(0, 0, 0, 0.03);
  border-color: rgba(0, 0, 0, 0.06);
}

.light .eq-db {
  color: rgba(40, 40, 46, 0.4);
}

.light .eq-track-zero {
  background: rgba(0, 0, 0, 0.18);
}

.light .eq-slider::-webkit-slider-thumb {
  background: #f2f2f4;
}

.light .eq-freq,
.light .setting-hint {
  color: rgba(40, 40, 46, 0.45);
}

/* 我的歌单样式（pl-* / fav-*）已整体迁至 PlaylistView.vue */

/* ============ 下载设置 / 缓存管理 / 关于 ============ */
.path-text {
  display: block;
  max-width: 360px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 危险按钮 .btn-danger 与确认弹窗 .modal-* 已全局化到 main.css */

/* 关于卡片（内容直接铺在行容器内） */
.about-row {
  align-items: flex-start;
}

.about-content {
  min-width: 0;
}

.about-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.about-header .logo-text {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 0.5px;
}
.about-logo {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  flex-shrink: 0;
}

.about-header .version {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.06);
  padding: 2px 10px;
  border-radius: 20px;
}

.about-desc {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.45);
}

/* 检查更新 */
.about-update {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}
.update-check-btn {
  border: 1px solid rgba(var(--brand-rgb, 236, 109, 164), 0.4);
  background: rgba(var(--brand-rgb, 236, 109, 164), 0.1);
  color: var(--brand, #ec6da4);
  font-size: 12px;
  padding: 5px 14px;
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease;
}
.update-check-btn:hover:not(:disabled) {
  background: var(--brand, #ec6da4);
  color: #fff;
}
.update-check-btn:disabled {
  opacity: 0.6;
  cursor: default;
}
.update-status {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}

/* 浅色模式补充 */
.light .about-header .version {
  color: rgba(40, 40, 46, 0.5);
  background: rgba(0, 0, 0, 0.06);
}

.light .about-desc {
  color: rgba(40, 40, 46, 0.55);
}

.light .update-status {
  color: rgba(40, 40, 46, 0.5);
}
</style>
