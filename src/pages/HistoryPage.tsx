import { useState, useMemo, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  History, Printer, ChevronDown, ChevronUp, Calendar,
  FileCheck, Search, X, ClipboardList,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { PageLoader } from '../components/ui/Spinner'
import { Badge } from '../components/ui/Badge'
import { patientService } from '../services/patients'
import type { PatientHistory } from '../types'
import { toastError } from '../lib/errors'

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

  /* pre-select from URL param */
  useEffect(() => {
    const pid = searchParams.get('patientId')
    if (pid) {
      loadHistory.mutate(Number(pid))
      const found = patients.find(p => String(p.id) === pid)
      if (found) setQuery(found.fullName)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patients.length])

  /* close dropdown on outside click */
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

  return (
    <div className="flex h-full flex-col">
      <Header
        title="Result History"
        subtitle="Search patients and view their full diagnostic report history"
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl space-y-5 p-5">

          {/* ── Search bar ── */}
          <div ref={wrapRef} className="relative">
            <div className={`flex items-center gap-2 rounded-2xl border bg-white px-4 py-3 shadow-sm transition-all dark:bg-gray-800
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

            {/* Dropdown */}
            {dropOpen && suggestions.length > 0 && (
              <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
                <div className="max-h-64 overflow-y-auto py-1">
                  {suggestions.map(p => (
                    <button key={p.id} onMouseDown={() => selectPatient(p)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-blue-50 dark:hover:bg-blue-900/20">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
                        {p.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{p.fullName}</p>
                        <p className="text-xs text-gray-400">{p.patientCode}{p.phoneNumber ? ` · ${p.phoneNumber}` : ''}</p>
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

          {/* ── Loading ── */}
          {loadHistory.isPending && <PageLoader />}

          {/* ── Patient card + history ── */}
          {!loadHistory.isPending && patient && (
            <div className="space-y-4">

              {/* Patient summary */}
              <div className="flex items-center justify-between rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50/40 px-5 py-4 dark:border-blue-900/40 dark:from-blue-900/20 dark:to-indigo-900/10">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-xl font-bold text-white shadow">
                    {patient.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">{patient.fullName}</h3>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2.5 text-xs text-gray-500 dark:text-gray-400">
                      <span className="font-mono font-semibold">{patient.patientCode}</span>
                      {patient.gender     && <><span className="text-gray-300">·</span><span>{patient.gender}</span></>}
                      {patient.bloodGroup && <><span className="text-gray-300">·</span><span>Blood: {patient.bloodGroup}</span></>}
                      {patient.phoneNumber && <><span className="text-gray-300">·</span><span>{patient.phoneNumber}</span></>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xl font-bold text-blue-600">{history!.history.length}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Reports</p>
                  </div>
                  {history!.history.length > 0 && (
                    <Button size="sm" variant="secondary" icon={<Printer className="h-3.5 w-3.5" />} onClick={printReport}>
                      Print
                    </Button>
                  )}
                </div>
              </div>

              {/* History list */}
              {history!.history.length === 0 ? (
                <EmptyState
                  icon={<FileCheck className="h-10 w-10" />}
                  title="No test history"
                  description="This patient has no completed test reports yet."
                />
              ) : (
                <div className="space-y-3">
                  {history!.history.map((item, idx) => {
                    const isOpen = expandedId === item.orderId
                    return (
                      <div key={item.orderId}
                        className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800">

                        {/* Row header */}
                        <button
                          className="flex w-full items-center gap-4 px-5 py-4 text-left"
                          onClick={() => setExpandedId(isOpen ? null : item.orderId)}
                        >
                          {/* Index bubble */}
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                            {history!.history.length - idx}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-gray-800 dark:text-white">
                              {item.testName}
                              <span className="ml-2 font-mono text-xs font-normal text-gray-400">({item.testCode})</span>
                            </p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                              <Calendar className="h-3 w-3" />
                              <span>{new Date(item.createdAt).toLocaleString()}</span>
                              <span className="text-gray-200 dark:text-gray-600">·</span>
                              <ClipboardList className="h-3 w-3" />
                              <span>{item.results.length} parameter{item.results.length !== 1 ? 's' : ''}</span>
                            </div>
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

                        {/* Expanded results */}
                        {isOpen && item.results.length > 0 && (
                          <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-4 dark:border-gray-700 dark:bg-gray-800/60">
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
              )}
            </div>
          )}

          {/* ── Initial empty state ── */}
          {!loadHistory.isPending && !patient && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                <History className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Search for a patient</h3>
              <p className="mt-1 max-w-xs text-xs text-gray-400">
                Type a name, patient code, or phone number above to load their full diagnostic history.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
