import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FlaskConical, Users, ClipboardList,
  CheckSquare, History, LogOut, FlaskRound, ChevronRight,
  UserCog, Settings, Building2, MapPin, Receipt, PanelLeft,
  PenLine, ImageIcon, Shield,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { logoService } from '../../services/logos'
import { toast } from 'sonner'

interface NavItem { to: string; label: string; icon: React.ReactNode }

const labNavItems: NavItem[] = [
  { to: '/patients',     label: 'Patients',           icon: <Users className="h-4 w-4" /> },
  { to: '/orders',       label: 'Orders & Results',   icon: <ClipboardList className="h-4 w-4" /> },
  { to: '/billing',      label: 'Billing & Reports',  icon: <Receipt className="h-4 w-4" /> },
  { to: '/history',      label: 'Result History',     icon: <History className="h-4 w-4" /> },
  { to: '/settings',     label: 'Settings',           icon: <Settings className="h-4 w-4" /> },
]

const dashboardItem: NavItem = {
  to: '/dashboard',
  label: 'Dashboard',
  icon: <LayoutDashboard className="h-4 w-4" />,
}

const adminItems: NavItem[] = [
  { to: '/approvals',    label: 'Approvals',          icon: <CheckSquare className="h-4 w-4" /> },
  { to: '/templates',    label: 'Test Catalogue',     icon: <FlaskConical className="h-4 w-4" /> },
  { to: '/users',        label: 'User Management',    icon: <UserCog className="h-4 w-4" /> },
  { to: '/b2b-labs',     label: 'B2B Partners',       icon: <Building2 className="h-4 w-4" /> },
  { to: '/lab-branches', label: 'Lab Branches',       icon: <MapPin className="h-4 w-4" /> },
  { to: '/signatures',   label: 'Signatures',         icon: <PenLine className="h-4 w-4" /> },
  { to: '/logos',        label: 'Logo Manager',       icon: <ImageIcon className="h-4 w-4" /> },
  { to: '/audit',        label: 'Audit Log',          icon: <Shield className="h-4 w-4" /> },
]

const W_COLLAPSED = 'w-[56px]'
const W_EXPANDED  = 'w-56'

function NavItemLink({ item, expanded }: { item: NavItem; expanded: boolean }) {
  return (
    <NavLink
      to={item.to}
      title={!expanded ? item.label : undefined}
      className={({ isActive }) => `
        flex items-center rounded-lg py-2 text-[13px] font-medium transition-all duration-150
        ${expanded ? 'gap-2.5 px-3' : 'justify-center px-0'}
        ${isActive
          ? 'bg-blue-600 text-white'
          : 'text-gray-400 hover:bg-white/8 hover:text-white'
        }
      `}
    >
      {({ isActive }) => (
        <>
          <span className="shrink-0">{item.icon}</span>
          <span className={`overflow-hidden whitespace-nowrap transition-all duration-200 flex-1
            ${expanded ? 'max-w-[140px] opacity-100' : 'max-w-0 opacity-0'}`}>
            {item.label}
          </span>
          {isActive && expanded && (
            <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />
          )}
        </>
      )}
    </NavLink>
  )
}

function SectionLabel({ label, expanded }: { label: string; expanded: boolean }) {
  return (
    <div className={`overflow-hidden transition-all duration-200 ${expanded ? 'max-h-6 opacity-100 mb-1' : 'max-h-0 opacity-0 mb-0'}`}>
      <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
        {label}
      </p>
    </div>
  )
}

