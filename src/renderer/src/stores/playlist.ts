import { defineStore } from 'pinia'
import type { RecommendedMusic } from '../apis/bilibili'

const STORAGE_KEY = 'app-user-playlists'

/** 歌单：持久化到 localStorage。默认收藏夹不可删；isDefault 标记内置 */
export interface Playlist {
  id: string
  name: string
  /** 内置收藏夹不可删除 */
  isDefault?: boolean
  songs: RecommendedMusic[]
  createdAt: number
}

let seed = 0
/** 生成短 id：时间戳 + 自增，避免同名创建冲突 */
function genId(): string {
  seed += 1
  return 'pl' + Date.now().toString(36) + seed.toString(36)
}

function loadFromStorage(): Playlist[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (_) {
    return []
  }
}

/** 全部数据 → 序列化持久化 */
function persist(list: Playlist[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

/**
 * 歌单管理 store：
 * - 默认「默认收藏」不可删除
 * - 创建 / 重命名 / 删除自定义歌单
 * - addToPlaylist 按 bvid+cid 去重
 * 本地持久化到 localStorage。
 */
export const usePlaylistStore = defineStore('playlist', {
  state: () => ({
    /** 当前所有歌单（含内置收藏夹） */
    playlists: [] as Playlist[],
    /** 歌单管理弹窗是否打开（底部播放器「歌单」按钮触发） */
    showPlaylistModal: false,
    /** 正在处理的曲目（菜单里临时持有） */
    pendingMusic: null as RecommendedMusic | null
  }),
  getters: {
    /** 内置收藏夹（兜底为不存在时返回 null） */
    favorites(): Playlist | null {
      return this.playlists.find((p) => p.isDefault) ?? null
    },
    favoriteCount(): number {
      return this.favorites?.songs.length ?? 0
    }
  },
  actions: {
    /** 启动时从 localStorage 恢复；无数据则建一个默认收藏夹 */
    init() {
      const loaded = loadFromStorage()
      if (loaded.length) {
        this.playlists = loaded
      } else {
        this.playlists = [
          {
            id: 'favorites',
            name: '默认收藏',
            isDefault: true,
            songs: [],
            createdAt: Date.now()
          }
        ]
        persist(this.playlists)
      }
      this.showPlaylistModal = false
    },
    persist() {
      persist(this.playlists)
    },
    /** 当前曲目是否已加入收藏夹（UI 上高亮「收藏」） */
    isFavorite(bvid: string): boolean {
      return this.favorites?.songs.some((s) => s.bvid === bvid) ?? false
    },
    createPlaylist(name: string): Playlist | null {
      const t = name.trim()
      if (!t) return null
      const pl: Playlist = {
        id: genId(),
        name: t,
        songs: [],
        createdAt: Date.now()
      }
      this.playlists.push(pl)
      this.persist()
      return pl
    },
    renamePlaylist(id: string, name: string) {
      const pl = this.playlists.find((p) => p.id === id)
      if (!pl || pl.isDefault) return
      const t = name.trim()
      if (!t) return
      pl.name = t
      this.persist()
    },
    /** 删除自定义歌单；内置收藏夹拒绝删除 */
    deletePlaylist(id: string): boolean {
      const pl = this.playlists.find((p) => p.id === id)
      if (!pl || pl.isDefault) return false
      this.playlists = this.playlists.filter((p) => p.id !== id)
      this.persist()
      // 若正在处理的曲目来自被删歌单，清理兜底
      return true
    },
    /** 加入歌单：按 bvid+cid 去重，返回是否新增 */
    addToPlaylist(music: RecommendedMusic, playlistId: string): boolean {
      const pl = this.playlists.find((p) => p.id === playlistId)
      if (!pl || !music) return false
      const exists = pl.songs.some(
        (s) => s.bvid === music.bvid && (s.cid ?? '') === (music.cid ?? '')
      )
      if (exists) return false
      pl.songs.unshift(music)
      this.persist()
      return true
    },
    /** 从歌单移除一首；当前曲目保留在歌单外不影响播放 */
    removeFromPlaylist(musicBvid: string, playlistId: string) {
      const pl = this.playlists.find((p) => p.id === playlistId)
      if (!pl || pl.isDefault) return
      pl.songs = pl.songs.filter((s) => s.bvid !== musicBvid)
      this.persist()
    },
    removeFromFavorites(musicBvid: string) {
      const f = this.favorites
      if (!f) return
      f.songs = f.songs.filter((s) => s.bvid !== musicBvid)
      this.persist()
    },
    // ===== 弹窗 =====
    openPlaylistModal(music: RecommendedMusic | null = null) {
      this.pendingMusic = music
      this.showPlaylistModal = true
    },
    closePlaylistModal() {
      this.showPlaylistModal = false
      this.pendingMusic = null
    }
  }
})