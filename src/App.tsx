import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AppLayout } from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import TemplatesPage from './pages/TemplatesPage'
import PatientsPage from './pages/PatientsPage'
import OrdersPage from './pages/OrdersPage'
import ApprovalsPage from './pages/ApprovalsPage'
import HistoryPage from './pages/HistoryPage'
import UsersPage from './pages/UsersPage'
import SettingsPage from './pages/SettingsPage'
import { useAuthStore } from './store/authStore'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>
}

function RoleRoute({ role, children }: { role: 'SUPER_ADMIN' | 'LAB_USER'; children: React.ReactNode }) {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/login" replace />
  return user.role === role ? <>{children}</> : <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<AuthRoute><LoginPage /></AuthRoute>} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/templates" element={<RoleRoute role="SUPER_ADMIN"><TemplatesPage /></RoleRoute>} />
            <Route path="/approvals" element={<RoleRoute role="SUPER_ADMIN"><ApprovalsPage /></RoleRoute>} />
            <Route path="/patients" element={<RoleRoute role="LAB_USER"><PatientsPage /></RoleRoute>} />
            <Route path="/orders" element={<RoleRoute role="LAB_USER"><OrdersPage /></RoleRoute>} />
            <Route path="/history" element={<RoleRoute role="LAB_USER"><HistoryPage /></RoleRoute>} />
            <Route path="/users" element={<RoleRoute role="SUPER_ADMIN"><UsersPage /></RoleRoute>} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  )
}
