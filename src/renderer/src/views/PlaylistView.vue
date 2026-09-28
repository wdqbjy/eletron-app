<template>
  <div class="page playlist-page">
    <!-- 我的歌单：歌单网格 / 歌单详情（点卡片进入） -->
    <template v-if="!openPlaylist">
      <!-- 页头（对齐 pink-music 歌单页） -->
      <div class="pl-page-head">
        <h2 class="pl-page-title">全部歌单</h2>
        <p class="pl-page-sub">
          <template v-if="isBatchMode">已选 {{ selectedPlaylistIds.size }} 个歌单</template>
          <template v-else>共 {{ playlistStore.playlists.length }} 个歌单</template>
        </p>
      </div>
      <div class="list-header">
        <h3 class="list-title">
          我的歌单
          <span class="pl-count-badge">{{ playlistStore.playlists.length }}</span>
        </h3>
        <div class="pl-header-actions">
          <!-- 批量模式工具栏 -->
          <template v-if="isBatchMode">
            <button
              v-if="deletablePlaylists.length"
              class="clear-btn"
              :title="isAllDeletableSelected ? '取消全选' : '选中所有可删除的歌单（默认收藏夹除外）'"
              @click="toggleSelectAllPlaylists"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                <path v-if="isAllDeletableSelected" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                <path v-else d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
              </svg>
              {{ isAllDeletableSelected ? '取消全选' : '全选' }}
            </button>
            <button class="clear-btn" @click="exitBatchMode">取消</button>
            <button
              class="clear-btn btn-danger"
              :disabled="!selectedPlaylistIds.size"
              @click="showBatchDeleteConfirm = true"
            >
              批量删除{{ selectedPlaylistIds.size ? ` (${selectedPlaylistIds.size})` : '' }}
            </button>
          </template>
          <!-- 正常模式工具栏 -->
          <template v-else>
            <button class="clear-btn" @click="toggleCreateInput">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              新建歌单
            </button>
            <button
              class="clear-btn"
              :disabled="favSyncing"
              title="把 B 站账号的收藏夹同步为本地歌单（需先登录）"
              @click="syncFavlist"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <path d="M21 12a9 9 0 1 1-3-6.7"/>
                <path d="M21 3v6h-6"/>
              </svg>
              {{ favSyncing ? '同步中...' : '同步收藏夹' }}
            </button>
            <button
              v-if="playlistStore.playlists.length > 1"
              class="clear-btn"
              title="批量管理歌单"
              @click="enterBatchMode"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                <path d="M3 5h2v2H3V5zm4 0h14v2H7V5zM3 11h2v2H3v-2zm4 0h14v2H7v-2zM3 17h2v2H3v-2zm4 0h14v2H7v-2z"/>
              </svg>
              批量管理
            </button>
          </template>
        </div>
      </div>
      <p v-if="favError" class="fav-error">{{ favError }}</p>
      <p v-if="favResult" class="fav-result">{{ favResult }}</p>

      <form v-if="showCreateInput" class="pl-create-row" @submit.prevent="confirmCreatePlaylist">
        <input
          v-model="newPlaylistName"
          class="pl-create-input"
          placeholder="输入歌单名称"
          maxlength="30"
          autofocus
        />
        <button type="submit" class="mini-btn" :disabled="!newPlaylistName.trim()">创建</button>
        <button type="button" class="mini-btn" @click="cancelCreateInput">取消</button>
      </form>

      <div v-if="playlistStore.playlists.length" class="pl-grid" :class="{ 'batch-mode': isBatchMode }">
        <div
          v-for="pl in playlistStore.playlists"
          :key="pl.id"
          class="pl-card"
          :class="{
            'batch-mode': isBatchMode,
            selected: isBatchMode && isPlaylistSelected(pl),
            disabled: isBatchMode && pl.isDefault
          }"
          @click="isBatchMode ? togglePlaylistSelection(pl) : openPlaylistDetail(pl)"
        >
          <!-- 左上角标：默认 / B站（对齐 pink-music is-default / is-bili-fav） -->
          <span v-if="pl.isDefault" class="pl-card-tag">默认</span>
          <span v-else-if="pl.isBiliFavorite" class="pl-card-tag bili">B站</span>
          <!-- 批量模式多选框 -->
          <span
            v-if="isBatchMode && !pl.isDefault"
            class="pl-card-checkbox"
            :class="{ checked: isPlaylistSelected(pl) }"
            @click.stop="togglePlaylistSelection(pl)"
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
            </svg>
          </span>
          <div class="pl-cover">
            <img v-if="pl.cover" :src="pl.cover" :alt="pl.name" loading="lazy" />
            <div v-else class="pl-cover-fallback text-gradient">{{ pl.name.slice(0, 1) }}</div>
            <div v-if="!isBatchMode" class="pl-cover-overlay">
              <button
                class="pl-play-all"
                :class="{ disabled: !pl.songs.length }"
                :title="pl.songs.length ? '播放全部' : '歌单为空'"
                @click.stop="playAllInPlaylist(pl)"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="pl-card-name" :title="pl.name">{{ pl.name }}</div>
          <div class="pl-card-count">{{ pl.isBiliFavorite ? `${pl.mediaCount ?? pl.songs.length} 个内容` : `${pl.songs.length} 首` }}</div>
        </div>
      </div>
      <p v-else class="pl-empty">还没有歌单，点击右上角「新建歌单」创建一个吧</p>
    </template>

    <!-- 歌单详情 -->
    <template v-else>
      <button class="pl-back" @click="backToPlaylists">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="14" height="14">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
        返回歌单列表
      </button>

      <div class="pl-detail-head">
        <div class="pl-cover large">
          <img v-if="openPlaylist.cover" :src="openPlaylist.cover" :alt="openPlaylist.name" />
          <div v-else class="pl-cover-fallback text-gradient">{{ openPlaylist.name.slice(0, 1) }}</div>
        </div>
        <div class="pl-detail-meta">
          <span class="pl-label">
            歌单
            <em v-if="openPlaylist.isBiliFavorite" class="pl-bili-badge">B站收藏夹</em>
          </span>
          <h2 class="pl-detail-name">{{ openPlaylist.name }}</h2>
          <p class="pl-detail-count">
            {{ openPlaylist.isBiliFavorite
              ? `共 ${openPlaylist.mediaCount ?? openPlaylist.songs.length} 个内容，已加载 ${openPlaylist.songs.length} 条`
              : `${openPlaylist.songs.length} 首歌曲` }}
          </p>
          <div class="pl-detail-actions">
            <button
              class="login-btn"
              :disabled="!openPlaylist.songs.length"
              @click="playAllInPlaylist(openPlaylist)"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                <path d="M8 5v14l11-7z"/>
              </svg>
              播放全部
            </button>
            <button
              v-if="openPlaylist.isBiliFavorite"
              class="clear-btn"
              :disabled="favLoading"
              @click="loadFavContent"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                <path d="M21 12a9 9 0 1 1-3-6.7"/>
                <path d="M21 3v6h-6"/>
              </svg>
              {{ openPlaylist.songs.length ? '更新内容' : '加载收藏内容' }}
            </button>
            <button
              v-if="!openPlaylist.isDefault"
              class="clear-btn"
              title="重命名歌单"
              @click="openRenameModal"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 3 22l1.5-4.5z"/>
              </svg>
              重命名
            </button>
            <button
              v-if="openPlaylist.songs.length"
              class="clear-btn"
              :title="isSongBatchMode ? '退出批量管理' : '批量管理歌曲'"
              @click="toggleSongBatchMode"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                <path d="M3 5h2v2H3V5zm4 0h14v2H7V5zM3 11h2v2H3v-2zm4 0h14v2H7v-2zM3 17h2v2H3v-2zm4 0h14v2H7v-2z"/>
              </svg>
              {{ isSongBatchMode ? '完成' : '批量管理' }}
            </button>
            <button
              v-if="!openPlaylist.isDefault"
              class="clear-btn btn-danger"
              title="删除歌单"
              @click="showDeletePlaylistConfirm = true"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>
              </svg>
              删除
            </button>
          </div>
          <p v-if="favLoading && favProgressText()" class="fav-progress">{{ favProgressText() }}</p>
          <p v-if="favError" class="fav-error">{{ favError }}</p>
        </div>
      </div>

      <div v-if="isSongBatchMode && openPlaylist.songs.length" class="pl-song-batch-bar">
        <button class="mini-btn" @click="toggleSelectAllSongs">{{ isAllSongsSelected ? '取消全选' : '全选' }}</button>
        <span class="pl-song-batch-info">已选 {{ selectedSongCount }} 首</span>
        <button class="mini-btn btn-danger" :disabled="!selectedSongCount" @click="removeSelectedSongs">删除选中</button>
        <button class="mini-btn" @click="exitSongBatchMode">取消</button>
      </div>
      <div v-if="openPlaylist.songs.length" class="pl-songs">
        <div
          v-for="(song, idx) in openPlaylist.songs"
          :key="song.bvid + (song.cid ?? '')"
          class="pl-song"
          :class="{
            playing: !isSongBatchMode && playerStore.current?.bvid === song.bvid,
            'batch-mode': isSongBatchMode,
            selected: isSongBatchMode && isSongSelected(song)
          }"
          @click="isSongBatchMode ? toggleSongSelection(song) : playPlaylistSong(song)"
        >
          <span class="rank">
            <template v-if="isSongBatchMode">
              <span class="pl-song-check" :class="{ checked: isSongSelected(song) }">
                <svg v-if="isSongSelected(song)" viewBox="0 0 24 24" fill="none" stroke="#fff"
                  stroke-width="3" stroke-linecap="round" stroke-linejoin="round" width="12" height="12">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
              </span>
            </template>
            <svg v-else-if="playerStore.current?.bvid === song.bvid" viewBox="0 0 24 24" fill="var(--brand)" width="13" height="13">
              <path d="M8 5v14l11-7z"/>
            </svg>
            <template v-else>{{ idx + 1 }}</template>
          </span>
          <img class="pl-song-cover" :src="song.cover" :alt="song.title" loading="lazy" />
          <div class="history-info">
            <div class="history-title">{{ song.title }}</div>
            <div class="history-up">{{ song.author }}</div>
          </div>
          <span class="history-duration">{{ formatDuration(song.duration) }}</span>
          <button v-if="!isSongBatchMode" class="pl-song-remove" title="从歌单移除" @click.stop="removeSong(song)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
              <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>
            </svg>
          </button>
        </div>
      </div>
      <p v-else-if="openPlaylist.isBiliFavorite" class="pl-empty">
        尚未加载内容，点击上方「加载收藏内容」从 B 站拉取
      </p>
      <p v-else class="pl-empty">歌单还是空的，播放歌曲时在底部播放器点「添加到歌单」即可收藏到这里</p>
    </template>
  </div>

  <!-- 批量删除歌单确认 -->
  <div v-if="showBatchDeleteConfirm" class="modal-overlay" @click="showBatchDeleteConfirm = false">
    <div class="modal small-modal" @click.stop>
      <h2>批量删除歌单</h2>
      <p>
        确定要删除已选中的 {{ batchDeleteSummary.count }} 个歌单吗？共约
        {{ batchDeleteSummary.totalSongs }} 首音乐将被移出列表，此操作不可恢复。<template
          v-if="batchDeleteSummary.hasBili"
        >
          （B 站收藏夹仅删除本地副本，不影响云端）</template
        >
      </p>
      <div class="modal-buttons">
        <button class="mini-btn" @click="showBatchDeleteConfirm = false">取消</button>
        <button class="mini-btn btn-danger" @click="confirmBatchDelete">批量删除</button>
      </div>
    </div>
  </div>

  <!-- 重命名歌单 -->
  <div v-if="renameModalOpen" class="modal-overlay" @click="renameModalOpen = false">
    <div class="modal small-modal" @click.stop>
      <h2>重命名歌单</h2>
      <input
        v-model="renameValue"
        ref="renameInputEl"
        class="rename-input"
        placeholder="歌单名称"
        maxlength="30"
        @keyup.enter="commitRename"
        @keyup.esc="renameModalOpen = false"
      />
      <div class="modal-buttons">
        <button class="mini-btn" @click="renameModalOpen = false">取消</button>
        <button class="mini-btn" @click="commitRename">确认</button>
      </div>
    </div>
  </div>

  <!-- 删除当前歌单确认 -->
  <div v-if="showDeletePlaylistConfirm" class="modal-overlay" @click="showDeletePlaylistConfirm = false">
    <div class="modal small-modal" @click.stop>
      <h2>删除歌单</h2>
      <p>
        确定要删除歌单「{{ openPlaylist?.name }}」吗？共
        {{ openPlaylist?.songs.length ?? 0 }} 首歌曲将被移出列表，此操作不可恢复。<template
          v-if="openPlaylist?.isBiliFavorite"
        >
          （B 站收藏夹仅删除本地副本，不影响云端）</template
        >
      </p>
      <div class="modal-buttons">
        <button class="mini-btn" @click="showDeletePlaylistConfirm = false">取消</button>
        <button class="mini-btn btn-danger" @click="confirmDeleteCurrentPlaylist">删除</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { usePlaylistStore, type Playlist } from '../stores/playlist'
