import { Bell } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

interface HeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
}

export function Header({ title, subtitle, action }: HeaderProps) {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'SUPER_ADMIN'

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        {/* Title */}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-gray-900">{title}</h1>
          {subtitle && <p className="mt-0.5 truncate text-sm text-gray-500">{subtitle}</p>}
        </div>

        {/* Actions */}
        {action && (
          <div className="flex flex-wrap items-center gap-2">
            {action}
          </div>
        )}

        {/* Right icons — lab users only (admins see these in the top navbar) */}
        {!isAdmin && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              className="relative flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
