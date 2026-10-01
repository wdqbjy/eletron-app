import { defineStore } from 'pinia'
import type { RecommendedMusic, BiliPage, BiliFavMedia, BiliFavFolder } from '../apis/bilibili'
import {
  getMusicEpisodes,
  getFavFolders,
  getFavCollectedFolders,
  getFavResourceIds,
  getFavResourceInfos
} from '../apis/bilibili'

const STORAGE_KEY = 'app-user-playlists'

/** 歌单：持久化到 localStorage。默认收藏夹不可删；isDefault 标记内置 */
export interface Playlist {
  id: string
  name: string
  /** 内置收藏夹不可删除 */
  isDefault?: boolean
  /** 封面跟随第一首歌（无歌时为空，UI 显示占位） */
  cover?: string
  songs: RecommendedMusic[]
  createdAt: number
  /** B 站收藏夹虚拟歌单（id 形如 bili-fav-{mediaId}，内容由接口拉取） */
  isBiliFavorite?: boolean
  /** B 站收藏夹服务端条目数 */
  mediaCount?: number
  /** B 站收藏夹来源：created = 自己创建，collected = 收藏他人的（pink-music 同名字段） */
  biliSource?: 'created' | 'collected'
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
    pendingMusic: null as RecommendedMusic | null,
    // ===== 卡片「添加到歌单」多P分P弹窗（对齐 pink-music showAddPModal） =====
    showPAddModal: false,
    /** 分P弹窗的来源视频（多P批量加入的整稿信息） */
    pAddPending: null as RecommendedMusic | null,
    /** 分P列表（length > 1 才会打开分P弹窗） */
    pAddEpisodes: [] as BiliPage[]
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
        // 存量清洗：早期版本可能存入无 bvid 的收藏音频项（永远无法播放），
        // 启动时统一剔除并落盘，避免污染歌单/播放队列
        let dirty = false
        for (const pl of loaded) {
          if (pl.songs?.some((s) => !s.bvid)) {
            pl.songs = pl.songs.filter((s) => s.bvid)
            dirty = true
          }
        }
        this.playlists = loaded
        if (dirty) persist(this.playlists)
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
    /**
     * 批量删除歌单（对齐 pink-music）：内置收藏夹自动跳过；
     * B 站收藏夹仅删本地副本。返回 { deleted, skipped }。
     */
    batchDeletePlaylists(ids: string[]): { deleted: number; skipped: number } {
      const idSet = new Set(ids)
      let deleted = 0
      let skipped = 0
      this.playlists = this.playlists.filter((p) => {
        if (!idSet.has(p.id)) return true
        if (p.isDefault) {
          skipped++
          return true
        }
        deleted++
        return false
      })
      this.persist()
      return { deleted, skipped }
    },
    /** 加入歌单：按 bvid+cid 去重，返回是否新增；封面始终跟随第一首歌 */
    addToPlaylist(music: RecommendedMusic, playlistId: string): boolean {
      const pl = this.playlists.find((p) => p.id === playlistId)
      if (!pl || !music) return false
      const exists = pl.songs.some(
        (s) => s.bvid === music.bvid && (s.cid ?? '') === (music.cid ?? '')
      )
      if (exists) return false
      pl.songs.unshift(music)
      pl.cover = pl.songs[0]?.cover || ''
      this.persist()
      return true
    },
    /** 从歌单移除一首；传 cid 时按 bvid+cid 精确移除（多P歌单只删该分P） */
    removeFromPlaylist(musicBvid: string, playlistId: string, cid?: number) {
      const pl = this.playlists.find((p) => p.id === playlistId)
      if (!pl) return
      pl.songs = pl.songs.filter((s) =>
        cid != null ? !(s.bvid === musicBvid && (s.cid ?? null) === cid) : s.bvid !== musicBvid
      )
      pl.cover = pl.songs[0]?.cover || ''
      this.persist()
    },
    /** 批量加入（逐首去重），返回新增/跳过数；供分P弹窗批量添加 */
    addManyToPlaylist(
      tracks: RecommendedMusic[],
      playlistId: string
    ): { added: number; skipped: number } {
      const pl = this.playlists.find((p) => p.id === playlistId)
      if (!pl || !tracks.length) return { added: 0, skipped: 0 }
      let added = 0
      for (const t of tracks) {
        if (this.addToPlaylist(t, playlistId)) added++
      }
      return { added, skipped: tracks.length - added }
    },
    removeFromFavorites(musicBvid: string) {
      const f = this.favorites
      if (!f) return
      f.songs = f.songs.filter((s) => s.bvid !== musicBvid)
      f.cover = f.songs[0]?.cover || ''
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
    },
    /**
     * 卡片「添加到歌单」统一入口：
     * 拉分P列表 → 多P打开分P选择弹窗；单P或接口失败直接走单曲弹窗
     */
    async openAddFlow(music: RecommendedMusic) {
      if (!music?.bvid) return
      try {
        const res = await getMusicEpisodes(music.bvid)
        const pages = res?.code === 0 && Array.isArray(res.data) ? res.data : []
        if (pages.length > 1) {
          this.pAddPending = music
          this.pAddEpisodes = pages
          this.showPAddModal = true
          return
        }
      } catch (e) {
        console.warn('[playlist] 分P列表获取失败，走单曲添加:', e)
      }
      this.openPlaylistModal(music)
    },
    closePAddModal() {
      this.showPAddModal = false
      this.pAddPending = null
      this.pAddEpisodes = []
    },

