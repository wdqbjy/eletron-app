import { defineStore } from 'pinia'

/**
 * B 站登录态（共享给 TopBar 与「我的」页，避免两处各拉一次、状态不一致）
 *
 * - userInfo：/x/web-interface/nav 返回的已登录用户信息
 * - loginModalOpen：扫码登录弹窗开关；弹窗本体在 TopBar，
 *   「我的」页未登录卡片的登录按钮也通过它唤起弹窗
 *
 * cookie 的恢复/持久化由主进程负责，渲染层启动时 refresh() 一次即可。
 */

export interface BiliUserInfo {
  uname: string
  mid: number
  isLogin: boolean
}

interface UserState {
  userInfo: BiliUserInfo | null
  loginModalOpen: boolean
}

function biliApi(): any {
  return (window as any).electronMyAPI?.bilibili
}

export const useUserStore = defineStore('user', {
  state: (): UserState => ({
    userInfo: null,
    loginModalOpen: false
  }),

  getters: {
    isLoggedIn: (state): boolean => !!(state.userInfo?.isLogin && state.userInfo.uname)
  },

  actions: {
    /** 打开扫码登录弹窗（TopBar watch 该状态生成二维码） */
    openLoginModal(): void {
      this.loginModalOpen = true
    },

    closeLoginModal(): void {
      this.loginModalOpen = false
    },

    /** 拉取当前登录态（启动 / 扫码成功后调用） */
    async refresh(): Promise<void> {
      const api = biliApi()
      if (!api) return
      try {
        const res = await api.getBilibiliUserInfo()
        if (res?.code === 0 && res?.data?.isLogin) {
          this.userInfo = {
            uname: res.data.uname,
            mid: res.data.mid,
            isLogin: true
          }
        } else {
          this.userInfo = null
        }
      } catch (e) {
        console.error('[user] 刷新登录态失败:', e)
        this.userInfo = null
      }
    },

    /** 注销并回到匿名态 */
    async logout(): Promise<void> {
      const api = biliApi()
      if (!api) {
        this.userInfo = null
        return
      }
      await api.logoutBilibili()
      this.userInfo = null
    }
  }
})
