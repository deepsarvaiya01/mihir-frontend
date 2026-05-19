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
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {action}
        <button className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50 transition-colors">
          <Bell className="h-4 w-4" />
        </button>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
          {user?.name.charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  )
}
