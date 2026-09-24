import { app, shell, BrowserWindow, ipcMain, safeStorage, protocol, net } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'
import icon from '../../resources/icon.png?asset'
import { bilibiliApi } from './services/bilibili'
import { downloadService } from './services/download'
import { assertSafeUrl, SecurityError } from './security/ssrf'
import { nonEmptyString, boundedInt, plainObject, ParamError } from './security/validate'

// ============== B 站音频流代理协议（必须在 app ready 之前注册）==============
// 渲染层 <audio> 原生请求不会带 B 站 Referer → 音频 CDN 403。主进程用 axios（带正确
// Referer/UA）把流代理回来，渲染层用 `biliaudio://audio/?u=<编码后的真实地址>` 播放。
protocol.registerSchemesAsPrivileged([
  { scheme: 'biliaudio', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
])

/**
 * 处理 biliaudio:// 媒体请求：把真实音频地址通过主进程拉流（带 B 站 Referer/UA），
 * 流式返回给渲染层，从而绕过 CDN 防盗链。Range 一并透传以支持进度拖动。
 *
 * 返回前补 CORS 头（Access-Control-Allow-Origin）：渲染层 <audio> 设了 crossOrigin
 * 以便 Web Audio AnalyserNode 读取频谱（播放特效），跨源媒体必须带 CORS 头否则被
 * taint 成静音/零数据。
 */
function installBiliAudioProtocol(): void {
  try {
    const CORS_HEADERS: Record<string, string> = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Range, Content-Type, Origin',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      Vary: 'Origin'
    }
    protocol.handle('biliaudio', async (request) => {
      try {
        // 预检请求：媒体元素一般不发预检，但 fetch 可能触发，兜底返回 204
        if (request.method === 'OPTIONS') {
          return new Response(null, { status: 204, headers: CORS_HEADERS })
        }
        const params = new URL(request.url).searchParams
        const audioUrl = params.get('u') || ''
        if (!/^https?:\/\//.test(audioUrl)) return new Response('bad url', { status: 400 })
        const headers: Record<string, string> = {
          'User-Agent': BILIBILI_UA,
          Referer: 'https://www.bilibili.com/',
          Origin: 'https://www.bilibili.com'
        }
        const range = request.headers.get('range')
        if (range) headers['Range'] = range
        // @ts-ignore 双工流需要 duplex（GET 下无实际影响，仅为满足 fetch 类型）
        const upstream = await net.fetch(audioUrl, { headers, duplex: 'half' })
        // 透传上游 body 与状态（保留 206 / Content-Range 供进度拖动），追加 CORS 头
        const outHeaders = new Headers(upstream.headers)
        Object.entries(CORS_HEADERS).forEach(([k, v]) => outHeaders.set(k, v))
        return new Response(upstream.body, {
          status: upstream.status,
          statusText: upstream.statusText,
          headers: outHeaders
        })
      } catch (err) {
        console.error('[biliaudio] proxy failed:', err)
        return new Response('proxy error', { status: 502, headers: CORS_HEADERS })
      }
    })
  } catch (err) {
    console.error('[biliaudio] register protocol failed:', err)
  }
}

// ============== Token 安全存储（主进程无 localStorage，改用文件 + safeStorage 加密）==============
const TOKEN_FILE = join(app.getPath('userData'), 'auth_token')

function saveEncryptedToken(token: string): void {
  try {
    const userDataDir = app.getPath('userData')
    if (!existsSync(userDataDir)) {
      mkdirSync(userDataDir, { recursive: true })
    }
    const buffer = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(token)
      : Buffer.from(token, 'utf-8')
    writeFileSync(TOKEN_FILE, buffer)
  } catch (err) {
    console.error('[Token] save failed:', err)
  }
}

function readEncryptedToken(): string | null {
  try {
    if (!existsSync(TOKEN_FILE)) return null
    const buffer = readFileSync(TOKEN_FILE)
    return safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(buffer)
      : buffer.toString('utf-8')
  } catch (err) {
    console.error('[Token] read failed:', err)
    return null
  }
}

function clearEncryptedToken(): void {
  try {
    if (existsSync(TOKEN_FILE)) {
      unlinkSync(TOKEN_FILE)
    }
  } catch (err) {
    console.error('[Token] clear failed:', err)
  }
}


// ============== API 响应类型 ==============
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
  statusCode?: number
}

