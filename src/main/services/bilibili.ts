import axios, { AxiosInstance } from 'axios'

const BILIBILI_BASE = 'https://api.bilibili.com'
const UserAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/**
 * B 站 API 服务（主进程）
 *
 * 与 pink-music-app 的 BilibiliAPI 同构：真实的 HTTP 请求只在主进程发生。
 * 渲染层经 preload contextBridge → ipcRenderer.invoke → ipcMain.handle 调到这里的
 * searchMusic / getMusicInfo，结果原样透传回渲染层。
 *
 * 好处：UA / Referer / Cookie 等集中在主进程，渲染层无需关心跨域与安全隔离。
 */
class BilibiliApi {
  private axios: AxiosInstance

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

    // 请求在【主进程 / Node 侧】发出，所以不显示在渲染层 DevTools 网络面板，
    // 只会打印在这里的终端。这段日志让你能确认搜索确实打到了 B 站。
    this.axios.interceptors.request.use((config) => {
      console.log(`[Bilibili] → ${(config.method || 'GET').toUpperCase()} ${config.url}`)
      return config
    })
    this.axios.interceptors.response.use(
      (resp) => {
        console.log(
          `[Bilibili] ← ${resp.status} ${resp.config.url} code=${(resp.data as any)?.code}`
        )
        return resp
      },
      (err) => {
        console.error('[Bilibili] ← 请求失败:', err?.message)
        return Promise.reject(err)
      }
    )
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
      console.error('[Bilibili] 搜索失败:', err.message)
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
      console.error('[Bilibili] 获取稿件失败:', err.message)
      return { code: -1, message: err.message }
    }
  }
}

export const bilibiliApi = new BilibiliApi()