import type { ReactNode } from 'react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: ReactNode
  iconBg?: string
  trend?: { value: number; label: string }
}

export function StatCard({ title, value, subtitle, icon, iconBg = 'bg-indigo-100', trend }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
      <div className="flex items-center justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconBg}`}>
          {icon}
        </div>
        {trend && (
          <span className={`text-xs font-semibold ${trend.value >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-3xl font-bold text-slate-900">{value}</p>
        <p className="mt-0.5 text-sm font-medium text-slate-600">{title}</p>
        {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
      </div>
    </div>
  )
}
