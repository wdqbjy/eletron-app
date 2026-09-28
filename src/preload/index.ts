import { contextBridge, ipcRenderer } from 'electron'
// import { electronAPI } from '@electron-toolkit/preload'

// ============== API 响应类型 ==============
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
  statusCode?: number
}

// Custom APIs for renderer 
const electronMyAPI = {
  minimize: () => ipcRenderer.send('window-minimize'), //主窗口缩小
  maximize: () => ipcRenderer.send('window-maximize'), //主窗口放大或者复原
  close: () => ipcRenderer.send('window-close'), // 关闭主窗口
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'), // 获取窗口最大化状态
  // HTTP 请求
  http: {
    get: <T = any>(url: string, params?: any): Promise<ApiResponse<T>> => {
      console.log('预处理',url);
      return ipcRenderer.invoke('http:get', { url, params })
    },
    post: <T = any>(url: string, data?: any, headers?: Record<string, string>): Promise<ApiResponse<T>> => {
      return ipcRenderer.invoke('http:post', { url, data, headers })
    },
    put: <T = any>(url: string, data?: any): Promise<ApiResponse<T>> => {
      return ipcRenderer.invoke('http:put', { url, data })
    },
    delete: <T = any>(url: string): Promise<ApiResponse<T>> => {
      return ipcRenderer.invoke('http:delete', { url })
    },
    patch: <T = any>(url: string, data?: any): Promise<ApiResponse<T>> => {
      return ipcRenderer.invoke('http:patch', { url, data })
    },
    upload: <T = any>(url: string, filePath: string, fieldName?: string, data?: any): Promise<ApiResponse<T>> => {
      return ipcRenderer.invoke('http:upload', { url, filePath, fieldName, data })
    },

    // 认证
    auth: {
      login: (username: string, password: string): Promise<ApiResponse<{ token: string; user: any }>> => {
        return ipcRenderer.invoke('auth:login', { username, password })
      },
      logout: (): Promise<ApiResponse> => {
        return ipcRenderer.invoke('auth:logout')
      },
      setToken: (token: string): Promise<ApiResponse> => {
        return ipcRenderer.invoke('auth:setToken', { token })
      }
    },
  
    // 事件监听
    on: (channel: string, callback: (...args: any[]) => void) => {
      const validChannels = ['unauthorized', 'notification']
      if (validChannels.includes(channel)) {
        const subscription = (_event: any, ...args: any[]) => callback(...args)
        ipcRenderer.on(channel, subscription)
        return () => ipcRenderer.removeListener(channel, subscription)
      }
      return undefined
    }
  },
  // B 站音乐：contextBridge 白名单 → ipcRenderer.invoke → ipcMain.handle
  bilibili: {
    searchMusic: (keyword: string, page?: number, pageSize?: number): Promise<any> =>
      ipcRenderer.invoke('bili:search-music', keyword, page, pageSize),
    getMusicInfo: (bvid: string): Promise<any> =>
      ipcRenderer.invoke('bili:get-music-info', bvid),
    getMusicEpisodes: (bvid: string): Promise<any> =>
      ipcRenderer.invoke('bili:get-episodes', bvid),
    getFavFolders: (upMid: number): Promise<any> =>
      ipcRenderer.invoke('bili:get-fav-folders', upMid),
    getFavCollectedFolders: (upMid: number): Promise<any> =>
      ipcRenderer.invoke('bili:get-fav-collected-folders', upMid),
    getFavResourceIds: (mediaId: number): Promise<any> =>
      ipcRenderer.invoke('bili:get-fav-resource-ids', mediaId),
    getFavResourceInfos: (resources: string): Promise<any> =>
      ipcRenderer.invoke('bili:get-fav-resource-infos', resources),
    getMusicRegionFeed: (displayId?: number, requestCnt?: number): Promise<any> =>
      ipcRenderer.invoke('bili:region-feed', displayId, requestCnt),
    getMusicPlayUrl: (bvid: string, cid: number): Promise<any> =>
      ipcRenderer.invoke('bili:get-music-play-url', bvid, cid),
    getLyric: (arg: { title: string; artist: string }): Promise<any> =>
      ipcRenderer.invoke('bili:get-lyric', arg),
    searchLyric: (keyword: string): Promise<any> =>
      ipcRenderer.invoke('bili:search-lyric', keyword),
    getLyricById: (id: number): Promise<any> =>
      ipcRenderer.invoke('bili:get-lyric-by-id', id),
    // 扫码登录（generate-qrcode / poll-qrcode / get-user-info / logout-bilibili）
    generateQrcode: (): Promise<any> => ipcRenderer.invoke('bili:generate-qrcode'),
    pollQrcode: (qrcodeKey: string): Promise<any> =>
      ipcRenderer.invoke('bili:poll-qrcode', qrcodeKey),
    logoutBilibili: (): Promise<any> => ipcRenderer.invoke('bili:logout-bilibili'),
    getBilibiliUserInfo: (): Promise<any> => ipcRenderer.invoke('bili:get-user-info')
  },
  // 音乐下载（download-audio / download-progress 链路）
  download: {
    /** 发起下载（任务 id 由渲染层生成，保证与本地任务同一条） */
    start: (taskInfo: Record<string, any>): Promise<any> =>
      ipcRenderer.invoke('bili:download-audio', taskInfo),
    getTasks: (): Promise<any> => ipcRenderer.invoke('bili:get-download-tasks'),
    clearTasks: (): Promise<any> => ipcRenderer.invoke('bili:clear-download-tasks'),
    openFolder: (): Promise<any> => ipcRenderer.invoke('bili:open-download-folder'),
    getDirectory: (): Promise<any> => ipcRenderer.invoke('bili:get-download-directory'),
    setDirectory: (dirPath: string): Promise<any> =>
      ipcRenderer.invoke('bili:set-download-directory', dirPath),
    selectDirectory: (): Promise<any> => ipcRenderer.invoke('bili:select-download-directory'),
    /** 订阅主进程下载进度推送，返回取消订阅函数 */
    onProgress: (callback: (task: any) => void): (() => void) => {
      const listener = (_event: unknown, task: any): void => callback(task)
      ipcRenderer.on('bili:download-progress', listener)
      return () => ipcRenderer.removeListener('bili:download-progress', listener)
    }
  },
  // 应用信息 / 缓存管理（下载设置 / 缓存管理 / 关于卡片）
  app: {
    getInfo: (): Promise<any> => ipcRenderer.invoke('app:info'),
    getCacheSize: (): Promise<any> => ipcRenderer.invoke('app:get-cache-size'),
    clearCache: (): Promise<any> => ipcRenderer.invoke('app:clear-cache')
  },
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    // contextBridge.exposeInMainWorld('electron', electronAPI)
    // 安全的暴露 API 给渲染进程
    contextBridge.exposeInMainWorld('electronMyAPI', electronMyAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  //window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.electronMyAPI = electronMyAPI
}


