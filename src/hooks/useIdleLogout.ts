import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '../store/authStore'

const IDLE_TIMEOUT_MS = 15 * 60 * 1000
const ACTIVITY_THROTTLE_MS = 5_000
const CHECK_INTERVAL_MS = 15_000
const LAST_ACTIVITY_KEY = 'lab_last_activity'

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const

/** Signs the user out after IDLE_TIMEOUT_MS of no mouse/keyboard/touch activity. */
export function useIdleLogout() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const clearAuth = useAuthStore(s => s.clearAuth)
  const navigate = useNavigate()
  const lastWrite = useRef(0)

  useEffect(() => {
    if (!isAuthenticated) return

    if (!localStorage.getItem(LAST_ACTIVITY_KEY)) {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
    }

    const markActive = () => {
      const now = Date.now()
      if (now - lastWrite.current < ACTIVITY_THROTTLE_MS) return
      lastWrite.current = now
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now))
    }

    const checkIdle = () => {
      const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) ?? Date.now())
      if (Date.now() - last >= IDLE_TIMEOUT_MS) {
        clearAuth()
        toast.info('You were signed out due to inactivity')
        navigate('/login', { replace: true })
      }
    }

    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, markActive, { passive: true }))
    const interval = setInterval(checkIdle, CHECK_INTERVAL_MS)
    checkIdle() // catches the case where the tab was reopened after sitting idle for a long time

    return () => {
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, markActive))
      clearInterval(interval)
    }
  }, [isAuthenticated, clearAuth, navigate])
}
