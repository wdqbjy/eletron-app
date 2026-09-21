import { searchMusic, type SearchResultItem } from '../apis/bilibili'
import { useSearchStore } from '../stores/search'
import { stripHtmlTags, fixCoverUrl } from '../utils/bilibili'

/**
 * 音乐搜索业务逻辑（对应 pink-music-app 的 composables/useMusic.js）
 * 职责：组合 Pinia store + 调用渲染层 API + 数据格式化。
 */
export function useMusic() {
  const store = useSearchStore()

  async function handleSearch(): Promise<void> {
    const keyword = store.query.trim()
    if (!keyword || store.loading) return

    store.setLoading(true)
    try {
      const res = await searchMusic(keyword, 1, 30)
      if (res.code === 0) {
        // B 站 payload 是 { code, message, ttl, data:{ result } }，result 在 res.data.result（只有一层 data）
        const video = res.data?.result?.find((item) => item.result_type === 'video')
        store.setResults(
          (video?.data ?? []).map<SearchResultItem>((i) => ({
            bvid: i.bvid,
            aid: i.aid,
            title: stripHtmlTags(i.title),
            author: stripHtmlTags(i.author),
            cover: fixCoverUrl(i.pic),
            play: i.play,
            duration: i.duration,
            pubdate: i.pubdate
          }))
        )
      } else {
        store.setResults([])
      }
      store.setSearched(true)
    } catch (err: any) {
      console.error('[useMusic] 搜索失败:', err)
      store.setResults([])
    } finally {
      store.setLoading(false)
    }
  }

  return { state: store, handleSearch }
}