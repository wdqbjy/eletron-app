export interface RequestConfig {
  baseURL?: string
  timeout?: number
  headers?: Record<string, string>
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public data?: any
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

class HttpClient {
  private baseURL: string = ''
  private defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  constructor(config?: RequestConfig) {
    if (config?.baseURL) this.baseURL = config.baseURL
    if (config?.headers) this.defaultHeaders = { ...this.defaultHeaders, ...config.headers }
  }

  private getFullURL(url: string): string {
    if (url.startsWith('http')) return url
    return this.baseURL + url
  }

  async get<T = any>(url: string, params?: any): Promise<T> {
    const fullURL = this.getFullURL(url)
    const ipc = window as any
    const response = await ipc.electronMyAPI.http.get(fullURL, params)
    if (!response.success) {
      throw new ApiError(response.statusCode || 500, response.message || '请求失败', response.error)
    }
    return response.data
  }

  async post<T = any>(url: string, data?: any, headers?: Record<string, string>): Promise<T> {
    const fullURL = this.getFullURL(url)
    const ipc = window as any
    const response = await ipc.electronMyAPI.http.post(fullURL, data, headers)
    if (!response.success) {
      throw new ApiError(response.statusCode || 500, response.message || '请求失败', response.error)
    }
    return response.data
  }

  async put<T = any>(url: string, data?: any): Promise<T> {
    const fullURL = this.getFullURL(url)
    const ipc = window as any
    const response = await ipc.electronMyAPI.http.put(fullURL, data)
    if (!response.success) {
      throw new ApiError(response.statusCode || 500, response.message || '请求失败', response.error)
    }
    return response.data
  }

  async delete<T = any>(url: string): Promise<T> {
    const fullURL = this.getFullURL(url)
    const ipc = window as any
    const response = await ipc.electronMyAPI.http.delete(fullURL)
    if (!response.success) {
      throw new ApiError(response.statusCode || 500, response.message || '请求失败', response.error)
    }
    return response.data
  }

  async patch<T = any>(url: string, data?: any): Promise<T> {
    const fullURL = this.getFullURL(url)
    const ipc = window as any
    const response = await ipc.electronMyAPI.http.patch(fullURL, data)
    if (!response.success) {
      throw new ApiError(response.statusCode || 500, response.message || '请求失败', response.error)
    }
    return response.data
  }

  async uploadFile<T = any>(url: string, filePath: string, fieldName?: string, data?: any): Promise<T> {
    const fullURL = this.getFullURL(url)
    const ipc = window as any
    const response = await ipc.electronMyAPI.http.upload(fullURL, filePath, fieldName, data)
    if (!response.success) {
      throw new ApiError(response.statusCode || 500, response.message || '上传失败', response.error)
    }
    return response.data
  }
}

export const httpClient = new HttpClient({
  baseURL: 'http://yunwei.gzyfzn.cn:8001/v2'
})

export default httpClient