// ============== Axios 实例配置 ==============
class ApiService {
  private axiosInstance: AxiosInstance
  private requestInterceptor: number | null = null
  private responseInterceptor: number | null = null

  constructor() {
    // 创建 Axios 实例
    this.axiosInstance = axios.create({
      //baseURL: 'http://192.168.103.160:8088',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    })

    this.setupInterceptors()

    // 启动时恢复已保存的 token
    const savedToken = readEncryptedToken()
    if (savedToken) {
      this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`
    }
  }

  // 设置拦截器
  private setupInterceptors(): void {
    // 请求拦截器 - 添加 token 等
    this.requestInterceptor = this.axiosInstance.interceptors.request.use(
      (config) => {
        // 从安全存储中获取 token（实际应从加密存储读取）
        // const token = this.getAuthToken()
        // if (token && config.headers) {
        //   config.headers.Authorization = `Bearer ${token}`
        // }
        
        // 添加请求时间戳（防重放攻击）
        config.params = {
          ...config.params,
          _t: Date.now()
        }
        
        console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`)
        return config
      },
      (error: AxiosError) => {
        console.error('[API Request Error]', error)
        return Promise.reject(error)
      }
    )

    // 响应拦截器 - 统一错误处理
    this.responseInterceptor = this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        console.log(`[API Response] ${response.config.url}`, response.status)
        return response
      },
      (error: AxiosError) => {
        // 统一错误处理
        if (error.response) {
          // 服务器返回错误状态码
          const status = error.response.status
          switch (status) {
            case 401:
              console.error('unauthorized, please re-login')
              this.handleUnauthorized()
              break
            case 403:
              console.error('access denied')
              break
            case 404:
              console.error('resource not found')
              break
            case 500:
              console.error('server internal error')
              break
            default:
              console.error(`request error: ${status}`)
          }
        } else if (error.request) {
          // 请求已发出但没有收到响应
          console.error('network error, cannot connect to server')
        } else {
          // 请求配置出错
          console.error('request config error:', error.message)
        }
        
        return Promise.reject(error)
      }
    )
  }
  
  // 处理未授权
  private handleUnauthorized(): void {
    // 清除本地 token
    // 通知渲染进程跳转登录页
    if (mainWindow) {
      mainWindow.webContents.send('unauthorized')
    }
  }

  // 通用请求方法
  private async request<T = any>(
    method: string,
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      let response: AxiosResponse<T>
      
      switch (method.toUpperCase()) {
        case 'GET':
          response = await this.axiosInstance.get<T>(url, { ...config, params: data })
          break
        case 'POST':
          response = await this.axiosInstance.post<T>(url, data, config)
          break
        case 'PUT':
          response = await this.axiosInstance.put<T>(url, data, config)
          break
        case 'DELETE':
          response = await this.axiosInstance.delete<T>(url, { ...config, data })
          break
        case 'PATCH':
          response = await this.axiosInstance.patch<T>(url, data, config)
          break
        default:
          throw new Error(`不支持的请求方法: ${method}`)
      }
      
      return {
        success: true,
        data: response.data,
        statusCode: response.status
      }
    } catch (error) {
      const axiosError = error as AxiosError
      return {
        success: false,
        error: axiosError.message,
        message: axiosError.response?.statusText || '请求失败',
        statusCode: axiosError.response?.status
      }
    }
  }

  // 公开的 API 方法
  async get<T = any>(url: string, params?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('GET', url, params, config)
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('POST', url, data, config)
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', url, data, config)
  }

  async delete<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', url, data, config)
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', url, data, config)
  }

  // 文件上传
  async uploadFile<T = any>(
    url: string,
    filePath: string,
    fieldName: string = 'file',
    additionalData?: Record<string, any>
  ): Promise<ApiResponse<T>> {
    const FormData = require('form-data')
    const fs = require('fs')
    
    const form = new FormData()
    form.append(fieldName, fs.createReadStream(filePath))
    
    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        form.append(key, value)
      })
    }
    
    return this.post<T>(url, form, {
      headers: {
        ...form.getHeaders()
      }
    })
  }

  // 设置认证 token
  setAuthToken(token: string | null): void {
    if (token) {
      this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`
      // 安全存储 token（加密文件）
      this.saveAuthToken(token)
    } else {
      delete this.axiosInstance.defaults.headers.common['Authorization']
      this.clearAuthToken()
    }
  }

  private saveAuthToken(token: string): void {
    saveEncryptedToken(token)
  }

  private clearAuthToken(): void {
    clearEncryptedToken()
  }

  // 销毁拦截器
  destroy(): void {
    if (this.requestInterceptor !== null) {
      this.axiosInstance.interceptors.request.eject(this.requestInterceptor)
    }
    if (this.responseInterceptor !== null) {
      this.axiosInstance.interceptors.response.eject(this.responseInterceptor)
    }
  }
}

// 创建 API 服务实例
const apiService = new ApiService()

// 安全拦截的统一失败返回（与渲染层 httpClient 的 ApiResponse 形状对齐）
function toSecurityFailure(e: unknown): ApiResponse {
  const message =
    e instanceof SecurityError || e instanceof ParamError ? e.message : '请求被安全策略拦截'
  return { success: false, message, error: message, statusCode: 400 }
}

let mainWindow: BrowserWindow | any = null // 主窗口

// ============== B 站图床 Referer（渲染层直连 <img> 时用） ==============
const BILIBILI_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/**
 * B 站封面/CDN 会校验 Referer，缺了会 403。渲染层 <img> 更不会带 bilibili 的 Referer，
 * 用 webRequest 在【主进程】给图床请求统一补上 Referer/Origin/UA
 * （只影响渲染层图片直连，不影响主进程 API）。
 */
function setupBilibiliImageHeaders(win: BrowserWindow): void {
  try {
    win.webContents.session.webRequest.onBeforeSendHeaders(
      {
        // http/https 都拦：封面转 https 后走 https 规则；万一有 raw http 也有兜底 Referer
        urls: [
          'https://*.hdslb.com/*',
          'http://*.hdslb.com/*',
          'https://*.bilivideo.com/*',
          'https://*.bilivideo.cn/*'
        ]
      },
      (details, callback) => {
        details.requestHeaders['Referer'] = 'https://www.bilibili.com/'
        details.requestHeaders['Origin'] = 'https://www.bilibili.com'
        details.requestHeaders['User-Agent'] = BILIBILI_UA
        callback({ requestHeaders: details.requestHeaders })
      }
    )
  } catch (err) {
    console.error('[sec] install bilibili img referer failed:', err)
  }
}

// ============== Electron 应用 ==============
class ElectronMyApp {
  private mainWindow: BrowserWindow | null = null

  private createWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 900,
      height: 670,
      show: false,
      frame: false, // 禁用原生边框
      autoHideMenuBar: true,
      ...(process.platform === 'linux' ? { icon } : {}),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: true,           // preload 运行在沙箱，限制其可用 Node 能力
        contextIsolation: true,  // 渲染上下文隔离，只能用 contextBridge 暴露的白名单 API
        nodeIntegration: false,  // 渲染层不注入 Node
        webSecurity: true,       // 保持默认同源/权限约束，绝不关闭
        spellcheck: false
      },
      // macOS 圆角
      roundedCorners: true
    })

    mainWindow = this.mainWindow
    // HMR for renderer base on electron-vite cli.
    // Load the remote URL for development or the local html file for production.
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }

    // 挂载
    mainWindow.on('ready-to-show', () => {
      mainWindow.show()
    })
  
    mainWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    setupBilibiliImageHeaders(mainWindow)

    this.setupIpcHandlers()
  }

  private setupIpcHandlers(): void {
    // ============== HTTP 请求处理器（已加 SSRF 白名单 + 入参校验） ==============
    ipcMain.handle('http:get', async (_event, { url, params }) => {
      try {
        await assertSafeUrl(url)
        if (params !== undefined) plainObject(params, 'params')
        return await apiService.get(url, params)
      } catch (e) {
        console.error('[sec] blocked http:get', e)
        return toSecurityFailure(e)
      }
    })

    ipcMain.handle('http:post', async (_event, { url, data, headers }) => {
      try {
        await assertSafeUrl(url)
        if (data !== undefined) plainObject(data, 'data')
        if (headers !== undefined) plainObject(headers, 'headers')
        return await apiService.post(url, data, headers ? { headers } : undefined)
      } catch (e) {
        console.error('[sec] blocked http:post', e)
        return toSecurityFailure(e)
      }
    })

    ipcMain.handle('http:put', async (_event, { url, data }) => {
      try {
        await assertSafeUrl(url)
        if (data !== undefined) plainObject(data, 'data')
        return await apiService.put(url, data)
      } catch (e) {
        console.error('[sec] blocked http:put', e)
        return toSecurityFailure(e)
      }
    })

    ipcMain.handle('http:delete', async (_event, { url }) => {
      try {
        await assertSafeUrl(url)
        return await apiService.delete(url)
      } catch (e) {
        console.error('[sec] blocked http:delete', e)
        return toSecurityFailure(e)
      }
    })

    ipcMain.handle('http:patch', async (_event, { url, data }) => {
      try {
        await assertSafeUrl(url)
        if (data !== undefined) plainObject(data, 'data')
        return await apiService.patch(url, data)
      } catch (e) {
        console.error('[sec] blocked http:patch', e)
        return toSecurityFailure(e)
      }
    })

    // ============== B 站音乐（参数化 + 入参校验） ==============
    ipcMain.handle('bili:search-music', async (_event, keyword, page, pageSize) => {
      try {
        const kw = nonEmptyString(keyword, 'keyword', 100)
        const p = boundedInt(page, 'page', 1, 1000, 1)
        const ps = boundedInt(pageSize, 'pageSize', 1, 100, 20)
        return await bilibiliApi.searchMusic(kw, p, ps)
      } catch (e) {
        console.error('[sec] blocked bili:search-music', e)
        return toSecurityFailure(e)
      }
    })
    ipcMain.handle('bili:get-music-info', async (_event, bvid) => {
      try {
        const bv = nonEmptyString(bvid, 'bvid', 20)
        if (!/^BV[0-9A-Za-z]{10,12}$/.test(bv)) throw new ParamError('bvid 格式非法')
        return await bilibiliApi.getMusicInfo(bv)
      } catch (e) {
        console.error('[sec] blocked bili:get-music-info', e)
        return toSecurityFailure(e)
      }
    })
    ipcMain.handle('bili:get-episodes', async (_event, bvid) => {
      try {
        const bv = nonEmptyString(bvid, 'bvid', 20)
        if (!/^BV[0-9A-Za-z]{10,12}$/.test(bv)) throw new ParamError('bvid 格式非法')
        return await bilibiliApi.getMusicEpisodes(bv)
      } catch (e) {
        console.error('[sec] blocked bili:get-episodes', e)
        return toSecurityFailure(e)
      }
    })
    ipcMain.handle('bili:region-feed', async (_event, displayId, requestCnt) => {
      try {
        const did = boundedInt(displayId, 'displayId', 1, 100000, 1)
        const cnt = boundedInt(requestCnt, 'requestCnt', 1, 100, 20)
        return await bilibiliApi.getMusicRegionFeed(did, cnt)
      } catch (e) {
        console.error('[sec] blocked bili:region-feed', e)
        return toSecurityFailure(e)
      }
    })
    ipcMain.handle('bili:get-music-play-url', async (_event, bvid, cid) => {
      try {
        const bv = nonEmptyString(bvid, 'bvid', 20)
        if (!/^BV[0-9A-Za-z]{10,12}$/.test(bv)) throw new ParamError('bvid 格式非法')
        const c = boundedInt(cid, 'cid', 1, 100000000000)
        return await bilibiliApi.getMusicPlayUrl(bv, c)
      } catch (e) {
        console.error('[sec] blocked bili:get-music-play-url', e)
        return toSecurityFailure(e)
      }
    })
    ipcMain.handle('bili:get-lyric', async (_event, arg) => {
      try {
        const o = plainObject(arg, 'arg', ['title', 'artist'])
        const title = nonEmptyString(o.title, 'title', 200)
        const artist = typeof o.artist === 'string' ? o.artist.trim().slice(0, 200) : ''
        return await bilibiliApi.getMusicLyric(title, artist)
      } catch (e) {
        console.error('[sec] blocked bili:get-lyric', e)
        return toSecurityFailure(e)
      }
    })
    ipcMain.handle('bili:search-lyric', async (_event, keyword) => {
      try {
        const kw = nonEmptyString(keyword, 'keyword', 100)
        return await bilibiliApi.searchLyric(kw)
      } catch (e) {
        console.error('[sec] blocked bili:search-lyric', e)
        return toSecurityFailure(e)
      }
    })
    ipcMain.handle('bili:get-lyric-by-id', async (_event, id) => {
      try {
        const sid = boundedInt(id, 'id', 1, 9007199254740991)
        return await bilibiliApi.getLyricById(sid)
      } catch (e) {
        console.error('[sec] blocked bili:get-lyric-by-id', e)
        return toSecurityFailure(e)
      }
    })

    // ============== B 站扫码登录（generate-qrcode / poll-qrcode / get-user-info / logout-bilibili） ==============
    ipcMain.handle('bili:generate-qrcode', async () => {
      try {
        return await bilibiliApi.generateQrcode()
      } catch (e) {
        console.error('[sec] blocked bili:generate-qrcode', e)
        return toSecurityFailure(e)
      }
    })
    ipcMain.handle('bili:poll-qrcode', async (_event, qrcodeKey) => {
      try {
        const key = nonEmptyString(qrcodeKey, 'qrcode_key', 128)
        return await bilibiliApi.pollQrcode(key)
      } catch (e) {
        console.error('[sec] blocked bili:poll-qrcode', e)
        return toSecurityFailure(e)
      }
    })
    ipcMain.handle('bili:get-user-info', async () => {
      try {
        return await bilibiliApi.getUserInfo()
      } catch (e) {
        console.error('[sec] blocked bili:get-user-info', e)
        return toSecurityFailure(e)
      }
    })
    ipcMain.handle('bili:logout-bilibili', async () => {
      try {
        return await bilibiliApi.logout()
      } catch (e) {
        console.error('[sec] blocked bili:logout-bilibili', e)
        return toSecurityFailure(e)
      }
    })

    // ============== 音乐下载（download-audio 链路） ==============
    // 进度推送频道：bili:download-progress → preload onProgress 回调 → download store
    const broadcastDownload = (task: unknown): void => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('bili:download-progress', task)
      }
    }

    ipcMain.handle('bili:download-audio', async (_event, params) => {
      try {
        const o = plainObject(params, 'params', [
          'id',
          'audioUrl',
          'fileName',
          'bvid',
          'cid',
          'title',
          'author',
          'quality',
          'audioCodecs'
        ])
        const audioUrl = nonEmptyString(o.audioUrl, 'audioUrl', 2048)
        if (!/^https?:\/\//.test(audioUrl)) throw new ParamError('audioUrl 必须是 http(s) 地址')
        const fileName = nonEmptyString(o.fileName, 'fileName', 200)
        const optStr = (v: unknown, max: number): string | undefined =>
          v == null ? undefined : String(v).trim().slice(0, max) || undefined
        return await downloadService.start(
          {
            id: optStr(o.id, 100),
            audioUrl,
            fileName,
            bvid: optStr(o.bvid, 20),
            cid: optStr(o.cid, 32) as string | undefined,
            title: optStr(o.title, 200),
            author: optStr(o.author, 100),
            quality: optStr(o.quality, 20),
            audioCodecs: optStr(o.audioCodecs, 100)
          },
          broadcastDownload
        )
      } catch (e) {
        console.error('[sec] blocked bili:download-audio', e)
        return toSecurityFailure(e)
      }
    })

    ipcMain.handle('bili:get-download-tasks', async () => {
      return { code: 0, data: downloadService.list() }
    })

    ipcMain.handle('bili:clear-download-tasks', async () => {
      downloadService.clear()
      return { code: 0 }
    })

    ipcMain.handle('bili:open-download-folder', async () => {
      return await downloadService.openFolder()
    })

    ipcMain.handle('bili:get-download-directory', async () => {
      return { code: 0, data: downloadService.getDirectory() }
    })

    ipcMain.handle('bili:set-download-directory', async (_event, dir) => {
      try {
        const target = nonEmptyString(dir, 'dir', 1024)
        return downloadService.setDirectory(target)
      } catch (e) {
        console.error('[sec] blocked bili:set-download-directory', e)
        return toSecurityFailure(e)
      }
    })

    ipcMain.handle('bili:select-download-directory', async () => {
      return await downloadService.selectDirectory()
    })

    // ============== 应用信息 / 缓存管理（下载设置-缓存管理-关于卡片数据源） ==============

    /** 应用名 + 版本号（供「关于」卡片展示） */
    ipcMain.handle('app:info', async () => {
      return {
        code: 0,
        data: {
          name: 'Dark Music',
          version: app.getVersion()
        }
      }
    })

    /** 递归累加目录大小（字节），目录不存在/读失败返回 0 */
    async function calcDirSize(dirPath: string): Promise<number> {
      try {
        if (!existsSync(dirPath)) return 0
        const { readdirSync, statSync } = await import('fs')
        let total = 0
        for (const name of readdirSync(dirPath)) {
          const p = join(dirPath, name)
          try {
            const st = statSync(p)
            total += st.isDirectory() ? await calcDirSize(p) : st.size
          } catch {
            /* 单个文件读失败忽略 */
          }
        }
        return total
      } catch {
        return 0
      }
    }

    /** 统计缓存：userData/downloads + Cache + Code Cache（与下载目录分开，避免误清用户文件） */
    ipcMain.handle('app:get-cache-size', async () => {
      try {
        const userData = app.getPath('userData')
        const dirs = [
          join(userData, 'downloads'),
          join(userData, 'Cache'),
          join(userData, 'Code Cache')
        ]
        let total = 0
        for (const d of dirs) total += await calcDirSize(d)
        return { code: 0, size: total }
      } catch (e: any) {
        console.error('[cache] get-cache-size failed:', e?.message)
        return { code: -1, message: e?.message }
      }
    })

    /** 清理缓存：userData 下的 downloads / Cache / Code Cache + session 内存缓存 */
    ipcMain.handle('app:clear-cache', async () => {
      try {
        const userData = app.getPath('userData')
        const { rmSync } = await import('fs')
        for (const sub of ['downloads', 'Cache', 'Code Cache']) {
          try {
            rmSync(join(userData, sub), { recursive: true, force: true })
          } catch (e: any) {
            console.warn(`[cache] clear ${sub} failed:`, e?.message)
          }
        }
        try {
          const { session } = await import('electron')
          await session.defaultSession.clearCache()
        } catch (e: any) {
          console.warn('[cache] clear session cache failed:', e?.message)
        }
        return { code: 0 }
      } catch (e: any) {
        console.error('[cache] clear-cache failed:', e?.message)
        return { code: -1, message: e?.message }
      }
    })

    // ============== 认证相关（入参校验） ==============
    ipcMain.handle('auth:login', async (event, { username, password }) => {
      console.log(event)
      try {
        const user = nonEmptyString(username, 'username', 100)
        const pwd = nonEmptyString(password, 'password', 256)
        const response = await apiService.post<{ token: string; user: any }>(
          '/auth/login',
          { username: user, password: pwd }
        )
        if (response.success && response.data?.token) {
          apiService.setAuthToken(response.data.token)
        }
        return response
      } catch (e) {
        console.error('[sec] blocked auth:login', e)
        return toSecurityFailure(e)
      }
    })

    ipcMain.handle('auth:logout', async () => {
      apiService.setAuthToken(null)
      return { success: true }
    })

    ipcMain.handle('auth:setToken', async (event, { token }) => {
      console.log(event)
      try {
        const t = nonEmptyString(token, 'token', 2048)
        apiService.setAuthToken(t)
        return { success: true }
      } catch (e) {
        console.error('[sec] blocked auth:setToken', e)
        return toSecurityFailure(e)
      }
    })

    // ============== 文件上传（SSRF 白名单 + 字段校验） ==============
    ipcMain.handle('http:upload', async (event, { url, filePath, fieldName, data }) => {
      console.log(event)
      try {
        await assertSafeUrl(url)
        const fp = nonEmptyString(filePath, 'filePath', 1024)
        const fn = fieldName == null ? 'file' : nonEmptyString(fieldName, 'fieldName', 32)
        const extra = data === undefined || data === null ? undefined : plainObject(data, 'data')
        return await apiService.uploadFile(url, fp, fn, extra)
      } catch (e) {
        console.error('[sec] blocked http:upload', e)
        return toSecurityFailure(e)
      }
    })

    // ============== 窗口控制 ==============
    ipcMain.on('window-minimize', () => {
      if (this.mainWindow && !this.mainWindow.isMinimized()) {
        this.mainWindow.minimize()
      }
    })

    ipcMain.on('window-maximize', () => {
      if (this.mainWindow) {
        if (this.mainWindow.isMaximized()) {
          this.mainWindow.unmaximize()
        } else {
          this.mainWindow.maximize()
        }
      }
    })

    ipcMain.on('window-close', () => {
      if (this.mainWindow) {
        this.mainWindow.close()
      }
    })

    ipcMain.handle('window-is-maximized', () => {
      return this.mainWindow ? this.mainWindow.isMaximized() : false
    })

    // ============== 自动更新 ==============
    ipcMain.handle('updater:check', async () => {
      if (is.dev) {
        return { success: false, message: '开发环境下不检查更新' }
      }
      try {
        await autoUpdater.checkForUpdates()
        return { success: true }
      } catch (err: any) {
        return { success: false, message: err?.message || '检查更新失败' }
      }
    })

    ipcMain.handle('updater:quitAndInstall', () => {
      autoUpdater.quitAndInstall()
    })
  }

  private setupAutoUpdater(): void {
    if (is.dev) return

    // 自动下载更新
    autoUpdater.autoDownload = true
    // 下载完成后不自动安装，等待用户确认
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('checking-for-update', () => {
      this.mainWindow?.webContents.send('updater:checking')
    })

    autoUpdater.on('update-available', (info) => {
      this.mainWindow?.webContents.send('updater:update-available', info)
    })

    autoUpdater.on('update-not-available', (info) => {
      this.mainWindow?.webContents.send('updater:update-not-available', info)
    })

    autoUpdater.on('download-progress', (progress) => {
      this.mainWindow?.webContents.send('updater:download-progress', progress)
    })

    autoUpdater.on('update-downloaded', (info) => {
      this.mainWindow?.webContents.send('updater:update-downloaded', info)
    })

    autoUpdater.on('error', (err) => {
      this.mainWindow?.webContents.send('updater:error', err.message)
    })

    // 启动时自动检查更新
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.error('[Updater] check update failed:', err)
    })
  }

  public init(): void {
    app.whenReady().then(async () => {
      installBiliAudioProtocol()
      // 启动时从 JSON 文件 + Electron session 恢复 B 站登录态，
      // 之后所有 B 站请求（推荐/搜索等）经拦截器自动带登录 Cookie。
      // 失败仅记日志，不阻塞窗口创建（匿名 buvid 兜底仍可用）。
      try {
        bilibiliApi.loadCookiesFromFile()
        await bilibiliApi.refreshCookiesFromSession()
      } catch (e) {
        console.error('[Bilibili] startup restore login failed:', e)
      }
      this.createWindow()

      // 启动后台种 B 站指纹 cookie（隐藏窗口加载 bilibili.com 首页）。
      // 主进程 axios 不走 Chromium 网络栈，set-cookie 不会进 session jar，必须靠
      // 真实页面访问让 B 站 JS 种下 buvid3/b_nut/_uuid/buvid_fp/b_lsid 等。
      // 指纹齐全后推荐流才会返回含多分P合集的 feed。
      // 非阻塞：窗口已先显示，种好后后续推荐请求自动带完整 Cookie；首个 feed
      // 可能需刷新一两次才出现合集。
      bilibiliApi.seedBilibiliFingerprint().catch((e) => {
        console.warn('[Bilibili] startup seed failed:', e?.message)
      })

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createWindow()
        }
      })
        // Set app user model id for windows
      electronApp.setAppUserModelId('com.electron')

      // Default open or close DevTools by F12 in development
      // and ignore CommandOrControl + R in production.
      // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
      app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
      })

      // 仅在开发环境打开 DevTools，生产环境关闭
      if (is.dev) {
        mainWindow.webContents.openDevTools({ mode: 'detach' })
      }

      // 初始化自动更新（生产环境）
      this.setupAutoUpdater()
    })

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit()
      }
    })
  }
}


// 启动应用
// ============ 关闭 Windows/Chromium 的 overlay scrollbar ============
// overlay scrollbar 使用原生合成层渲染，会覆盖 ::-webkit-scrollbar CSS 伪元素的 hover 效果
// 关闭后滚动条走标准 WebKit 渲染，CSS 规则才能正常生效
app.commandLine.appendSwitch('disable-features', 'OverlayScrollbar')

const electronMyApp = new ElectronMyApp()
electronMyApp.init()
