import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getLyric, searchLyric, getLyricById, type NeteaseSong } from '../apis/bilibili'
import { parseLyric, currentLyricIndex, type LyricLine } from '../utils/lyric'

/**
 * 歌词 store：
 * 按当前曲目加载歌词、解析、缓存，维护当前高亮行与用户手动偏移。
 */
export const useLyricStore = defineStore('lyric', () => {
  // 当前曲目的结构化歌词（含每行原文/翻译）
  const currentLyric = ref<LyricLine[]>([])
  const currentLineIndex = ref(-1)
  const isLyricLoading = ref(false)
  const lyricError = ref('')
  // 用户手动偏移（毫秒，"校正"功能）——按曲目持久化（对齐 pink-music lyricOffsets）
  const currentOffset = ref(0)
  // 歌词来源：netease 自动 / manual 手动指定
  const lyricSource = ref('netease')
  // 缓存 key → 结构化歌词，避免重复请求
  const lyricCache = new Map<string, LyricLine[]>()
  // 当前曲目的缓存 key（bvid/cid/标题/作者）
  const currentKey = ref('')

  // ===== per-track 偏移持久化（localStorage） =====
  const OFFSETS_KEY = 'app-lyric-offsets'
  function loadOffsets(): Record<string, number> {
    try {
      const raw = localStorage.getItem(OFFSETS_KEY)
      const parsed = raw ? JSON.parse(raw) : {}
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }
  const lyricOffsets: Record<string, number> = loadOffsets()
  function persistOffsets() {
    try {
      localStorage.setItem(OFFSETS_KEY, JSON.stringify(lyricOffsets))
    } catch (_) {}
  }

  /** 有无歌词可显示 */
  const hasLyric = computed(() => currentLyric.value.length > 0)
  /** 歌词是否来自手动指定（搜索面板选中的网易云曲目） */
  const isManualSource = computed(() => lyricSource.value === 'manual')

  /** 开始加载某首曲目的歌词：先查缓存，再走主进程网易云匹配 */
  async function loadLyricForTrack(track: { id?: number | string; title: string; artist: string } | null | undefined) {
    if (!track) return
    const key = `${track.id || ''}|${track.title}|${track.artist}`
    currentKey.value = key
    if (lyricCache.has(key)) {
      currentLyric.value = lyricCache.get(key)!
      lyricError.value = ''
      // 恢复该歌已保存的校正偏移
      currentOffset.value = lyricOffsets[key] || 0
      updateCurrentLine(0)
      return
    }
    isLyricLoading.value = true
    lyricError.value = ''
    try {
      const res = await getLyric(track.title, track.artist)
      const text = res?.data
      if (!text) {
        currentLyric.value = []
        lyricError.value = res?.message || '未找到歌词'
        return
      }
      setCurrentLyric(text, key, 'netease')
    } catch (err: any) {
      currentLyric.value = []
      lyricError.value = err?.message || '歌词加载失败'
    } finally {
      isLyricLoading.value = false
    }
  }

  /** 直接以 LRC 文本（或 {lrc,tv,rv} 对象）设为当前歌词（手动搜索/指定来源时用） */
  function setCurrentLyric(
    raw: string | { lrc?: string; tv?: string; rv?: string },
    key?: string,
    source = 'netease'
  ) {
    const parsed = parseLyric(raw)
    currentLyric.value = parsed.lyrics
    if (key) {
      currentKey.value = key
      lyricCache.set(key, parsed.lyrics)
    }
    lyricSource.value = source
    // 恢复该歌已保存的校正偏移（0 仅在从未校正过时）
    currentOffset.value = (key && lyricOffsets[key]) || 0
    lyricError.value = ''
    updateCurrentLine(0)
  }

  function setCurrentLineIndex(i: number) {
    currentLineIndex.value = Math.max(0, i)
  }

  /** 手动微调偏移（±500ms）——按曲目记忆并持久化 */
  function adjustLyricOffset(deltaMs: number) {
    if (!currentKey.value) return
    const next = (lyricOffsets[currentKey.value] || 0) + deltaMs
    lyricOffsets[currentKey.value] = next
    currentOffset.value = next
    persistOffsets()
    updateCurrentLine()
  }
  function resetLyricOffset() {
    if (currentKey.value) {
      lyricOffsets[currentKey.value] = 0
      persistOffsets()
    }
    currentOffset.value = 0
    updateCurrentLine()
  }

  /** 根据当前播放时间刷新高亮行（currentTime 单位秒） */
  function updateCurrentLine(currentTimeSec = 0) {
    currentLineIndex.value = currentLyricIndex(currentLyric.value, currentTimeSec, currentOffset.value)
  }

  /** 手动搜索候选歌曲 */
  async function searchNetease(keyword: string): Promise<NeteaseSong[]> {
    try {
      return await searchLyric(keyword)
    } catch {
      return []
    }
  }

  /** 按网易云歌曲 id 获取并应用其歌词 */
  async function loadLyricById(song: NeteaseSong) {
    try {
      const res = await getLyricById(song.id)
      if (res?.data) {
        setCurrentLyric(res.data, `netease|${song.id}`, 'manual')
        return true
      }
      return false
    } catch {
      return false
    }
  }

  return {
    currentLyric,
    isManualSource,
    currentLineIndex,
    isLyricLoading,
    lyricError,
    currentOffset,
    lyricSource,
    hasLyric,
    loadLyricForTrack,
    setCurrentLyric,
    setCurrentLineIndex,
    adjustLyricOffset,
    resetLyricOffset,
    updateCurrentLine,
    searchNetease,
    loadLyricById,
    currentKey
  }
})