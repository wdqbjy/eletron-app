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
  // B 站音乐（pink-music 同源示例）：contextBridge 白名单 → ipcRenderer.invoke → ipcMain.handle
  bilibili: {
    searchMusic: (keyword: string, page?: number, pageSize?: number): Promise<any> =>
      ipcRenderer.invoke('bili:search-music', keyword, page, pageSize),
    getMusicInfo: (bvid: string): Promise<any> =>
      ipcRenderer.invoke('bili:get-music-info', bvid)
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


