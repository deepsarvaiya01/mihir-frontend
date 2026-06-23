import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, ClipboardList, Receipt, History, Settings,
} from 'lucide-react'

const labItems = [
  { to: '/dashboard', label: 'Dashboard',        icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: '/patients',  label: 'Patients',          icon: <Users className="h-4 w-4" /> },
  { to: '/orders',    label: 'Orders & Results',  icon: <ClipboardList className="h-4 w-4" /> },
  { to: '/billing',   label: 'Billing & Reports', icon: <Receipt className="h-4 w-4" /> },
  { to: '/history',   label: 'Result History',    icon: <History className="h-4 w-4" /> },
  { to: '/settings',  label: 'Settings',          icon: <Settings className="h-4 w-4" /> },
]

export function TopNavbar() {
  return (
    <div className="shrink-0 border-b border-gray-200 bg-white">
      {/* Section label */}
      <div className="px-5 pt-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
          Laboratory
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex items-center gap-0.5 overflow-x-auto px-4 pb-0">
        {labItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition-colors
              ${isActive
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800'
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
