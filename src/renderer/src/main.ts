import './assets/main.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useThemeStore } from './stores/theme'
import { useSettingsStore } from './stores/settings'
import { usePlaylistStore } from './stores/playlist'

const app = createApp(App)
// 注册 Pinia（必须先 use 再 mount）
const pinia = createPinia()
app.use(pinia)
app.use(router)
// mount 前先应用主题、设置与歌单，避免首帧闪白/闪黑
useThemeStore(pinia).init()
useSettingsStore(pinia).init()
usePlaylistStore(pinia).init()
app.mount('#app')
