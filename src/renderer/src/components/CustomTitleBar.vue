<template>
  <div class="title-bar" :class="{ 'windows-os': isWindows }">
    <div class="drag-region"></div>

    <div class="app-info">
      <!-- <img src="/vite.svg" alt="icon" class="app-icon" /> -->
      <span class="app-title">{{ appTitle }}</span>
    </div>

    <div class="window-controls">
      <button class="control-btn minimize" @click="handleMinimize" title="最小化">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M4 12H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>

      <button
        class="control-btn maximize"
        @click="handleMaximize"
        :title="isMaximized ? '还原' : '最大化'"
      >
        <svg v-if="!isMaximized" width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 3H21V21H3V3Z"
            stroke="currentColor"
            stroke-width="2"
            stroke-linejoin="round"
          />
        </svg>
        <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 5H19V19H5V5Z"
            stroke="currentColor"
            stroke-width="2"
            stroke-linejoin="round"
          />
          <path
            d="M8 2V5M16 2V5M8 19V22M16 19V22"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </button>

      <button class="control-btn close" @click="handleClose" title="关闭">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path
            d="M6 6L18 18M6 18L18 6"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const winIpc = window as any

const isMaximized = ref<boolean>(false)
const isWindows = ref<boolean>(false) //process.platform === 'win32'

const appTitle = ref('')
// 检查窗口最大化状态
const checkMaximized = async (): Promise<void> => {
  if (winIpc.electronAPI) {
    try {
      isMaximized.value = await winIpc.electronAPI.isMaximized()
    } catch (error) {
      console.error('Failed to get window state:', error)
    }
  }
}

// 窗口控制方法
const handleMinimize = (): void => {
  console.log('winIpc', winIpc)
  if (winIpc.electronMyAPI) {
    winIpc.electronMyAPI.minimize()
  }
}

const handleMaximize = (): void => {
  if (winIpc.electronMyAPI) {
    winIpc.electronMyAPI.maximize()
    // 延迟更新状态，等待窗口动画完成
    setTimeout(() => {
      checkMaximized()
    }, 100)
  }
}

const handleClose = (): void => {
  if (winIpc.electronMyAPI) {
    winIpc.electronMyAPI.close()
  }
}

// 防抖处理窗口大小变化
let resizeTimer: NodeJS.Timeout | null = null
const handleResize = (): void => {
  if (resizeTimer) {
    clearTimeout(resizeTimer)
  }
  resizeTimer = setTimeout(() => {
    checkMaximized()
  }, 100)
}

onMounted(() => {
  checkMaximized()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (resizeTimer) {
    clearTimeout(resizeTimer)
  }
})
</script>

<style scoped>
.title-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 38px;
  background: linear-gradient(135deg, #1e1e1e 0%, #2d2d2d 100%);
  display: flex;
  align-items: center;
  justify-content: space-between;
  -webkit-app-region: drag;
  z-index: 1000;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
}

.title-bar.windows-os {
  height: 32px;
}

.drag-region {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 100%;
  -webkit-app-region: drag;
  pointer-events: none;
}

.app-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 16px;
  -webkit-app-region: no-drag;
  z-index: 1;
}

.app-icon {
  width: 20px;
  height: 20px;
  filter: brightness(0) invert(1);
}

.app-title {
  font-size: 13px;
  font-weight: 500;
  color: #ffffff;
  opacity: 0.9;
  user-select: none;
}

.window-controls {
  display: flex;
  align-items: center;
  gap: 2px;
  padding-right: 12px;
  -webkit-app-region: no-drag;
  z-index: 1;
}

.control-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 4px;
}

.title-bar.windows-os .control-btn {
  width: 46px;
  height: 32px;
  border-radius: 0;
}

.control-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.control-btn.minimize:hover {
  background-color: rgba(255, 255, 255, 0.15);
}

.control-btn.maximize:hover {
  background-color: rgba(255, 255, 255, 0.15);
}

.control-btn.close:hover {
  background-color: #e81123;
  color: #ffffff;
}

.title-bar.windows-os .control-btn.close:hover {
  background-color: #e81123;
}

@media (prefers-color-scheme: dark) {
  .title-bar {
    background: linear-gradient(135deg, #1a1a1a 0%, #252525 100%);
  }
}
</style>
