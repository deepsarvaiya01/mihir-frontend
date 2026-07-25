import { create } from 'zustand'
import type { UserProfile } from '../types'

interface AuthState {
  user: UserProfile | null
  isAuthenticated: boolean
  setAuth: (user: UserProfile, accessToken: string) => void
  setUser: (user: UserProfile) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('lab_access_token'),
  setAuth: (user, accessToken) => {
    localStorage.setItem('lab_access_token', accessToken)
    localStorage.setItem('lab_last_activity', String(Date.now()))
    set({ user, isAuthenticated: true })
  },
  setUser: (user) => set({ user }),
  clearAuth: () => {
    localStorage.removeItem('lab_access_token')
    localStorage.removeItem('lab_last_activity')
    set({ user: null, isAuthenticated: false })
  },
}))
