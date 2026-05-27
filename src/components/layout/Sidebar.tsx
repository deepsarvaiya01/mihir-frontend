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
  PenLine,
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
  { to: '/dashboard',    label: 'Dashboard',       icon: <LayoutDashboard className="h-4 w-4" />, roles: ['SUPER_ADMIN', 'LAB_USER'] },
  { to: '/approvals',    label: 'Approvals',        icon: <CheckSquare className="h-4 w-4" />,     roles: ['SUPER_ADMIN'] },
  { to: '/templates',    label: 'Test Catalogue',   icon: <FlaskConical className="h-4 w-4" />,    roles: ['SUPER_ADMIN'] },
  { to: '/users',        label: 'User Management',  icon: <UserCog className="h-4 w-4" />,         roles: ['SUPER_ADMIN'] },
  { to: '/b2b-labs',     label: 'B2B Partners',     icon: <Building2 className="h-4 w-4" />,       roles: ['SUPER_ADMIN'] },
  { to: '/lab-branches', label: 'Lab Branches',     icon: <MapPin className="h-4 w-4" />,          roles: ['SUPER_ADMIN'] },
  { to: '/signatures',   label: 'Signatures',       icon: <PenLine className="h-4 w-4" />,         roles: ['SUPER_ADMIN'] },
  { to: '/patients',     label: 'Patients',         icon: <Users className="h-4 w-4" />,           roles: ['SUPER_ADMIN', 'LAB_USER'] },
  { to: '/orders',       label: 'Orders & Results', icon: <ClipboardList className="h-4 w-4" />,   roles: ['SUPER_ADMIN', 'LAB_USER'] },
  { to: '/billing',      label: 'Billing & Reports',icon: <Receipt className="h-4 w-4" />,         roles: ['SUPER_ADMIN', 'LAB_USER'] },
  { to: '/history',      label: 'Result History',   icon: <History className="h-4 w-4" />,         roles: ['SUPER_ADMIN', 'LAB_USER'] },
  { to: '/settings',     label: 'Settings',         icon: <Settings className="h-4 w-4" />,        roles: ['SUPER_ADMIN', 'LAB_USER'] },
]

/* Collapsed strip width */
const W_COLLAPSED = 'w-[52px]'
/* Expanded width */
const W_EXPANDED  = 'w-52'

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
    <div
      className={`relative h-screen flex-shrink-0 transition-[width] duration-300 ease-in-out ${locked ? W_EXPANDED : W_COLLAPSED}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <aside
        className={`
          absolute inset-y-0 left-0 z-40 flex h-screen flex-col bg-slate-950 text-white
          overflow-hidden transition-[width] duration-300 ease-in-out
          ${expanded ? W_EXPANDED : W_COLLAPSED}
          ${!locked && expanded ? 'shadow-2xl shadow-black/50' : ''}
        `}
      >
        {/* ── Logo bar ───────────────────────────────────────── */}
        <div className="flex h-[57px] shrink-0 items-center border-b border-white/10 px-3">
          {/* App icon */}
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600">
            <Activity className="h-4 w-4 text-white" />
          </div>

          {/* Text — fades in when expanded */}
          <div
            className={`ml-2.5 min-w-0 flex-1 transition-all duration-200 ${
              expanded ? 'opacity-100 delay-75' : 'pointer-events-none opacity-0'
            }`}
          >
            <h1 className="whitespace-nowrap text-[13px] font-bold tracking-tight">LabOps Console</h1>
            <p className="whitespace-nowrap text-[10px] text-slate-400">
              {user?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Lab User'}
            </p>
          </div>

          {/* Pin / unpin */}
          <button
            onClick={toggleLock}
            title={locked ? 'Unpin sidebar' : 'Pin sidebar open'}
            className={`ml-auto shrink-0 rounded-md p-1 transition-all duration-200
              text-slate-500 hover:bg-white/10 hover:text-white
              ${expanded ? 'opacity-100 delay-100' : 'pointer-events-none opacity-0 w-0 p-0'}`}
          >
            {locked
              ? <PinOff className="h-3 w-3" />
              : <Pin className="h-3 w-3" />}
          </button>
        </div>

        {/* ── Navigation ─────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-1.5 py-3">
          {/* Section label */}
          <div
            className={`overflow-hidden transition-all duration-200 ${
              expanded ? 'mb-1.5 max-h-5 opacity-100 delay-75' : 'mb-0 max-h-0 opacity-0'
            }`}
          >
            <p className="whitespace-nowrap px-2 text-[9px] font-semibold uppercase tracking-widest text-slate-500">
              {user?.role === 'SUPER_ADMIN' ? 'Administration' : 'Laboratory'}
            </p>
          </div>

          <div className="space-y-px">
            {visibleItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                title={!expanded ? item.label : undefined}
                className={({ isActive }) =>
                  `group flex items-center rounded-lg py-2 text-[13px] font-medium transition-all duration-150
                   ${expanded ? 'justify-between px-2.5' : 'justify-center px-0'}
                   ${isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/40'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                   }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="flex items-center gap-2.5">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                        {item.icon}
                      </span>
                      <span
                        className={`overflow-hidden whitespace-nowrap transition-all duration-200
                          ${expanded ? 'max-w-[120px] opacity-100 delay-75' : 'max-w-0 opacity-0'}`}
                      >
                        {item.label}
                      </span>
                    </span>
                    {isActive && expanded && (
                      <ChevronRight className="h-3 w-3 shrink-0 opacity-60" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* ── User footer ────────────────────────────────────── */}
        <div className="shrink-0 border-t border-white/10 p-1.5">
          {/* Avatar + info */}
          <div className={`mb-0.5 flex items-center rounded-lg px-2 py-1.5 ${expanded ? 'gap-2.5' : 'justify-center'}`}>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
              {user?.name.charAt(0).toUpperCase()}
            </div>
            <div
              className={`min-w-0 flex-1 overflow-hidden transition-all duration-200
                ${expanded ? 'max-w-[120px] opacity-100 delay-75' : 'max-w-0 opacity-0'}`}
            >
              <p className="truncate whitespace-nowrap text-[13px] font-medium text-white">{user?.name}</p>
              <p className="truncate whitespace-nowrap text-[10px] text-slate-400">{user?.email}</p>
            </div>
          </div>

          {/* Sign out */}
          <button
            onClick={handleLogout}
            title={!expanded ? 'Sign out' : undefined}
            className={`flex w-full items-center rounded-lg py-1.5 text-[13px] font-medium text-slate-400
              transition-colors hover:bg-rose-500/10 hover:text-rose-400
              ${expanded ? 'gap-2.5 px-2' : 'justify-center px-0'}`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span
              className={`overflow-hidden whitespace-nowrap transition-all duration-200
                ${expanded ? 'max-w-[100px] opacity-100 delay-75' : 'max-w-0 opacity-0'}`}
            >
              Sign out
            </span>
          </button>
        </div>
      </aside>
    </div>
  )
}
