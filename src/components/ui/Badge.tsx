type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  dot?: boolean
  className?: string
}

const variants: Record<BadgeVariant, string> = {
  default: 'bg-slate-100 text-slate-600',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-rose-100 text-rose-700',
  info: 'bg-blue-100 text-blue-700',
  purple: 'bg-violet-100 text-violet-700',
}

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-slate-400',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  info: 'bg-blue-500',
  purple: 'bg-violet-500',
}

export function Badge({ children, variant = 'default', dot = false, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${variants[variant]} ${className}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  )
}

export function OrderStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: BadgeVariant; label: string }> = {
    PENDING: { variant: 'default', label: 'Pending' },
    IN_PROGRESS: { variant: 'info', label: 'In Progress' },
    AWAITING_APPROVAL: { variant: 'warning', label: 'Awaiting Approval' },
    APPROVED: { variant: 'success', label: 'Approved' },
    REJECTED: { variant: 'danger', label: 'Rejected' },
  }
  const cfg = map[status] ?? { variant: 'default' as BadgeVariant, label: status }
  return <Badge variant={cfg.variant} dot>{cfg.label}</Badge>
}
