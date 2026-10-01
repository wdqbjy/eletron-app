/**
 * 音频流选择工具（渲染层，纯函数）
 * 输入是 /x/player/playurl 的 data（含 dash / durl），按音质档选一路可直接给 new Audio() 的 URL。
 *
 * 音质档（settings.audioQuality）：
 * - auto / lossless：优先 Hi-Res FLAC（dash.flac.audio），其次杜比全景声（dash.dolby.audio[0]），
 *   再退回普通 DASH 最高码率（未登录拿不到无损段时即等同 high）；
 * - high：普通 DASH 最高码率；medium：中间码率；low：最低码率。
 */

/** DASH 音频流 id 优先级（从低到高），带宽相同时按此排序 */
const audioQualitySort = [30257, 30216, 30259, 30260, 30232, 30280, 30250, 30251]

export type QualityPreference = 'auto' | 'lossless' | 'high' | 'medium' | 'low'

function sortAudio(audioList: any[]): any[] {
  return [...audioList].sort((a, b) => {
    if (a.bandwidth !== b.bandwidth) {
      return b.bandwidth - a.bandwidth
    }
    const indexA = audioQualitySort.indexOf(a.id)
    const indexB = audioQualitySort.indexOf(b.id)
    if (indexA === -1) return 1
    if (indexB === -1) return -1
    return indexB - indexA
  })
}

/** B 站官方 CDN 域名族：择优时优先，避免命中不稳定的第三方 PCDN 节点 */
const OFFICIAL_HOST_SUFFIXES: readonly string[] = [
  'bilivideo.com',
  'bilivideo.cn',
  'szbdyd.com',
  'bilibili.com',
  'hdslb.com',
  'akamaized.net'
]

function isOfficialUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname
    return OFFICIAL_HOST_SUFFIXES.some((s) => h === s || h.endsWith('.' + s))
  } catch {
    return false
  }
}

/**
 * baseUrl/backupUrl 里挑一路：优先 B 站官方域名（稳定），
 * 全部为第三方 PCDN（mcdn 调度下发）时才用第一个。
 */
function pickBaseUrl(info: any): string {
  const candidates = [
    info.baseUrl,
    info.base_url,
    ...(Array.isArray(info.backupUrl) ? info.backupUrl : []),
    ...(Array.isArray(info.backup_url) ? info.backup_url : [])
  ].filter((u: unknown): u is string => typeof u === 'string' && !!u)
  if (!candidates.length) return ''
  return candidates.find(isOfficialUrl) || candidates[0]
}

function toAudioInfo(track: any, fallbackCodecs: string): { url: string; codecs: string } | null {
  if (!track) return null
  const url = pickBaseUrl(track)
  if (!url) return null
  return { url, codecs: track.codecs || fallbackCodecs }
}

/**
 * 挑出一路音频流并返回 { url, codecs }。
 * @param playUrlData /x/player/playurl 返回的 data
 * @param quality 音质档，默认 auto
 */
export function selectAudioInfo(
  playUrlData: any,
  quality: QualityPreference = 'auto'
): { url: string; codecs: string } | null {
  if (!playUrlData) return null

  const dash = playUrlData.dash
  const durl = playUrlData.durl

  if (dash?.audio && dash.audio.length > 0) {
    // auto / lossless：优先无损/杜比（需登录态 + fnval=4048，主进程请求已带）
    if (quality === 'auto' || quality === 'lossless') {
      // Hi-Res FLAC：dash.flac.audio 是单个对象
      const flacInfo = toAudioInfo(dash.flac?.audio, 'fLaC')
      if (flacInfo) return flacInfo
      // 杜比全景声：dash.dolby.audio 是数组
      const dolbyTrack = dash.dolby?.audio?.[0]
      const dolbyInfo = toAudioInfo(dolbyTrack, 'ec-3')
      if (dolbyInfo) return dolbyInfo
      // 无无损段则继续向下取最高码率普通轨
    }

    const sorted = sortAudio(dash.audio)
    let pick: any
    if (quality === 'low') {
      pick = sorted[sorted.length - 1]
    } else if (quality === 'medium') {
      pick = sorted[Math.floor((sorted.length - 1) / 2)]
    } else {
      // high / auto / lossless 兜底均为最高码率
      pick = sorted[0]
    }
    const info = toAudioInfo(pick, 'mp4a.40.2')
    if (info) return info
  }

  // 兜底：FLV/MP4 分段流
  if (durl && durl.length > 0 && durl[0].url) {
    return { url: durl[0].url, codecs: 'mp4a.40.2' }
  }

  return null
}

/** 直接拿音频 URL（按 auto 档），取不到返回 null */
export function selectAudioUrl(playUrlData: any): string | null {
  return selectAudioInfo(playUrlData, 'auto')?.url || null
}
