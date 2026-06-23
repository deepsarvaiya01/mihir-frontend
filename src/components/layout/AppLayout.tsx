import { Outlet, Navigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopNavbar } from './TopNavbar'
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
  if (isLoading) return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <PageLoader />
    </div>
  )

  const isAdmin = user?.role === 'SUPER_ADMIN'

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {isAdmin && <TopNavbar />}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
