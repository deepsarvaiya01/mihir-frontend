import { Sun, Moon } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useThemeStore } from '../../store/themeStore'
import { NotificationBell } from './NotificationBell'

export function NavbarUserActions() {
  const { user } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()

  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <NotificationBell />

      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white select-none">
        {user?.name?.charAt(0).toUpperCase()}
      </div>
    </div>
  )
}
