/**
 * 音频流选择工具（渲染层，纯函数）
 * 对应 pink-music-app 的 src/utils/audio.js（selectAudioInfo / selectAudioUrl — 已剔除登录鉴权才有的无损段）。
 * 输入是 /x/player/playurl 的 data（含 dash / durl），选一条可直接给 new Audio() 的 URL。
 */

/** DASH 音频流 id 优先级（从低到高），配合 bandwidth 选音质 */
const audioQualitySort = [30257, 30216, 30259, 30260, 30232, 30280, 30250, 30251]

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

function pickBaseUrl(info: any): string {
  return (
    info.baseUrl ||
    info.base_url ||
    info.backupUrl?.[0] ||
    info.backup_url?.[0] ||
    ''
  )
}

/** 挑出最优一路音频流并返回 { url, codecs } */
export function selectAudioInfo(playUrlData: any): { url: string; codecs: string } | null {
  if (!playUrlData) return null

  const dash = playUrlData.dash
  const durl = playUrlData.durl

  // 普通 DASH 音频流（未登录时 flac/dolby 一般为空，直接取最高码率音频轨）
  if (dash?.audio && dash.audio.length > 0) {
    const sorted = sortAudio(dash.audio)
    const top = sorted[0]
    const url = pickBaseUrl(top)
    if (url) return { url, codecs: top.codecs || 'mp4a.40.2' }
  }

  // 兜底：FLV/MP4 分段流
  if (durl && durl.length > 0 && durl[0].url) {
    return { url: durl[0].url, codecs: 'mp4a.40.2' }
  }

  return null
}

/** 直接拿音频 URL，取不到返回 null（调用方决定兜底策略） */
export function selectAudioUrl(playUrlData: any): string | null {
  const info = selectAudioInfo(playUrlData)
  return info?.url || null
}