import { usePlayerStore } from '../stores/player'
import { useUserStore } from '../stores/user'
import { useAudioPlayer } from '../composables/useAudioPlayer'
import type { RecommendedMusic } from '../apis/bilibili'

// ============ 我的歌单（对齐 pink-music 歌单模块：网格 + 新建 + 详情视图） ============
const playlistStore = usePlaylistStore()
const playerStore = usePlayerStore()
const userStore = useUserStore()
const { playMusic } = useAudioPlayer()

/** 详情视图当前打开的歌单 id；空 = 歌单网格 */
const openPlaylistId = ref('')
const showCreateInput = ref(false)
const newPlaylistName = ref('')

const openPlaylist = computed(
  () => playlistStore.playlists.find((p) => p.id === openPlaylistId.value) ?? null
)

function toggleCreateInput(): void {
  // 始终打开并清空（对齐 pink-music：新建按钮只开不关，关闭走取消）
  showCreateInput.value = true
  newPlaylistName.value = ''
}

function cancelCreateInput(): void {
  showCreateInput.value = false
  newPlaylistName.value = ''
}

function confirmCreatePlaylist(): void {
  const pl = playlistStore.createPlaylist(newPlaylistName.value)
  if (pl) {
    newPlaylistName.value = ''
    showCreateInput.value = false
  }
}

