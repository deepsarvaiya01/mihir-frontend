import { Bell } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

export function NavbarUserActions() {
  const { user } = useAuthStore()

  return (
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
  )
}
