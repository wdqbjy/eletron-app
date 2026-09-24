import { defineStore } from 'pinia'
import { getMusicRegionFeed, type RecommendedMusic } from '../apis/bilibili'
import { stripHtmlTags, fixCoverUrl, thumbnailCover } from '../utils/bilibili'

/**
 * 首页「推荐音乐」store
 * - 数据源：B 站音乐区推荐接口（from_region=1003），比全站搜索更贴合“推荐”。
 * - load()：拉取 → 格式化 → 随机打乱；供首页 onMounted / 刷新按钮调用。
 */
export const useRecommendStore = defineStore('recommend', {
  state: (): { items: RecommendedMusic[]; loading: boolean; error: string } => ({
    items: [],
    loading: false,
    error: ''
  }),
  getters: {},
  actions: {
    async load(): Promise<void> {
      this.loading = true
      this.error = ''
      try {
        const res = await getMusicRegionFeed(1, 20)
        if (res.code === 0 && res.data?.archives?.length) {
          const list: RecommendedMusic[] = res.data.archives.map((item: any) => ({
            bvid: item.bvid,
            aid: item.aid,
            cid: item.cid,
            title: stripHtmlTags(item.title || ''),
            author: item.author?.name || '',
            cover: thumbnailCover(fixCoverUrl(item.cover)),
            duration: item.duration || 180,
            playCount: item.stat?.view || 0,
            pubdate: item.pubdate,
            rec_reason: item.rec_reason || ''
          }))
          // 随机打乱，每次刷新都得到新的推荐顺序
          this.items = [...list].sort(() => 0.5 - Math.random())
        } else {
          this.items = []
          this.error = res.message || '获取推荐失败'
        }
      } catch (err: any) {
        console.error('[recommend] 加载推荐音乐失败:', err)
        this.items = []
        this.error = err?.message || '加载失败'
      } finally {
        this.loading = false
      }
    }
  }
})