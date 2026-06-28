type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  dot?: boolean
  className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-600 ring-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:ring-gray-600',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-800',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:ring-amber-800',
  danger:  'bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/30 dark:text-red-400 dark:ring-red-800',
  info:    'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:ring-blue-800',
  purple:  'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:ring-violet-800',
}

const dotStyles: Record<BadgeVariant, string> = {
  default: 'bg-gray-400',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger:  'bg-red-500',
  info:    'bg-blue-500',
  purple:  'bg-violet-500',
}

export function Badge({ children, variant = 'default', dot = false, className = '' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5
        text-xs font-medium ring-1
        ${variantStyles[variant]} ${className}
      `}
    >
      {dot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotStyles[variant]}`} />}
      {children}
    </span>
  )
}

export function OrderStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: BadgeVariant; label: string }> = {
    PENDING:           { variant: 'default',  label: 'Pending' },
    IN_PROGRESS:       { variant: 'info',     label: 'In Progress' },
    AWAITING_APPROVAL: { variant: 'warning',  label: 'Awaiting Approval' },
    APPROVED:          { variant: 'success',  label: 'Approved' },
    REJECTED:          { variant: 'danger',   label: 'Rejected' },
  }
  const cfg = map[status] ?? { variant: 'default' as BadgeVariant, label: status.replace(/_/g, ' ') }
  return <Badge variant={cfg.variant} dot>{cfg.label}</Badge>
}
