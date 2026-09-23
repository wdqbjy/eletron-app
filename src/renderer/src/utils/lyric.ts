/**
 * 歌词（LRC）解析工具（渲染层，纯函数）
 * 对齐 pink-music stores/lyric.js 的 parseLyric：解析 `[mm:ss.xx]文本` 行，
 * 并支持翻译已由主进程合并进同一行（`原文 翻译`）的情况，也兼容独立的 tv 段。
 */
export interface LyricLine {
  time: number // 起始毫秒
  text: string
  translation?: string
}
export interface ParsedLyric {
  lyrics: LyricLine[]
  title: string
  artist: string
}

const TIME_REGEX = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.+)/
const TITLE_REGEX = /\[ti:(.+)\]/
const ARTIST_REGEX = /\[ar:(.+)\]/
// 出现在前 11s 的出品信息行大多是 "[00:01.00] 作词..."，跳过
const CREDIT_REGEX =
  /^(作词|作曲|编曲|制作人|和声编写|和声|吉他|贝斯|鼓|键盘|弦乐|录音工程|录音|混音工程|混音|母带|母带后期|母带工程|监制|OP|SP|原唱|翻唱|原曲|改编|发行|出品|封面|设计|统筹|企划)[''']?\s*[:：]/

function lineToTimeMs(m: RegExpMatchArray): number {
  return parseInt(m[1]) * 60000 + parseInt(m[2]) * 1000 + parseInt(m[3].padEnd(3, '0'))
}

/**
 * 解析 LRC 文本为结构化歌词。若传 raw 为 {@link ParsedLyric} 则原样返回；
 * 若为对象 { lrc, rv, tv }（网易云新版）则拆出原文/翻译分别解析再对齐。
 */
export function parseLyric(raw: string | ParsedLyric | { lrc?: string; rv?: string; tv?: string }): ParsedLyric {
  const empty: ParsedLyric = { lyrics: [], title: '', artist: '' }
  if (!raw) return empty
  if (typeof raw === 'object' && !Array.isArray(raw) && 'lyrics' in raw) return empty // 已解析

  let lrcText = ''
  let rvText = ''
  let tvText = ''
  if (typeof raw === 'string') {
    lrcText = raw
  } else if (raw && typeof raw === 'object' && 'lrc' in raw) {
    lrcText = raw.lrc || ''
    rvText = raw.rv || ''
    tvText = raw.tv || ''
  }

  const lyrics: LyricLine[] = []
  let title = ''
  let artist = ''

  function findTimeMatch(map: Map<number, string>, target: number): string | undefined {
    if (map.has(target)) return map.get(target)
    let best: string | undefined
    let bestDiff = Infinity
    for (const [key, val] of map) {
      const diff = Math.abs(key - target)
      if (diff < bestDiff) {
        bestDiff = diff
        best = val
        if (diff === 0) break
      }
    }
    return bestDiff <= 500 ? best : undefined
  }

  // 翻译/罗马音独立段 → 时间映射
  const tvMap = new Map<number, string>()
  for (const line of (tvText || '').split('\n')) {
    const m = line.match(TIME_REGEX)
    if (m) tvMap.set(lineToTimeMs(m), m[4].trim())
  }
  const rvMap = new Map<number, string>()
  for (const line of (rvText || '').split('\n')) {
    const m = line.match(TIME_REGEX)
    if (m) rvMap.set(lineToTimeMs(m), m[4].trim())
  }

  for (const line of lrcText.split('\n')) {
    const t = line.match(TITLE_REGEX)
    if (t) { title = t[1]; continue }
    const a = line.match(ARTIST_REGEX)
    if (a) { artist = a[1]; continue }
    const m = line.match(TIME_REGEX)
    if (m) {
      const timeMs = lineToTimeMs(m)
      let text = m[4].trim()
      if (!text) continue
      if (CREDIT_REGEX.test(text)) {
        if (timeMs < 11000) continue
      }
      if (
        timeMs < 11000 &&
        /·原版|·伴奏|·和声|·纯音乐|未经许可|未经授权|版权所有|本歌曲|https?:\/\//.test(text)
      ) {
        continue
      }
      // 主进程已把翻译拼到行尾（"原文 翻译"）——拆出翻译
      let translation: string | undefined
      const spaceIdx = text.indexOf('  ')
      if (spaceIdx > 0 && /[一-龥]/.test(text) && !/[一-龥]/.test(text.slice(0, 4))) {
        // 开头即有中文且带双空格，视后半为翻译
        translation = text.slice(spaceIdx + 2).trim()
        text = text.slice(0, spaceIdx).trim()
      } else if (spaceIdx > 0) {
        translation = text.slice(spaceIdx + 2).trim()
        text = text.slice(0, spaceIdx).trim()
      }
      lyrics.push({
        time: timeMs,
        text,
        translation: translation || findTimeMatch(rvMap, timeMs) || findTimeMatch(tvMap, timeMs)
      })
    }
  }
  lyrics.sort((a, b) => a.time - b.time)
  return { lyrics, title, artist }
}

/** 根据当前播放时间（秒）返回应高亮的行索引；无歌词返回 -1 */
export function currentLyricIndex(lyrics: LyricLine[], currentTimeSec: number, offsetMs = 0): number {
  if (!lyrics || lyrics.length === 0) return -1
  const adjusted = Math.round(currentTimeSec * 1000) + offsetMs
  let index = -1
  for (let i = lyrics.length - 1; i >= 0; i--) {
    if (lyrics[i].time <= adjusted + 500) {
      index = i
      break
    }
  }
  return index
}