function openPlaylistDetail(pl: Playlist): void {
  openPlaylistId.value = pl.id
}

function backToPlaylists(): void {
  openPlaylistId.value = ''
}

/** 播放全部：从第一首开始播（多分P会在 playMusic 内自动展开队列） */
function playAllInPlaylist(pl: Playlist): void {
  if (!pl.songs.length) return
  playMusic(pl.songs[0])
}

function playPlaylistSong(song: RecommendedMusic): void {
  playMusic(song)
}

function removeSong(song: RecommendedMusic): void {
  if (!openPlaylist.value) return
  playlistStore.removeFromPlaylist(song.bvid, openPlaylist.value.id)
}

/** 秒 → mm:ss */
function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// ============ B 站收藏夹同步（需登录；ids 一次 + 50/批 infos） ============
const favSyncing = ref(false)
const favLoading = ref(false)
const favProgress = ref<{ stage: string; current: number; total: number; loaded: number } | null>(
  null
)
const favError = ref('')
const favResult = ref('')

/** 同步收藏夹列表 → 本地虚拟歌单（bili-fav-*），结果反馈对齐 pink-music */
async function syncFavlist(): Promise<void> {
  if (favSyncing.value) return
  if (!userStore.isLoggedIn || !userStore.userInfo?.mid) {
    favError.value = '请先在顶栏登录 B 站账号'
    return
  }
  favError.value = ''
  favResult.value = ''
  favSyncing.value = true
  try {
    const { added } = await playlistStore.syncBiliFavlist(userStore.userInfo.mid)
    favResult.value =
      added > 0 ? `已同步 ${added} 个收藏夹到我的歌单` : '收藏夹已为最新或没有可同步的项'
  } catch (e: any) {
    favError.value = `同步失败：${e?.message || e}`
  } finally {
    favSyncing.value = false
  }
}

