import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2, XCircle, FileText, Download, RefreshCw,
  RotateCcw, Undo2, LayoutGrid, List, CheckSquare, Square,
  Minus, X, User, Building2, Stethoscope, AlertTriangle,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { Modal, ConfirmModal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { PageLoader } from '../components/ui/Spinner'
import { OrderStatusBadge } from '../components/ui/Badge'
import { FilterBar, FilterSelect } from '../components/ui/FilterBar'
import { orderService } from '../services/orders'
import { labSettingsService } from '../services/labSettings'
import { signatureService } from '../services/signatures'
import { logoService } from '../services/logos'
import { generateLabReport } from '../utils/generateReport'
import { isOutOfRange as isValueOutOfRange } from '../utils/rangeCheck'
import type { Order, OrderResult, HistoryResult } from '../types'
import { toast } from 'sonner'
import { toastError } from '../lib/errors'

/* ── helpers ─────────────────────────────────────────────────────────────── */

function isOutOfRange(result: HistoryResult): boolean {
  return isValueOutOfRange(result.value, result.referenceRange)
}

function InfoPill({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</span>
      <span className="text-sm text-gray-800 dark:text-gray-200">{value}</span>
    </div>
  )
}

/* ── Full-screen review panel ─────────────────────────────────────────────── */

function ReviewPanel({
  data,
  onClose,
  onApprove,
  onReject,
  approving,
  rejecting,
}: {
  data: OrderResult
  onClose: () => void
  onApprove: () => void
  onReject: () => void
  approving: boolean
  rejecting: boolean
}) {
  const { order, results } = data
  const p = order.patient
  const isPending = order.status === 'AWAITING_APPROVAL'

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-900 overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-5 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex min-w-0 items-center gap-3">
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800">
            <X className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-gray-900 dark:text-white">
              {p?.fullName ?? '—'}
            </h2>
            <p className="truncate text-xs text-gray-400">
              {order.template?.name ?? '—'} · {order.receiptNumber ?? p?.patientCode ?? ''}
            </p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
        {isPending && (
          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" variant="danger" icon={<XCircle className="h-3.5 w-3.5" />}
              loading={rejecting} onClick={onReject}>Reject</Button>
            <Button size="sm" variant="success" icon={<CheckCircle2 className="h-3.5 w-3.5" />}
              loading={approving} onClick={onApprove}>Approve</Button>
          </div>
        )}
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl space-y-5 p-5">

          {/* ── Patient + Order info row ── */}
          <div className="grid gap-4 sm:grid-cols-2">

            {/* Patient card */}
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/60">
              <div className="mb-3 flex items-center gap-2">
                <User className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Patient</span>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white">
                  {p?.fullName?.charAt(0).toUpperCase() ?? '?'}
                </div>
                <div>
                  <p className="font-bold text-gray-900 dark:text-white">{p?.fullName ?? '—'}</p>
                  <p className="font-mono text-xs text-blue-600 dark:text-blue-400">{p?.patientCode ?? '—'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                <InfoPill label="Age" value={p?.age != null ? `${p.age} yrs` : null} />
                <InfoPill label="Gender" value={p?.gender} />
                <InfoPill label="Blood Group" value={p?.bloodGroup} />
                <InfoPill label="Phone" value={p?.phoneNumber} />
                <InfoPill label="Email" value={p?.email} />
                {(p?.city || p?.state) && <InfoPill label="Location" value={[p.city, p.state].filter(Boolean).join(', ')} />}
                {p?.doctorName && <InfoPill label="Ref. Doctor" value={p.doctorName} />}
              </div>
            </div>

            {/* Order + B2B card */}
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/60">
                <div className="mb-3 flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Order</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  <InfoPill label="Test" value={order.template?.name} />
                  <InfoPill label="Receipt" value={order.receiptNumber} />
                  <InfoPill label="Registered" value={order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null} />
                  <InfoPill label="Report Date" value={p?.reportDate ? new Date(p.reportDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null} />
                </div>
              </div>

              {p?.isB2b && p?.b2bLab && (
                <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4 dark:border-violet-800/40 dark:bg-violet-900/20">
                  <div className="mb-3 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-violet-500" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-violet-500 dark:text-violet-400">B2B Referral Lab</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    <div className="col-span-2"><InfoPill label="Lab Name" value={p.b2bLab.name} /></div>
                    <InfoPill label="Contact" value={p.b2bLab.contactPerson} />
                    <InfoPill label="Phone" value={p.b2bLab.phone} />
                    <InfoPill label="Email" value={p.b2bLab.email} />
                    <InfoPill label="City" value={p.b2bLab.city} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Test Results ── */}
          <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-800/40">
            <div className="border-b border-gray-100 px-5 py-3.5 dark:border-gray-800">
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">Test Results</h3>
              <p className="mt-0.5 text-xs text-gray-400">{results.filter(r => !r.isSectionHeader).length} parameters</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/40">
                    <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Parameter</th>
                    <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Value</th>
                    <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Unit</th>
                    <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Reference Range</th>
                    <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => {
                    if (r.isSectionHeader) {
                      return (
                        <tr key={i} className="border-t-2 border-blue-100 bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-900/20">
                          <td colSpan={5} className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                            {r.fieldName}
                          </td>
                        </tr>
                      )
                    }
                    const outOfRange = isOutOfRange(r)
                    return (
                      <tr key={i} className={`border-b border-gray-50 transition-colors dark:border-gray-800/60
                        ${outOfRange ? 'bg-red-50/40 dark:bg-red-900/10' : 'hover:bg-gray-50/60 dark:hover:bg-gray-800/30'}`}>
                        <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-200">{r.fieldName}</td>
                        <td className={`px-5 py-3 font-bold ${outOfRange ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                          {r.value != null ? String(r.value) : '—'}
                        </td>
                        <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{r.unit ?? '—'}</td>
                        <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{r.referenceRange ?? '—'}</td>
                        <td className="px-5 py-3">
                          {outOfRange && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600 dark:bg-red-900/40 dark:text-red-400">
                              <AlertTriangle className="h-3 w-3" /> Out of range
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Documents ── */}
          <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-800/40">
            <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3.5 dark:border-gray-800">
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">Documents</h3>
              {(p?.documents?.length ?? 0) > 0 && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                  {p!.documents!.length}
                </span>
              )}
            </div>
            {(p?.documents?.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <FileText className="mb-2 h-8 w-8 text-gray-200 dark:text-gray-700" />
                <p className="text-sm text-gray-400 dark:text-gray-500">No documents uploaded for this patient</p>
              </div>
            ) : (
              <div className="grid gap-2 p-5 sm:grid-cols-2">
                {p!.documents!.map(doc => (
                  <a key={doc.id} href={doc.url} target="_blank" rel="noopener noreferrer"
                    className="group flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 transition-colors hover:border-blue-200 hover:bg-blue-50/40 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-800">
                    <FileText className="h-5 w-5 shrink-0 text-blue-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800 group-hover:text-blue-700 dark:text-gray-200">{doc.name}</p>
                      <p className="text-xs text-gray-400">{new Date(doc.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* ── Bottom action bar ── */}
          {isPending && (
            <div className="flex justify-end gap-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-800/40">
              <Button variant="secondary" onClick={onClose}>Close</Button>
              <Button variant="danger" icon={<XCircle className="h-4 w-4" />}
                loading={rejecting} onClick={onReject}>Reject Order</Button>
              <Button variant="success" icon={<CheckCircle2 className="h-4 w-4" />}
                loading={approving} onClick={onApprove}>Approve Order</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

type ViewMode = 'card' | 'table'

function getStoredView(): ViewMode {
  try { return (localStorage.getItem('approvals-view') as ViewMode) || 'card' } catch { return 'card' }
}

function saveView(v: ViewMode) {
  try { localStorage.setItem('approvals-view', v) } catch {}
}

/* ── Checkbox helper ──────────────────────────────────────────────────────── */
function Checkbox({ checked, indeterminate, onChange, className = '' }: {
  checked: boolean; indeterminate?: boolean; onChange: () => void; className?: string
}) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onChange() }}
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors
        ${checked || indeterminate
          ? 'border-blue-600 bg-blue-600 text-white'
          : 'border-gray-300 bg-white hover:border-blue-400 dark:border-gray-600 dark:bg-gray-800'}
        ${className}`}
    >
      {indeterminate
        ? <Minus className="h-3 w-3" />
        : checked
          ? <CheckSquare className="h-3 w-3" />
          : <Square className="h-3 w-3 opacity-0" />}
    </button>
  )
}

/* ── Pending card ─────────────────────────────────────────────────────────── */
function PendingCard({
  order, selected, onToggle, onReview, onApprove, onReject, reviewLoading,
}: {
  order: Order; selected: boolean; onToggle: () => void
  onReview: () => void; onApprove: () => void; onReject: () => void; reviewLoading: boolean
}) {
  return (
    <div
      className={`relative rounded-2xl border-2 bg-white p-5 shadow-sm transition-all dark:bg-gray-800
        ${selected
          ? 'border-blue-500 shadow-blue-100 dark:border-blue-400 dark:shadow-blue-900/20'
          : 'border-amber-200 dark:border-amber-800/60'}`}
    >
      {/* Checkbox */}
      <div className="absolute left-3.5 top-3.5">
        <Checkbox checked={selected} onChange={onToggle} />
      </div>

      <div className="mb-4 ml-8 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            {order.receiptNumber ?? order.template?.name ?? 'Order'}
          </span>
          <p className="mt-1 font-semibold text-gray-900 dark:text-white">{order.patient?.fullName ?? '—'}</p>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{order.template?.name ?? '—'}</p>
          <p className="mt-1 text-xs text-gray-400">
            {order.createdAt
              ? new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
              : ''}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" icon={<FileText className="h-3.5 w-3.5" />}
          loading={reviewLoading} onClick={onReview}>
          Review
        </Button>
        <Button size="sm" variant="success" icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          onClick={onApprove}>
          Approve
        </Button>
        <Button size="sm" variant="danger" icon={<XCircle className="h-3.5 w-3.5" />}
          onClick={onReject}>
          Reject
        </Button>
      </div>
    </div>
  )
}

/* ── Main page ─────────────────────────────────────────────────────────────── */
type Tab = 'pending' | 'reviewed'

export default function ApprovalsPage() {
  const qc = useQueryClient()

  const [tab, setTab] = useState<Tab>('pending')
  const [viewMode, setViewMode] = useState<ViewMode>(getStoredView)
  const [search, setSearch] = useState('')
  const [testFilter, setTestFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | 'APPROVED' | 'REJECTED'>('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [selectedReport, setSelectedReport] = useState<OrderResult | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ type: 'approve' | 'reject'; order: Order } | null>(null)
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [reopenOrder, setReopenOrder] = useState<Order | null>(null)
  const [revertOrder, setRevertOrder] = useState<Order | null>(null)
  const [revertRemark, setRevertRemark] = useState('')

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['orders'],
    queryFn: orderService.getAll,
  })
  const { data: labSettings = {} } = useQuery({ queryKey: ['lab-settings'], queryFn: labSettingsService.getAll })
  const { data: activeSignatures = [] } = useQuery({ queryKey: ['active-signature'], queryFn: signatureService.getActive })
  const { data: activeLogo = null } = useQuery({ queryKey: ['logos', 'active'], queryFn: logoService.getActive })

  const testOptions = Array.from(new Set(orders.map(o => o.template?.name).filter((n): n is string => !!n))).sort()

  const matchesSearch = (o: Order) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      (o.patient?.fullName ?? '').toLowerCase().includes(q) ||
      (o.patient?.patientCode ?? '').toLowerCase().includes(q) ||
      (o.receiptNumber ?? '').toLowerCase().includes(q) ||
      (o.template?.name ?? '').toLowerCase().includes(q)
    )
  }

  const pending = orders
    .filter(o => o.status === 'AWAITING_APPROVAL')
    .filter(o => matchesSearch(o) && (!testFilter || o.template?.name === testFilter))

  const reviewed = orders
    .filter(o => o.status === 'APPROVED' || o.status === 'REJECTED')
    .filter(o => matchesSearch(o) && (!statusFilter || o.status === statusFilter))

  /* Selection helpers */
  const allSelected = pending.length > 0 && pending.every(o => selected.has(o.id))
  const someSelected = pending.some(o => selected.has(o.id)) && !allSelected
  const selectedCount = pending.filter(o => selected.has(o.id)).length

  const toggleOne = (id: number) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const toggleAll = () => {
    if (allSelected) {
      setSelected(prev => { const n = new Set(prev); pending.forEach(o => n.delete(o.id)); return n })
    } else {
      setSelected(prev => { const n = new Set(prev); pending.forEach(o => n.add(o.id)); return n })
    }
  }

  const clearSelection = () => setSelected(new Set())

  /* Mutations */
  const loadResults = useMutation({
    mutationFn: (orderId: number) => orderService.getResults(orderId),
    onSuccess: (data) => { setSelectedReport(data); setReportModalOpen(true) },
    onError: (err) => toastError(err, 'Failed to load results'),
  })

  const downloadReport = useMutation({
    mutationFn: (orderId: number) => orderService.getResults(orderId),
    onSuccess: (data) => {
      generateLabReport({
        order: data.order,
        results: data.results.map(r => ({
          fieldName: r.fieldName, fieldType: r.fieldType, value: r.value,
          unit: r.unit ?? null, referenceRange: r.referenceRange ?? null, isSectionHeader: r.isSectionHeader ?? false,
          isMainHeader: r.isMainHeader ?? false,
        })),
        labSettings, signatures: activeSignatures, activeLogo,
      }).then(() => toast.success('Report downloaded')).catch(() => toast.error('Failed to generate report'))
    },
    onError: (err) => toastError(err, 'Failed to generate report'),
  })

  const approve = useMutation({
    mutationFn: (orderId: number) => orderService.approve(orderId),
    onSuccess: (_, orderId) => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] })
      setConfirmAction(null)
      toast.success(`Order #${orderId} approved`)
    },
    onError: (err) => toastError(err, 'Failed to approve order'),
  })

  const bulkApprove = useMutation({
    mutationFn: (ids: number[]) => orderService.bulkApprove(ids),
    onSuccess: ({ approved, failed }) => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] })
      setConfirmBulk(false)
      clearSelection()
      if (approved.length) toast.success(`${approved.length} order${approved.length > 1 ? 's' : ''} approved`)
      if (failed.length)   toast.error(`${failed.length} order${failed.length > 1 ? 's' : ''} failed`)
    },
    onError: (err) => toastError(err, 'Bulk approval failed'),
  })

  const reopen = useMutation({
    mutationFn: (orderId: number) => orderService.reopen(orderId),
    onSuccess: (order) => { qc.invalidateQueries({ queryKey: ['orders'] }); setReopenOrder(null); toast.success(`${order.receiptNumber ?? order.template?.name ?? 'Order'} reopened`) },
    onError: (err) => toastError(err, 'Failed to reopen order'),
  })

  const revert = useMutation({
    mutationFn: ({ orderId, remark }: { orderId: number; remark: string }) => orderService.revert(orderId, remark),
    onSuccess: (order) => { qc.invalidateQueries({ queryKey: ['orders'] }); setRevertOrder(null); setRevertRemark(''); toast.success(`${order.receiptNumber ?? order.template?.name ?? 'Order'} reverted`) },
    onError: (err) => toastError(err, 'Failed to revert order'),
  })

  const reject = useMutation({
    mutationFn: (orderId: number) => orderService.reject(orderId),
    onSuccess: (_, orderId) => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] })
      setConfirmAction(null)
      toast.success(`Order #${orderId} rejected`)
    },
    onError: (err) => toastError(err, 'Failed to reject order'),
  })

  const switchView = (v: ViewMode) => { setViewMode(v); saveView(v) }

  return (
    <div className="flex h-full flex-col">
      <Header
        title="Approval Review"
        subtitle="Review and approve submitted test results"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {/* View toggle — only meaningful for the Pending tab */}
            {tab === 'pending' && (
              <div className="flex overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => switchView('card')}
                  title="Card view"
                  className={`flex h-8 w-8 items-center justify-center transition-colors
                    ${viewMode === 'card'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'}`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => switchView('table')}
                  title="Table view"
                  className={`flex h-8 w-8 items-center justify-center transition-colors border-l border-gray-200 dark:border-gray-700
                    ${viewMode === 'table'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'}`}
                >
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={() => refetch()} size="sm">
              Refresh
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 px-3 dark:border-gray-700 sm:px-5 lg:px-6">
        <button
          onClick={() => setTab('pending')}
          className={`flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors
            ${tab === 'pending'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
        >
          Pending Review
          {pending.length > 0 && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold
              ${tab === 'pending'
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
              {pending.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('reviewed')}
          className={`flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors
            ${tab === 'reviewed'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
        >
          Recently Reviewed
          {reviewed.length > 0 && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold
              ${tab === 'reviewed'
                ? 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
              {reviewed.length}
            </span>
          )}
        </button>
      </div>

      {/* Bulk action bar */}
      {tab === 'pending' && selectedCount > 0 && (
        <div className="mx-4 mt-3 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 dark:border-blue-800 dark:bg-blue-900/30">
          <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
            {selectedCount} order{selectedCount > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <button onClick={clearSelection} className="text-xs text-blue-600 hover:underline dark:text-blue-400">
              Clear
            </button>
            <Button
              size="sm"
              variant="success"
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
              onClick={() => setConfirmBulk(true)}
              loading={bulkApprove.isPending}
            >
              Approve {selectedCount} selected
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-5 p-3 sm:p-5 lg:p-6">
        {isLoading ? (
          <PageLoader />
        ) : (
          <>
            {/* ── Pending section ──────────────────────────────── */}
            {tab === 'pending' && (
            <div className="space-y-4">
              <FilterBar
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Patient, receipt no., test..."
                count={pending.length}
                countLabel={`pending order${pending.length !== 1 ? 's' : ''}`}
              >
                <FilterSelect value={testFilter} onChange={setTestFilter}>
                  <option value="">All Tests</option>
                  {testOptions.map(name => <option key={name} value={name}>{name}</option>)}
                </FilterSelect>
              </FilterBar>

              {pending.length > 0 && (
                <div className="mb-4 flex items-center gap-2">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={toggleAll}
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">Select all</span>
                </div>
              )}

              {pending.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 className="h-12 w-12" />}
                  title={search || testFilter ? 'No matching orders' : 'All caught up!'}
                  description={search || testFilter
                    ? 'No pending orders match your search or filter.'
                    : 'No orders are waiting for your approval right now.'}
                />
              ) : viewMode === 'card' ? (
                /* ── Card view ─── */
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {pending.map(order => (
                    <PendingCard
                      key={order.id}
                      order={order}
                      selected={selected.has(order.id)}
                      onToggle={() => toggleOne(order.id)}
                      onReview={() => loadResults.mutate(order.id)}
                      onApprove={() => setConfirmAction({ type: 'approve', order })}
                      onReject={() => setConfirmAction({ type: 'reject', order })}
                      reviewLoading={loadResults.isPending && loadResults.variables === order.id}
                    />
                  ))}
                </div>
              ) : (
                /* ── Table view ─── */
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                  <div className="w-full overflow-x-auto">
                    <table className="min-w-[700px] w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
                          <th className="w-10 px-4 py-3.5">
                            <Checkbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll} />
                          </th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Order</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Patient</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Test</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Date</th>
                          <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                        {pending.map(order => (
                          <tr
                            key={order.id}
                            onClick={() => toggleOne(order.id)}
                            className={`cursor-pointer transition-colors
                              ${selected.has(order.id)
                                ? 'bg-blue-50/60 dark:bg-blue-900/20'
                                : 'hover:bg-gray-50/60 dark:hover:bg-gray-700/40'}`}
                          >
                            <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                              <Checkbox checked={selected.has(order.id)} onChange={() => toggleOne(order.id)} />
                            </td>
                            <td className="whitespace-nowrap px-4 py-3.5 font-bold text-amber-600 dark:text-amber-400">
                              {order.receiptNumber ?? order.template?.name ?? '—'}
                            </td>
                            <td className="px-4 py-3.5">
                              <p className="font-medium text-gray-900 dark:text-white">{order.patient?.fullName ?? '—'}</p>
                              <p className="text-xs text-gray-400">{order.patient?.patientCode ?? ''}</p>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3.5 text-gray-600 dark:text-gray-300">{order.template?.name ?? '—'}</td>
                            <td className="whitespace-nowrap px-4 py-3.5 text-xs text-gray-400">
                              {order.createdAt
                                ? new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                : '—'}
                            </td>
                            <td className="px-4 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                              <div className="flex flex-wrap justify-end gap-1.5">
                                <Button size="sm" variant="secondary" icon={<FileText className="h-3 w-3" />}
                                  loading={loadResults.isPending && loadResults.variables === order.id}
                                  onClick={() => loadResults.mutate(order.id)}>
                                  Review
                                </Button>
                                <Button size="sm" variant="success" icon={<CheckCircle2 className="h-3 w-3" />}
                                  onClick={() => setConfirmAction({ type: 'approve', order })}>
                                  Approve
                                </Button>
                                <Button size="sm" variant="danger" icon={<XCircle className="h-3 w-3" />}
                                  onClick={() => setConfirmAction({ type: 'reject', order })}>
                                  Reject
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            )}

            {/* ── Reviewed section ─────────────────────────────── */}
            {tab === 'reviewed' && (
              <div className="space-y-4">
                <FilterBar
                  search={search}
                  onSearchChange={setSearch}
                  searchPlaceholder="Patient, receipt no., test..."
                  count={reviewed.length}
                  countLabel={`reviewed order${reviewed.length !== 1 ? 's' : ''}`}
                >
                  <FilterSelect value={statusFilter} onChange={v => setStatusFilter(v as typeof statusFilter)}>
                    <option value="">All Statuses</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </FilterSelect>
                </FilterBar>

                {reviewed.length === 0 ? (
                  <EmptyState
                    icon={<FileText className="h-12 w-12" />}
                    title={search || statusFilter ? 'No matching orders' : 'Nothing reviewed yet'}
                    description={search || statusFilter
                      ? 'No reviewed orders match your search or filter.'
                      : 'Approved and rejected orders will show up here.'}
                  />
                ) : (
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                  <div className="w-full overflow-x-auto">
                    <table className="min-w-[750px] w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
                          <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Order</th>
                          <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Patient</th>
                          <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Test</th>
                          <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Status</th>
                          <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                        {reviewed.map(order => (
                          <tr key={order.id} className="transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-700/40">
                            <td className="whitespace-nowrap px-5 py-4 font-bold text-gray-700 dark:text-gray-300">{order.receiptNumber ?? order.template?.name ?? '—'}</td>
                            <td className="px-5 py-4">
                              <p className="font-medium text-gray-800 dark:text-gray-200">{order.patient?.fullName ?? '—'}</p>
                              <p className="text-xs text-gray-400">{order.patient?.patientCode ?? ''}</p>
                            </td>
                            <td className="whitespace-nowrap px-5 py-4 text-gray-600 dark:text-gray-300">{order.template?.name ?? '—'}</td>
                            <td className="px-5 py-4"><OrderStatusBadge status={order.status} /></td>
                            <td className="px-5 py-4 text-right">
                              <div className="flex flex-wrap justify-end gap-2">
                                {order.status === 'APPROVED' && (
                                  <>
                                    <Button size="sm" variant="ghost" icon={<Download className="h-3.5 w-3.5" />}
                                      loading={downloadReport.isPending && downloadReport.variables === order.id}
                                      onClick={() => downloadReport.mutate(order.id)}>
                                      Report
                                    </Button>
                                    <Button size="sm" variant="secondary" icon={<Undo2 className="h-3.5 w-3.5" />}
                                      onClick={() => { setRevertOrder(order); setRevertRemark('') }}>
                                      Revert
                                    </Button>
                                  </>
                                )}
                                {order.status === 'REJECTED' && (
                                  <Button size="sm" variant="secondary" icon={<RotateCcw className="h-3.5 w-3.5" />}
                                    onClick={() => setReopenOrder(order)}>
                                    Re-open
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Full-screen review panel ──────────────────────────── */}
      {reportModalOpen && selectedReport && (
        <ReviewPanel
          data={selectedReport}
          onClose={() => setReportModalOpen(false)}
          onApprove={() => { setReportModalOpen(false); setConfirmAction({ type: 'approve', order: selectedReport.order }) }}
          onReject={() => { setReportModalOpen(false); setConfirmAction({ type: 'reject', order: selectedReport.order }) }}
          approving={approve.isPending}
          rejecting={reject.isPending}
        />
      )}

      {/* ── Bulk approve confirm ──────────────────────────────── */}
      <ConfirmModal
        open={confirmBulk}
        onClose={() => setConfirmBulk(false)}
        onConfirm={() => bulkApprove.mutate([...selected].filter(id => pending.some(o => o.id === id)))}
        title={`Approve ${selectedCount} Orders`}
        message={`Are you sure you want to approve all ${selectedCount} selected orders at once? This will publish all their results.`}
        confirmLabel={`Approve ${selectedCount} Orders`}
        variant="primary"
        loading={bulkApprove.isPending}
      />

      {/* ── Revert modal ─────────────────────────────────────── */}
      <Modal
        open={!!revertOrder}
        onClose={() => { setRevertOrder(null); setRevertRemark('') }}
        title={`Revert Order — ${revertOrder?.receiptNumber ?? revertOrder?.template?.name ?? ''}`}
        subtitle={`${revertOrder?.patient?.fullName ?? ''} · ${revertOrder?.template?.name ?? ''}`}
        size="sm"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => { setRevertOrder(null); setRevertRemark('') }}>Cancel</Button>
            <Button variant="danger" icon={<Undo2 className="h-4 w-4" />}
              loading={revert.isPending} disabled={!revertRemark.trim()}
              onClick={() => revertOrder && revert.mutate({ orderId: revertOrder.id, remark: revertRemark })}>
              Revert &amp; Unlock
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            This will unlock the order so the lab user can correct and re-submit the results.
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={revertRemark}
              onChange={e => setRevertRemark(e.target.value)}
              placeholder="e.g. Haemoglobin value was incorrectly entered"
              rows={3}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 resize-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
            />
          </div>
        </div>
      </Modal>

      {/* ── Reopen confirm ───────────────────────────────────── */}
      <ConfirmModal
        open={!!reopenOrder}
        onClose={() => setReopenOrder(null)}
        onConfirm={() => reopenOrder && reopen.mutate(reopenOrder.id)}
        title="Re-open Order"
        message={`Re-open ${reopenOrder?.receiptNumber ?? reopenOrder?.template?.name ?? 'this order'} for ${reopenOrder?.patient?.fullName ?? ''}? All previously submitted results will be cleared.`}
        confirmLabel="Re-open Order"
        variant="primary"
        loading={reopen.isPending}
      />

      {/* ── Single approve / reject confirm ──────────────────── */}
      <ConfirmModal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (!confirmAction) return
          if (confirmAction.type === 'approve') approve.mutate(confirmAction.order.id)
          else reject.mutate(confirmAction.order.id)
        }}
        title={confirmAction?.type === 'approve' ? 'Approve Order' : 'Reject Order'}
        message={
          confirmAction?.type === 'approve'
            ? `Approve ${confirmAction?.order.receiptNumber ?? confirmAction?.order.template?.name ?? 'this order'}? This will publish the results.`
            : `Reject ${confirmAction?.order.receiptNumber ?? confirmAction?.order.template?.name ?? 'this order'}?`
        }
        confirmLabel={confirmAction?.type === 'approve' ? 'Approve' : 'Reject'}
        variant={confirmAction?.type === 'approve' ? 'primary' : 'danger'}
        loading={approve.isPending || reject.isPending}
      />
    </div>
  )
}
