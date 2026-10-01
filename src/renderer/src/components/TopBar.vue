<template>
  <header ref="topbarRef" class="topbar" @dblclick="onTitleBarDblClick">
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

      <!-- 登录 B 站 / 已登录显示用户名 / 注销按钮 -->
      <button
        v-if="!isLoggedIn"
        class="topbar-btn login-btn"
        title="登录 B 站"
        @click="userStore.openLoginModal()"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
        </svg>
        <span class="login-text">登录 B 站</span>
      </button>
      <button
        v-else
        class="topbar-btn login-btn"
        :title="`已登录：${userStore.userInfo?.uname || ''}（点击注销）`"
        @click="handleLogout"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
        <span class="login-text">{{ userStore.userInfo?.uname || '已登录' }}</span>
      </button>

      <!-- 窗口控制（自定义标题栏；可在「我的-窗口设置」关闭） -->
      <div v-if="showWindowControls" class="window-controls">
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

  <!-- 扫码登录弹窗（与 PlayerPage 同思路 Teleport 到 body，避免被应用内层叠上下文影响） -->
  <Teleport to="body">
    <Transition name="login-modal">
      <div v-if="userStore.loginModalOpen" class="login-modal-mask" @click.self="closeLoginModal">
        <div class="login-modal" @click.stop>
          <button class="login-modal-close" title="关闭" @click="closeLoginModal">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
          <h3 class="login-modal-title">扫码登录 B 站</h3>
          <p class="login-modal-tip">使用 B 站手机 App 扫描下方二维码完成登录，登录后推荐音乐将携带登录态。</p>
          <div class="login-qr-wrapper">
            <canvas
              v-show="qrcodeUrl"
              ref="qrcodeCanvasRef"
              class="login-qr-canvas"
            ></canvas>
            <div v-if="!qrcodeUrl" class="login-qr-placeholder">二维码生成中…</div>
          </div>
          <p v-if="loginStatus" class="login-status">{{ loginStatus }}</p>
          <p v-if="loginError" class="login-error">{{ loginError }}</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import QRCode from 'qrcode'
import { useThemeStore } from '../stores/theme'
import { useRecommendStore } from '../stores/recommend'
import { useSettingsStore } from '../stores/settings'
import { useUserStore } from '../stores/user'

// topbarRef：Liquid Glass 等效果运用时可挂到该 DOM 上
const topbarRef = ref<HTMLElement | null>(null)

const winIpc = window as any

const appTitle = ref('Dark Music')
const isMaximized = ref(false)

// ============== B 站扫码登录（登录态收敛到 user store，与「我的」页共享） ==============
const userStore = useUserStore()
const isLoggedIn = computed(() => userStore.isLoggedIn)
const recommendStore = useRecommendStore()

// 弹窗开关在 user store（「我的」页也能唤起）；以下是弹窗内的二维码流程状态
const qrcodeUrl = ref('')
const qrcodeKey = ref('')
const qrcodeCanvasRef = ref<HTMLCanvasElement | null>(null)
const loginStatus = ref('')
const loginError = ref('')
let pollTimer: ReturnType<typeof setInterval> | null = null
let pollDeadline = 0
const POLL_INTERVAL_MS = 2000
// 二维码有效期约 180s，过期前持续轮询
const POLL_TIMEOUT_MS = 180000

/** 弹窗打开后生成二维码并开始轮询（store 开关由本组件与「我的」页共同控制） */
async function startQrLoginFlow(): Promise<void> {
  if (!winIpc.electronMyAPI?.bilibili) return
  loginError.value = ''
  loginStatus.value = '正在生成二维码…'
  qrcodeUrl.value = ''
  qrcodeKey.value = ''
  try {
    const res = await winIpc.electronMyAPI.bilibili.generateQrcode()
    if (res?.code === 0 && res?.data) {
      // B 站返回 data.url（待编码的登录 URL）与 data.qrcode_key，
      // 不返回图片；这里用 qrcode 库把 url 绘制到 canvas
      qrcodeUrl.value = res.data.url || ''
      qrcodeKey.value = res.data.qrcode_key || ''
      loginStatus.value = '请使用 B 站 App 扫码'
      await nextTick()
      if (qrcodeCanvasRef.value && qrcodeUrl.value) {
        await QRCode.toCanvas(qrcodeCanvasRef.value, qrcodeUrl.value, {
          width: 196,
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' }
        })
      }
      startPolling()
    } else {
      loginError.value = res?.message || '生成二维码失败'
      loginStatus.value = ''
    }
  } catch (e: any) {
    loginError.value = e?.message || '生成二维码失败'
    loginStatus.value = ''
  }
}

