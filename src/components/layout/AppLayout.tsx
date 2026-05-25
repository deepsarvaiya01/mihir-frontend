import { Outlet, Navigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { MobileSidebarContext } from './MobileSidebarContext'
import { useAuthStore } from '../../store/authStore'
import { useQuery } from '@tanstack/react-query'
import { authService } from '../../services/auth'
import { PageLoader } from '../ui/Spinner'
import { useState } from 'react'
import { Header } from './Header'

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { isAuthenticated, user, setUser } = useAuthStore()

  const { isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const profile = await authService.getProfile()
      setUser(profile)
      return profile
    },
    enabled: isAuthenticated && !user,
    retry: false,
  })

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (isLoading) return <div className="flex h-screen items-center justify-center bg-slate-50"><PageLoader /></div>

  const ctxValue = { isOpen: mobileOpen, open: () => setMobileOpen(true), close: () => setMobileOpen(false) }

  return (
    <MobileSidebarContext.Provider value={ctxValue}>
      <div className="min-h-screen bg-slate-50">
        <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
          <div className="flex min-h-screen flex-1 flex-col lg:pl-[280px]">

  {/* MOBILE HEADER */}
  <div className="sticky top-0 z-30 border-b border-slate-200 bg-white lg:hidden">
   
  </div>

  {/* PAGE CONTENT */}
  <main className="flex-1 overflow-x-hidden overflow-y-auto">
    <Outlet />
  </main>

</div>
      </div>
    </MobileSidebarContext.Provider>
  )
}