/** 拉取收藏夹歌单的全部内容（显示 ids/infos 进度），完成后刷新详情 */
async function loadFavContent(): Promise<void> {
  const pl = openPlaylist.value
  if (!pl || favLoading.value || !pl.id.startsWith('bili-fav-')) return
  favError.value = ''
  favLoading.value = true
  favProgress.value = null
  try {
    await playlistStore.loadFavResources(pl.id, (p) => {
      favProgress.value = p
    })
  } catch (e: any) {
    favError.value = `加载失败：${e?.message || e}`
  } finally {
    favLoading.value = false
    favProgress.value = null
  }
}

/** 收藏夹歌单是否需要/可以加载内容 */
function favProgressText(): string {
  const p = favProgress.value
  if (!p) return ''
  return p.stage === 'ids'
    ? `获取条目列表...（${p.loaded} 条）`
    : `加载内容 ${p.current}/${p.total} 批...（已入库 ${p.loaded} 条）`
}

// ============ 歌单批量管理 + JSON 导入（对齐 pink-music 歌单页交互） ============
const isBatchMode = ref(false)
const selectedPlaylistIds = ref<Set<string>>(new Set())
const showBatchDeleteConfirm = ref(false)

/** 可删除的歌单（内置收藏夹除外） */
const deletablePlaylists = computed(() =>
  playlistStore.playlists.filter((p) => !p.isDefault)
)

