<template>
  <Teleport to="body">
    <div class="plm-overlay" @click.self="close">
      <div class="plm-modal plm-modal-wide">
        <header class="plm-head">
          <h3 class="plm-title">
            添加到歌单
            <span class="plm-track">
              {{ pending?.title }}
              <template v-if="episodes.length > 1">（共 {{ episodes.length }} P）</template>
            </span>
          </h3>
          <button
            v-if="episodes.length > 1"
            class="plm-select-all"
            :title="isAllSelected ? '取消全选' : '全选所有分P'"
            @click="toggleSelectAll"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
            </svg>
            {{ isAllSelected ? '取消全选' : '全选' }}
          </button>
          <button class="wc-note plm-close" title="关闭" @click="close">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </header>

        <div class="plm-body">
          <!-- 分P多选列表 -->
          <div class="plm-ep-list">
            <div
              v-for="(ep, i) in episodes"
              :key="ep.cid"
              class="plm-ep-row"
              :class="{ selected: selected.has(ep.cid) }"
              @click="toggleEp(ep.cid)"
            >
              <span
                class="plm-checkbox"
                :class="{ checked: selected.has(ep.cid) }"
                @click.stop="toggleEp(ep.cid)"
              >
                <svg v-if="selected.has(ep.cid)" viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                </svg>
              </span>
              <span class="plm-ep-index">{{ i + 1 }}</span>
              <span class="plm-ep-part">{{ ep.part || `P${i + 1}` }}</span>
              <span class="plm-ep-duration">{{ formatDuration(ep.duration) }}</span>
            </div>
          </div>

          <!-- 添加到 -->
          <div class="plm-add-section">
            <div class="plm-add-header">
              <span class="plm-selected-count">已选 {{ selected.size }} / {{ episodes.length }} P</span>
              <button class="plm-create-all" title="创建以视频标题命名的新歌单，并加入全部P" @click="startCreate('all')">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                </svg>
                新建歌单（全部P）
              </button>
            </div>

            <ul class="plm-list">
              <li class="plm-item clickable" title="创建新歌单并加入已勾选的P" @click="startCreate('selected')">
                <span class="plm-name create-row">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                  </svg>
                  新建歌单（加入已勾选的P）
                </span>
              </li>
              <li
                v-for="pl in list"
                :key="pl.id"
                class="plm-item clickable"
                :title="`添加到「${pl.name}」`"
                @click="addTo(pl.id)"
              >
                <span class="plm-name">
                  {{ pl.name }}
                  <em v-if="pl.isDefault" class="plm-default">默认</em>
                </span>
                <span class="plm-count">{{ pl.songs.length }} 首</span>
              </li>
              <li v-if="!list.length" class="plm-empty small">暂无歌单，可通过上方「新建歌单」创建</li>
            </ul>

            <!-- 内联创建：全部P / 已选P -->
            <form v-if="creating" class="plm-create" @submit.prevent="confirmCreate">
              <input
                v-model="newName"
                class="plm-input"
                placeholder="新歌单名称"
                maxlength="30"
              />
              <button class="plm-submit" type="submit" :disabled="!newName.trim() || !selected.size">
                创建并加入
              </button>
              <button class="plm-cancel" type="button" @click="creating = false">取消</button>
            </form>
          </div>
        </div>

        <footer class="plm-foot">
          <button class="plm-close-btn" @click="close">关闭</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { usePlaylistStore } from '../stores/playlist'
import { buildEpisodes } from '../composables/useAudioPlayer'
import { formatDuration } from '../utils/bilibili'

const playlist = usePlaylistStore()

const pending = computed(() => playlist.pAddPending)
const episodes = computed(() => playlist.pAddEpisodes)
const list = computed(() => playlist.playlists)

/** 已勾选的分P cid 集合（默认全选，方便整合集一键入库） */
const selected = ref<Set<number>>(new Set(episodes.value.map((e) => e.cid)))
const creating = ref<false | 'all' | 'selected'>(false)
const newName = ref('')

function close() {
  playlist.closePAddModal()
}

function toggleEp(cid: number) {
  const next = new Set(selected.value)
  if (next.has(cid)) next.delete(cid)
  else next.add(cid)
  selected.value = next
}

const isAllSelected = computed(
  () => episodes.value.length > 0 && episodes.value.every((e) => selected.value.has(e.cid))
)

function toggleSelectAll() {
  selected.value = isAllSelected.value
    ? new Set()
    : new Set(episodes.value.map((e) => e.cid))
}

/** 已勾选分P → music 对象数组（继承整稿信息，标题取分P名） */
function selectedTracks() {
  if (!pending.value) return []
  const pages = episodes.value.filter((e) => selected.value.has(e.cid))
  return buildEpisodes(pending.value, pages)
}

function addTo(playlistId: string) {
  const tracks = selectedTracks()
  if (!tracks.length) return
  const { added, skipped } = playlist.addManyToPlaylist(tracks, playlistId)
  console.log(`[AddP] 添加 ${added} 首，跳过重复 ${skipped} 首`)
  close()
}

function startCreate(mode: 'all' | 'selected') {
  creating.value = mode
  // 默认名 = 视频标题（对齐 pink-music createPlaylistWithPs）
  newName.value = pending.value?.title ?? ''
  if (mode === 'all') selected.value = new Set(episodes.value.map((e) => e.cid))
}

