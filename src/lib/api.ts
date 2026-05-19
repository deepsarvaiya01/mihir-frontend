import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('lab_access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refreshToken = sessionStorage.getItem('lab_refresh_token')
        if (!refreshToken) throw new Error('No refresh token')
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken })
        sessionStorage.setItem('lab_access_token', data.accessToken)
        sessionStorage.setItem('lab_refresh_token', data.refreshToken)
        original.headers.Authorization = `Bearer ${data.accessToken}`
        return api(original)
      } catch {
        sessionStorage.removeItem('lab_access_token')
        sessionStorage.removeItem('lab_refresh_token')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)
