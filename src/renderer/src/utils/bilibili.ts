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

/** 补齐 https:// 前缀（B 站封面常以 //i0.hdslb.com 开头） */
export function fixCoverUrl(url: string): string {
  if (!url) return ''
  return url.startsWith('//') ? 'https:' + url : url
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