function confirmCreate() {
  if (!newName.value.trim() || !pending.value) return
  const pl = playlist.createPlaylist(newName.value)
  if (!pl) return
  const tracks =
    creating.value === 'all' ? buildEpisodes(pending.value, episodes.value) : selectedTracks()
  playlist.addManyToPlaylist(tracks, pl.id)
  creating.value = false
  newName.value = ''
  close()
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
  width: 380px;
  max-width: calc(100vw - 48px);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  background: var(--color-background, #fff);
  color: var(--chrome-text, #222);
  border: 1px solid var(--chrome-border, rgba(0, 0, 0, 0.08));
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}
.plm-modal-wide {
  width: 440px;
}
.plm-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--chrome-border, rgba(0, 0, 0, 0.08));
}
.plm-title {
  flex: 1;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.plm-track {
  font-size: 12px;
  font-weight: 400;
  color: var(--chrome-text-faint, #888);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.plm-select-all {
  border: 1px solid var(--chrome-border, rgba(0, 0, 0, 0.12));
  background: transparent;
  color: var(--chrome-text, #222);
  font-size: 12px;
  border-radius: 16px;
  padding: 4px 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  transition: all 0.15s ease;
}
.plm-select-all:hover {
  border-color: var(--brand, #ec6da4);
  color: var(--brand, #ec6da4);
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
  flex-shrink: 0;
}
.wc-note:hover {
  background: var(--chrome-hover, rgba(0, 0, 0, 0.06));
  color: var(--chrome-text, #222);
}
.plm-body {
  padding: 10px 12px 14px;
  overflow-y: auto;
  flex: 1;
}

/* 分P列表 */
.plm-ep-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 220px;
  overflow-y: auto;
  margin-bottom: 12px;
  border: 1px solid var(--chrome-border, rgba(0, 0, 0, 0.08));
  border-radius: 10px;
  padding: 6px;
}
.plm-ep-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s ease;
}
.plm-ep-row:hover {
  background: var(--chrome-hover, rgba(0, 0, 0, 0.05));
}
.plm-ep-row.selected {
  background: rgba(var(--brand-rgb, 236, 109, 164), 0.08);
}
.plm-checkbox {
  width: 17px;
  height: 17px;
  border-radius: 5px;
  border: 1.5px solid var(--chrome-border, rgba(0, 0, 0, 0.25));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #fff;
  transition: all 0.12s ease;
}
.plm-checkbox.checked {
  background: var(--brand, #ec6da4);
  border-color: var(--brand, #ec6da4);
}
.plm-ep-index {
  font-size: 11px;
  color: var(--chrome-text-faint, #999);
  width: 22px;
  text-align: center;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
.plm-ep-part {
  flex: 1;
  font-size: 12.5px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  min-width: 0;
}
.plm-ep-duration {
  font-size: 11px;
  color: var(--chrome-text-faint, #999);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

/* 添加到区 */
.plm-add-section {
  border-top: 1px dashed var(--chrome-border, rgba(0, 0, 0, 0.12));
  padding-top: 10px;
}
.plm-add-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.plm-selected-count {
  font-size: 12px;
  color: var(--chrome-text-faint, #888);
  font-variant-numeric: tabular-nums;
}
.plm-create-all {
  border: none;
  background: var(--brand-grad, linear-gradient(90deg, #ec6da4, #f9a8d4));
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  border-radius: 16px;
  padding: 5px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.plm-create-all:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(var(--brand-rgb, 236, 109, 164), 0.4);
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
}
.plm-item.clickable {
  cursor: pointer;
}
.plm-item.clickable:hover {
  background: var(--chrome-hover, rgba(0, 0, 0, 0.05));
}
.plm-name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  min-width: 0;
}
.plm-name.create-row {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--brand, #ec6da4);
  font-weight: 600;
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
.plm-empty {
  text-align: center;
  color: var(--chrome-text-faint, #999);
  font-size: 13px;
  padding: 20px 0;
}
.plm-empty.small {
  padding: 10px 0;
}
.plm-create {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.plm-input {
  flex: 1;
  border: 1px solid var(--chrome-border, rgba(0, 0, 0, 0.15));
  background: var(--color-background-soft, #f5f5f5);
  color: var(--chrome-text, #222);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  outline: none;
  min-width: 0;
}
.plm-input:focus {
  border-color: var(--brand, #ec6da4);
}
.plm-submit {
  border: none;
  background: var(--brand-grad, linear-gradient(90deg, #ec6da4, #f9a8d4));
  color: #fff;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  flex-shrink: 0;
}
.plm-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.plm-cancel {
  border: 1px solid var(--chrome-border, rgba(0, 0, 0, 0.15));
  background: transparent;
  color: var(--chrome-text, #222);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
  flex-shrink: 0;
}

/* 底部关闭 */
.plm-foot {
  padding: 10px 16px 14px;
  border-top: 1px solid var(--chrome-border, rgba(0, 0, 0, 0.08));
  display: flex;
  justify-content: flex-end;
}
.plm-close-btn {
  border: 1px solid var(--chrome-border, rgba(0, 0, 0, 0.15));
  background: transparent;
  color: var(--chrome-text, #222);
  border-radius: 8px;
  padding: 7px 18px;
  font-size: 13px;
  cursor: pointer;
}
.plm-close-btn:hover {
  border-color: var(--brand, #ec6da4);
  color: var(--brand, #ec6da4);
}
</style>
