import { defineStore } from 'pinia'
import { getMusicRegionFeed, type RecommendedMusic } from '../apis/bilibili'
import { stripHtmlTags, fixCoverUrl, thumbnailCover } from '../utils/bilibili'

/**
 * 首页「推荐音乐」store
 * - 数据源：B 站音乐区推荐接口（from_region=1003），比全站搜索更贴近“推荐”。
 * - load()：拉取 → 过滤非音乐 → 格式化 → 随机打乱；供首页 onMounted / 刷新按钮调用。
 *
 * 备注：B 站 region/feed 返回项无 tid/tname/rec_reason 等分区字段，1003 是「音乐综合」
 * 流，会混入新闻/教学/Reaction/访谈/综艺等非音乐内容。下方用标题关键词做保守过滤，
 * 仅丢弃明显非音乐，保留音乐（含循环歌单、MV、翻唱、专辑推荐、晚会演出等）。
 */
const NON_MUSIC_KEYWORDS = [
  'reaction', 'reaction ', '锐评', '评测', '测评',
  '教学', '拆解', '跟练', '教程', '讲解', '示范',
  '访谈', '胡聊', '闲聊',
  '去世', '讣告', '病逝', '逝世',
  '新闻', '报道', '资讯'
]
function isLikelyMusic(title: string): boolean {
  const lower = title.toLowerCase()
  return !NON_MUSIC_KEYWORDS.some((k) => lower.includes(k.toLowerCase()))
}

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
          const list: RecommendedMusic[] = res.data.archives
            .map((item: any) => ({
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
            .filter((m: RecommendedMusic) => isLikelyMusic(m.title))
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