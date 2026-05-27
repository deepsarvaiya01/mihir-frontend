import { useState } from 'react'
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
  Building2,
  MapPin,
  Receipt,
  Pin,
  PinOff,
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
  { to: '/dashboard',    label: 'Dashboard',        icon: <LayoutDashboard className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'LAB_USER'] },
  { to: '/approvals',    label: 'Approvals',         icon: <CheckSquare className="h-5 w-5" />,     roles: ['SUPER_ADMIN'] },
  { to: '/templates',    label: 'Test Catalogue',    icon: <FlaskConical className="h-5 w-5" />,    roles: ['SUPER_ADMIN'] },
  { to: '/users',        label: 'User Management',   icon: <UserCog className="h-5 w-5" />,         roles: ['SUPER_ADMIN'] },
  { to: '/b2b-labs',     label: 'B2B Partners',      icon: <Building2 className="h-5 w-5" />,       roles: ['SUPER_ADMIN'] },
  { to: '/lab-branches', label: 'Lab Branches',      icon: <MapPin className="h-5 w-5" />,          roles: ['SUPER_ADMIN'] },
  { to: '/patients',     label: 'Patients',          icon: <Users className="h-5 w-5" />,           roles: ['LAB_USER'] },
  { to: '/orders',       label: 'Orders & Results',  icon: <ClipboardList className="h-5 w-5" />,   roles: ['LAB_USER'] },
  { to: '/billing',      label: 'Billing & Reports', icon: <Receipt className="h-5 w-5" />,         roles: ['LAB_USER'] },
  { to: '/history',      label: 'Result History',    icon: <History className="h-5 w-5" />,         roles: ['LAB_USER'] },
  { to: '/settings',     label: 'Settings',          icon: <Settings className="h-5 w-5" />,        roles: ['SUPER_ADMIN', 'LAB_USER'] },
]

export function Sidebar() {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  const [locked, setLocked] = useState<boolean>(() => {
    try { return localStorage.getItem('sidebar-locked') === 'true' } catch { return false }
  })
  const [hovered, setHovered] = useState(false)

  const expanded = locked || hovered

  const toggleLock = () => {
    setLocked(prev => {
      const next = !prev
      try { localStorage.setItem('sidebar-locked', String(next)) } catch { /* ignore */ }
      return next
    })
  }

  const visibleItems = navItems.filter(item => user?.role && item.roles.includes(user.role))

  const handleLogout = () => {
    clearAuth()
    toast.success('Signed out successfully')
    navigate('/login')
  }

  return (
    /*
     * Outer container reserves the collapsed width in the flex layout.
     * When locked it reserves the full expanded width so content shifts over.
     * The inner <aside> is absolute-positioned so hover-expansion overlays the
     * page content instead of pushing it.
     */
    <div
      className={`relative h-screen flex-shrink-0 transition-[width] duration-300 ease-in-out ${locked ? 'w-72' : 'w-[68px]'}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <aside
        className={`
          absolute inset-y-0 left-0 z-40 flex h-screen flex-col bg-slate-950 text-white
          overflow-hidden transition-[width] duration-300 ease-in-out
          ${expanded ? 'w-72' : 'w-[68px]'}
          ${!locked && expanded ? 'shadow-2xl shadow-black/50' : ''}
        `}
      >
        {/* ── Logo bar ───────────────────────────────────────── */}
        <div className="flex h-[69px] shrink-0 items-center border-b border-white/10 px-[14px]">
          {/* App icon — always visible */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600">
            <Activity className="h-5 w-5 text-white" />
          </div>

          {/* Text — fades in when expanded */}
          <div
            className={`ml-3 min-w-0 flex-1 transition-all duration-200 ${
              expanded ? 'opacity-100 delay-75' : 'pointer-events-none opacity-0'
            }`}
          >
            <h1 className="whitespace-nowrap text-sm font-bold tracking-tight">LabOps Console</h1>
            <p className="whitespace-nowrap text-[11px] text-slate-400">
              {user?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Lab User'} Workspace
            </p>
          </div>

          {/* Lock / unlock pin */}
          <button
            onClick={toggleLock}
            title={locked ? 'Unpin sidebar' : 'Pin sidebar open'}
            className={`ml-auto shrink-0 rounded-lg p-1.5 transition-all duration-200
              text-slate-500 hover:bg-white/10 hover:text-white
              ${expanded ? 'opacity-100 delay-100' : 'pointer-events-none opacity-0 w-0 p-0'}`}
          >
            {locked
              ? <PinOff className="h-3.5 w-3.5" />
              : <Pin className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* ── Navigation ─────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-4">
          {/* Section label */}
          <div
            className={`overflow-hidden transition-all duration-200 ${
              expanded ? 'mb-2 max-h-6 opacity-100 delay-75' : 'mb-0 max-h-0 opacity-0'
            }`}
          >
            <p className="whitespace-nowrap px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              {user?.role === 'SUPER_ADMIN' ? 'Administration' : 'Laboratory'}
            </p>
          </div>

          <div className="space-y-0.5">
            {visibleItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                title={!expanded ? item.label : undefined}
                className={({ isActive }) =>
                  `group flex items-center rounded-xl py-2.5 text-sm font-medium transition-all duration-150
                   ${expanded ? 'justify-between px-3' : 'justify-center px-0'}
                   ${isActive
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                   }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="flex items-center gap-3">
                      {/* Icon — always rendered at the same size */}
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                        {item.icon}
                      </span>
                      {/* Label — slides in */}
                      <span
                        className={`overflow-hidden whitespace-nowrap transition-all duration-200
                          ${expanded ? 'max-w-[160px] opacity-100 delay-75' : 'max-w-0 opacity-0'}`}
                      >
                        {item.label}
                      </span>
                    </span>
                    {isActive && expanded && (
                      <ChevronRight className="h-4 w-4 shrink-0 opacity-70" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* ── User footer ────────────────────────────────────── */}
        <div className="shrink-0 border-t border-white/10 p-2">
          {/* Avatar + info */}
          <div className={`mb-1 flex items-center rounded-xl px-3 py-2 ${expanded ? 'gap-3' : 'justify-center'}`}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
              {user?.name.charAt(0).toUpperCase()}
            </div>
            <div
              className={`min-w-0 flex-1 overflow-hidden transition-all duration-200
                ${expanded ? 'max-w-[160px] opacity-100 delay-75' : 'max-w-0 opacity-0'}`}
            >
              <p className="truncate whitespace-nowrap text-sm font-medium text-white">{user?.name}</p>
              <p className="truncate whitespace-nowrap text-xs text-slate-400">{user?.email}</p>
            </div>
          </div>

          {/* Sign out */}
          <button
            onClick={handleLogout}
            title={!expanded ? 'Sign out' : undefined}
            className={`flex w-full items-center rounded-xl py-2 text-sm font-medium text-slate-400
              transition-colors hover:bg-rose-500/10 hover:text-rose-400
              ${expanded ? 'gap-3 px-3' : 'justify-center px-0'}`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span
              className={`overflow-hidden whitespace-nowrap transition-all duration-200
                ${expanded ? 'max-w-[120px] opacity-100 delay-75' : 'max-w-0 opacity-0'}`}
            >
              Sign out
            </span>
          </button>
        </div>
      </aside>
    </div>
  )
}
