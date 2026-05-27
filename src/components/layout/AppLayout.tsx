import { Outlet, Navigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useAuthStore } from '../../store/authStore'
import { useQuery } from '@tanstack/react-query'
import { authService } from '../../services/auth'
import { PageLoader } from '../ui/Spinner'

export function AppLayout() {
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

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex flex-1 flex-col min-h-screen overflow-hidden">
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
