import { app, shell, dialog } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, promises as fsp } from 'fs'
import { bilibiliApi } from './bilibili'
import { assertMediaUrl } from '../security/ssrf'

/**
 * 音乐下载服务（主进程）
 *
 * download-audio 链路：
 * - 渲染层先经 /x/player/playurl 取到 DASH 音频流地址，再把地址交给本服务；
 * - 本进程用带 Referer/UA/登录态 cookie 的 axios 拉成 Buffer，写入下载目录；
 * - 进度通过 onProgress 回调实时广播（IPC 层转 webContents.send）。
 *
 * 任务仅保存在内存（重启清空）；不写 ID3 标签。
 */

export type DownloadStatus = 'waiting' | 'downloading' | 'completed' | 'error'

/** 渲染层发起下载时传入的参数（id 由渲染层生成，保证两端同一任务） */
export interface DownloadStartParams {
  id?: string
  audioUrl: string
  /** 不含扩展名的文件名，主进程做非法字符清洗 */
  fileName: string
  bvid?: string
  cid?: number | string
  title?: string
  author?: string
  quality?: string
  audioCodecs?: string
}

/** 下载任务（主进程内存态 + 广播给渲染层的形状） */
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

interface IpcResult<T = any> {
  code: number
  message?: string
  data?: T
}

/** 下载设置文件（userData/settings.json） */
function getSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function readSettings(): Record<string, any> {
  try {
    const p = getSettingsPath()
    if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf-8'))
  } catch (e: any) {
    console.warn('[Download] read settings failed:', e?.message)
  }
  return {}
}

function writeSettings(data: Record<string, any>): void {
  writeFileSync(getSettingsPath(), JSON.stringify(data, null, 2), 'utf-8')
}

