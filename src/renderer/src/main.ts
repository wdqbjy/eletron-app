import './assets/main.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

const app = createApp(App)
// 注册 Pinia（必须先 use 再 mount），与 pink-music 的 main.js 一致
const pinia = createPinia()
app.use(pinia)
app.mount('#app')
