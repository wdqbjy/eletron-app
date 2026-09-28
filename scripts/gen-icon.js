// 生成主题图标：粉色渐变圆角底 + 白色四分音符
// 纯 Node，无外部依赖：zlib 压缩 + 手写 PNG/CRC32 + 2x 超采样抗锯齿
const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

const SIZE = 512
const SS = 2 // 超采样倍数
const W = SIZE * SS
const H = SIZE * SS

function lerp(a, b, t) { return a + (b - a) * t }
// 垂直渐变：顶 #ff7aa3 -> 底 #e84d8a（与品牌色 #ec6da4 协调）
function gradColor(y) {
  const t = y / H
  return [
    Math.round(lerp(0xff, 0xe8, t)),
    Math.round(lerp(0x7a, 0x4d, t)),
    Math.round(lerp(0xa3, 0x8a, t))
  ]
}

// 圆角矩形（铺满画布，四角半径 rad）测试
function inRoundedRect(x, y, rad) {
  let cx, cy
  if (x < rad) cx = rad
  else if (x > W - rad) cx = W - rad
  else return true
  if (y < rad) cy = rad
  else if (y > H - rad) cy = H - rad
  else return true
  const dx = x - cx, dy = y - cy
  return dx * dx + dy * dy <= rad * rad
}
function inEllipse(x, y, cx, cy, rx, ry) {
  const dx = (x - cx) / rx, dy = (y - cy) / ry
  return dx * dx + dy * dy <= 1
}
function inRect(x, y, x0, y0, x1, y1) {
  return x >= x0 && x <= x1 && y >= y0 && y <= y1
}
function inPoly(x, y, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1]
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi)) inside = !inside
  }
  return inside
}

// 音符几何（工作空间坐标，已乘 SS）
const S = SS
// 音符头：椭圆，略偏左下
const headCx = 235 * S, headCy = 360 * S, headRx = 88 * S, headRy = 66 * S
// 符干：从音符头右侧向上
const stemX0 = 300 * S, stemX1 = 332 * S, stemY0 = 128 * S, stemY1 = 366 * S
// 旗（flag）：从符干顶端向右下的曲线，用多边形近似
const flag = [
  [332 * S, 128 * S],
  [392 * S, 158 * S],
  [350 * S, 232 * S],
  [332 * S, 232 * S]
]

const RAD = 100 * S
const out = Buffer.alloc(SIZE * SIZE * 4)
let idx = 0
for (let oy = 0; oy < SIZE; oy++) {
  for (let ox = 0; ox < SIZE; ox++) {
    let bgCov = 0, noteCov = 0
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const x = ox * SS + sx + 0.5, y = oy * SS + sy + 0.5
        if (inRoundedRect(x, y, RAD)) bgCov++
        if (
          inEllipse(x, y, headCx, headCy, headRx, headRy) ||
          inRect(x, y, stemX0, stemY0, stemX1, stemY1) ||
          inPoly(x, y, flag)
        ) noteCov++
      }
    }
    const total = SS * SS
    const bgA = bgCov / total
    const noteA = noteCov / total
    const [gr, gg, gb] = gradColor(oy * SS)
    // 先铺渐变底（带圆角 alpha），再把白色音符合成上去
    let fr = gr, fg = gg, fb = gb, fa = bgA
    const na = noteA
    fr = Math.round(fr * (1 - na) + 255 * na)
    fg = Math.round(fg * (1 - na) + 255 * na)
    fb = Math.round(fb * (1 - na) + 255 * na)
    fa = fa + na * (1 - fa)
    out[idx++] = fr; out[idx++] = fg; out[idx++] = fb
    out[idx++] = Math.round(fa * 255)
  }
}

// ===== PNG 编码 =====
function makeCrcTable() {
  const t = new Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    t[n] = c >>> 0
  }
  return t
}
const crcTable = makeCrcTable()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ crcTable[(c ^ buf[i]) & 0xff]
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
  const t = Buffer.from(type, 'ascii')
  const body = Buffer.concat([t, data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}
const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8      // bit depth
ihdr[9] = 6      // color type RGBA
ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1))
let p = 0
for (let y = 0; y < SIZE; y++) {
  raw[p++] = 0 // filter none
  out.copy(raw, p, y * SIZE * 4, (y + 1) * SIZE * 4)
  p += SIZE * 4
}
const idat = zlib.deflateSync(raw, { level: 9 })
const png = Buffer.concat([
  sig,
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0))
])

const dir = 'd:/study/eletron-app'
fs.writeFileSync(path.join(dir, 'resources/icon.png'), png)
fs.writeFileSync(path.join(dir, 'build/icon.png'), png)
console.log('icon generated:', png.length, 'bytes -> resources/icon.png + build/icon.png')