function enterBatchMode(): void {
  isBatchMode.value = true
  selectedPlaylistIds.value = new Set()
}

function exitBatchMode(): void {
  isBatchMode.value = false
  selectedPlaylistIds.value = new Set()
}

function isPlaylistSelected(pl: Playlist): boolean {
  return selectedPlaylistIds.value.has(pl.id)
}

/** 批量模式下点卡片 = 切换选中（内置收藏夹置灰不可选） */
function togglePlaylistSelection(pl: Playlist): void {
  if (pl.isDefault) return
  const next = new Set(selectedPlaylistIds.value)
  if (next.has(pl.id)) next.delete(pl.id)
  else next.add(pl.id)
  selectedPlaylistIds.value = next
}

const isAllDeletableSelected = computed(
  () =>
    deletablePlaylists.value.length > 0 &&
    deletablePlaylists.value.every((p) => selectedPlaylistIds.value.has(p.id))
)

function toggleSelectAllPlaylists(): void {
  selectedPlaylistIds.value = isAllDeletableSelected.value
    ? new Set()
    : new Set(deletablePlaylists.value.map((p) => p.id))
}

/** 确认框里展示的删除摘要 */
const batchDeleteSummary = computed(() => {
  const targets = playlistStore.playlists.filter(
    (p) => selectedPlaylistIds.value.has(p.id) && !p.isDefault
  )
  const totalSongs = targets.reduce(
    (sum, p) => sum + (p.songs.length || p.mediaCount || 0),
    0
  )
  const hasBili = targets.some((p) => p.isBiliFavorite)
  return {
    count: targets.length,
    totalSongs,
    hasBili
  }
})

function confirmBatchDelete(): void {
  const { deleted } = playlistStore.batchDeletePlaylists(
    Array.from(selectedPlaylistIds.value)
  )
  console.log(`[playlist] 批量删除完成: ${deleted} 个`)
  showBatchDeleteConfirm.value = false
  exitBatchMode()
}

// ============ 歌单详情：重命名 / 歌曲批量管理 / 删除（对齐 pink-music） ============
const renameModalOpen = ref(false)
const renameValue = ref('')
const renameInputEl = ref<HTMLInputElement | null>(null)
const showDeletePlaylistConfirm = ref(false)
/** 歌曲级批量管理（详情内多选移除歌曲） */
const isSongBatchMode = ref(false)
const selectedSongKeys = ref<Set<string>>(new Set())

// 打开重命名弹窗时自动聚焦输入框
watch(renameModalOpen, (v) => {
  if (v) nextTick(() => renameInputEl.value?.focus())
})
// 离开当前歌单详情时清理临时态，避免残留
watch(openPlaylistId, () => {
  isSongBatchMode.value = false
  selectedSongKeys.value = new Set()
  renameModalOpen.value = false
  showDeletePlaylistConfirm.value = false
})