    // ===== B 站收藏夹（对齐 pink-music：ids 一次拿全 + 50/批 infos，防 -412 风控） =====

    /**
     * 同步登录用户的收藏夹列表为本地虚拟歌单（id 形如 bili-fav-{mediaId}）。
     * 对齐 pink-music syncFavorites：创建的 + 收藏的 两个真实接口并行拉取，
     * 只收 state === 0 的正常项并标记 biliSource 来源。
     * 已存在的收藏夹只更新标题/封面/条目数，不动已加载的歌曲。
     * 返回 { total, added }：total = 服务端收藏夹总数，added = 本次新增虚拟歌单数。
     */
    async syncBiliFavlist(mid: number): Promise<{ total: number; added: number }> {
      const [createdRes, collectedRes] = await Promise.all([
        getFavFolders(mid),
        getFavCollectedFolders(mid)
      ])
      // 单个接口失败不阻断整体（pink-music 同策略）：失败的按空列表处理
      const folders: Array<BiliFavFolder & { source: 'created' | 'collected' }> = []
      const errors: string[] = []
      const collect = (
        res: { code?: number; message?: string; data?: { list?: BiliFavFolder[] } },
        source: 'created' | 'collected'
      ) => {
        if (res?.code === 0 && Array.isArray(res.data?.list)) {
          for (const f of res.data!.list) {
            // state === 0 才是正常收藏夹（pink-music 过滤规则）
            if (f.state !== undefined && f.state !== 0) continue
            folders.push({ ...f, source })
          }
        } else {
          errors.push(`${source}: ${res?.message || `code=${res?.code}`}`)
        }
      }
      collect(createdRes, 'created')
      collect(collectedRes, 'collected')
      // 两个接口都失败才算整体失败
      if (!folders.length && errors.length === 2) {
        throw new Error(errors.join('；'))
      }

      let added = 0
      let idx = 0
      for (const f of folders) {
        const pid = `bili-fav-${f.id}`
        const existing = this.playlists.find((p) => p.id === pid)
        if (!existing) {
          this.playlists.push({
            id: pid,
            name: f.title,
            cover: f.cover || '',
            songs: [],
            createdAt: Date.now() + idx,
            isBiliFavorite: true,
            biliSource: f.source,
            mediaCount: f.media_count
          })
          added++
        } else {
          existing.name = f.title
          existing.mediaCount = f.media_count
          existing.biliSource = existing.biliSource ?? f.source
          if (f.cover) existing.cover = f.cover
        }
        idx++
      }
      this.persist()
      return { total: folders.length, added }
    },