/** 关闭弹窗并停止轮询 */
function closeLoginModal(): void {
  userStore.closeLoginModal()
  stopPolling()
  loginStatus.value = ''
  loginError.value = ''
  qrcodeUrl.value = ''
  qrcodeKey.value = ''
}

/** 启动轮询扫码登录状态（每 2s 一次，过期或成功后停止） */
function startPolling(): void {
  stopPolling()
  if (!qrcodeKey.value) return
  pollDeadline = Date.now() + POLL_TIMEOUT_MS
  pollTimer = setInterval(pollQrcodeOnce, POLL_INTERVAL_MS)
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function pollQrcodeOnce(): Promise<void> {
  if (!qrcodeKey.value || !winIpc.electronMyAPI?.bilibili) return
  if (Date.now() > pollDeadline) {
    stopPolling()
    loginError.value = '二维码已过期，请重新生成'
    loginStatus.value = ''
    return
  }
  try {
    const res = await winIpc.electronMyAPI.bilibili.pollQrcode(qrcodeKey.value)
    const pollData = res?.data?.data
    // 0=成功 86101=未扫码 86090=已扫码确认中 86038=已失效 86039=未确认
    const code = pollData?.code
    if (res?.code === 0 && code === 0) {
      // 登录成功
      stopPolling()
      loginStatus.value = '登录成功，正在刷新…'
      userStore.closeLoginModal()
      await userStore.refresh()
      // 推荐流携带登录态重拉一次
      await recommendStore.load()
    } else if (code === 86090) {
      loginStatus.value = '已扫码，请在手机上确认'
    } else if (code === 86038 || code === 86039) {
      stopPolling()
      loginError.value = pollData?.message || '二维码已失效，请重新生成'
      loginStatus.value = ''
    } else if (code === 86101) {
      loginStatus.value = '请使用 B 站 App 扫码'
    } else {
      loginStatus.value = pollData?.message || '等待扫码…'
    }
  } catch (e: any) {
    // 单次轮询失败不停止，继续重试
    console.error('[TopBar] 轮询扫码状态失败:', e)
  }
}

/** 注销：清空 session cookie + 文件，再恢复匿名态推荐流 */
async function handleLogout(): Promise<void> {
  try {
    await userStore.logout()
    // 注销后推荐流回到匿名状态，重拉一次
    await recommendStore.load()
  } catch (e: any) {
    console.error('[TopBar] 注销失败:', e)
  }
}

// 弹窗开关变化：打开则生成二维码，关闭/中途关掉则停止轮询
watch(
  () => userStore.loginModalOpen,
  (open) => {
    if (open) {
      startQrLoginFlow()
    } else {
      stopPolling()
    }
  }
)

// —— 主题（全局 store，整应用联动）——
const themeStore = useThemeStore()
const settingsStore = useSettingsStore()

const theme = computed(() => themeStore.theme)
const themeLabel = computed(() => (theme.value === 'dark' ? '切换到浅色模式' : '切换到深色模式'))
const toggleTheme = (): void => themeStore.toggle()

// 窗口控制按钮：仅受设置开关控制（mac 上主进程 frame:false 同样没有系统交通灯，
// 必须显示自定义按钮，否则无法最小化/最大化/关闭）
const showWindowControls = computed(() => settingsStore.windowControlsEnabled !== false)

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
// 双击标题栏空白处切换最大化/还原（Windows 标题栏惯例）；
// 命中可交互元素（按钮/输入框/弹窗）时不触发，避免误切换
const onTitleBarDblClick = (e: MouseEvent): void => {
  const target = e.target as HTMLElement | null
  if (target && target.closest('button, input, select, a, .login-modal, .window-controls')) return
  handleMaximize()
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
  // 启动时通过 /x/web-interface/nav 检查登录态（主进程已从 JSON/session 恢复 cookie）
  userStore.refresh()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (resizeTimer) clearTimeout(resizeTimer)
  stopPolling()
})
</script>

