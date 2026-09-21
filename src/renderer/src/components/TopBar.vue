<template>
  <header ref="topbarRef" class="topbar">
    <!-- 左侧：品牌 -->
    <div class="topbar-left">
      <span class="brand-dot" :class="{ dark: theme === 'dark' }"></span>
      <h1 class="brand">{{ appTitle }}</h1>
    </div>

    <!-- 右侧：操作按钮 + 窗口控制 -->
    <div class="topbar-right">
      <!-- 一键切换深浅色模式 -->
      <button class="topbar-btn theme-quick-toggle" :title="themeLabel" @click="toggleTheme">
        <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
          <template v-if="theme === 'dark'">
            <!-- 月亮 -->
            <path
              d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z"
            />
          </template>
          <template v-else>
            <!-- 太阳 -->
            <path
              d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"
            />
          </template>
        </svg>
      </button>

      <!-- 登录 B 站 -->
      <button class="topbar-btn login-btn" title="登录 B 站" @click="handleLogin">
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
        </svg>
        <span class="login-text">登录 B 站</span>
      </button>

      <!-- 窗口控制（自定义标题栏） -->
      <div class="window-controls">
        <button class="control-btn minimize" @click="handleMinimize" title="最小化">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M4 12H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>

        <button class="control-btn maximize" @click="handleMaximize" :title="isMaximized ? '还原' : '最大化'">
          <svg v-if="!isMaximized" width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M3 3H21V21H3V3Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
          </svg>
          <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M5 5H19V19H5V5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
            <path d="M8 2V5M16 2V5M8 19V22M16 19V22" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>

        <button class="control-btn close" @click="handleClose" title="关闭">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useThemeStore } from '../stores/theme'

// 呼应 pink-music 的 topbarRef（Liquid Glass 等效果运用时可挂到该 DOM 上）
const topbarRef = ref<HTMLElement | null>(null)

const winIpc = window as any

const appTitle = ref('Pink Music')
const isMaximized = ref(false)

const handleLogin = (): void => {
  // TODO: 接入 B 站 OAuth 登录流程
  console.log('登录 B 站')
}

// —— 主题（全局 store，整应用联动）——
const themeStore = useThemeStore()
themeStore.init() // 幂等：仅首次读取，避免重复副作用
const theme = computed(() => themeStore.theme)
const themeLabel = computed(() => (theme.value === 'dark' ? '切换到浅色模式' : '切换到深色模式'))
const toggleTheme = (): void => themeStore.toggle()

// —— 窗口控制 ——
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
  // topbarRef 的实际用途：把头部高度暴露成 CSS 变量，供内容区避让 fixed 头
  if (topbarRef.value) {
    document.documentElement.style.setProperty('--topbar-height', `${topbarRef.value.offsetHeight}px`)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (resizeTimer) clearTimeout(resizeTimer)
})
</script>

<style scoped>
/* ============ 主体：整条可拖拽，兼作应用头部 ============ */
.topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-left: 16px;
  z-index: 1000;
  -webkit-app-region: drag;
  user-select: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(20, 20, 24, 0.85);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  color: rgba(255, 255, 255, 0.88);
}

/* 浅色模式下 TopBar 仍保持深色（Pink Music 风格） */
.light .topbar {
  background: rgba(20, 20, 24, 0.85);
  color: rgba(255, 255, 255, 0.88);
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  -webkit-app-region: no-drag;
}

.brand {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.3px;
  color: rgba(255, 255, 255, 0.92);
}

.brand-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--brand-grad);
  box-shadow: 0 0 8px rgba(var(--brand-rgb-2), 0.7);
}

/* ============ 右侧按钮区 ============ */
.topbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
  -webkit-app-region: no-drag;
}

.topbar-btn {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.78);
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.18s ease, color 0.18s ease;
}

.topbar-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.login-btn {
  width: auto;
  padding: 0 12px;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  background: rgba(var(--brand-rgb), 0.18);
  border: 1px solid rgba(var(--brand-rgb), 0.35);
  border-radius: 14px;
}

.login-btn:hover {
  background: rgba(var(--brand-rgb), 0.3);
  color: #fff;
}

.login-text {
  font-weight: 500;
}

/* ============ 窗口控制 ============ */
.window-controls {
  display: flex;
  align-items: center;
  gap: 2px;
  padding-left: 8px;
  margin-left: 8px;
}

.control-btn {
  width: 34px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease;
}

.control-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.control-btn.close:hover {
  background: #e81123;
  color: #ffffff;
}
</style>