import axios from 'axios'
import { toast } from 'sonner'

const BASE_URL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? 'http://localhost:3000' : '')

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('lab_access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Any 401 (expired token, or another login elsewhere revoked this session)
// signs the user out immediately — no silent refresh to mask the failure.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('lab_access_token')
      localStorage.removeItem('lab_last_activity')
      const reason = error.response?.data?.message
      toast.info(
        reason === 'SESSION_REVOKED_ELSEWHERE'
          ? 'You were signed out because this account was signed in from another device or browser.'
          : 'Your session has expired. Please sign in again.',
      )
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)
