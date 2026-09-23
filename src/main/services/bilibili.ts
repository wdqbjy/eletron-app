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
      console.error('[Bilibili] 获取播放地址失败:', err.message)
      return { code: -1, message: err.message }
    }
  }

  // ============== 歌词（网易云来源，对齐 pink-music electron main.js） ==============

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
      console.error('[Netease] 搜索失败:', err.message)
      return []
    }
  }

  /** 网易云取歌词：GET /api/song/lyric，返回 lrc(+翻译合并为同一行) 字符串 */
  private async neteaseGetLyricRaw(songId: number): Promise<string | null> {
    try {
      const resp = await this.axios.get('https://music.163.com/api/song/lyric', {
        params: { id: songId, lv: -1, kv: -1, tv: -1 },
        headers: { Referer: 'https://music.163.com/' }
      })
      const data: any = resp.data
      if (data.code === 200 || resp.status === 200) {
        const lrc = data.lrc?.lyric || ''
        const tlyric = data.tlyric?.lyric || ''
        if (!lrc) return null
        if (!tlyric) return lrc
        const tlyricMap: Record<string, string> = {}
        tlyric.split('\n').forEach((line: string) => {
          const m = line.match(/\[(\d{2}:\d{2}\.\d{2,3})\](.+)/)
          if (m) tlyricMap[m[1]] = m[2]
        })
        return lrc
          .split('\n')
          .map((line: string) => {
            const m = line.match(/\[(\d{2}:\d{2}\.\d{2,3})\](.+)/)
            if (m && tlyricMap[m[1]]) return `${line} ${tlyricMap[m[1]]}`
            return line
          })
          .join('\n')
      }
      return null
    } catch (err: any) {
      console.error('[Netease] 取歌词失败:', err.message)
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
  async getMusicRegionFeed(displayId = 1, requestCnt = 20): Promise<any> {
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
      console.error('[Bilibili] 音乐区推荐失败:', err.message)
      return { code: -1, message: err.message }
    }
  }
}

export const bilibiliApi = new BilibiliApi()