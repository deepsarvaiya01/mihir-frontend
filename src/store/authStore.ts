import { create } from 'zustand'
import type { UserProfile } from '../types'

interface AuthState {
  user: UserProfile | null
  isAuthenticated: boolean
  setAuth: (user: UserProfile, accessToken: string, refreshToken: string) => void
  setUser: (user: UserProfile) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: !!sessionStorage.getItem('lab_access_token'),
  setAuth: (user, accessToken, refreshToken) => {
    sessionStorage.setItem('lab_access_token', accessToken)
    sessionStorage.setItem('lab_refresh_token', refreshToken)
    set({ user, isAuthenticated: true })
  },
  setUser: (user) => set({ user }),
  clearAuth: () => {
    sessionStorage.removeItem('lab_access_token')
    sessionStorage.removeItem('lab_refresh_token')
    set({ user: null, isAuthenticated: false })
  },
}))
