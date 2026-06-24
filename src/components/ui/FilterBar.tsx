import type { ReactNode } from 'react'
import { Search, RefreshCw, ChevronDown } from 'lucide-react'

interface FilterBarProps {
  search?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  onRefresh?: () => void
  isRefreshing?: boolean
  count?: number
  countLabel?: string
  children?: ReactNode
}

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  onRefresh,
  isRefreshing,
  count,
  countLabel = 'results',
  children,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {onSearchChange !== undefined && (
        <div className="relative min-w-[200px] flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search ?? ''}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      )}

      {children}

      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          title="Refresh"
          className={`flex h-[42px] w-[42px] items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-blue-600 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`}
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      )}

      {count !== undefined && (
        <span className="ml-auto text-sm text-gray-400">
          {count} {countLabel}
        </span>
      )}
    </div>
  )
}

interface FilterSelectProps {
  value: string
  onChange: (value: string) => void
  children: ReactNode
  className?: string
}

export function FilterSelect({ value, onChange, children, className = '' }: FilterSelectProps) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none rounded-lg border border-gray-200 bg-white py-2.5 pl-4 pr-9 text-sm text-gray-700 outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
    </div>
  )
}
