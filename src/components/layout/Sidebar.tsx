import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  FlaskConical,
  Users,
  ClipboardList,
  CheckSquare,
  History,
  LogOut,
  Activity,
  ChevronRight,
  UserCog,
  Settings,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { toast } from 'sonner'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  roles: ('SUPER_ADMIN' | 'LAB_USER')[]
}

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'LAB_USER'] },
  { to: '/approvals', label: 'Approvals', icon: <CheckSquare className="h-5 w-5" />, roles: ['SUPER_ADMIN'] },
  { to: '/templates', label: 'Test Catalogue', icon: <FlaskConical className="h-5 w-5" />, roles: ['SUPER_ADMIN'] },
  { to: '/users', label: 'User Management', icon: <UserCog className="h-5 w-5" />, roles: ['SUPER_ADMIN'] },
  { to: '/patients', label: 'Patients', icon: <Users className="h-5 w-5" />, roles: ['LAB_USER'] },
  { to: '/orders', label: 'Orders & Results', icon: <ClipboardList className="h-5 w-5" />, roles: ['LAB_USER'] },
  { to: '/history', label: 'Result History', icon: <History className="h-5 w-5" />, roles: ['LAB_USER'] },
  { to: '/settings', label: 'Settings', icon: <Settings className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'LAB_USER'] },
]

export function Sidebar() {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  const visibleItems = navItems.filter(item => user?.role && item.roles.includes(user.role))

  const handleLogout = () => {
    clearAuth()
    toast.success('Signed out successfully')
    navigate('/login')
  }

  return (
    <aside className="flex h-screen w-72 flex-col bg-slate-950 text-white">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-white/10 px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600">
          <Activity className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight">LabOps Console</h1>
          <p className="text-[11px] text-slate-400">
            {user?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Lab User'} Workspace
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          {user?.role === 'SUPER_ADMIN' ? 'Administration' : 'Laboratory'}
        </p>
        {visibleItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150
               ${isActive
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'}`
            }
          >
            {({ isActive }) => (
              <>
                <span className="flex items-center gap-3">
                  {item.icon}
                  {item.label}
                </span>
                {isActive && <ChevronRight className="h-4 w-4 opacity-70" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-white/10 p-3">
        <div className="mb-2 flex items-center gap-3 rounded-xl px-3 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
            {user?.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{user?.name}</p>
            <p className="truncate text-xs text-slate-400">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
