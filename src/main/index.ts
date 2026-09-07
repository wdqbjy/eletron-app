import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'
import icon from '../../resources/icon.png?asset'


// ============== API 响应类型 ==============
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
  statusCode?: number
}

// ============== Axios 实例配置 ==============
class ApiService {
  private axiosInstance: AxiosInstance
  private requestInterceptor: number | null = null
  private responseInterceptor: number | null = null

  constructor() {
    // 创建 Axios 实例
    this.axiosInstance = axios.create({
      //baseURL: 'http://192.168.103.160:8088',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    })

    this.setupInterceptors()
  }

  // 设置拦截器
  private setupInterceptors(): void {
    // 请求拦截器 - 添加 token 等
    this.requestInterceptor = this.axiosInstance.interceptors.request.use(
      (config) => {
        // 从安全存储中获取 token（实际应从加密存储读取）
        // const token = this.getAuthToken()
        // if (token && config.headers) {
        //   config.headers.Authorization = `Bearer ${token}`
        // }
        
        // 添加请求时间戳（防重放攻击）
        config.params = {
          ...config.params,
          _t: Date.now()
        }
        
        console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`)
        return config
      },
      (error: AxiosError) => {
        console.error('[API Request Error]', error)
        return Promise.reject(error)
      }
    )

    // 响应拦截器 - 统一错误处理
    this.responseInterceptor = this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        console.log(`[API Response] ${response.config.url}`, response.status)
        return response
      },
      (error: AxiosError) => {
        // 统一错误处理
        if (error.response) {
          // 服务器返回错误状态码
          const status = error.response.status
          switch (status) {
            case 401:
              console.error('未授权，请重新登录')
              this.handleUnauthorized()
              break
            case 403:
              console.error('拒绝访问')
              break
            case 404:
              console.error('请求的资源不存在')
              break
            case 500:
              console.error('服务器内部错误')
              break
            default:
              console.error(`请求错误: ${status}`)
          }
        } else if (error.request) {
          // 请求已发出但没有收到响应
          console.error('网络错误，无法连接到服务器')
        } else {
          // 请求配置出错
          console.error('请求配置错误:', error.message)
        }
        
        return Promise.reject(error)
      }
    )
  }
  
  // 处理未授权
  private handleUnauthorized(): void {
    // 清除本地 token
    // 通知渲染进程跳转登录页
    if (mainWindow) {
      mainWindow.webContents.send('unauthorized')
    }
  }

  // 通用请求方法
  private async request<T = any>(
    method: string,
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      let response: AxiosResponse<T>
      
      switch (method.toUpperCase()) {
        case 'GET':
          response = await this.axiosInstance.get<T>(url, { ...config, params: data })
          break
        case 'POST':
          response = await this.axiosInstance.post<T>(url, data, config)
          break
        case 'PUT':
          response = await this.axiosInstance.put<T>(url, data, config)
          break
        case 'DELETE':
          response = await this.axiosInstance.delete<T>(url, { ...config, data })
          break
        case 'PATCH':
          response = await this.axiosInstance.patch<T>(url, data, config)
          break
        default:
          throw new Error(`不支持的请求方法: ${method}`)
      }
      
      return {
        success: true,
        data: response.data,
        statusCode: response.status
      }
    } catch (error) {
      const axiosError = error as AxiosError
      return {
        success: false,
        error: axiosError.message,
        message: axiosError.response?.statusText || '请求失败',
        statusCode: axiosError.response?.status
      }
    }
  }

  // 公开的 API 方法
  async get<T = any>(url: string, params?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('GET', url, params, config)
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('POST', url, data, config)
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', url, data, config)
  }

  async delete<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', url, data, config)
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', url, data, config)
  }

  // 文件上传
  async uploadFile<T = any>(
    url: string,
    filePath: string,
    fieldName: string = 'file',
    additionalData?: Record<string, any>
  ): Promise<ApiResponse<T>> {
    const FormData = require('form-data')
    const fs = require('fs')
    
    const form = new FormData()
    form.append(fieldName, fs.createReadStream(filePath))
    
    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        form.append(key, value)
      })
    }
    
    return this.post<T>(url, form, {
      headers: {
        ...form.getHeaders()
      }
    })
  }

  // 设置认证 token
  setAuthToken(token: string | null): void {
    if (token) {
      this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`
      // 安全存储 token
      this.saveAuthToken(token)
    } else {
      delete this.axiosInstance.defaults.headers.common['Authorization']
      this.clearAuthToken()
    }
  }

  private saveAuthToken(token: string): void {
    // 使用 safeStorage 或加密存储
    // 这里简化处理
    localStorage.setItem('auth_token', token)
  }

  private clearAuthToken(): void {
    localStorage.removeItem('auth_token')
  }

  // 销毁拦截器
  destroy(): void {
    if (this.requestInterceptor !== null) {
      this.axiosInstance.interceptors.request.eject(this.requestInterceptor)
    }
    if (this.responseInterceptor !== null) {
      this.axiosInstance.interceptors.response.eject(this.responseInterceptor)
    }
  }
}

// 创建 API 服务实例
const apiService = new ApiService()

let mainWindow: BrowserWindow | any = null // 主窗口

// ============== Electron 应用 ==============
class ElectronMyApp {
  private mainWindow: BrowserWindow | null = null

  private createWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 900,
      height: 670,
      show: false,
      frame: false, // 禁用原生边框
      autoHideMenuBar: true,
      ...(process.platform === 'linux' ? { icon } : {}),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false
      },
      // macOS 圆角
      roundedCorners: true
    })

