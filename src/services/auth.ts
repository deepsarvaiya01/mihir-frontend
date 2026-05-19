import { api } from '../lib/api'
import type { LoginResponse, UserProfile } from '../types'

export const authService = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const { data } = await api.post('/auth/login', { email, password })
    return data
  },

  getProfile: async (): Promise<UserProfile> => {
    const { data } = await api.get('/auth/profile')
    return data
  },

  refresh: async (refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> => {
    const { data } = await api.post('/auth/refresh', { refreshToken })
    return data
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<{ message: string }> => {
    const { data } = await api.post('/auth/change-password', { currentPassword, newPassword })
    return data
  },
}