function songKey(song: RecommendedMusic): string {
  return song.bvid + (song.cid ?? '')
}

function openRenameModal(): void {
  const pl = openPlaylist.value
  if (!pl || pl.isDefault) return
  renameValue.value = pl.name
  renameModalOpen.value = true
}
function commitRename(): void {
  const pl = openPlaylist.value
  if (!pl) return
  const name = renameValue.value.trim()
  if (name && name !== pl.name) playlistStore.renamePlaylist(pl.id, name)
  renameModalOpen.value = false
}

function toggleSongBatchMode(): void {
  if (isSongBatchMode.value) {
    exitSongBatchMode()
  } else {
    isSongBatchMode.value = true
    selectedSongKeys.value = new Set()
  }
}
function exitSongBatchMode(): void {
  isSongBatchMode.value = false
  selectedSongKeys.value = new Set()
}
function isSongSelected(song: RecommendedMusic): boolean {
  return selectedSongKeys.value.has(songKey(song))
}
function toggleSongSelection(song: RecommendedMusic): void {
  const k = songKey(song)
  const next = new Set(selectedSongKeys.value)
  if (next.has(k)) next.delete(k)
  else next.add(k)
  selectedSongKeys.value = next
}
const selectedSongCount = computed(() => selectedSongKeys.value.size)
const isAllSongsSelected = computed(() => {
  const pl = openPlaylist.value
  if (!pl || !pl.songs.length) return false
  return pl.songs.every((s) => selectedSongKeys.value.has(songKey(s)))
})
function toggleSelectAllSongs(): void {
  const pl = openPlaylist.value
  if (!pl) return
  selectedSongKeys.value = isAllSongsSelected.value
    ? new Set()
    : new Set(pl.songs.map(songKey))
}
function removeSelectedSongs(): void {
  const pl = openPlaylist.value
  if (!pl || !selectedSongKeys.value.size) return
  const set = selectedSongKeys.value
  pl.songs = pl.songs.filter((s) => !set.has(songKey(s)))
  pl.cover = pl.songs[0]?.cover || ''
  playlistStore.persist()
  exitSongBatchMode()
}
function confirmDeleteCurrentPlaylist(): void {
  const pl = openPlaylist.value
  if (!pl || pl.isDefault) return
  playlistStore.deletePlaylist(pl.id)
  showDeletePlaylistConfirm.value = false
  openPlaylistId.value = ''
}

</script>

<style scoped>
/* 页面容器：对齐 MineView 外层容器（底部留出 BottomNav 空间） */
.page {
  padding: 24px 28px 120px;
  max-width: 1200px;
  margin: 0 auto;
}

/* ============ 我的歌单（网格 + 详情） ============ */
.pl-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pl-bili-badge {
  display: inline-block;
  font-style: normal;
  font-size: 10px;
  font-weight: 600;
  color: #fff;
  background: #fb7299;
  border-radius: 6px;
  padding: 1px 6px;
  margin-right: 6px;
  vertical-align: 2px;
}

.fav-error {
  margin: -8px 0 12px;
  font-size: 12px;
  color: #ff6b6b;
}

.fav-result {
  margin: -8px 0 12px;
  font-size: 12px;
  color: rgba(var(--brand-rgb), 0.9);
}

.fav-progress {
  margin: 8px 0 0;
  font-size: 12px;
  color: rgba(var(--brand-rgb), 0.9);
}

.pl-detail-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pl-count-badge {
  display: inline-block;
  min-width: 18px;
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  background: rgba(var(--brand-rgb), 0.55);
  border-radius: 9px;
  padding: 1px 6px;
  margin-left: 6px;
  vertical-align: 2px;
}

/* 新建歌单输入行 */
.pl-create-row {
  display: flex;
  gap: 8px;
  margin: 0 0 16px;
}

.pl-create-input {
  flex: 1;
  padding: 9px 14px;
  font-size: 13px;
  font-family: inherit;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  outline: none;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.pl-create-input:focus {
  border-color: rgba(var(--brand-rgb), 0.6);
  box-shadow: 0 0 0 3px rgba(var(--brand-rgb), 0.15);
}

.pl-create-input::placeholder {
  color: rgba(255, 255, 255, 0.35);
}

/* 歌单卡片网格 */
.pl-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
  gap: 16px;
}

