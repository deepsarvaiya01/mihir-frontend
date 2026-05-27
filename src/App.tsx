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
import B2bLabsPage from './pages/B2bLabsPage'
import LabBranchesPage from './pages/LabBranchesPage'
import PatientFormPage from './pages/PatientFormPage'
import TemplateFormPage from './pages/TemplateFormPage'
import BillingPage from './pages/BillingPage'
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

function RoleRoute({ roles, children }: { roles: ('SUPER_ADMIN' | 'LAB_USER')[]; children: React.ReactNode }) {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/login" replace />
  return roles.includes(user.role as 'SUPER_ADMIN' | 'LAB_USER') ? <>{children}</> : <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<AuthRoute><LoginPage /></AuthRoute>} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/templates" element={<RoleRoute roles={['SUPER_ADMIN']}><TemplatesPage /></RoleRoute>} />
            <Route path="/templates/new" element={<RoleRoute roles={['SUPER_ADMIN']}><TemplateFormPage /></RoleRoute>} />
            <Route path="/templates/:id/edit" element={<RoleRoute roles={['SUPER_ADMIN']}><TemplateFormPage /></RoleRoute>} />
            <Route path="/approvals" element={<RoleRoute roles={['SUPER_ADMIN']}><ApprovalsPage /></RoleRoute>} />
            <Route path="/patients" element={<RoleRoute roles={['SUPER_ADMIN', 'LAB_USER']}><PatientsPage /></RoleRoute>} />
            <Route path="/patients/new" element={<RoleRoute roles={['SUPER_ADMIN', 'LAB_USER']}><PatientFormPage /></RoleRoute>} />
            <Route path="/patients/:id/edit" element={<RoleRoute roles={['SUPER_ADMIN', 'LAB_USER']}><PatientFormPage /></RoleRoute>} />
            <Route path="/orders" element={<RoleRoute roles={['SUPER_ADMIN', 'LAB_USER']}><OrdersPage /></RoleRoute>} />
            <Route path="/billing" element={<RoleRoute roles={['SUPER_ADMIN', 'LAB_USER']}><BillingPage /></RoleRoute>} />
            <Route path="/history" element={<RoleRoute roles={['SUPER_ADMIN', 'LAB_USER']}><HistoryPage /></RoleRoute>} />
            <Route path="/users" element={<RoleRoute roles={['SUPER_ADMIN']}><UsersPage /></RoleRoute>} />
            <Route path="/b2b-labs" element={<RoleRoute roles={['SUPER_ADMIN']}><B2bLabsPage /></RoleRoute>} />
            <Route path="/lab-branches" element={<RoleRoute roles={['SUPER_ADMIN']}><LabBranchesPage /></RoleRoute>} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  )
}