    /** 收藏 media 项 → 本地曲目并追加（过滤失效/追更/电影，按 bvid 去重）；返回新增数 */
    appendFavMedias(pl: Playlist, medias: BiliFavMedia[]): number {
      let added = 0
      for (const item of medias) {
        if (!item) continue
        // attr 非 0 = 条目已失效
        if (item.attr && item.attr !== 0) continue
        // 2=视频稿件 12=音频；跳过追更合集(21)与电影(24)
        if (item.type === 21 || item.type === 24) continue
        // 必须有 bvid：播放链路 getMusicInfo/playurl 全依赖 bvid，
        // 无 bvid 的纯音频(type 12)入库后永远无法播放，还会污染队列
        const bvid = item.bvid || item.bv_id || ''
        if (!bvid) continue
        const exists = pl.songs.some((m) => m.bvid === bvid)
        if (exists) continue
        pl.songs.push({
          bvid,
          aid: item.id || 0,
          cid: item.cid,
          title: item.title || `收藏项 ${item.id}`,
          author: item.upper?.name || (item.upper?.mid != null ? String(item.upper.mid) : ''),
          cover: item.cover
            ? item.cover.startsWith('//')
              ? `https:${item.cover}`
              : item.cover
            : '',
          duration: item.duration || 0,
          playCount: item.cnt_info?.play || 0,
          pubdate: 0,
          rec_reason: '',
          favId: item.id,
          favType: item.type,
          isBiliFavoriteResource: true
        })
        added++
      }
      return added
    },

    /**
     * 拉取某个收藏夹歌单的全部内容并入库。
     * onProgress({stage:'ids'|'infos', current, total, loaded}) 供 UI 显示进度。返回本次新增数。
     */
    async loadFavResources(
      playlistId: string,
      onProgress?: (p: { stage: string; current: number; total: number; loaded: number }) => void
    ): Promise<number> {
      const pl = this.playlists.find((p) => p.id === playlistId)
      if (!pl || !playlistId.startsWith('bili-fav-')) return 0
      const mediaId = Number(playlistId.replace('bili-fav-', ''))
      if (!mediaId) return 0
      const idsRes = await getFavResourceIds(mediaId)
      if (idsRes?.code !== 0 || !Array.isArray(idsRes.data)) {
        throw new Error(idsRes?.message || `code=${idsRes?.code}`)
      }
      // 只保留视频稿件(2)与音频(12)，提前剔除追更/电影等
      const validIds = idsRes.data.filter((it) => it && (it.type === 2 || it.type === 12))
      onProgress?.({ stage: 'ids', current: 1, total: 1, loaded: validIds.length })
      if (!validIds.length) return 0
      const CHUNK = 50
      const totalChunks = Math.ceil(validIds.length / CHUNK)
      let added = 0
      for (let i = 0; i < validIds.length; i += CHUNK) {
        const resources = validIds
          .slice(i, i + CHUNK)
          .map((it) => `${it.id}:${it.type}`)
          .join(',')
        try {
          const infoRes = await getFavResourceInfos(resources)
          if (infoRes?.code === 0 && Array.isArray(infoRes.data)) {
            added += this.appendFavMedias(pl, infoRes.data)
          }
        } catch (e) {
          // 单批失败不中断整体
          console.warn(`[playlist] fav infos 第 ${Math.floor(i / CHUNK) + 1}/${totalChunks} 批失败:`, e)
        }
        onProgress?.({
          stage: 'infos',
          current: Math.floor(i / CHUNK) + 1,
          total: totalChunks,
          loaded: pl.songs.length
        })
      }
      if (added > 0) {
        pl.cover = pl.cover || pl.songs[0]?.cover || ''
        this.persist()
      }
      return added
    }
  }
})