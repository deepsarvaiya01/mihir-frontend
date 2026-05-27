import { Bell } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

interface HeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
}

export function Header({ title, subtitle, action }: HeaderProps) {
  const { user } = useAuthStore()

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        {/* Title */}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="mt-0.5 truncate text-sm text-slate-500">{subtitle}</p>}
        </div>

        {/* Action */}
        {action && (
          <div className="flex flex-wrap items-center gap-2">
            {action}
          </div>
        )}

        {/* Right icons */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  )
}
