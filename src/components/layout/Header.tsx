import { Bell, Menu } from 'lucide-react'
import { useMobileSidebar } from './MobileSidebarContext'
import { useAuthStore } from '../../store/authStore'

interface HeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
}

interface HeaderPropsExtended extends HeaderProps {
  onMenuClick?: () => void
}

export function Header({
  title,
  subtitle,
  action,
  onMenuClick,
}: HeaderPropsExtended) {
  const { user } = useAuthStore()
  const mobileCtx = useMobileSidebar()

  const handleMenu = () => {
    if (onMenuClick) return onMenuClick()
    mobileCtx.open()
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm">
      <div className="px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-4 lg:px-8">

        {/* ================= DESKTOP ================= */}
        <div className="hidden lg:flex lg:items-center lg:justify-between gap-4">

          {/* Left Section */}
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 truncate">
              {title}
            </h1>

            {subtitle && (
              <p className="mt-1 text-sm md:text-base text-slate-600 truncate">
                {subtitle}
              </p>
            )}
          </div>

          {/* Center Section */}
          {action && (
            <div className="flex flex-wrap items-center gap-2 justify-center">
              {action}
            </div>
          )}

          {/* Right Section */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
            </button>

            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-xs sm:text-sm font-bold text-white hover:bg-indigo-700 transition-colors cursor-pointer">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {/* ================= TABLET ================= */}
        <div className="hidden md:block lg:hidden">

          {/* Row 1 */}
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={handleMenu}
              className="flex items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-slate-900 truncate">
                {title}
              </h1>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
              </button>

              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>

          {/* Row 2 */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            {subtitle && (
              <p className="text-sm text-slate-600 flex-1">
                {subtitle}
              </p>
            )}

            {action && (
              <div className="flex flex-wrap items-center gap-2 justify-end">
                {action}
              </div>
            )}
          </div>
        </div>

        {/* ================= MOBILE ================= */}
        <div className="md:hidden">

          {/* Top Row */}
          <div className="flex items-start gap-2">

            {/* Menu */}
            <button
              onClick={handleMenu}
              className="mt-1 flex items-center justify-center rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Title + Subtitle */}
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-slate-900 truncate">
                {title}
              </h1>

              {subtitle && (
                <p className="mt-0.5 text-xs text-slate-600">
                  {subtitle}
                </p>
              )}
            </div>

            {/* Right Icons */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
              </button>

              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>

          {/* Actions BELOW heading + subtitle */}
          {action && (
            <div className="mt-3 ml-[38px] flex flex-wrap items-center gap-2">
              {action}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}