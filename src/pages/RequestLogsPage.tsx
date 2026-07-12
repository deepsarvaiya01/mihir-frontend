import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ListTree } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContent } from '../components/ui/PageContent'
import { Pagination } from '../components/ui/Pagination'
import { FilterBar, FilterSelect } from '../components/ui/FilterBar'
import { requestLogService, type RequestLog } from '../services/requestLogs'

const PAGE_SIZE = 50

function StatusBadge({ status }: { status: number }) {
  const cls = status >= 500
    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
    : status >= 400
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {status}
    </span>
  )
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-blue-600 dark:text-blue-400',
  POST: 'text-emerald-600 dark:text-emerald-400',
  PATCH: 'text-amber-600 dark:text-amber-400',
  PUT: 'text-amber-600 dark:text-amber-400',
  DELETE: 'text-red-600 dark:text-red-400',
}

export default function RequestLogsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [method, setMethod] = useState('')
  const [status, setStatus] = useState<'' | 'success' | 'error'>('')

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['request-logs', page, search, method, status],
    queryFn: () =>
      requestLogService.getAll({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        method: method || undefined,
        status: status || undefined,
      }),
  })

  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE)

  return (
    <div>
      <Header
        title="Request Log"
        subtitle="Every API request handled by the server — endpoint, status, and errors"
      />
      <PageContent className="space-y-4">
        <FilterBar
          search={search}
          onSearchChange={v => { setSearch(v); setPage(1) }}
          searchPlaceholder="Filter by endpoint…"
          onRefresh={() => refetch()}
          isRefreshing={isFetching}
          count={data?.total}
          countLabel={`request${data?.total !== 1 ? 's' : ''}`}
        >
          <FilterSelect value={method} onChange={v => { setMethod(v); setPage(1) }}>
            <option value="">All Methods</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PATCH">PATCH</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
          </FilterSelect>
          <FilterSelect value={status} onChange={v => { setStatus(v as typeof status); setPage(1) }}>
            <option value="">All Statuses</option>
            <option value="success">Success (&lt;400)</option>
            <option value="error">Error (≥400)</option>
          </FilterSelect>
        </FilterBar>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Method</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Endpoint</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Error</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Duration</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {isLoading ? (
                  [...Array(10)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(6)].map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 animate-pulse rounded bg-gray-100 dark:bg-gray-700" style={{ width: j === 1 ? '220px' : j === 3 ? '160px' : '70px' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : !data?.data.length ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400 dark:text-gray-500">
                      <ListTree className="mx-auto mb-2 h-8 w-8 opacity-30" />
                      No requests logged yet
                    </td>
                  </tr>
                ) : (
                  data.data.map((log: RequestLog) => (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                      <td className={`px-4 py-3 font-mono text-xs font-bold ${METHOD_COLORS[log.method] ?? 'text-gray-500'}`}>{log.method}</td>
                      <td className="px-4 py-3 max-w-sm truncate font-mono text-xs text-gray-700 dark:text-gray-300">{log.path}</td>
                      <td className="px-4 py-3"><StatusBadge status={log.statusCode} /></td>
                      <td className="px-4 py-3 max-w-xs truncate text-xs text-red-600 dark:text-red-400">{log.errorMessage ?? <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">{log.durationMs != null ? `${log.durationMs} ms` : '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                        {new Date(log.createdAt).toLocaleString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
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
          <Pagination page={page} totalPages={totalPages} total={data?.total ?? 0} pageSize={PAGE_SIZE} onPage={setPage} onPageSize={() => {}} />
        )}
      </PageContent>
    </div>
  )
}
