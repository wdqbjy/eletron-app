import { defineStore } from 'pinia'

export type Theme = 'light' | 'dark'
export type Color = 'pink' | 'purple' | 'blue' | 'green' | 'orange' | 'apple-music'

const THEME_KEY = 'app-theme'
const COLOR_KEY = 'app-theme-color'
const COLORS: Color[] = ['pink', 'purple', 'blue', 'green', 'orange', 'apple-music']

/**
 * 全局主题 store（模式 dark/light + 主题色，整应用生效，对齐 pink-music）
 * - 模式：`class="dark/light"` 加在 <html> 上，CSS 用 `.light`/`:root` 变量切换。
 * - 颜色：`data-color` 属性加在 <html> 上，base.css 的 `[data-color="…"]` 覆盖品牌变量。
 * - init() 应在应用启动时调用一次：读 localStorage → 回退系统偏好，避免闪烁。
 * - 头部 TopBar 的切换按钮、我的·设置页的色板均调用本 store。
 */
export const useThemeStore = defineStore('theme', {
  state: (): { theme: Theme; color: Color } => ({
    theme: 'dark',
    color: 'pink'
  }),
  getters: {
    isDark: (s): boolean => s.theme === 'dark'
  },
  actions: {
    /** 把当前模式+颜色应用到 <html>（幂等） */
    applyTheme(theme: Theme, color: Color): void {
      document.documentElement.classList.toggle('dark', theme === 'dark')
      document.documentElement.classList.toggle('light', theme === 'light')
      document.documentElement.setAttribute('data-color', color)
    },
    init() {
      const saved = localStorage.getItem(THEME_KEY)
      if (saved === 'dark' || saved === 'light') {
        this.theme = saved
      } else if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
        this.theme = 'dark'
      }
      const savedColor = localStorage.getItem(COLOR_KEY)
      this.color = savedColor && COLORS.includes(savedColor as Color) ? (savedColor as Color) : 'pink'
      this.applyTheme(this.theme, this.color)
    },
    set(theme: Theme) {
      this.theme = theme
      this.applyTheme(theme, this.color)
      localStorage.setItem(THEME_KEY, theme)
    },
    toggle() {
      this.set(this.theme === 'dark' ? 'light' : 'dark')
    },
    setColor(color: Color) {
      this.color = color
      this.applyTheme(this.theme, color)
      localStorage.setItem(COLOR_KEY, color)
    }
  }
})