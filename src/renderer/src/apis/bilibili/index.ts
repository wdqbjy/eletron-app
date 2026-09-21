/**
 * B 站音乐渲染层 API（服务层）
 *
 * 对应 pink-music-app 的 src/service：类型定义 + 方法封装。
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
}

/** 展示层搜索结果项（格式化后，对应 pink-music 渲染成 card 的字段） */
export interface SearchResultItem {
  bvid: string
  aid: number
  title: string
  author: string
  cover: string
  play: number
  duration: string | number
  pubdate: number
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

// 经 preload 的 contextBridge 注入；node/main 类型作用域里 window 无该全局声明，故走 any（同 utils/request.ts 惯例）
const api = (window as any).electronMyAPI.bilibili

/** 全站搜索音乐：主进程透传的正是 B 站 payload，类型即 BiliSearchResponse */
export async function searchMusic(
  keyword: string,
  page = 1,
  pageSize = 20
): Promise<BiliSearchResponse> {
  return api.searchMusic(keyword, page, pageSize)
}

/** 获取稿件信息 */
export async function getMusicInfo(
  bvid: string
): Promise<{ code: number; message: string; data?: any }> {
  return api.getMusicInfo(bvid)
}