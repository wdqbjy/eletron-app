/**
 * B 站音乐渲染层 API（服务层）
 *
 * 类型定义 + 方法封装。
 * 自身不直接发 HTTP —— 经 window.electronMyAPI.bilibili → IPC → 主进程 BilibiliApi。
 */
export interface BiliSearchVideoItem {
  bvid: string
  aid: number
  title: string
  author: string
  pic: string
  play: number
  duration: string | number
  pubdate: number
  videos: number
}

/** 展示层搜索结果项（格式化后用于渲染卡片的字段） */
export interface SearchResultItem {
  bvid: string
  aid: number
  title: string
  author: string
  cover: string
  play: number
  duration: string | number
  pubdate: number
  videos: number
}

/** /x/web-interface/search/all/v2 响应 —— B 站原始 payload 形状（注意：data 只有一层） */
export interface BiliSearchResponse {
  code: number
  message: string
  ttl: number
  data: {
    result?: { result_type?: string; data?: BiliSearchVideoItem[] }[]
  }
}

// 经 preload 的 contextBridge 注入；node/main 类型作用域里 window 无该全局声明，故走 any
const api = (window as any).electronMyAPI.bilibili

/** 全站搜索音乐：主进程透传的正是 B 站 payload，类型即 BiliSearchResponse */
export async function searchMusic(
  keyword: string,
  page = 1,
  pageSize = 20
): Promise<BiliSearchResponse> {
  const res = await api.searchMusic(keyword, page, pageSize)
  console.log('[bili-recv] searchMusic 返回:', res)
  return res
}

/** 获取稿件信息 */
export async function getMusicInfo(
  bvid: string
): Promise<{ code: number; message: string; data?: any }> {
  const res = await api.getMusicInfo(bvid)
  console.log('[bili-recv] getMusicInfo 返回:', res)
  return res
}

export interface BiliPage {
  cid: number
  page: number
  part: string
  duration: number
}
/** 分P列表：GET /x/player/pagelist，返回 data: Page[] */
export async function getMusicEpisodes(bvid: string): Promise<{ code: number; message: string; data?: BiliPage[] }> {
  const res = await api.getMusicEpisodes(bvid)
  console.log('[bili-recv] getMusicEpisodes 返回:', res)
  return res
}

// ============ B 站收藏夹（需登录） ============
/** 收藏夹（用户创建的）：/x/v3/fav/folder/created/list 的 list 项 */
export interface BiliFavFolder {
  id: number
  title: string
  media_count: number
  cover?: string
  /** 0 = 正常（pink-music 同步时只收 state===0 的项） */
  state?: number
  upper?: { mid?: number; name?: string }
}

/** 收藏条目：/x/v3/fav/resource/infos 的 data 项 */
export interface BiliFavMedia {
  id: number
  type: number // 2 视频稿件 / 12 音频 / 21 视频合集(追更) / 24 电影
  attr?: number // 非 0 视为失效
  bvid?: string
  bv_id?: string
  cid?: number
  title?: string
  upper?: { name?: string; mid?: number }
  cover?: string
  duration?: number
  cnt_info?: { play?: number; collect?: number }
}

export async function getFavFolders(
  upMid: number
): Promise<{ code: number; message: string; data?: { list: BiliFavFolder[] } }> {
  return api.getFavFolders(upMid)
}

/** 收藏的（他人的）收藏夹：/x/v3/fav/folder/collected/list */
export async function getFavCollectedFolders(
  upMid: number
): Promise<{ code: number; message: string; data?: { list: BiliFavFolder[] } }> {
  return api.getFavCollectedFolders(upMid)
}

export async function getFavResourceIds(
  mediaId: number
): Promise<{ code: number; message: string; data?: Array<{ id: number; type: number }> }> {
  return api.getFavResourceIds(mediaId)
}

export async function getFavResourceInfos(
  resources: string
): Promise<{ code: number; message: string; data?: BiliFavMedia[] }> {
  return api.getFavResourceInfos(resources)
}

/** 首页「推荐音乐」卡片（x/web-interface/region/feed/rcmd archives[] 格式化后） */
export interface RecommendedMusic {
  bvid: string
  aid: number
  cid?: number
  title: string
  author: string
  cover: string
  duration: number
  playCount: number
  pubdate: number
  rec_reason: string
  /** B 站收藏条目专用：来源收藏夹内的 id/type（无 bvid 的音频项兜底用） */
  favId?: number
  favType?: number
  isBiliFavoriteResource?: boolean
}

/** /x/web-interface/region/feed/rcmd 响应 —— B 站原始 payload */
export interface BiliRegionResponse {
  code: number
  message: string
  ttl?: number
  data?: {
    archives?: any[]
  }
}

/** 音乐区推荐：B 站主进程透传的正是原始 payload */
export async function getMusicRegionFeed(
  displayId = 1,
  requestCnt = 20
): Promise<BiliRegionResponse> {
  const res = await api.getMusicRegionFeed(displayId, requestCnt)
  console.log('[bili-recv] getMusicRegionFeed 返回:', res)
  return res
}

/** /x/player/playurl 响应 —— B 站原始 payload（data 含 dash / durl 音频流） */
export interface MusicPlayurlResponse {
  code: number
  message: string
  data?: any
}

/** 获取真实播放地址：主进程透传 B 站原始 payload，渲染层再用 selectAudioUrl 择优 */
export async function getMusicPlayUrl(bvid: string, cid: number): Promise<MusicPlayurlResponse> {
  const res = await api.getMusicPlayUrl(bvid, cid)
  console.log('[bili-recv] getMusicPlayUrl 返回:', res)
  return res
}

/** 歌词响应（网易云匹配） */
export interface LyricResponse {
  code: number
  message?: string
  /** 旧版为拼接字符串；新版主进程返回 { lrc, tv, rv } 三段（原文/翻译/罗马音） */
  data?: string | { lrc?: string; tv?: string; rv?: string }
  source?: string
}

/** 为当前曲目自动匹配歌词（主进程按标题/作者搜网易云），data 为合并翻译的 LRC 文本 */
export async function getLyric(title: string, artist: string): Promise<LyricResponse> {
  const res = await api.getLyric({ title, artist })
  console.log('[bili-recv] getLyric 返回:', res)
  return res
}

/** 网易云搜索候选歌曲 */
export interface NeteaseSong {
  id: number
  name: string
  artist: string
  album: string
  duration: number
}
export async function searchLyric(keyword: string): Promise<NeteaseSong[]> {
  const res = await api.searchLyric(keyword)
  console.log('[bili-recv] searchLyric 返回:', res)
  return res
}

/** 按网易云歌曲 id 取歌词 */
export async function getLyricById(id: number): Promise<LyricResponse> {
  const res = await api.getLyricById(id)
  console.log('[bili-recv] getLyricById 返回:', res)
  return res
}