import axios from 'axios'

const BASE_URL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? 'http://localhost:3000' : '')

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Single shared refresh promise — prevents concurrent calls from each firing their own refresh
let refreshing: Promise<string> | null = null

/** Decode JWT exp claim (milliseconds). Returns 0 on any parse error. */
function tokenExpiry(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return (payload.exp as number) * 1000
  } catch {
    return 0
  }
}

/** True if the token will expire within `bufferMs` (default 2 min). */
function expiresSoon(token: string, bufferMs = 2 * 60 * 1000): boolean {
  const exp = tokenExpiry(token)
  return exp > 0 && Date.now() >= exp - bufferMs
}

async function doRefresh(): Promise<string> {
  const rt = localStorage.getItem('lab_refresh_token')
  if (!rt) throw new Error('No refresh token stored')
  const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken: rt })
  localStorage.setItem('lab_access_token', data.accessToken as string)
  localStorage.setItem('lab_refresh_token', data.refreshToken as string)
  return data.accessToken as string
}

// ── Request interceptor: proactively refresh if token expires within 2 min ──
api.interceptors.request.use(async (config) => {
  const token = localStorage.getItem('lab_access_token')
  if (token && expiresSoon(token)) {
    if (!refreshing) {
      refreshing = doRefresh().finally(() => { refreshing = null })
    }
    try { await refreshing } catch { /* fall through — 401 handler will handle it */ }
  }
  const latest = localStorage.getItem('lab_access_token')
  if (latest) config.headers.Authorization = `Bearer ${latest}`
  return config
})

// ── Response interceptor: fallback for any 401 that slips through ──
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        if (!refreshing) {
          refreshing = doRefresh().finally(() => { refreshing = null })
        }
        const newToken = await refreshing
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      } catch {
        localStorage.removeItem('lab_access_token')
        localStorage.removeItem('lab_refresh_token')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)