    mainWindow = this.mainWindow
    // HMR for renderer base on electron-vite cli.
    // Load the remote URL for development or the local html file for production.
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }

    // 挂载
    mainWindow.on('ready-to-show', () => {
      mainWindow.show()
    })
  
    mainWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    // mainWindow = new BrowserWindow({
    //   width: 900,
    //   height: 670,
    //   show: false,
    //   frame: false, // 禁用原生边框
    //   autoHideMenuBar: true,
    //   ...(process.platform === 'linux' ? { icon } : {}),
    //   webPreferences: {
    //     preload: join(__dirname, '../preload/index.js'),
    //     sandbox: false
    //   },
    //   // macOS 圆角
    //   roundedCorners: true
    // })

    this.setupIpcHandlers()
  }

  private setupIpcHandlers(): void {
    // ============== HTTP 请求处理器 ==============
    ipcMain.handle('http:get', async (event, { url, params }) => {
      console.log(event);
      return await apiService.get(url, params)
    })

    ipcMain.handle('http:post', async (event, { url, data, headers }) => {
      console.log(event);
      return await apiService.post(url, data, { headers })
    })

    ipcMain.handle('http:put', async (event, { url, data }) => {
      console.log(event);
      return await apiService.put(url, data)
    })

    ipcMain.handle('http:delete', async (event, { url }) => {
      console.log(event);
      return await apiService.delete(url)
    })

    ipcMain.handle('http:patch', async (event, { url, data }) => {
      console.log(event);
      return await apiService.patch(url, data)
    })

    // ============== 认证相关 ==============
    ipcMain.handle('auth:login', async (event, { username, password }) => {
      console.log(event);
      const response = await apiService.post<{ token: string; user: any }>('/auth/login', {
        username,
        password
      })
      
      if (response.success && response.data?.token) {
        apiService.setAuthToken(response.data.token)
      }
      
      return response
    })

    ipcMain.handle('auth:logout', async () => {
      apiService.setAuthToken(null)
      return { success: true }
    })

    ipcMain.handle('auth:setToken', async (event, { token }) => {
      console.log(event);
      apiService.setAuthToken(token)
      return { success: true }
    })

    // ============== 文件上传 ==============
    ipcMain.handle('http:upload', async (event, { url, filePath, fieldName, data }) => {
      console.log(event);
      return await apiService.uploadFile(url, filePath, fieldName, data)
    })

    // ============== 窗口控制 ==============
    ipcMain.on('window-minimize', () => {
      if (this.mainWindow && !this.mainWindow.isMinimized()) {
        this.mainWindow.minimize()
      }
    })

    ipcMain.on('window-maximize', () => {
      if (this.mainWindow) {
        if (this.mainWindow.isMaximized()) {
          this.mainWindow.unmaximize()
        } else {
          this.mainWindow.maximize()
        }
      }
    })

    ipcMain.on('window-close', () => {
      if (this.mainWindow) {
        this.mainWindow.close()
      }
    })

    ipcMain.handle('window-is-maximized', () => {
      return this.mainWindow ? this.mainWindow.isMaximized() : false
    })
  }

  public init(): void {
    app.whenReady().then(() => {
      this.createWindow()

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createWindow()
        }
      })
        // Set app user model id for windows
      electronApp.setAppUserModelId('com.electron')

      // Default open or close DevTools by F12 in development
      // and ignore CommandOrControl + R in production.
      // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
      app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
      })
      mainWindow.webContents.openDevTools({mode:'detach'}); 

    })

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit()
      }
    })
  }
}


// 启动应用
const electronMyApp = new ElectronMyApp()
electronMyApp.init()
