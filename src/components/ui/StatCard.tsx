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
  blue:    { icon: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',       border: 'border-blue-100 dark:border-blue-800/40' },
  emerald: { icon: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400', border: 'border-emerald-100 dark:border-emerald-800/40' },
  amber:   { icon: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',   border: 'border-amber-100 dark:border-amber-800/40' },
  red:     { icon: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',           border: 'border-red-100 dark:border-red-800/40' },
  violet:  { icon: 'bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400', border: 'border-violet-100 dark:border-violet-800/40' },
  gray:    { icon: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',         border: 'border-gray-200 dark:border-gray-600' },
}

export function StatCard({ title, value, subtitle, icon, trend, color = 'blue' }: StatCardProps) {
  const c = colorMap[color]
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:bg-gray-800 dark:border-gray-700">
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${c.icon}`}>
          {icon}
        </div>
        {trend && (
          <span className={`text-xs font-semibold ${trend.value >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold text-gray-900 tabular-nums dark:text-white">{value}</p>
        <p className="mt-0.5 text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
        {subtitle && <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>}
      </div>
    </div>
  )
}
