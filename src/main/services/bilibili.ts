import axios, { AxiosInstance } from 'axios'
import { app, session, BrowserWindow } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { createHash } from 'crypto'

const BILIBILI_BASE = 'https://api.bilibili.com'
const BILIBILI_WEB = 'https://passport.bilibili.com'
/** 匿名追踪 cookie 引导接口：回 buvid3/buvid4，避免完全无 Cookie 被 B 站降级/风控 */
const FINGER_SPI = `${BILIBILI_BASE}/x/frontend/finger/spi`

// ============ wbi 签名（收藏夹 /x/v3/fav/* 接口需要） ============
const mixinKeyEncTab = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29,
  28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25,
  54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52
]
function getMixinKey(orig: string): string {
  return mixinKeyEncTab.map((n) => orig[n]).join('').slice(0, 32)
}
function wbiSignParams(params: Record<string, unknown>, imgKey: string, subKey: string) {
  if (!imgKey || !subKey) return { ...params }
  const mixinKey = getMixinKey(imgKey + subKey)
  const wts = Math.round(Date.now() / 1000)
  const enriched: Record<string, unknown> = { ...params, wts }
  const keys = Object.keys(enriched)
    .filter((k) => enriched[k] !== undefined && enriched[k] !== null && enriched[k] !== '')
    .sort()
  const chrFilter = /[!'()*]/g
  const query = keys
    .map((k) => {
      const v = String(enriched[k]).replace(chrFilter, '')
      return `${encodeURIComponent(k)}=${encodeURIComponent(v)}`
    })
    .join('&')
  const wRid = createHash('md5').update(query + mixinKey).digest('hex')
  return { ...enriched, w_rid: wRid }
}
function extractWbiKeys(wbiImg: { img_url?: string; sub_url?: string }) {
  if (!wbiImg) return { imgKey: '', subKey: '' }
  const extract = (u?: string) => (u ? u.slice(u.lastIndexOf('/') + 1, u.lastIndexOf('.')) : '')
  return { imgKey: extract(wbiImg.img_url), subKey: extract(wbiImg.sub_url) }
}
const wbiKeysCache = { imgKey: '', subKey: '' }
function updateWbiKeys(wbiImg: { img_url?: string; sub_url?: string }): void {
  if (!wbiImg) return
  const { imgKey, subKey } = extractWbiKeys(wbiImg)
  if (imgKey && subKey) {
    wbiKeysCache.imgKey = imgKey
    wbiKeysCache.subKey = subKey
  }
}

const UserAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/** B 站登录态 cookie 持久化文件（Windows 友好路径，跨重启保持登录） */
function getCookieStorePath(): string {
  return join(app.getPath('userData'), 'bilibili-cookies.json')
}

/**
 * B 站 API 服务（主进程）
 *
 * 真实的 HTTP 请求只在主进程发生。
 * 渲染层经 preload contextBridge → ipcRenderer.invoke → ipcMain.handle 调到这里的
 * searchMusic / getMusicInfo，结果原样透传回渲染层。
 *
 * 好处：UA / Referer / Cookie 等集中在主进程，渲染层无需关心跨域与安全隔离。
 */
class BilibiliApi {
  private axios: AxiosInstance
  /** 已就绪的 buvid Cookie 头（`buvid3=...; buvid4=...;`），为空表示尚未引导 */
  private cookieHeader = ''
  private buvidPromise: Promise<void> | null = null
  /**
   * B 站登录态 cookie（SESSDATA / bili_jct / DedeUserID / buvid3...）。
   * 空 = 未登录，请求自动退回匿名 buvid Cookie。
   */
  cookies: Record<string, string> = {}

  constructor() {
    this.axios = axios.create({
      timeout: 30000,
      withCredentials: false,
      headers: {
        'User-Agent': UserAgent,
        Referer: 'https://www.bilibili.com/',
        Origin: 'https://www.bilibili.com',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
      }
    })

    // 每次请求前先确保拿到 buvid Cookie（注入后 B 站才当它是"正常匿名客户端"，
    // 否则推荐/搜索等接口会匿名降级）。
    // 登录态与 buvid 合并注入：buvid 作为兜底，登录态 cookie 覆盖。
    // 关键：登录后 B 站 set-cookie 通常不含 buvid3（buvid3 由 finger/spi 或浏览器下发），
    // 若登录态非空就走 if、丢掉 buvid，会导致带 SESSDATA 但缺 buvid3 的请求被风控降级
    // （推荐流退化为不含多分P合集的匿名 feed）。必须把 buvid 显式合并进 Cookie。
    this.axios.interceptors.request.use(async (config) => {
      await this.ensureBuvid()
      config.headers = config.headers || {}
      // 合并：先放 buvid（兜底），再用登录态覆盖同名 key
      const merged = new Map<string, string>()
      if (this.cookieHeader) {
        for (const part of this.cookieHeader.split(';').map((s) => s.trim()).filter(Boolean)) {
          const eq = part.indexOf('=')
          if (eq > 0) merged.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim())
        }
      }
      for (const [k, v] of Object.entries(this.cookies)) merged.set(k, v)
      const cookieStr = [...merged.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
      if (cookieStr) config.headers.Cookie = cookieStr
      // 收藏夹 /x/v3/fav/* 接口需要 wbi 签名（img/sub key 从 nav 接口缓存）
      if (config.url && config.url.includes('/x/v3/fav/') && wbiKeysCache.imgKey) {
        config.params = wbiSignParams(
          (config.params as Record<string, unknown>) || {},
          wbiKeysCache.imgKey,
          wbiKeysCache.subKey
        )
      }
      // 请求在【主进程 / Node 侧】发出，所以不显示在渲染层 DevTools 网络面板，
      // 只会打印在这里的终端。这段日志让你能确认请求确实打到了 B 站。
      const hasSess = merged.has('SESSDATA')
      console.log(
        `[Bilibili] -> ${(config.method || 'GET').toUpperCase()} ${config.url}` +
          ` | Cookie keys: ${[...merged.keys()].join(',') || '(none)'} | login: ${hasSess ? 'yes' : 'no'}`
      )
      return config
    })
    this.axios.interceptors.response.use(
      (resp) => {
        console.log(
          `[Bilibili] <- ${resp.status} ${resp.config.url} code=${(resp.data as any)?.code}`
        )
        return resp
      },
      (err) => {
        console.error('[Bilibili] <- request failed:', err?.message)
        return Promise.reject(err)
      }
    )

    // 构造即启动 buvid 引导，保证首个 B 站请求前 cookie 已就绪（幂等，失败则后续请求再试）
    this.ensureBuvid().catch(() => {})
  }

  /**
   * 引导匿名 buvid Cookie（幂等，只执行一次）。
   * B 站要求请求带 buvid3/buvid4，完全匿名的请求会被风控降级（推荐接口常只吐 1 条）。
   * 通过 /x/frontend/finger/spi 换取，无需登录。
   */
  private async ensureBuvid(): Promise<void> {
    if (this.cookieHeader) return
    if (this.buvidPromise) {
      await this.buvidPromise
      return
    }
    this.buvidPromise = (async () => {
      try {
        // 用裸 axios（不带 request 拦截器）打 finger/spi，避免引导请求自身又去等 buvid 造成死锁
        const resp = await axios.get(FINGER_SPI, {
          headers: {
            'User-Agent': UserAgent,
            Referer: 'https://www.bilibili.com/'
          },
          timeout: 10000
        })
        const data = resp.data?.data
        const b3: string | undefined = data?.b_3 ?? data?.buvid3
        const b4: string | undefined = data?.b_4 ?? data?.buvid4
        if (b3) {
          const parts = [`buvid3=${b3}`]
          if (b4) parts.push(`buvid4=${b4}`)
          this.cookieHeader = parts.join('; ') + ';'
          console.log('[Bilibili] buvid guide ok:', b3.slice(0, 10) + '...')
        } else {
          console.warn('[Bilibili] buvid guide empty:', JSON.stringify(resp.data)?.slice(0, 200))
        }
      } catch (e: any) {
        console.warn('[Bilibili] buvid guide failed (anon fallback):', e?.message)
      }
    })()
    await this.buvidPromise
  }

  // ============== 登录态 cookie 持久化（JSON 文件，Windows 友好路径） ==============

  /** 从 JSON 文件加载登录 cookie 到内存（冷启动恢复登录态）。需在 app ready 后调用。 */
  loadCookiesFromFile(): void {
    try {
      const file = getCookieStorePath()
      if (existsSync(file)) {
        const raw = readFileSync(file, 'utf-8')
        const data = JSON.parse(raw)
        if (data && typeof data === 'object') {
          this.cookies = data as Record<string, string>
        }
      }
    } catch (e: any) {
      console.error('[Bilibili] read cookie store failed:', e?.message)
    }
  }

  /** 把内存 cookies 落盘（登录成功 / poll 后 / 刷新后调用） */
  saveCookiesToFile(): void {
    try {
      const file = getCookieStorePath()
      const dir = app.getPath('userData')
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(file, JSON.stringify(this.cookies, null, 2), 'utf-8')
    } catch (e: any) {
      console.error('[Bilibili] write cookie store failed:', e?.message)
    }
  }

  /**
   * 从 Electron defaultSession 读 .bilibili.com cookie，合并到 this.cookies。
   * 三源合并：JSON 持久化（冷启动） < session 内存（热路径）。
   * session 是热路径值更新，覆盖 file 中旧值；file 中已存在但 session 没有的保留。
   */
  async refreshCookiesFromSession(): Promise<void> {
    let sessionCookies: Record<string, string> = {}
    try {
      const list = await session.defaultSession.cookies.get({ domain: '.bilibili.com' })
      list.forEach((c) => {
        sessionCookies[c.name] = c.value
      })
    } catch (e: any) {
      console.error('[Bilibili] read session cookies failed:', e?.message)
    }
    this.cookies = { ...this.cookies, ...sessionCookies }
    // 落盘保持 JSON 是当前真实状态的镜像
    this.saveCookiesToFile()
    console.log('[Bilibili] refreshCookiesFromSession merged:', Object.keys(this.cookies).join(','))
  }

  /** 解析单个 set-cookie 字符串：name/value + expires 等 */
  private parseSetCookieString(
    cookie: string
  ): { name: string; value: string; expires?: string } | null {
    if (!cookie) return null
    const parts = cookie.split(';').map((p) => p.trim()).filter(Boolean)
    if (!parts.length) return null
    const first = parts[0]
    const eq = first.indexOf('=')
    if (eq < 0) return null
    const result: { name: string; value: string; expires?: string } = {
      name: first.slice(0, eq).trim(),
      value: first.slice(eq + 1).trim()
    }
    for (let i = 1; i < parts.length; i++) {
      const seg = parts[i]
      const idx = seg.indexOf('=')
      if (idx < 0) continue
      const key = seg.slice(0, idx).trim().toLowerCase()
      const val = seg.slice(idx + 1).trim()
      if (key === 'expires') result.expires = val
    }
    return result
  }

  /**
   * 把扫码登录成功响应里的 set-cookie 写入 Electron session + 内存 cookies + JSON 文件。
   * axios（withCredentials:false）不会自动把 cookie 存进 Electron session，必须手动搬。
   */
  async persistBilibiliCookies(headers: Record<string, unknown>): Promise<void> {
    const raw = headers?.['set-cookie'] || headers?.['Set-Cookie']
    if (!raw) return
    const setCookies: string[] = Array.isArray(raw) ? (raw as string[]) : [raw as string]
    for (const cookie of setCookies) {
      const parsed = this.parseSetCookieString(cookie)
      if (!parsed?.name) continue
      try {
        const cookieDetails: Record<string, unknown> = {
          url: 'https://bilibili.com/',
          domain: '.bilibili.com',
          path: '/',
          name: parsed.name,
          value: parsed.value,
          secure: true,
          sameSite: 'no_restriction',
          httpOnly: false
        }
        if (parsed.expires) {
          const exp = Date.parse(parsed.expires)
          if (!Number.isNaN(exp)) {
            cookieDetails.expirationDate = Math.floor(exp / 1000)
          }
        }
        await session.defaultSession.cookies.set(cookieDetails as any)
        this.cookies[parsed.name] = parsed.value
      } catch (e: any) {
        console.warn('[Bilibili] set cookie failed:', parsed.name, e?.message)
      }
    }
    this.saveCookiesToFile()
    await this.refreshCookiesFromSession()
  }

  /**
   * 隐藏窗口加载 bilibili.com 首页，让 B 站页面 JS 种下完整浏览器指纹 cookie
   * （buvid3 / b_nut / _uuid / buvid_fp / b_lsid 等）到 defaultSession。
   *
   * 背景：本服务所有 B 站 API 都在主进程用 axios（withCredentials:false）发起，
   * 走 Node 的 http 栈，set-cookie 不会进入 Electron session jar。
   * 缺这些指纹 cookie，B 站会把音乐区推荐降级为不含多分P合集的匿名 feed。
   *
   * 加载完页面（dom-ready + 等 JS 写 cookie）→ refreshCookiesFromSession 合并到
   * this.cookies → 后续推荐请求经拦截器自动带完整 Cookie → 返回含合集的 feed。
   * 非阻塞：调用方 fire-and-forget 即可；失败仅记日志，不影响主流程。
   */
  async seedBilibiliFingerprint(): Promise<void> {
    let win: BrowserWindow | null = null
    try {
      win = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true
        }
      })
      // 首页文档请求本身会 set-cookie（b_nut / _uuid / b_lsid / buvid_fp 等），
      // 页面 JS 又会调 finger/spi 写 buvid3/buvid4。等 loadURL 完成后给 JS 一点时间。
      await win.loadURL('https://www.bilibili.com/', { userAgent: UserAgent })
      await new Promise((resolve) => setTimeout(resolve, 3000))
      await this.refreshCookiesFromSession()
      console.log(
        '[Bilibili] seed fingerprint ok, keys:',
        Object.keys(this.cookies).join(',')
      )
    } catch (e: any) {
      console.warn('[Bilibili] seed fingerprint failed:', e?.message)
    } finally {
      if (win && !win.isDestroyed()) {
        win.destroy()
      }
    }
  }

  // ============== 扫码登录（generateQrcode / pollQrcode） ==============

  /** 申请扫码登录二维码：GET /x/passport-login/web/qrcode/generate */
  async generateQrcode(): Promise<any> {
    try {
      const resp = await this.axios.get(`${BILIBILI_WEB}/x/passport-login/web/qrcode/generate`, {
        headers: { Referer: 'https://passport.bilibili.com/' }
      })
      return resp.data
    } catch (err: any) {
      console.error('[Bilibili] generate qrcode failed:', err.message)
      return { code: -1, message: err.message }
    }
  }

  /**
   * 轮询扫码登录状态：GET /x/passport-login/web/qrcode/poll
   * 当 data.code === 0（登录成功）时，把响应 set-cookie 持久化到 session + 文件，
   * 之后所有请求经拦截器自动带登录态 Cookie。
   */
  async pollQrcode(qrcodeKey: string): Promise<any> {
    try {
      const resp = await this.axios.get(`${BILIBILI_WEB}/x/passport-login/web/qrcode/poll`, {
        params: { qrcode_key: qrcodeKey },
        headers: { Referer: 'https://passport.bilibili.com/' }
      })
      // data.code === 0 表示登录成功，此时响应头会带 set-cookie（SESSDATA 等）
      if (resp.data?.data?.code === 0) {
        await this.persistBilibiliCookies(resp.headers as Record<string, unknown>)
        // 登录成功后再种一次指纹 cookie：保证登录态与指纹同 session 完整，
        // 之后推荐流带 SESSDATA + 完整指纹，B 站返回含多分P合集的 feed。
        this.seedBilibiliFingerprint().catch((e) => {
          console.warn('[Bilibili] post-login seed failed:', e?.message)
        })
      }
      return { code: 0, data: resp.data, headers: resp.headers }
    } catch (err: any) {
      console.error('[Bilibili] poll qrcode failed:', err.message)
      return { code: -1, message: err.message }
    }
  }

  /** 当前登录用户信息：GET /x/web-interface/nav（含 uname/mid/isLogin） */
  async getUserInfo(): Promise<any> {
    try {
      await this.refreshCookiesFromSession()
      const resp = await this.axios.get(`${BILIBILI_BASE}/x/web-interface/nav`)
      // 缓存 wbi img/sub key（收藏夹接口签名用）
      if ((resp.data as any)?.data?.wbi_img) {
        updateWbiKeys((resp.data as any).data.wbi_img)
      }
      return resp.data
    } catch (err: any) {
      console.error('[Bilibili] get userinfo failed:', err.message)
      return { code: -1, message: err.message }
    }
  }

  /**
   * 注销 B 站登录：清空 Electron session 中 .bilibili.com cookie + 内存 cookies + JSON 文件。
   * 注销后请求自动退回匿名 buvid 路径，不会破坏既有匿名行为。
   */
  async logout(): Promise<{ code: number; message?: string }> {
    try {
      const list = await session.defaultSession.cookies.get({ domain: '.bilibili.com' })
      for (const c of list) {
        try {
          // Electron 39: cookies.remove(url, name)，两个参数形式
          const host = (c.domain || '.bilibili.com').replace(/^\./, '')
          await session.defaultSession.cookies.remove(`https://${host}/`, c.name)
        } catch (e: any) {
          console.warn('[Bilibili] remove cookie failed:', c.name, e?.message)
        }
      }
      try {
        await session.defaultSession.cookies.flushStore()
      } catch (_) {
        /* flushStore 可能在某些 Electron 版本不可用，忽略 */
      }
      this.cookies = {}
      this.saveCookiesToFile() // 写入空对象 {}
      console.log('[Bilibili] logged out, cleared .bilibili.com cookies')
      return { code: 0 }
    } catch (err: any) {
      console.error('[Bilibili] logout failed:', err.message)
      return { code: -1, message: err.message }
    }
  }

  /**
   * 全站搜索：GET /x/web-interface/search/all/v2
   * @returns B 站原始 data：{ code, message, ttl, data:{ result:[{ result_type, data:[] }] } }
   */
  async searchMusic(keyword: string, page = 1, pageSize = 20): Promise<any> {
    try {
      const resp = await this.axios.get(`${BILIBILI_BASE}/x/web-interface/search/all/v2`, {
        params: { keyword, page, page_size: pageSize }
      })
      return resp.data
    } catch (err: any) {
      console.error('[Bilibili] search failed:', err.message)
      return { code: -1, message: err.message }
    }
  }

  /** 稿件信息：GET /x/web-interface/view */
  async getMusicInfo(bvid: string): Promise<any> {
    try {
      const resp = await this.axios.get(`${BILIBILI_BASE}/x/web-interface/view`, {
        params: { bvid }
      })
      return resp.data
    } catch (err: any) {
      console.error('[Bilibili] get music info failed:', err.message)
      return { code: -1, message: err.message }
    }
  }

  /**
   * 分P列表：GET /x/player/pagelist
   * 一个视频稿件的全部分P：{ code, data: [{ cid, page, part, duration }] }
   */
  async getMusicEpisodes(bvid: string): Promise<any> {
    try {
      const resp = await this.axios.get(`${BILIBILI_BASE}/x/player/pagelist`, {
        params: { bvid }
      })
      return resp.data
    } catch (err: any) {
      console.error('[Bilibili] get episodes failed:', err.message)
      return { code: -1, message: err.message }
    }
  }

  // ============ B 站收藏夹（登录态 + wbi 签名，见拦截器） ============

  /**
   * 用户创建的收藏夹列表：GET /x/v3/fav/folder/created/list
   * { code, data: { list: [{ id, title, media_count, cover }] } }
   */
  async getFavFolderCreatedList(upMid: number, pn = 1, ps = 50): Promise<any> {
    try {
      const resp = await this.axios.get(`${BILIBILI_BASE}/x/v3/fav/folder/created/list`, {
        params: { up_mid: upMid, pn, ps, web_location: '333.1387' }
      })
      return resp.data
    } catch (err: any) {
      console.error('[Bilibili] get fav folder list failed:', err.message)
      return { code: -1, message: err.message }
    }
  }

  /**
   * 用户收藏的（他人的）收藏夹列表：GET /x/v3/fav/folder/collected/list
   * { code, data: { list: [{ id, title, media_count, cover, state }] } }
   */
  async getFavFolderCollectedList(upMid: number, pn = 1, ps = 50): Promise<any> {
    try {
      const resp = await this.axios.get(`${BILIBILI_BASE}/x/v3/fav/folder/collected/list`, {
        params: { up_mid: upMid, pn, ps, platform: 'web' }
      })
      return resp.data
    } catch (err: any) {
      console.error('[Bilibili] get collected fav folder list failed:', err.message)
      return { code: -1, message: err.message }
    }
  }

  /**
   * 收藏夹全部条目 id（不分页，防 -412）：GET /x/v3/fav/resource/ids
   * { code, data: [{ id, type, bvid, cid, part, duration ... }] }
   */
  async getFavResourceIds(mediaId: number): Promise<any> {
    try {
      const resp = await this.axios.get(`${BILIBILI_BASE}/x/v3/fav/resource/ids`, {
        params: { media_id: mediaId, platform: 'web' }
      })
      return resp.data
    } catch (err: any) {
      console.error('[Bilibili] get fav resource ids failed:', err.message)
      return { code: -1, message: err.message }
    }
  }

  /**
   * 批量收藏详情（resources 形如 "id:type,id:type"，≤50 个/批）：
   * GET /x/v3/fav/resource/infos → { code, data: [{ id, type, bvid, cid, title, upper, cover, duration, cnt_info, attr }] }
   */
  async getFavResourceInfos(resources: string): Promise<any> {
    try {
      const resp = await this.axios.get(`${BILIBILI_BASE}/x/v3/fav/resource/infos`, {
        params: { resources, platform: 'web' }
      })
      return resp.data
    } catch (err: any) {
      console.error('[Bilibili] get fav resource infos failed:', err.message)
      return { code: -1, message: err.message }
    }
  }

  /**
   * 播放地址：GET /x/player/playurl（DASH，fnval=4048）
   * 供真实音频播放使用：返回 dash 音频流 / durl 分段流，由渲染层 selectAudioUrl 择优。
   */
  async getMusicPlayUrl(bvid: string, cid: number): Promise<any> {
    try {
      const resp = await this.axios.get(`${BILIBILI_BASE}/x/player/playurl`, {
        params: { bvid, cid, qn: 0, fnval: 4048, fnver: 0, fourk: 1 }
      })
      return resp.data
    } catch (err: any) {
      console.error('[Bilibili] get playurl failed:', err.message)
      return { code: -1, message: err.message }
    }
  }

  /**
   * 下载音频流为 Buffer。
   * 复用本实例 axios：自动带 UA / Referer / 登录态 cookie（HQ/无损流需要 SESSDATA）。
   * @param onProgress 字节进度回调 (已下载字节, 总字节)，依赖 axios onDownloadProgress
   */
  async fetchAudioBuffer(
    url: string,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<Buffer> {
    const resp = await this.axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 120000,
      onDownloadProgress: (progressEvent: any) => {
        if (onProgress && progressEvent.total) {
          onProgress(progressEvent.loaded, progressEvent.total)
        }
      }
    })
    return Buffer.from(resp.data)
  }

  // ============== 歌词（网易云来源） ==============

  /** 网易云搜索歌曲：GET /api/search/get */
  async neteaseSearchMusic(keyword: string, limit = 10): Promise<any[]> {
    try {
      const resp = await this.axios.get('https://music.163.com/api/search/get', {
        params: { s: keyword, type: 1, offset: 0, limit },
        headers: { Referer: 'https://music.163.com/' }
      })
      const songs = resp.data?.result?.songs
      if (resp.data?.code === 200 && Array.isArray(songs)) {
        return songs.map((s: any) => ({
          id: s.id,
          name: s.name,
          artist: s.artists?.[0]?.name || s.ar?.[0]?.name || '',
          album: s.album?.name || s.al?.name || '',
          duration: typeof s.duration === 'number' ? s.duration : 0
        }))
      }
      return []
    } catch (err: any) {
      console.error('[Netease] search failed:', err.message)
      return []
    }
  }

  /**
   * 取网易云歌词原文/翻译/罗马音。
   * - tv=-1：返回 tlyric（中文翻译）；yv=1：返回 yromal（罗马音，日文歌多见）。
   * 返回 { lrc, tv, rv } 三段 LRC 文本，由渲染层 parseLyric 按时间轴对齐。
   */
  private async neteaseGetLyricRaw(
    songId: number
  ): Promise<{ lrc: string; tv: string; rv: string } | null> {
    try {
      const resp = await this.axios.get('https://music.163.com/api/song/lyric', {
        params: { id: songId, lv: -1, kv: -1, tv: -1, yv: 1 },
        headers: { Referer: 'https://music.163.com/' }
      })
      const data: any = resp.data
      if (data.code === 200 || resp.status === 200) {
        const lrc = data.lrc?.lyric || ''
        if (!lrc) return null
        return {
          lrc,
          tv: data.tlyric?.lyric || '',
          rv: data.yromal?.lyric || ''
        }
      }
      return null
    } catch (err: any) {
      console.error('[Netease] get lyric failed:', err.message)
      return null
    }
  }

  /**
   * 为 B 站稿件匹配网易云歌词：优先「标题+作者」→「标题」，再按作者/标题粗匹配，取第一首有歌词的。
   * @returns { code: 0, data: lrc, source: 'netease' } | { code: -1, message }
   */
  async getMusicLyric(title: string, artist: string): Promise<any> {
    const keywords: string[] = []
    if (title && artist) keywords.push(`${title} ${artist}`)
    if (title) keywords.push(title)
    for (const kw of keywords) {
      const results = await this.neteaseSearchMusic(kw, 10)
      if (!results.length) continue
      let matched: any = null
      if (artist) {
        const artistMain = artist.split(/[、,，&/\\\s]+/)[0].trim().toLowerCase()
        matched =
          results.find(
            (s: any) =>
              String(s.artist || '').toLowerCase().includes(artistMain) ||
              s.name?.toLowerCase() === title?.toLowerCase()
          ) || null
      }
      if (!matched) matched = results[0]
      const lrc = await this.neteaseGetLyricRaw(matched.id)
      if (lrc) return { code: 0, data: lrc, source: 'netease' }
    }
    return { code: -1, message: '未找到歌词' }
  }

  /** 手动搜索歌词（搜索面板用）：返回候选歌曲列表 */
  async searchLyric(keyword: string): Promise<any[]> {
    return this.neteaseSearchMusic(keyword, 10)
  }

  /** 按网易云歌曲 id 直接取歌词（搜索面板选中后） */
  async getLyricById(songId: number): Promise<any> {
    const lrc = await this.neteaseGetLyricRaw(songId)
    if (lrc) return { code: 0, data: lrc }
    return { code: -1, message: '该歌曲无歌词' }
  }

  /**
   * 音乐区推荐：GET /x/web-interface/region/feed/rcmd
   * B 站音乐区（tid=1003）的推荐视频流，比全站搜索更贴合“推荐音乐”。
   * @returns B 站原始 payload：{ code, message, data:{ archives:[...] } }
   */
  async getMusicRegionFeed(displayId = 1, requestCnt = 15): Promise<any> {
    try {
      const resp = await this.axios.get(`${BILIBILI_BASE}/x/web-interface/region/feed/rcmd`, {
        params: {
          display_id: displayId,
          request_cnt: requestCnt,
          from_region: 1003, // 音乐区
          device: 'web',
          plat: 30,
          web_location: '333.40138'
        }
      })
      return resp.data
    } catch (err: any) {
      console.error('[Bilibili] region feed failed:', err.message)
      return { code: -1, message: err.message }
    }
  }
}

export const bilibiliApi = new BilibiliApi()