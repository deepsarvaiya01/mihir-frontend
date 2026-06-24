import type { ReactNode } from 'react'
import { StatCard } from './StatCard'

interface StatItem {
  title: string
  value: string | number
  subtitle?: string
  icon: ReactNode
  color?: 'blue' | 'emerald' | 'amber' | 'red' | 'violet' | 'gray'
}

interface StatSummaryGridProps {
  stats: StatItem[]
  columns?: 2 | 3 | 4
}

export function StatSummaryGrid({ stats, columns = 4 }: StatSummaryGridProps) {
  const colClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-4',
  }[columns]

  return (
    <div className={`grid gap-4 ${colClass}`}>
      {stats.map(stat => (
        <StatCard
          key={stat.title}
          title={stat.title}
          value={stat.value}
          subtitle={stat.subtitle}
          icon={stat.icon}
          color={stat.color ?? 'blue'}
        />
      ))}
    </div>
  )
}
