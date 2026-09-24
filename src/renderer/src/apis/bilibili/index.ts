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