<template>
  <Teleport to="body">
    <div class="plm-overlay" @click.self="close">
      <div class="plm-modal">
        <header class="plm-head">
          <h3 class="plm-title">
            {{ pending ? '收藏到歌单' : '歌单管理' }}
            <span v-if="pending" class="plm-track">{{ pending.title }}</span>
          </h3>
          <button class="wc-note plm-close" title="关闭" @click="close">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </header>

        <div class="plm-body">
          <!-- 已有歌单 -->
          <ul v-if="list.length" class="plm-list">
            <li
              v-for="pl in list"
              :key="pl.id"
              class="plm-item"
              :class="{ defaulted: pl.isDefault }"
            >
              <span class="plm-name">{{ pl.name }}
                <em v-if="pl.isDefault" class="plm-default">默认</em>
              </span>
              <span class="plm-count">{{ pl.songs.length }} 首</span>
              <button
                class="plm-act"
                :class="{ saved: isFav(pl.id) && !!pending }"
                :title="isFav(pl.id) && pending ? '已收藏' : '加入此歌单'"
                @click="add(pl.id)"
              >
                <template v-if="pl.isDefault">
                  <svg v-if="isFav(pl.id) && pending" viewBox="0 0 24 24" width="15" height="15"
                    fill="currentColor"><path d="m12 2 3 6.5 7 .9-5.2 4.9 1.4 7L12 18l-6.2 3.3 1.4-7L2 9.4l7-.9z"/></svg>
                  <svg v-else viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 3v18M3 12h18" stroke-width="3" stroke="currentColor"/></svg>
                </template>
                <span v-else class="add-glyph">+</span>
              </button>
              <button
                v-if="!pl.isDefault"
                class="plm-del"
                title="重命名"
                @click="rename(pl)"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
                  stroke-width="2" stroke-linecap="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 3 22l1.5-4.5z"/></svg>
              </button>
              <button v-if="!pl.isDefault" class="plm-del" title="删除" @click="remove(pl)">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
                  stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
              </button>
            </li>
          </ul>
          <p v-else class="plm-empty">还没有歌单，创建一个吧</p>

          <!-- 新建歌单 -->
          <form class="plm-create" @submit.prevent="create">
            <input
              v-model="newName"
              class="plm-input"
              placeholder="新歌单名称"
              maxlength="30"
            />
            <button class="plm-submit" type="submit" :disabled="!newName.trim()">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
              创建
            </button>
          </form>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { usePlaylistStore, type Playlist } from '../stores/playlist'
import { usePlayerStore } from '../stores/player'

const playlist = usePlaylistStore()
const player = usePlayerStore()

const pending = computed(() => playlist.pendingMusic)
const list = computed(() => playlist.playlists)
const newName = ref('')

function close() {
  playlist.closePlaylistModal()
}
function isFav(id: string): boolean {
  if (!player.current) return false
  const pl = playlist.playlists.find((p) => p.id === id)
  return pl ? pl.songs.some((s) => s.bvid === player.current!.bvid) : false
}
function add(id: string) {
  if (!pending.value) return
  playlist.addToPlaylist(pending.value, id)
}
function create() {
  const pl = playlist.createPlaylist(newName.value)
  if (pl) {
    newName.value = ''
    // 创建即收藏当前曲目（若在收藏流程中打开）
    if (pending.value) playlist.addToPlaylist(pending.value, pl.id)
  }
}
function remove(pl: Playlist) {
  if (pl.isDefault) return
  if (confirm(`删除歌单「${pl.name}」？`)) playlist.deletePlaylist(pl.id)
}
function rename(pl: Playlist) {
  if (pl.isDefault) return
  const name = prompt('重命名歌单', pl.name)
  if (name) playlist.renamePlaylist(pl.id, name)
}
</script>

<style scoped>
.plm-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(3px);
}
.plm-modal {
  width: 360px;
  max-width: calc(100vw - 48px);
  max-height: 78vh;
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  background: var(--color-background, #fff);
  color: var(--chrome-text, #222);
  border: 1px solid var(--chrome-border, rgba(0,0,0,.08));
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}
.plm-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--chrome-border, rgba(0,0,0,.08));
}
.plm-title {
  flex: 1;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.plm-track {
  font-size: 12px;
  font-weight: 400;
  color: var(--chrome-text-faint, #888);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.wc-note {
  border: none;
  background: transparent;
  color: var(--chrome-text-faint, #888);
  cursor: pointer;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.wc-note:hover {
  background: var(--chrome-hover, rgba(0,0,0,.06));
  color: var(--chrome-text, #222);
}
.plm-body {
  padding: 10px 12px 14px;
  overflow-y: auto;
  flex: 1;
}
.plm-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.plm-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: default;
}
.plm-item:hover {
  background: var(--chrome-hover, rgba(0,0,0,.05));
}
.plm-name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.plm-default {
  font-style: normal;
  font-size: 10px;
  color: #fff;
  background: var(--brand, #ec6da4);
  border-radius: 6px;
  padding: 1px 5px;
  margin-left: 6px;
  vertical-align: 2px;
}
.plm-count {
  font-size: 11px;
  color: var(--chrome-text-faint, #888);
}
.plm-act {
  border: none;
  background: var(--chrome-hover, rgba(0,0,0,.06));
  color: var(--chrome-text, #222);
  width: 26px;
  height: 26px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.plm-act:hover {
  background: var(--brand, #ec6da4);
  color: #fff;
}
.plm-act.saved {
  background: var(--brand, #ec6da4);
  color: #fff;
}
.add-glyph {
  font-size: 17px;
  line-height: 1;
}
.plm-del {
  border: none;
  background: transparent;
  color: var(--chrome-text-faint, #a0a0a0);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.plm-del:hover {
  color: #e81123;
  background: rgba(232, 17, 35, 0.08);
}
.plm-empty {
  text-align: center;
  color: var(--chrome-text-faint, #999);
  font-size: 13px;
  padding: 24px 0;
}
.plm-create {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  border-top: 1px dashed var(--chrome-border, rgba(0,0,0,.1));
  padding-top: 12px;
}
.plm-input {
  flex: 1;
  border: 1px solid var(--chrome-border, rgba(0,0,0,.15));
  background: var(--color-background-soft, #f5f5f5);
  color: var(--chrome-text, #222);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  outline: none;
}
.plm-input:focus {
  border-color: var(--brand, #ec6da4);
}
.plm-submit {
  border: none;
  background: var(--brand-grad, linear-gradient(90deg,#ec6da4,#f9a8d4));
  color: #fff;
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}
.plm-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>