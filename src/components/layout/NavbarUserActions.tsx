import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, FlaskConical, CheckCircle2, XCircle, Clock, Sun, Moon } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { useThemeStore } from '../../store/themeStore'
import { notificationService, getLastSeenId, setLastSeenId, type AppNotification } from '../../services/notifications'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  ORDER_AWAITING_APPROVAL: <Clock className="h-4 w-4 text-amber-500" />,
  ORDER_APPROVED:          <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  ORDER_REJECTED:          <XCircle className="h-4 w-4 text-red-500" />,
}

const TYPE_ROUTE: Record<string, string> = {
  ORDER_AWAITING_APPROVAL: '/approvals',
  ORDER_APPROVED:          '/billing',
  ORDER_REJECTED:          '/history',
}

function NotifItem({ notif, isNew, onClick }: { notif: AppNotification; isNew: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50
        ${isNew ? 'bg-blue-50/60 dark:bg-blue-900/20' : ''}`}
    >
      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full
        ${isNew ? 'bg-white dark:bg-gray-600 shadow-sm ring-1 ring-gray-100 dark:ring-gray-600' : 'bg-gray-100 dark:bg-gray-700'}`}>
        {TYPE_ICON[notif.type] ?? <FlaskConical className="h-4 w-4 text-gray-400" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={`truncate text-[13px] font-semibold ${isNew ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
            {notif.title}
          </p>
          {isNew && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
        </div>
        <p className="text-[12px] text-gray-500 leading-snug mt-0.5 line-clamp-2">{notif.message}</p>
        <p className="text-[11px] text-gray-400 mt-1">{timeAgo(notif.createdAt)}</p>
      </div>
    </button>
  )
}

export function NavbarUserActions() {
  const { user } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [lastSeen, setLastSeen] = useState(() => getLastSeenId())
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationService.getAll(25),
    refetchInterval: 30_000,
    staleTime: 20_000,
  })

  const unreadCount = notifications.filter(n => n.id > lastSeen).length

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleOpen = () => {
    setOpen(v => !v)
  }

  const markAllRead = () => {
    if (notifications.length > 0) {
      const maxId = Math.max(...notifications.map(n => n.id))
      setLastSeenId(maxId)
      setLastSeen(maxId)
    }
  }

  const handleNotifClick = (notif: AppNotification) => {
    if (notifications.length > 0) {
      const maxId = Math.max(...notifications.map(n => n.id))
      setLastSeenId(maxId)
      setLastSeen(maxId)
    }
    setOpen(false)
    const route = TYPE_ROUTE[notif.type]
    if (route) navigate(route)
  }

  return (
    <div className="flex items-center gap-2 shrink-0" ref={dropdownRef}>
      {/* Theme toggle button */}
      <button
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      {/* Bell button */}
      <div className="relative">
        <button
          onClick={handleOpen}
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 shadow-2xl shadow-black/10">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-4 py-3">
              <div>
                <h3 className="text-[14px] font-semibold text-gray-900 dark:text-white">Notifications</h3>
                {unreadCount > 0 && (
                  <p className="text-[11px] text-blue-600 font-medium">{unreadCount} new</p>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-96 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700/50">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                    <Bell className="h-5 w-5 text-gray-400" />
                  </div>
                  <p className="text-[13px] font-medium text-gray-500 dark:text-gray-400">No notifications yet</p>
                  <p className="text-[11px] text-gray-400">Activity will appear here</p>
                </div>
              ) : (
                notifications.map(notif => (
                  <NotifItem
                    key={notif.id}
                    notif={notif}
                    isNew={notif.id > lastSeen}
                    onClick={() => handleNotifClick(notif)}
                  />
                ))
              )}
            </div>

            {notifications.length > 0 && (
              <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-2.5">
                <p className="text-[11px] text-center text-gray-400">
                  Showing last {notifications.length} notifications
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Avatar */}
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white select-none">
        {user?.name?.charAt(0).toUpperCase()}
      </div>
    </div>
  )
}
