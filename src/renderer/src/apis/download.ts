/**
 * 音乐下载渲染层 API（服务层）
 *
 * 封装 downloadAudio / getDownloadTasks / onDownloadProgress 等。
 * 自身不发 HTTP —— 经 window.electronMyAPI.download
 * → IPC → 主进程 DownloadService（带 Referer/UA/登录态 cookie 拉 DASH 流写盘）。
 */

export type DownloadStatus = 'waiting' | 'downloading' | 'completed' | 'error'

/** 主进程广播 / 查询返回的下载任务 */
export interface DownloadTask {
  id: string
  title: string
  author: string
  bvid: string
  cid: number | string
  quality: string
  audioCodecs: string
  fileName: string
  filePath: string
  status: DownloadStatus
  progress: number
  totalBytes: number
  downloadedBytes: number
  createdTime: number
  error: string
}

/** 发起下载时的入参（id 由 store 生成后注入） */
export interface DownloadStartParams {
  id?: string
  audioUrl: string
  fileName: string
  bvid?: string
  cid?: number | string
  title?: string
  author?: string
  quality?: string
  audioCodecs?: string
}

// 经 preload contextBridge 注入
const api = (window as any).electronMyAPI.download

/** 发起下载 */
export async function startDownload(params: DownloadStartParams): Promise<any> {
  const res = await api.start(params)
  console.log('[bili-recv] download start 返回:', res)
  return res
}

/** 拉取主进程内存中的任务列表 */
export async function getDownloadTasks(): Promise<{ code: number; data?: DownloadTask[] }> {
  return await api.getTasks()
}

/** 清空任务记录（不删文件） */
export async function clearDownloadTasks(): Promise<any> {
  return await api.clearTasks()
}

/** 在系统文件管理器打开下载目录 */
export async function openDownloadFolder(): Promise<any> {
  return await api.openFolder()
}

/** 订阅下载进度推送，返回取消订阅函数 */
export function onDownloadProgress(callback: (task: DownloadTask) => void): () => void {
  return api.onProgress(callback)
}
