<template>
  <div class="page search-page">
    <div class="hero">
      <h2 class="text-gradient">搜索音乐</h2>
      <p>走完整调用链：Renderer → IPC → 主进程 B 站 API（无需登录）</p>
    </div>
    <BiliSearch />
  </div>
</template>

<script setup lang="ts">
import BiliSearch from '../components/BiliSearch.vue'
</script>

<style scoped>
.page {
  padding: 20px 24px 16px;
  max-width: 960px;
  margin: 0 auto;
}
.hero {
  padding: 28px 0 8px;
}
.hero h2 {
  font-size: 26px;
  font-weight: 800;
  margin-bottom: 6px;
}
.hero p {
  color: var(--ev-c-text-2);
}
</style>