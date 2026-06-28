import type { ReactNode } from 'react'

interface DataTableProps {
  title?: string
  count?: number
  children: ReactNode
  minWidth?: string
}

export function DataTable({ title, count, children, minWidth = '600px' }: DataTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      {title && (
        <div className="border-b border-gray-100 bg-gray-50 px-6 py-3.5 dark:border-gray-700 dark:bg-gray-900/50">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {title}{count !== undefined ? ` (${count})` : ''}
          </h3>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth }}>
          {children}
        </table>
      </div>
    </div>
  )
}

export function DataTableHead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-gray-100 bg-gray-50/50 text-left dark:border-gray-700 dark:bg-gray-900/30">
        {children}
      </tr>
    </thead>
  )
}

export function DataTableTh({ children, align = 'left' }: { children: ReactNode; align?: 'left' | 'right' }) {
  return (
    <th className={`px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  )
}

export function DataTableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-gray-50 dark:divide-gray-700">{children}</tbody>
}

export function DataTableRow({ children, onClick, className = '' }: { children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <tr
      className={`transition-colors hover:bg-gray-50/60 dark:hover:bg-gray-700/40 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </tr>
  )
}

export function DataTableTd({ children, align = 'left', className = '', colSpan }: { children: ReactNode; align?: 'left' | 'right'; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={`px-5 py-3.5 ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}>
      {children}
    </td>
  )
}
