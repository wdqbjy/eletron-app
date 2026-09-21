<script setup lang="ts">
import { ref } from 'vue'
import { useSearchStore } from '../stores/search'
import { useMusic } from '../composables/useMusic'
import { parseDuration } from '../utils/bilibili'

const state = useSearchStore()
const { handleSearch } = useMusic()

const note = ref('')

const onSearch = async (): Promise<void> => {
  note.value = ''
  await handleSearch()
  if (state.searched && state.results.length === 0) {
    note.value =
      '未搜到结果。搜索无需登录；若此前高频搜索，B 站会临时限流返回 code:-412，稍后再试即可。'
  }
}

const autoLoad = async () => {
  state.setQuery('周杰伦')
  note.value = '自动填充关键词「周杰伦」作为示例，点搜索发起完整调用链。'
  await handleSearch()
}
</script>

<template>
  <div class="bili-demo">
    <h3>B 站音乐搜索示例（pink-music 同源调用链）</h3>
    <div class="bar">
      <input
        v-model="state.query"
        placeholder="输入关键词，如：周杰伦"
        @keyup.enter="onSearch"
      />
      <button :disabled="state.loading" @click="onSearch">
        {{ state.loading ? '搜索中…' : '搜索' }}
      </button>
      <button class="ghost" :disabled="state.loading" @click="autoLoad">填充示例</button>
    </div>
    <p v-if="note" class="note">{{ note }}</p>

    <ul v-if="state.results.length" class="list">
      <li v-for="item of state.results" :key="item.bvid">
        <img :src="item.cover" alt="" class="cover" />
        <div class="meta">
          <div class="title" v-text="item.title" />
          <div class="sub">
            {{ item.author }} · {{ item.play }} 次播放 · {{ parseDuration(item.duration) }}s
          </div>
        </div>
        <a
          class="link"
          :href="`https://www.bilibili.com/video/${item.bvid}`"
          target="_blank"
          rel="noreferrer"
        >
          打开
        </a>
      </li>
    </ul>
    <p v-else-if="state.loading" class="note">加载中…</p>
  </div>
</template>

<style scoped>
.bili-demo {
  text-align: left;
  max-width: 760px;
  margin: 24px auto;
  font-size: 14px;
}
.bar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.bar input {
  flex: 1;
  padding: 6px 10px;
}
.bar button {
  padding: 6px 14px;
  cursor: pointer;
}
.bar .ghost {
  background: transparent;
  border: 1px solid var(--ev-c-gray-2);
  color: inherit;
}
.note {
  color: var(--ev-c-text-3);
  font-size: 12px;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.list li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--ev-c-gray-1);
}
.cover {
  width: 64px;
  height: 40px;
  object-fit: cover;
  border-radius: 4px;
  background: var(--color-background-mute);
}
.meta {
  flex: 1;
}
.title {
  font-weight: 600;
}
.sub {
  color: var(--ev-c-text-2);
  font-size: 12px;
}
.link {
  color: #4ea1f3;
  text-decoration: none;
}
</style>