export function Sidebar() {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  const { data: activeLogo } = useQuery({
    queryKey: ['logos', 'active'],
    queryFn: logoService.getActive,
    staleTime: 60_000,
  })

  const [locked, setLocked] = useState<boolean>(() => {
    try { return localStorage.getItem('sidebar-locked') === 'true' } catch { return false }
  })
  const [hovered, setHovered] = useState(false)

  const expanded = locked || hovered
  const isAdmin = user?.role === 'SUPER_ADMIN'

  const toggleLock = () => {
    setLocked(prev => {
      const next = !prev
      try { localStorage.setItem('sidebar-locked', String(next)) } catch {}
      return next
    })
  }

  const handleLogout = () => {
    clearAuth()
    toast.success('Signed out')
    navigate('/login')
  }

  return (
    <div
      className={`relative h-screen shrink-0 transition-[width] duration-300 ease-in-out ${locked ? W_EXPANDED : W_COLLAPSED}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <aside className={`
        absolute inset-y-0 left-0 z-40 flex h-screen flex-col
        bg-[#111827] border-r border-white/5
        overflow-hidden transition-[width] duration-300 ease-in-out
        ${expanded ? W_EXPANDED : W_COLLAPSED}
        ${!locked && expanded ? 'shadow-2xl shadow-black/30' : ''}
      `}>

        {/* ── Brand bar ───────────────────────────────────── */}
        <div className="flex h-14 shrink-0 items-center border-b border-white/5 px-3 gap-2.5">
          {/* Logo / icon */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 overflow-hidden">
            {activeLogo?.imageUrl
              ? <img src={activeLogo.imageUrl} alt={activeLogo.name} className="h-full w-full object-contain" />
              : <FlaskRound className="h-4 w-4 text-white" />
            }
          </div>

          {/* Name */}
          <div className={`min-w-0 flex-1 overflow-hidden transition-all duration-200 ${expanded ? 'opacity-100' : 'opacity-0 w-0'}`}>
            <p className="truncate text-[13px] font-semibold text-white leading-tight">
              {activeLogo?.name ?? 'LabOps Console'}
            </p>
            <p className="text-[10px] text-gray-500">
              {isAdmin ? 'Super Admin' : 'Lab User'}
            </p>
          </div>

          {/* Toggle pin */}
          <button
            onClick={toggleLock}
            title={locked ? 'Collapse sidebar' : 'Pin sidebar'}
            className={`shrink-0 rounded-md p-1.5 text-gray-600 hover:bg-white/8 hover:text-gray-300 transition-all duration-200
              ${expanded ? 'opacity-100' : 'opacity-0 pointer-events-none w-0 p-0'}`}
          >
            <PanelLeft className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* ── Navigation ──────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-4 space-y-4">
          {isAdmin ? (
            <>
              <div className="space-y-0.5">
                <NavItemLink item={dashboardItem} expanded={expanded} />
              </div>
              <div>
                <SectionLabel label="Administration" expanded={expanded} />
                <div className="space-y-0.5">
                  {adminItems.map(item => (
                    <NavItemLink key={item.to} item={item} expanded={expanded} />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div>
              <SectionLabel label="Laboratory" expanded={expanded} />
              <div className="space-y-0.5">
                <NavItemLink item={dashboardItem} expanded={expanded} />
                {labNavItems.map(item => (
                  <NavItemLink key={item.to} item={item} expanded={expanded} />
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* ── User footer ─────────────────────────────────── */}
        <div className="shrink-0 border-t border-white/5 p-2">
          <div className={`mb-1 flex items-center rounded-lg px-2 py-1.5 gap-2.5`}>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-semibold text-white">
              {user?.name.charAt(0).toUpperCase()}
            </div>
            <div className={`min-w-0 flex-1 overflow-hidden transition-all duration-200
              ${expanded ? 'opacity-100 max-w-[120px]' : 'opacity-0 max-w-0'}`}>
              <p className="truncate text-[12px] font-medium text-white">{user?.name}</p>
              <p className="truncate text-[10px] text-gray-500">{user?.email}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            title={!expanded ? 'Sign out' : undefined}
            className={`flex w-full items-center rounded-lg py-1.5 text-[12px] font-medium text-gray-500
              hover:bg-white/5 hover:text-red-400 transition-colors
              ${expanded ? 'gap-2.5 px-2' : 'justify-center px-0'}`}
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            <span className={`overflow-hidden whitespace-nowrap transition-all duration-200
              ${expanded ? 'max-w-[100px] opacity-100' : 'max-w-0 opacity-0'}`}>
              Sign out
            </span>
          </button>
        </div>
      </aside>
    </div>
  )
}
