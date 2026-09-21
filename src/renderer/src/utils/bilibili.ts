/**
 * B 站渲染层格式化工具（不发起任何 HTTP 请求）
 * 对应 pink-music-app 的 src/utils/bilibili.js。
 */

/** 去除搜索高亮标签（B 站返回 <em class="keyword"> 包裹关键词） */
export function stripHtmlTags(html: string): string {
  return (html ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

/** 补齐 https:// 前缀（B 站封面常以 //i0.hdslb.com 开头）；
    并把 B 站图床(hdslb.com)的 http:// 强制转成 https:// —— 主进程 webRequest 只给 https 补 Referer，
    裸 http 封面会被防盗链拦成 403。 */
export function fixCoverUrl(url: string): string {
  if (!url) return ''
  let u = url
  if (u.startsWith('//')) u = 'https:' + u
  if (u.startsWith('http://') && /(^|\.)hdslb\.com/.test(u)) u = u.replace('http://', 'https://')
  return u
}

/**
 * B 站图床缩略图：hdslb 图床支持在路径后追加 "@{宽}w_{高}h.jpg" 裁小图
 * （如 @320w_320h.jpg），体积可缩近 10 倍，网格多图时大幅提速。
 * 用 JPEG 而非 webp：体积足够小，且与原图同为 JPEG 保证任何环境都能解码渲染
 * （旧设备上 webp 解码反而可能更慢）。
 * 非 hdslb 图床（如兜底占位）原样返回，不破坏。
 */
export function thumbnailCover(url: string, size = 320): string {
  if (!url) return ''
  if (!/(^|\.)hdslb\.com/.test(url)) return url
  // 去掉已有的 ?query 与 @后缀，再统一追加
  const clean = url.split('@')[0].split('?')[0]
  return `${clean}@${size}w_${size}h.jpg`
}

/** 时长转秒：'05:30' → 330；'01:05:30' → 3930 */
export function parseDuration(input: string | number): number {
  if (typeof input === 'number') return input
  if (!input) return 0
  const parts = input.split(':')
  if (parts.length === 3) return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2])
  if (parts.length === 2) return Number(parts[0]) * 60 + Number(parts[1])
  return 0
}

/** 播放量缩写：12345 → '1.2万'；123456789 → '1.2亿'（照搬 pink-music） */
export function formatPlayCount(count: number): string {
  if (count == null || isNaN(count)) return '0'
  const trim = (v: string): string => v.replace(/\.0$/, '')
  if (count >= 1e8) return trim((count / 1e8).toFixed(1)) + '亿'
  if (count >= 1e4) return trim((count / 1e4).toFixed(1)) + '万'
  return String(count)
}

/** 秒 → 展示时长：330 → '5:30'；3930 → '1:05:30' */
export function formatDuration(sec: number): string {
  if (!sec || isNaN(sec)) return '0:00'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}