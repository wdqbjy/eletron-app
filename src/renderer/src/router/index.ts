import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import SearchView from '../views/SearchView.vue'
import PlaylistView from '../views/PlaylistView.vue'
import MineView from '../views/MineView.vue'

/**
 * 应用路由：首页 / 搜索 / 歌单 / 我的
 * 用 hash history —— Electron 打包后以 file:// 加载，history 模式无需服务端回退也能工作。
 */
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView, meta: { title: '首页' } },
    { path: '/search', name: 'search', component: SearchView, meta: { title: '搜索' } },
    { path: '/playlist', name: 'playlist', component: PlaylistView, meta: { title: '歌单' } },
    { path: '/mine', name: 'mine', component: MineView, meta: { title: '我的' } },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})

export default router