/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare global {
  interface ApiResponse<T = any> {
    success: boolean
    data?: T
    message?: string
    error?: string
    statusCode?: number
  }

  interface Window {
    electronMyAPI: {
      minimize: () => void
      maximize: () => void
      close: () => void
      isMaximized: () => Promise<boolean>
      http: {
        get: <T = any>(url: string, params?: any) => Promise<ApiResponse<T>>
        post: <T = any>(url: string, data?: any, headers?: Record<string, string>) => Promise<ApiResponse<T>>
        put: <T = any>(url: string, data?: any) => Promise<ApiResponse<T>>
        delete: <T = any>(url: string) => Promise<ApiResponse<T>>
        patch: <T = any>(url: string, data?: any) => Promise<ApiResponse<T>>
        upload: <T = any>(url: string, filePath: string, fieldName?: string, data?: any) => Promise<ApiResponse<T>>
      }
      auth: {
        login: (username: string, password: string) => Promise<ApiResponse<{ token: string; user: any }>>
        logout: () => Promise<ApiResponse>
        setToken: (token: string) => Promise<ApiResponse>
      }
      on: (channel: string, callback: (...args: any[]) => void) => (() => void) | undefined
      bilibili: {
        searchMusic: (keyword: string, page?: number, pageSize?: number) => Promise<any>
        getMusicInfo: (bvid: string) => Promise<any>
      }
      download: {
        start: (taskInfo: Record<string, any>) => Promise<any>
        getTasks: () => Promise<any>
        clearTasks: () => Promise<any>
        openFolder: () => Promise<any>
        getDirectory: () => Promise<any>
        setDirectory: (dirPath: string) => Promise<any>
        selectDirectory: () => Promise<any>
        onProgress: (callback: (task: any) => void) => () => void
      }
      app: {
        getInfo: () => Promise<any>
        getCacheSize: () => Promise<any>
        clearCache: () => Promise<any>
      }
    }
  }
}
