import type { ReactNode } from 'react'

interface DataTableProps {
  title?: string
  count?: number
  children: ReactNode
  minWidth?: string
}

export function DataTable({ title, count, children, minWidth = '600px' }: DataTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {title && (
        <div className="border-b border-gray-100 bg-gray-50 px-6 py-3.5">
          <h3 className="text-sm font-semibold text-gray-700">
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
      <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
        {children}
      </tr>
    </thead>
  )
}

export function DataTableTh({ children, align = 'left' }: { children: ReactNode; align?: 'left' | 'right' }) {
  return (
    <th className={`px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  )
}

export function DataTableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-gray-50">{children}</tbody>
}

export function DataTableRow({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <tr
      className={`transition-colors hover:bg-gray-50/60 ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {children}
    </tr>
  )
}

export function DataTableTd({ children, align = 'left', className = '' }: { children: ReactNode; align?: 'left' | 'right'; className?: string }) {
  return (
    <td className={`px-5 py-3.5 ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}>
      {children}
    </td>
  )
}
