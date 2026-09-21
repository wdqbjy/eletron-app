<template>
  <div class="page playlist-page">
    <div class="hero">
      <h2 class="text-gradient">我的歌单</h2>
      <p>全部歌单 · 收藏</p>
    </div>

    <div class="section">
      <h3>歌单列表</h3>
      <div class="playlist-grid">
        <div v-for="pl in playlists" :key="pl.id" class="playlist-card">
          <div class="pl-cover" :style="{ background: pl.bg }">
            <span class="pl-icon">♪</span>
          </div>
          <div class="pl-info">
            <div class="pl-name">{{ pl.name }}</div>
            <div class="pl-count">{{ pl.count }} 首</div>
          </div>
        </div>
      </div>
      <p class="hint">歌单数据暂为占位，后续可接 B 站收藏/歌单接口或本地化存储。</p>
    </div>
  </div>
</template>

<script setup lang="ts">
const playlists = [
  { id: 1, name: '我喜欢的音乐', count: 128, bg: 'var(--brand-grad)' },
  { id: 2, name: '深夜循环', count: 42, bg: 'linear-gradient(135deg,#7f7fd5,#86a8e7)' },
  { id: 3, name: '通勤路上', count: 66, bg: 'linear-gradient(135deg,#43cea2,#185a9d)' },
  { id: 4, name: 'ACG 燃曲', count: 35, bg: 'linear-gradient(135deg,#f7971e,#ffd200)' },
  { id: 5, name: '白噪音', count: 18, bg: 'linear-gradient(135deg,#a8a29e,#57534e)' }
]
</script>

<style scoped>
.page {
  padding: 20px 24px 16px;
  max-width: 960px;
  margin: 0 auto;
}
.hero h2 {
  font-size: 26px;
  font-weight: 800;
  margin-bottom: 6px;
}
.hero p {
  color: var(--ev-c-text-2);
}
.section h3 {
  margin: 18px 0 12px;
  font-size: 16px;
  color: var(--ev-c-text-1);
}
.playlist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 14px;
}
.playlist-card {
  border-radius: 12px;
  overflow: hidden;
  background: var(--color-background-soft);
  border: 1px solid var(--ev-c-gray-1);
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
.playlist-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.14);
}
.pl-cover {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pl-icon {
  font-size: 42px;
  color: rgba(255, 255, 255, 0.92);
}
.pl-info {
  padding: 8px 10px 10px;
}
.pl-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--ev-c-text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pl-count {
  font-size: 12px;
  color: var(--ev-c-text-2);
  margin-top: 2px;
}
.hint {
  margin-top: 14px;
  font-size: 12px;
  color: var(--ev-c-text-3);
}
</style>