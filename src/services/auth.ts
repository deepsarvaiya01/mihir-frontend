import { api } from '../lib/api'
import type { LoginResponse, UserProfile } from '../types'

export const authService = {
  /** `identifier` may be either the user's email address or their username. */
  login: async (identifier: string, password: string): Promise<LoginResponse> => {
    const { data } = await api.post('/auth/login', { identifier, password })
    return data
  },

  getProfile: async (): Promise<UserProfile> => {
    const { data } = await api.get('/auth/profile')
    return data
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<{ message: string }> => {
    const { data } = await api.post('/auth/change-password', { currentPassword, newPassword })
    return data
  },
}
