import type { ReactNode } from 'react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: ReactNode
  iconBg?: string
  trend?: { value: number; label: string }
  color?: 'blue' | 'emerald' | 'amber' | 'red' | 'violet' | 'gray'
}

const colorMap = {
  blue:    { border: 'border-l-blue-500',   icon: 'bg-blue-50   text-blue-600   dark:bg-blue-900/30  dark:text-blue-400'   },
  emerald: { border: 'border-l-emerald-500', icon: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
  amber:   { border: 'border-l-amber-500',  icon: 'bg-amber-50  text-amber-600  dark:bg-amber-900/30 dark:text-amber-400'  },
  red:     { border: 'border-l-red-500',    icon: 'bg-red-50    text-red-600    dark:bg-red-900/30   dark:text-red-400'    },
  violet:  { border: 'border-l-violet-500', icon: 'bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400' },
  gray:    { border: 'border-l-gray-400',   icon: 'bg-gray-100  text-gray-600   dark:bg-gray-700     dark:text-gray-400'   },
}

export function StatCard({ title, value, subtitle, icon, trend, color = 'blue' }: StatCardProps) {
  const c = colorMap[color]
  return (
    <div className={`flex items-center gap-4 rounded-xl border border-gray-200 border-l-4 bg-white px-5 py-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 ${c.border}`}>
      {/* Icon */}
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${c.icon}`}>
        {icon}
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{title}</p>
        <p className="mt-0.5 text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{value}</p>
        {(subtitle || trend) && (
          <div className="mt-0.5 flex items-center gap-1.5">
            {trend && (
              <span className={`text-[11px] font-semibold ${trend.value >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
              </span>
            )}
            {subtitle && !trend && (
              <span className="text-[11px] text-gray-400">{subtitle}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
