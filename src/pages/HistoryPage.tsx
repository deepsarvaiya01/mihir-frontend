import { useState, useMemo, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Printer, ChevronDown, ChevronUp, Calendar,
  FileCheck, Search, X, ClipboardList, User,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { PageLoader } from '../components/ui/Spinner'
import { Badge } from '../components/ui/Badge'
import { patientService } from '../services/patients'
import type { PatientHistory } from '../types'
import { toastError } from '../lib/errors'
import { formatAge } from '../lib/utils'

export default function HistoryPage() {
  const [query, setQuery]           = useState('')
  const [dropOpen, setDropOpen]     = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [history, setHistory]       = useState<PatientHistory | null>(null)
  const [searchParams]              = useSearchParams()
  const inputRef                    = useRef<HTMLInputElement>(null)
  const wrapRef                     = useRef<HTMLDivElement>(null)

  const { data: patients = [] } = useQuery({
    queryKey: ['patients'],
    queryFn: () => patientService.getAll(),
  })

  const loadHistory = useMutation({
    mutationFn: (id: number) => patientService.getHistory(id),
    onSuccess: (data) => { setHistory(data); setExpandedId(null) },
    onError:   (err)  => toastError(err, 'Failed to load history'),
  })

  useEffect(() => {
    const pid = searchParams.get('patientId')
    if (pid) {
      loadHistory.mutate(Number(pid))
      const found = patients.find(p => String(p.id) === pid)
      if (found) setQuery(found.fullName)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patients.length])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setDropOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const suggestions = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return patients.slice(0, 40)
    return patients.filter(p =>
      p.fullName.toLowerCase().includes(q) ||
      p.patientCode.toLowerCase().includes(q) ||
      (p.phoneNumber ?? '').includes(q)
    ).slice(0, 40)
  }, [patients, query])

  const selectPatient = (p: typeof patients[0]) => {
    setQuery(p.fullName)
    setDropOpen(false)
    setHistory(null)
    loadHistory.mutate(p.id)
  }

  const clearSelection = () => {
    setQuery('')
    setHistory(null)
    setExpandedId(null)
    inputRef.current?.focus()
  }

  const groupedHistory = useMemo(() => {
    const items = history?.history ?? []
    const groups = new Map<string, typeof items>()
    for (const item of items) {
      const key = new Date(item.createdAt).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
      const list = groups.get(key) ?? []
      list.push(item)
      groups.set(key, list)
    }
    return Array.from(groups.entries())
  }, [history])

  const printReport = () => {
    if (!history?.patient) return
    const html = `
      <html><head><title>${history.patient.fullName} — Full Report</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:32px;color:#111;max-width:750px;margin:0 auto}
        h1{font-size:22px;font-weight:700;margin-bottom:4px}
        .meta{color:#555;font-size:13px;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #e5e7eb}
        .card{border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:16px 0;page-break-inside:avoid}
        .card-hdr{display:flex;justify-content:space-between;margin-bottom:12px}
        .name{font-size:16px;font-weight:600}
        .sub{font-size:12px;color:#6b7280;margin-top:2px}
        .badge{display:inline-block;padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:600;background:#dcfce7;color:#166534}
        table{width:100%;border-collapse:collapse}
        th{font-size:11px;text-transform:uppercase;color:#9ca3af;padding:8px 10px;text-align:left;border-bottom:1px solid #f3f4f6}
        td{padding:8px 10px;font-size:13px;border-bottom:1px solid #f9fafb}
        @media print{body{padding:16px}}
      </style></head><body>
      <h1>${history.patient.fullName}</h1>
      <div class="meta">
        Code: <strong>${history.patient.patientCode}</strong>
        ${history.patient.phoneNumber ? ` &bull; ${history.patient.phoneNumber}` : ''}
        ${history.patient.gender ? ` &bull; ${history.patient.gender}` : ''}
        ${formatAge(history.patient.ageYears, history.patient.ageMonths, history.patient.ageDays) ? ` &bull; ${formatAge(history.patient.ageYears, history.patient.ageMonths, history.patient.ageDays)}` : ''}
        ${history.patient.bloodGroup ? ` &bull; Blood: ${history.patient.bloodGroup}` : ''}
        <br><em>${history.history.length} report${history.history.length !== 1 ? 's' : ''}</em>
      </div>
      ${history.history.map(item => `
        <div class="card">
          <div class="card-hdr">
            <div>
              <div class="name">${item.testName} (${item.testCode})</div>
              <div class="sub">${new Date(item.createdAt).toLocaleString()}</div>
            </div>
            <span class="badge">${item.status}</span>
          </div>
          <table>
            <thead><tr><th>Parameter</th><th>Result</th><th>Unit</th><th>Reference Range</th></tr></thead>
            <tbody>${item.results.map(r =>
              `<tr><td>${r.fieldName}</td><td><strong>${String(r.value)}</strong></td><td>${r.unit ?? '—'}</td><td>${r.referenceRange ?? '—'}</td></tr>`
            ).join('')}</tbody>
          </table>
        </div>`).join('')}
      </body></html>`
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html); w.document.close(); w.focus(); w.print()
  }

  const patient = history?.patient
  const patientAge = patient ? formatAge(patient.ageYears, patient.ageMonths, patient.ageDays) : null

  return (
    <div className="flex h-full flex-col">
      <Header
        title="Result History"
        subtitle="Look up a patient and review every completed diagnostic report"
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl space-y-5 p-6">

          <div ref={wrapRef} className="relative">
            <div className={`flex items-center gap-3 rounded-2xl border bg-white px-4 py-3.5 shadow-sm transition-all dark:bg-gray-800
              ${dropOpen ? 'border-blue-400 ring-2 ring-blue-500/20' : 'border-gray-200 dark:border-gray-700'}`}>
              <Search className="h-4 w-4 shrink-0 text-gray-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => { setQuery(e.target.value); setDropOpen(true) }}
                onFocus={() => setDropOpen(true)}
                placeholder="Search patient by name, code or phone…"
                className="flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400 dark:text-gray-100"
              />
              {query && (
                <button onClick={clearSelection}
                  className="rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {dropOpen && suggestions.length > 0 && (
              <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
                <div className="max-h-72 overflow-y-auto py-1">
                  {suggestions.map(p => (
                    <button key={p.id} onMouseDown={() => selectPatient(p)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-blue-50 dark:hover:bg-blue-900/20">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
                        {p.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{p.fullName}</p>
                        <p className="text-xs text-gray-400">
                          {p.patientCode}
                          {p.phoneNumber ? ` · ${p.phoneNumber}` : ''}
                          {formatAge(p.ageYears, p.ageMonths, p.ageDays) ? ` · ${formatAge(p.ageYears, p.ageMonths, p.ageDays)}` : ''}
                        </p>
                      </div>
                      {p.gender && (
                        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-700">
                          {p.gender}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {loadHistory.isPending && <PageLoader />}

          {!loadHistory.isPending && patient && (
            <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
              <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1d4ed8] text-2xl font-bold text-white">
                    {patient.fullName.charAt(0).toUpperCase()}
                  </div>
                  <h3 className="mt-3 text-base font-bold text-gray-900 dark:text-white">{patient.fullName}</h3>
                  <p className="mt-0.5 font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">{patient.patientCode}</p>
                </div>

                <dl className="mt-5 space-y-2.5 border-t border-gray-100 pt-4 text-sm dark:border-gray-700">
                  <InfoRow label="Age" value={patientAge} />
                  <InfoRow label="Gender" value={patient.gender} />
                  <InfoRow label="Blood group" value={patient.bloodGroup} />
                  <InfoRow label="Phone" value={patient.phoneNumber} />
                  {patient.isB2b && <InfoRow label="B2B" value={patient.b2bLab?.name ?? 'Partner'} />}
                </dl>

                <div className="mt-5 flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3 dark:bg-blue-950/40">
                  <div>
                    <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{history!.history.length}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-500">Reports</p>
                  </div>
                  {history!.history.length > 0 && (
                    <Button size="sm" variant="secondary" icon={<Printer className="h-3.5 w-3.5" />} onClick={printReport}>
                      Print
                    </Button>
                  )}
                </div>
              </aside>

              <div>
                {history!.history.length === 0 ? (
                  <EmptyState
                    icon={<FileCheck className="h-10 w-10" />}
                    title="No test history"
                    description="This patient has no completed test reports yet."
                  />
                ) : (
                  <div className="space-y-6">
                    {groupedHistory.map(([dateLabel, items]) => (
                      <section key={dateLabel}>
                        <div className="mb-2.5 flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-gray-400" />
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">{dateLabel}</h4>
                          <span className="h-px flex-1 bg-gray-100 dark:bg-gray-700" />
                        </div>
                        <div className="space-y-2.5">
                          {items.map((item) => {
                            const isOpen = expandedId === item.orderId
                            return (
                              <div key={item.orderId}
                                className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                                <button
                                  className="flex w-full items-center gap-4 px-5 py-4 text-left"
                                  onClick={() => setExpandedId(isOpen ? null : item.orderId)}
                                >
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950">
                                    <ClipboardList className="h-4 w-4 text-blue-600" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-bold text-gray-800 dark:text-white">
                                      {item.testName}
                                      <span className="ml-2 font-mono text-xs font-normal text-gray-400">({item.testCode})</span>
                                    </p>
                                    <p className="mt-0.5 text-xs text-gray-400">
                                      {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      {' · '}
                                      {item.results.length} parameter{item.results.length !== 1 ? 's' : ''}
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-2.5">
                                    <Badge variant={item.status === 'APPROVED' ? 'success' : item.status === 'REJECTED' ? 'danger' : 'warning'} dot>
                                      {item.status}
                                    </Badge>
                                    {isOpen
                                      ? <ChevronUp className="h-4 w-4 text-gray-400" />
                                      : <ChevronDown className="h-4 w-4 text-gray-400" />}
                                  </div>
                                </button>

                                {isOpen && item.results.length > 0 && (
                                  <div className="border-t border-gray-100 bg-gray-50/70 px-5 py-4 dark:border-gray-700 dark:bg-gray-800/60">
                                    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                                      {item.results.map((r, i) => (
                                        <div key={i}
                                          className="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
                                          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{r.fieldName}</p>
                                          <p className="mt-1 text-base font-bold text-gray-900 dark:text-white">
                                            {String(r.value)}
                                            {r.unit && <span className="ml-1.5 text-sm font-normal text-gray-400">{r.unit}</span>}
                                          </p>
                                          {r.referenceRange && (
                                            <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">Ref: {r.referenceRange}</p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {!loadHistory.isPending && !patient && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-20 text-center dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950">
                <User className="h-7 w-7 text-blue-500" />
              </div>
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">Search for a patient</h3>
              <p className="mt-1.5 max-w-sm text-sm text-gray-400">
                Type a name, patient code, or phone number to open their full diagnostic history.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className="text-right text-sm font-medium text-gray-700 dark:text-gray-200">{value}</dd>
    </div>
  )
}