/** 清洗文件名：去 Windows 非法字符，截断 100 字符 */
function sanitizeFileName(name: string): string {
  return (name || '未知音频').replace(/[<>"/\\|?*]/g, '').substring(0, 100).trim() || '未知音频'
}

class DownloadService {
  /** 纯内存任务列表，最新的在前 */
  private tasks: DownloadTask[] = []

  list(): DownloadTask[] {
    return this.tasks
  }

  clear(): void {
    // 只清列表，不删已落盘文件
    this.tasks.length = 0
  }

  /** 当前下载目录：settings.json 的 downloadDir，缺省 userData/downloads（自动建目录） */
  getDirectory(): string {
    const dir = readSettings().downloadDir || join(app.getPath('userData'), 'downloads')
    if (!existsSync(dir)) {
      try {
        mkdirSync(dir, { recursive: true })
      } catch (e: any) {
        console.error('[Download] mkdir failed:', e?.message)
      }
    }
    return dir
  }

  /** 弹系统目录选择框（只返回路径，由渲染层确认后再 setDirectory 落盘） */
  async selectDirectory(): Promise<IpcResult<{ canceled: boolean; path?: string }>> {
    const result = await dialog.showOpenDialog({
      title: '选择下载目录',
      defaultPath: this.getDirectory(),
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || !result.filePaths?.length) {
      return { code: 0, data: { canceled: true } }
    }
    return { code: 0, data: { canceled: false, path: result.filePaths[0] } }
  }

  /** 保存下载目录到 settings.json 并确保目录存在 */
  setDirectory(dir: string): IpcResult<{ path: string }> {
    const target = (dir || '').trim()
    if (!target) return { code: -1, message: '目录不能为空' }
    try {
      mkdirSync(target, { recursive: true })
      const settings = readSettings()
      settings.downloadDir = target
      writeSettings(settings)
      return { code: 0, data: { path: target } }
    } catch (e: any) {
      return { code: -1, message: e?.message || '设置下载目录失败' }
    }
  }

  /** 在系统文件管理器中打开下载目录 */
  async openFolder(): Promise<IpcResult> {
    try {
      const dir = this.getDirectory()
      const err = await shell.openPath(dir)
      if (err) return { code: -1, message: err }
      return { code: 0 }
    } catch (e: any) {
      return { code: -1, message: e?.message || '打开目录失败' }
    }
  }

  /**
   * 执行下载：建任务 → 拉流（带进度回调）→ 写盘 → 广播完成/失败。
   * @param params 渲染层传来的任务参数
   * @param onProgress 每次状态/进度变化时回调，IPC 层负责广播给渲染窗口
   */
  async start(
    params: DownloadStartParams,
    onProgress?: (task: DownloadTask) => void
  ): Promise<IpcResult<{ filePath: string; taskId: string }>> {
    const { audioUrl, fileName } = params
    if (!audioUrl || !/^https?:\/\//.test(audioUrl)) {
      return { code: -1, message: '缺少合法的音频地址' }
    }
    // SSRF 防护：媒体 CDN 白名单（内网 IP / IP 字面量 / DNS 重绑定仍拦截），
    // 严格 origin 白名单会拦掉 B 站音频 CDN 导致下载失败
    try {
      await assertMediaUrl(audioUrl)
    } catch (_) {
      return { code: -1, message: '音频地址被安全策略拒绝' }
    }

    const id = params.id || `dl_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
    const safeFileName = sanitizeFileName(fileName)
    const downloadDir = this.getDirectory()

    // B 站 DASH 音频（dash.audio/flac/dolby）字节流本质是 fragmented MP4，
    // 无论内部 codec 是 AAC/FLAC/EC-3 都不能写成 .flac/.mp3（魔数不匹配播放器不认）。
    // 统一 .m4a；仅 codecs 明确为 mp3 时用 .mp3。
    const codecsLower = String(params.audioCodecs || '').toLowerCase()
    const ext = codecsLower.includes('mp3') ? '.mp3' : '.m4a'
    // 同名文件不静默覆盖：追加序号 (1)(2)…
    let finalFileName = `${safeFileName}${ext}`
    let seq = 1
    while (existsSync(join(downloadDir, finalFileName))) {
      finalFileName = `${safeFileName}(${seq++})${ext}`
    }
    const filePath = join(downloadDir, finalFileName)

    const task: DownloadTask = {
      id,
      title: params.title || safeFileName,
      author: params.author || '',
      bvid: params.bvid || '',
      cid: params.cid ?? '',
      quality: params.quality || 'auto',
      audioCodecs: params.audioCodecs || '',
      fileName: finalFileName,
      filePath,
      status: 'downloading',
      progress: 0,
      totalBytes: 0,
      downloadedBytes: 0,
      createdTime: Date.now(),
      error: ''
    }

    // 同 id 任务覆盖（重试场景）
    const existingIdx = this.tasks.findIndex((t) => t.id === id)
    if (existingIdx > -1) this.tasks.splice(existingIdx, 1)
    this.tasks.unshift(task)
    onProgress?.(task)

    try {
      console.log(`[Download] -> ${audioUrl.slice(0, 90)}...`)
      const buffer = await bilibiliApi.fetchAudioBuffer(audioUrl, (loaded, total) => {
        task.totalBytes = total
        task.downloadedBytes = loaded
        task.progress = Math.min(100, Math.round((loaded / total) * 100))
        onProgress?.(task)
      })

      // 整包写入；同名直接覆盖
      await fsp.writeFile(filePath, buffer)

      task.status = 'completed'
      task.progress = 100
      task.totalBytes = task.totalBytes || buffer.length
      task.downloadedBytes = buffer.length
      onProgress?.(task)
      console.log(`[Download] completed: ${finalFileName} (${buffer.length} bytes)`)

      return { code: 0, data: { filePath, taskId: id } }
    } catch (e: any) {
      task.status = 'error'
      task.error = e?.message || '下载失败'
      task.progress = 0
      onProgress?.(task)
      console.error('[Download] failed:', task.error)
      return { code: -1, message: task.error }
    }
  }
}

export const downloadService = new DownloadService()
