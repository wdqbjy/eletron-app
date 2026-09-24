<template>
  <nav class="bottom-nav">
    <RouterLink
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="nav-item"
      :active-class="'active'"
    >
      <span class="nav-icon" v-html="item.icon"></span>
      <span class="nav-label">{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>

<script setup lang="ts">
const items: { to: string; label: string; icon: string }[] = [
  { to: '/', label: '首页', icon: '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 3 4 9v12h5v-6h6v6h5V9l-8-6z"/></svg>' },
  { to: '/search', label: '搜索', icon: '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.49 4.49 0 0 1 9.5 14z"/></svg>' },
  { to: '/playlist', label: '歌单', icon: '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>' },
  { to: '/mine', label: '我的', icon: '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5z"/></svg>' }
]
</script>

<style scoped>
.bottom-nav {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 900;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: 28px;
  /* 品牌色斜向淡晕 + 主题磨砂面：随所选主题色一起变色，与整体背景同源 */
  background:
    linear-gradient(135deg,
      rgba(var(--brand-rgb), 0.14) 0%,
      rgba(var(--brand-rgb), 0.03) 55%,
      rgba(var(--brand-rgb), 0) 100%),
    var(--chrome-surface);
  backdrop-filter: blur(20px) saturate(1.4);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
  border: 1px solid var(--chrome-border);
  box-shadow: var(--chrome-shadow);
  -webkit-app-region: no-drag;
  transition: background 0.25s ease, border-color 0.25s ease;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 14px;
  text-decoration: none;
  color: var(--chrome-text-faint);
  font-size: 11px;
  border-radius: 18px;
  user-select: none;
  transition: color 0.2s ease, background 0.2s ease;
}

.nav-item:hover {
  color: var(--chrome-text);
  background: var(--chrome-hover);
}

.nav-item.active {
  color: var(--brand);
  background: rgba(var(--brand-rgb), 0.15);
}

.nav-item.active .nav-icon {
  transform: scale(1.05);
}

.nav-icon {
  line-height: 0;
  transition: transform 0.2s ease;
}

.nav-label {
  font-weight: 500;
  letter-spacing: 0.3px;
}
</style>
