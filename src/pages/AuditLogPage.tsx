import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Shield, Search, User, Box } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContent } from '../components/ui/PageContent'
import { Pagination } from '../components/ui/Pagination'
import { auditLogService, type AuditLog } from '../services/auditLog'

const ACTION_COLORS: Record<string, string> = {
  ORDER_APPROVED:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  ORDER_REJECTED:   'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  ORDER_SUBMITTED:  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  PATIENT_CREATED:  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  PATIENT_DELETED:  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  PATIENT_UPDATED:  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400',
}

function ActionBadge({ action }: { action: string }) {
  const cls = ACTION_COLORS[action] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {action.replace(/_/g, ' ')}
    </span>
  )
}

function DetailsPanel({ details }: { details: string | null }) {
  if (!details) return <span className="text-gray-400 dark:text-gray-600">—</span>
  try {
    const obj = JSON.parse(details)
    return (
      <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
        {Object.entries(obj).map(([k, v]) => `${k}=${v}`).join(', ')}
      </span>
    )
  } catch {
    return <span className="text-xs text-gray-500 dark:text-gray-400">{details}</span>
  }
}

const PAGE_SIZE = 50

export default function AuditLogPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [entityFilter, setEntityFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, search, entityFilter],
    queryFn: () =>
      auditLogService.getAll({
        page,
        limit: PAGE_SIZE,
        action: search || undefined,
        entityType: entityFilter || undefined,
      }),
  })

  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE)

  return (
    <div>
      <Header
        title="Audit Log"
        subtitle="Complete record of all actions performed in the system"
      />
      <PageContent>
        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Filter by action…"
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
            />
          </div>
          <select
            value={entityFilter}
            onChange={e => { setEntityFilter(e.target.value); setPage(1) }}
            className="rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-700 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="">All Types</option>
            <option value="Order">Order</option>
            <option value="Patient">Patient</option>
            <option value="User">User</option>
          </select>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Entity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Details</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {isLoading ? (
                  [...Array(10)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(6)].map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 animate-pulse rounded bg-gray-100 dark:bg-gray-700" style={{ width: j === 1 ? '120px' : j === 4 ? '200px' : '80px' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : !data?.data.length ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400 dark:text-gray-500">
                      <Shield className="mx-auto mb-2 h-8 w-8 opacity-30" />
                      No audit records found
                    </td>
                  </tr>
                ) : (
                  data.data.map((log: AuditLog) => (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-400 dark:text-gray-500">#{log.id}</td>
                      <td className="px-4 py-3"><ActionBadge action={log.action} /></td>
                      <td className="px-4 py-3">
                        {log.entityType ? (
                          <span className="inline-flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                            <Box className="h-3.5 w-3.5 text-gray-400" />
                            {log.entityType}
                            {log.entityId != null && (
                              <span className="font-mono text-xs text-gray-400 dark:text-gray-500">#{log.entityId}</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                          <User className="h-3.5 w-3.5 text-gray-400" />
                          {log.userName}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate"><DetailsPanel details={log.details} /></td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                        {new Date(log.createdAt).toLocaleString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit', hour12: true,
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="mt-4">
            <Pagination page={page} totalPages={totalPages} total={data?.total ?? 0} pageSize={PAGE_SIZE} onPage={setPage} onPageSize={() => {}} />
          </div>
        )}
      </PageContent>
    </div>
  )
}