.pl-card {
  cursor: pointer;
  transition: transform 0.2s ease;
}

.pl-card:hover {
  transform: translateY(-3px);
}

.pl-cover {
  position: relative;
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
}

.pl-cover.large {
  width: 140px;
  height: 140px;
  flex-shrink: 0;
  border-radius: 16px;
}

.pl-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.pl-cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  font-weight: 800;
}

.pl-cover.large .pl-cover-fallback {
  font-size: 52px;
}

/* hover 蒙层 + 播放全部按钮 */
.pl-cover-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 8px;
  background: linear-gradient(180deg, transparent 45%, rgba(0, 0, 0, 0.55) 100%);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.pl-card:hover .pl-cover-overlay {
  opacity: 1;
}

.pl-play-all {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 50%;
  background: var(--brand-grad);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(var(--brand-rgb), 0.5);
  transform: scale(0.85);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.pl-card:hover .pl-play-all {
  transform: scale(1);
}

.pl-play-all:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 20px rgba(var(--brand-rgb), 0.65);
}

.pl-play-all.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.pl-card-name {
  margin-top: 8px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.pl-card-count {
  margin-top: 2px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

/* 页头（全部歌单 + 统计，对齐 pink-music 歌单页） */
.pl-page-head {
  margin-bottom: 14px;
}

.pl-page-title {
  margin: 0 0 4px;
  font-size: 22px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
}

.pl-page-sub {
  margin: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

/* 卡片左上角标：默认 / B站 */
.pl-card-tag {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
  padding: 3px 8px;
  font-size: 10px;
  font-weight: 600;
  color: #fff;
  background: rgba(0, 0, 0, 0.55);
  border-radius: 12px 0 10px 0;
  pointer-events: none;
}

.pl-card-tag.bili {
  background: #fb7299;
}

/* 批量模式：多选圆形框（左上角，替换角标） */
.pl-card.batch-mode .pl-card-tag {
  display: none;
}

.pl-card-checkbox {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 3;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.75);
  background: rgba(0, 0, 0, 0.35);
  color: transparent;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.pl-card-checkbox:hover {
  border-color: rgba(var(--brand-rgb), 0.9);
}

.pl-card-checkbox.checked {
  border-color: transparent;
  background: var(--brand-grad);
  color: #fff;
  box-shadow: 0 2px 8px rgba(var(--brand-rgb), 0.5);
}

/* 批量模式：卡片选中 / 不可选状态 */
.pl-card.batch-mode.selected .pl-cover {
  outline: 2px solid rgba(var(--brand-rgb), 0.85);
  outline-offset: 2px;
}

.pl-card.batch-mode.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pl-card.batch-mode.disabled:hover {
  transform: none;
}

.pl-empty {
  padding: 32px 0;
  text-align: center;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.35);
}

/* 返回按钮 */
.pl-back {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 16px;
  padding: 7px 14px;
  font-size: 12px;
  font-family: inherit;
  color: rgba(255, 255, 255, 0.65);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.pl-back:hover {
  color: #fff;
  border-color: rgba(var(--brand-rgb), 0.5);
  background: rgba(var(--brand-rgb), 0.1);
}

/* 详情头部 */
.pl-detail-head {
  display: flex;
  align-items: center;
  gap: 22px;
  padding: 20px 22px;
  margin-bottom: 18px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.pl-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: rgba(var(--brand-rgb), 0.9);
}

.pl-detail-name {
  margin: 6px 0 4px;
  font-size: 22px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.pl-detail-count {
  margin: 0 0 14px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}

/* 歌曲列表（复用历史行风格；rank/history-info/history-title/history-up/history-duration 为全局共享类） */
.pl-songs {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pl-song {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 14px;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.16s ease;
}
/* 批量管理模式：选中高亮 + 左侧品牌色描边 */
.pl-song.batch-mode {
  cursor: default;
}
.pl-song.selected {
  background: rgba(236, 109, 164, 0.14);
}
.pl-song.selected::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 3px;
  border-radius: 3px;
  background: var(--brand, #ec6da4);
}
/* 歌曲行内复选框 */
.pl-song-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: 1.5px solid rgba(255, 255, 255, 0.35);
  border-radius: 4px;
  background: transparent;
}
.pl-song-check.checked {
  background: var(--brand, #ec6da4);
  border-color: var(--brand, #ec6da4);
}
/* 歌曲批量管理工具栏 */
.pl-song-batch-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 4px 10px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--chrome-border, rgba(255, 255, 255, 0.08));
}
.pl-song-batch-info {
  flex: 1;
  font-size: 13px;
  color: var(--chrome-text-faint, rgba(255, 255, 255, 0.5));
}
/* 重命名弹窗输入框 */
.rename-input {
  width: 100%;
  margin: 14px 0 4px;
  padding: 9px 12px;
  font-size: 14px;
  border: 1px solid var(--chrome-border, rgba(0, 0, 0, 0.15));
  border-radius: 8px;
  background: var(--color-background, #fff);
  color: var(--chrome-text, #222);
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.16s ease;
}
.rename-input:focus {
  border-color: var(--brand, #ec6da4);
}

.pl-song:hover {
  background: rgba(255, 255, 255, 0.05);
}

.pl-song .rank {
  width: 20px;
  text-align: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.35);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  display: flex;
  justify-content: center;
}

.pl-song-cover {
  width: 42px;
  height: 42px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
}

.pl-song .history-title {
  color: rgba(255, 255, 255, 0.85);
}

.pl-song.playing .history-title {
  color: var(--brand);
}

.pl-song-remove {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: rgba(255, 255, 255, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: all 0.16s ease;
}

.pl-song:hover .pl-song-remove {
  opacity: 1;
}

.pl-song-remove:hover {
  color: #ff6b6b;
  background: rgba(255, 107, 107, 0.12);
}

/* 浅色模式 */
.light .pl-create-input {
  color: rgba(24, 24, 28, 0.88);
  background: rgba(0, 0, 0, 0.04);
  border-color: rgba(0, 0, 0, 0.1);
}

.light .pl-create-input::placeholder {
  color: rgba(40, 40, 46, 0.35);
}

.light .pl-page-title {
  color: rgba(24, 24, 28, 0.95);
}

.light .pl-page-sub {
  color: rgba(40, 40, 46, 0.45);
}

.light .pl-card-tag {
  background: rgba(0, 0, 0, 0.5);
}

.light .pl-card-checkbox {
  border-color: rgba(255, 255, 255, 0.9);
  background: rgba(0, 0, 0, 0.3);
}

.light .pl-card-name {
  color: rgba(24, 24, 28, 0.9);
}

.light .pl-card-count,
.light .pl-detail-count,
.light .pl-song .rank {
  color: rgba(40, 40, 46, 0.45);
}

.light .pl-empty {
  color: rgba(40, 40, 46, 0.4);
}

.light .pl-back {
  color: rgba(40, 40, 46, 0.65);
  background: rgba(0, 0, 0, 0.04);
  border-color: rgba(0, 0, 0, 0.1);
}

.light .pl-back:hover {
  color: rgba(24, 24, 28, 0.95);
}

.light .pl-detail-head {
  background: rgba(0, 0, 0, 0.03);
  border-color: rgba(0, 0, 0, 0.06);
}

.light .pl-detail-name {
  color: rgba(24, 24, 28, 0.95);
}

.light .pl-song .history-title {
  color: rgba(24, 24, 28, 0.85);
}

.light .pl-song:hover {
  background: rgba(0, 0, 0, 0.04);
}

.light .pl-song-remove {
  color: rgba(40, 40, 46, 0.4);
}
.light .pl-song-check {
  border-color: rgba(40, 40, 46, 0.35);
}
.light .pl-song-batch-info {
  color: rgba(40, 40, 46, 0.5);
}
.light .pl-song.selected {
  background: rgba(236, 109, 164, 0.1);
}
.light .pl-song.selected::before {
  background: var(--brand, #ec6da4);
}
.light .rename-input {
  background: #fff;
  color: #222;
}
</style>
