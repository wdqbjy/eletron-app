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

        <Transition name="plm-toast">
          <div v-if="toast" class="plm-toast">{{ toast }}</div>
        </Transition>

        <div class="plm-body">
          <!-- 已有歌单 -->
          <ul v-if="list.length" class="plm-list">
            <li
              v-for="pl in list"
              :key="pl.id"
              class="plm-item"
              :class="{ defaulted: pl.isDefault }"
            >
              <!-- 重命名编辑态（替代 prompt，Electron 渲染进程不支持 window.prompt） -->
              <template v-if="editingId === pl.id">
                <input
                  v-model="editingName"
                  :ref="focusRenameInput"
                  class="plm-input"
                  placeholder="歌单名称"
                  maxlength="30"
                  @keyup.enter="commitRename(pl)"
                  @keyup.esc="cancelRename"
                />
                <button class="plm-act saved" title="确认重命名" @click="commitRename(pl)">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
                    stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                </button>
                <button class="plm-act" title="取消" @click="cancelRename">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
                    stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </template>
              <!-- 删除二次确认态（替代 confirm） -->
              <template v-else-if="deletingId === pl.id">
                <span class="plm-name plm-confirm-text">删除「{{ pl.name }}」？</span>
                <button class="plm-del danger" title="确认删除" @click="confirmDelete(pl)">删除</button>
                <button class="plm-act" title="取消" @click="deletingId = ''">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
                    stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </template>
              <!-- 正常态 -->
              <template v-else>
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
                  @click="startRename(pl)"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
                    stroke-width="2" stroke-linecap="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 3 22l1.5-4.5z"/></svg>
                </button>
                <button v-if="!pl.isDefault" class="plm-del" title="删除" @click="deletingId = pl.id">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
                    stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
                </button>
              </template>
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
import { computed, ref, type ComponentPublicInstance } from 'vue'
import { usePlaylistStore, type Playlist } from '../stores/playlist'
import { usePlayerStore } from '../stores/player'

const playlist = usePlaylistStore()
const player = usePlayerStore()

const pending = computed(() => playlist.pendingMusic)
const list = computed(() => playlist.playlists)
const newName = ref('')
/** 正在内联重命名的歌单 id；空 = 无 */
const editingId = ref('')
const editingName = ref('')
/** 删除二次确认态的歌单 id；空 = 无 */
const deletingId = ref('')
/** 轻提示文案；空 = 不显示 */
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null

function showToast(msg: string): void {
  toast.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value = ''
    toastTimer = null
  }, 1.5 * 1000)
}

function close() {
  if (toastTimer) {
    clearTimeout(toastTimer)
    toastTimer = null
  }
  toast.value = ''
  editingId.value = ''
  editingName.value = ''
  deletingId.value = ''
  playlist.closePlaylistModal()
}
function isFav(id: string): boolean {
  if (!player.current) return false
  const pl = playlist.playlists.find((p) => p.id === id)
  return pl ? pl.songs.some((s) => s.bvid === player.current!.bvid) : false
}
function add(id: string) {
  if (!pending.value) return
  const pl = playlist.playlists.find((p) => p.id === id)
  const name = pl?.name ?? '歌单'
  // 收藏成功仅弹轻提示，不关闭弹框，便于继续收藏到其它歌单
  if (playlist.addToPlaylist(pending.value, id)) {
    showToast(`已收藏到「${name}」`)
  } else {
    showToast(`该曲目已在「${name}」中`)
  }
}
function create() {
  const pl = playlist.createPlaylist(newName.value)
  if (pl) {
    newName.value = ''
    // 创建即收藏当前曲目（若在收藏流程中打开），成功后关闭
    if (pending.value && playlist.addToPlaylist(pending.value, pl.id)) close()
  }
}
/** 进入内联重命名（替代 window.prompt，Electron 渲染进程不支持 prompt） */
function startRename(pl: Playlist) {
  if (pl.isDefault) return
  deletingId.value = ''
  editingId.value = pl.id
  editingName.value = pl.name
}
/** 重命名 input 的函数 ref：挂载时自动聚焦，输入中不抢焦 */
function focusRenameInput(el: Element | ComponentPublicInstance | null): void {
  if (el instanceof HTMLInputElement && document.activeElement !== el) el.focus()
}
function commitRename(pl: Playlist) {
  const name = editingName.value.trim()
  if (name && name !== pl.name) playlist.renamePlaylist(pl.id, name)
  editingId.value = ''
  editingName.value = ''
}
function cancelRename() {
  editingId.value = ''
  editingName.value = ''
}
/** 确认删除（替代 window.confirm） */
function confirmDelete(pl: Playlist) {
  if (pl.isDefault) return
  playlist.deletePlaylist(pl.id)
  deletingId.value = ''
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
  position: relative;
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
/* 收藏成功轻提示药丸（置于弹框底部，避免遮挡头部与关闭按钮） */
.plm-toast {
  position: absolute;
  bottom: 12px;
  left: 50%;
  z-index: 5;
  max-width: calc(100% - 24px);
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 500;
  color: #fff;
  background: var(--brand-grad, linear-gradient(90deg, #ec6da4, #f9a8d4));
  border-radius: 14px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.22);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
  transform: translateX(-50%);
}
.plm-toast-enter-active,
.plm-toast-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.plm-toast-enter-from,
.plm-toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(6px);
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
  min-width: 0;
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
/* 关闭按钮：常驻可见底色 + 始终置顶，避免被 toast/长名遮挡 */
.plm-close {
  position: relative;
  z-index: 6;
  flex-shrink: 0;
  background: var(--chrome-hover, rgba(0, 0, 0, 0.06));
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
  min-width: 0;
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
/* 删除二次确认态：红字提示 + 文字按钮 */
.plm-name.plm-confirm-text {
  color: #e81123;
}
.plm-del.danger {
  width: auto;
  padding: 0 8px;
  font-size: 12px;
  font-weight: 600;
  color: #e81123;
}
.plm-del.danger:hover {
  background: rgba(232, 17, 35, 0.12);
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
  min-width: 0;
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