<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import TopBar from './components/TopBar.vue'
import BottomNav from './components/BottomNav.vue'
import PlayerBar from './components/PlayerBar.vue'
import PlayerPage from './components/PlayerPage.vue'
import DownloadManager from './components/DownloadManager.vue'
import { useDownloadStore } from './stores/download'

const downloadStore = useDownloadStore()

// 启动时同步主进程内存任务 + 订阅下载进度推送
onMounted(() => {
  downloadStore.loadTasks()
  downloadStore.registerProgressListener()
})

onUnmounted(() => {
  downloadStore.unregisterProgressListener()
})
</script>

<template>
  <div class="app-root">
    <TopBar />
    <main class="app-main">
      <RouterView />
    </main>
    <BottomNav />
    <!-- 播放器固定在应用最底部，菜单在其上方 -->
    <PlayerBar />
    <!-- 歌词大页（点播放器封面弹出） -->
    <PlayerPage />
    <!-- 下载管理弹窗（卡片下载 / 我的-下载管理 触发） -->
    <DownloadManager />
  </div>
</template>

<style scoped>
.app-root {
  position: relative;
  height: 100vh;
  /* 主题色随 data-color 变更：-color-background 负责深/浅，这里叠一层主题色光晕，让背景随所选主题色一起变 */
  background:
    radial-gradient(ellipse at 70% 0%, rgba(var(--brand-rgb), 0.22) 0%, transparent 55%),
    radial-gradient(ellipse at 15% 90%, rgba(var(--brand-rgb), 0.14) 0%, transparent 50%),
    var(--color-background);
}

.app-main {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  padding-top: var(--topbar-height, 44px);
  padding-bottom: 140px;

  scrollbar-width: thin !important;
  scrollbar-color: var(--chrome-track) transparent !important;
}

/* 浅色模式滚动条（深色为默认白色半透明，见下方 ::-webkit 规则） */
.light .app-main::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.18) !important;
  background-clip: padding-box !important;
  border: 2px solid transparent !important;
}

/* WebKit 滚动条 —— 鼠标在容器上就全条变粉 */
.app-main::-webkit-scrollbar {
  width: 10px !important;
}
.app-main::-webkit-scrollbar-track {
  background: transparent !important;
}
.app-main::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.18) !important;
  border-radius: 5px !important;
  border: 2px solid transparent !important;
  background-clip: padding-box !important;
  transition: background-color 0.2s ease !important;
}
/* 鼠标在滚动容器上的任何位置 → 滑块变粉 */
.app-main:hover::-webkit-scrollbar-thumb {
  background: rgba(var(--brand-rgb), 0.85) !important;
  background-clip: padding-box !important;
  border: 2px solid transparent !important;
}
/* 鼠标精确放在滑块上 → 更深的粉 */
.app-main::-webkit-scrollbar-thumb:hover {
  background: rgba(var(--brand-rgb), 1) !important;
  background-clip: padding-box !important;
  border: 2px solid transparent !important;
}
.app-main::-webkit-scrollbar-thumb:active {
  background: linear-gradient(180deg, var(--brand) 0%, var(--brand-2) 100%) !important;
  background-clip: padding-box !important;
  border: 2px solid transparent !important;
}
</style>