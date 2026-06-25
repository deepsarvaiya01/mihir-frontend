import { NavLink } from 'react-router-dom'
import {
  Users, ClipboardList, Receipt, History, Settings,
} from 'lucide-react'
import { NavbarUserActions } from './NavbarUserActions'

const labItems = [
  { to: '/patients',  label: 'Patients',          icon: <Users className="h-4 w-4" /> },
  { to: '/orders',    label: 'Orders & Results',  icon: <ClipboardList className="h-4 w-4" /> },
  { to: '/billing',   label: 'Billing & Reports', icon: <Receipt className="h-4 w-4" /> },
  { to: '/history',   label: 'Result History',    icon: <History className="h-4 w-4" /> },
  { to: '/settings',  label: 'Settings',          icon: <Settings className="h-4 w-4" /> },
]

export function TopNavbar() {
  return (
    <div className="shrink-0 border-b border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700">
      <div className="flex items-center gap-1 overflow-x-auto px-4">
        <span className="mr-2 shrink-0 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
          Laboratory
        </span>

        <nav className="flex min-w-0 flex-1 items-center gap-0.5">
          {labItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-[13px] font-medium transition-colors
                ${isActive
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-200'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <NavbarUserActions />
      </div>
    </div>
  )
}
