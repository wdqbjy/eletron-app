
import httpClient from '../../utils/request'

export interface User {
  id: number
  username: string
  email: string
  avatar?: string
  role: string
  createdAt: string
}

export interface LoginParams {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  user: User
}

// demo
export const userApi = {
  // 获取当前用户信息
  getSystemCode: () => {
    return httpClient.get('/auth/code')
  },

  // 登录
  login: (params: LoginParams): Promise<LoginResponse> => {
    return httpClient.post<LoginResponse>('/auth/login', params)
  },
  
  // 获取当前用户信息
  getCurrentUser: (): Promise<User> => {
    return httpClient.get<User>('/user/current')
  },
  
  // 更新用户信息
  updateUser: (id: number, data: Partial<User>): Promise<User> => {
    return httpClient.put<User>(`/user/${id}`, data)
  },
  
  // 修改密码
  changePassword: (oldPassword: string, newPassword: string): Promise<void> => {
    return httpClient.post('/user/change-password', { oldPassword, newPassword })
  },
  
  // 上传头像
  uploadAvatar: (filePath: string): Promise<{ url: string }> => {
    return httpClient.uploadFile('/user/avatar', filePath, 'avatar')
  },
  
  // 获取用户列表（管理员）
  getUserList: (params?: { page: number; pageSize: number }): Promise<{ list: User[]; total: number }> => {
    return httpClient.get('/user/list', params)
  }
}