<style scoped>
/* ============ 主体：整条可拖拽，兼作应用头部 ============
   背景采用「品牌色晕 + 页面底色」双层渐变，底部向页面透明过渡、无分割线，
   与 app-root 的主题光晕连成一整片；滚动内容从下方经过时由磨砂层承接。 */
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
  border-bottom: none;
  background:
    linear-gradient(180deg,
      rgba(var(--brand-rgb), 0.18) 0%,
      rgba(var(--brand-rgb), 0.06) 46%,
      rgba(var(--brand-rgb), 0) 100%),
    linear-gradient(180deg,
      rgba(var(--bg-rgb), 0.72) 0%,
      rgba(var(--bg-rgb), 0.4) 58%,
      rgba(var(--bg-rgb), 0.12) 100%);
  backdrop-filter: blur(20px) saturate(1.4);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
  color: var(--chrome-text);
  transition: background 0.25s ease, color 0.25s ease;
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
  color: var(--chrome-text);
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
  color: var(--chrome-text-soft);
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.18s ease, color 0.18s ease;
}

.topbar-btn:hover {
  background: var(--chrome-hover);
  color: var(--chrome-text);
}

.login-btn {
  width: auto;
  padding: 0 12px;
  gap: 6px;
  font-size: 12px;
  color: var(--chrome-text);
  background: rgba(var(--brand-rgb), 0.18);
  border: 1px solid rgba(var(--brand-rgb), 0.35);
  border-radius: 14px;
}

.login-btn:hover {
  background: rgba(var(--brand-rgb), 0.3);
  color: var(--chrome-text);
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
  color: var(--chrome-text-soft);
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease;
}

/* 图标 hover 微放大 + 按压缩小，增强点击反馈 */
.control-btn svg {
  transition: transform 0.16s ease;
}

.control-btn:hover {
  background: var(--chrome-hover);
  color: var(--chrome-text);
}

.control-btn:hover svg {
  transform: scale(1.08);
}

.control-btn:active svg {
  transform: scale(0.82);
}

/* 键盘导航焦点环 */
.control-btn:focus-visible {
  outline: 2px solid var(--brand, #ec6da4);
  outline-offset: -2px;
  border-radius: 6px;
}

.control-btn.close:hover {
  background: #e81123;
  color: #ffffff;
}

.control-btn.close:active {
  background: #c50f1f;
  color: #ffffff;
}

/* ============ 扫码登录弹窗 ============ */
.login-modal-mask {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.login-modal {
  position: relative;
  width: 320px;
  padding: 24px 24px 20px;
  border-radius: 16px;
  background: var(--color-background, #fff);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.32);
  color: var(--color-text, #222);
  text-align: center;
}

.login-modal-close {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--chrome-text-soft, #999);
  border-radius: 8px;
  cursor: pointer;
}
.login-modal-close:hover {
  background: rgba(0, 0, 0, 0.06);
  color: var(--chrome-text, #333);
}

.login-modal-title {
  margin: 0 0 6px;
  font-size: 16px;
  font-weight: 700;
}
.login-modal-tip {
  margin: 0 0 16px;
  font-size: 12px;
  color: var(--chrome-text-soft, #999);
  line-height: 1.5;
}

.login-qr-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 200px;
  height: 200px;
  margin: 0 auto;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.08);
}
.login-qr-canvas {
  display: block;
  width: 100%;
  height: 100%;
}
.login-qr-placeholder {
  font-size: 13px;
  color: var(--chrome-text-soft, #999);
}

.login-status {
  margin: 14px 0 0;
  font-size: 13px;
  color: var(--brand, #ff5c8a);
}
.login-error {
  margin: 10px 0 0;
  font-size: 12px;
  color: #e81123;
}

.login-modal-enter-active,
.login-modal-leave-active {
  transition: opacity 0.18s ease;
}
.login-modal-enter-from,
.login-modal-leave-to {
  opacity: 0;
}
</style>