/**
 * SSRF（服务器端请求伪造）防护
 *
 * 背景：渲染层传来的「完整 URL」若被主进程直接请求，一旦渲染层被 XSS 注入，
 *      就能借主进程访问内网 / 云元数据(169.254.169.254) / 本地服务。
 * 对策（三层纵深）：
 *   1. 白名单          —— 只允许访问应用确需的「来源」(scheme+host+port)。
 *   2. 禁止 IP 字面量   —— 目标 hostname 不得是裸 IP，避免绕过域名层防护。
 *   3. DNS 反查        —— 对放行的域名实际解析到的每个 IP 做「公网」校验，
 *                         防 DNS 重绑定到内网（即使域名在白名单里）。
 */
import { URL } from 'node:url'
import { lookup } from 'node:dns/promises'

export class SecurityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SecurityError'
  }
}

/**
 * 放行的来源（scheme + host + 端口 精确匹配）。
 * 仅此列表内的目标可被通用 http:* 处理器转发；其它一律拦截。
 * 新增后端时在这里登记，而不是放宽校验。
 */
const ALLOWED_ORIGINS: readonly string[] = [
  'http://yunwei.gzyfzn.cn:8001', // eletron-app 自带后端
  'https://api.bilibili.com' // B 站搜索示例
]

const ALLOWED_HOSTS: readonly string[] = dedupe(
  ALLOWED_ORIGINS.map((o) => new URL(o).hostname)
)

function dedupe(list: string[]): string[] {
  return [...new Set(list)]
}

/** IPv4 私有 / 保留 / 回环判定（含云元数据 169.254.0.0/16、CGNAT 100.64/10） */
function isPrivateIpv4(ip: string): boolean {
  const p = ip.split('.').map((n) => Number(n))
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true
  const [a, b] = p
  if (a === 0) return true // 0.0.0.0/8
  if (a === 10) return true // 10/8
  if (a === 127) return true // 回环
  if (a === 169 && b === 254) return true // 链路本地 / 云元数据
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16/12
  if (a === 192 && b === 168) return true // 192.168/16
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (p.every((n) => n === 255)) return true // 广播
  return false
}

function isPrivateIpv6(ip: string): boolean {
  const s = ip.toLowerCase()
  return s === '::' || s === '::1' || s.startsWith('fe80:') || s.startsWith('fc') || s.startsWith('fd')
}

function isPrivateIp(ip: string): boolean {
  return ip.includes(':') ? isPrivateIpv6(ip) : isPrivateIpv4(ip)
}

/** 同步校验：协议 / host 白名单 / 来源精确匹配 / 非裸 IP。全部通过才返回 URL */
export function parseSafeUrl(raw: string): URL {
  const u = validateUrlShape(raw)
  if (!ALLOWED_HOSTS.includes(u.hostname)) {
    throw new SecurityError(`主机不在白名单: ${u.hostname}`)
  }
  const origin = `${u.protocol}//${u.host}`
  if (!ALLOWED_ORIGINS.includes(origin)) {
    throw new SecurityError(`来源不在白名单: ${origin}`)
  }
  return u
}

/** 通用 URL 形状校验：协议 / 长度 / 凭据 / 裸 IP 字面量（不含 host 白名单判断） */
function validateUrlShape(raw: string): URL {
  if (typeof raw !== 'string' || raw.trim().length === 0 || raw.length > 2048) {
    throw new SecurityError('URL 类型或长度非法')
  }
  let u: URL
  try {
    u = new URL(raw.trim())
  } catch {
    throw new SecurityError('URL 无法解析')
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new SecurityError('仅允许 http/https')
  }
  if (u.username || u.password) {
    throw new SecurityError('URL 不允许携带用户名密码')
  }
  // 即使是白名单域名，也不接受以 IP 字面量形式直连
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(u.hostname) || u.hostname.includes(':')) {
    throw new SecurityError('不允许使用 IP 字面量作为目标')
  }
  return u
}

/**
 * 媒体流 URL 校验（信任模型）：
 * biliaudio:// 代理与下载的 URL 全部来自主进程 playurl 接口响应（B 站签名下发）。
 * B 站 mcdn 调度会把流下发到任意第三方 edge/PCDN 域名（域名不可枚举，如
 * *.mcdn.bilivideo.cn、合作 CDN 独立域），因此无法按域名后缀设白名单。
 * 防护改为「形状校验 + DNS 反查公网 IP」纵深：即便渲染层伪造 URL，
 * 解析到内网/保留段一律拦截，SSRF 防护目标不变。
 */

/** 同步校验媒体流 URL：通用形状校验（协议/凭据/IP 字面量） */
export function parseMediaUrl(raw: string): URL {
  return validateUrlShape(raw)
}

/** 媒体流统一入口：形状校验 + DNS 反查公网 IP（防重绑定，尽力而为） */
export async function assertMediaUrl(raw: string): Promise<URL> {
  const u = parseMediaUrl(raw)
  try {
    // 解析成功：所有记录必须为公网 IP（防 DNS 重绑定）
    const records = await lookup(u.hostname, { all: true })
    if (records.some((r) => isPrivateIp(r.address))) {
      throw new SecurityError(`目标主机解析到内网 IP，已拦截: ${u.hostname}`)
    }
  } catch (err) {
    if (err instanceof SecurityError) throw err
    // 解析失败：B 站 PCDN 动态节点解析失败属常见情况，放行（无 IP 可验证时
    // 依赖「URL 来自 playurl 可信链路」的信任模型），不缓存避免连坐
    console.warn('[ssrf] media dns lookup failed, allow:', u.hostname)
  }
  return u
}

/** DNS 解析结果缓存（避免每个请求都做一次反查；10 分钟失效） */
const hostCache = new Map<string, { ok: boolean; at: number }>()
const HOST_CACHE_TTL = 10 * 60 * 1000

/** 异步纵深：反查域名，确认解析到的每个 IP 都是公网地址（防 DNS 重绑定） */
async function assertHostPublic(hostname: string): Promise<void> {
  const hit = hostCache.get(hostname)
  if (hit && Date.now() - hit.at < HOST_CACHE_TTL) {
    if (!hit.ok) throw new SecurityError(`主机解析到内网，已拦截: ${hostname}`)
    return
  }
  let records: { address: string }[]
  try {
    records = await lookup(hostname, { all: true })
  } catch {
    hostCache.set(hostname, { ok: false, at: Date.now() })
    throw new SecurityError(`无法解析主机: ${hostname}`)
  }
  const bad = records.some((r) => isPrivateIp(r.address))
  hostCache.set(hostname, { ok: !bad, at: Date.now() })
  if (bad) {
    throw new SecurityError(`目标主机解析到内网 IP，已拦截: ${hostname}`)
  }
}

/** 对外统一入口：白名单 + 非 IP 字面量 + DNS 公网反查 */
export async function assertSafeUrl(raw: string): Promise<URL> {
  const u = parseSafeUrl(raw)
  await assertHostPublic(u.hostname)
  return u
}

export { ALLOWED_ORIGINS }