import { defineStore } from 'pinia'
import type { SearchResultItem } from '../apis/bilibili'

/**
 * 搜索状态（Pinia，Options 风格）
 * 对齐 pink-music-app 的 stores/search.js：state 平铺 + actions 直接改。
 */
export const useSearchStore = defineStore('search', {
  state: () => ({
    query: '',
    results: [] as SearchResultItem[],
    loading: false,
    searched: false
  }),
  actions: {
    setQuery(q: string) {
      this.query = q
    },
    setResults(r: SearchResultItem[]) {
      this.results = r
    },
    setLoading(l: boolean) {
      this.loading = l
    },
    setSearched(s: boolean) {
      this.searched = s
    }
  }
})