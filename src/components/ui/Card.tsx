interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  padding?: 'sm' | 'md' | 'lg'
}

const paddings = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export function Card({
  children,
  className = '',
  hover = false,
  padding = 'md',
}: CardProps) {
  return (
    <div
      className={`
        rounded-2xl
        border
        border-slate-200
        bg-white
        shadow-sm

        ${paddings[padding]}

        ${
          hover
            ? 'transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md'
            : ''
        }

        ${className}
      `}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
  badge?: React.ReactNode
}

export function CardHeader({
  title,
  subtitle,
  action,
  badge,
}: CardHeaderProps) {
  return (
    <div className="mb-5 flex flex-row items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h3 className="text-lg font-bold text-slate-800">
          {title}
        </h3>

        {subtitle && (
          <p className="mt-0.5 text-sm text-slate-500">
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex flex-shrink-0 items-center gap-2 whitespace-nowrap">
        {badge}
        {action}
      </div>
    </div>
  )
}