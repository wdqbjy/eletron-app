/** 封面加载失败时的本地兜底：内联 SVG（深色渐变 + 音符），零网络依赖 */
export const COVER_FALLBACK =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a2a45"/><stop offset="1" stop-color="#1c1426"/></linearGradient></defs><rect width="400" height="400" fill="url(#g)"/><g fill="#ff69b4" opacity=".85"><circle cx="165" cy="285" r="38"/><rect x="193" y="110" width="14" height="180" rx="7"/><path d="M207 110c46 14 66 42 58 78-12-22-34-34-58-32z"/></g></svg>`
  )
