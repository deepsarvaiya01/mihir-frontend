import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2, XCircle, FileText, Download, RefreshCw,
  RotateCcw, Undo2, LayoutGrid, List, CheckSquare, Square,
  Minus,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { Modal, ConfirmModal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { PageLoader } from '../components/ui/Spinner'
import { OrderStatusBadge } from '../components/ui/Badge'
import { orderService } from '../services/orders'
import { labSettingsService } from '../services/labSettings'
import { signatureService } from '../services/signatures'
import { logoService } from '../services/logos'
import { generateLabReport, generateLabReportBase64, generateReportBase64 } from '../utils/generateReport'
import type { Order, OrderResult } from '../types'
import { toast } from 'sonner'
import { toastError } from '../lib/errors'

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
            Order #{order.id}
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
export default function ApprovalsPage() {
  const qc = useQueryClient()

  const [viewMode, setViewMode] = useState<ViewMode>(getStoredView)
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
  const { data: activeSignature = null } = useQuery({ queryKey: ['active-signature'], queryFn: signatureService.getActive })
  const { data: activeLogo = null } = useQuery({ queryKey: ['logos', 'active'], queryFn: logoService.getActive })

  const pending  = orders.filter(o => o.status === 'AWAITING_APPROVAL')
  const reviewed = orders.filter(o => o.status === 'APPROVED' || o.status === 'REJECTED')

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
        })),
        labSettings, signature: activeSignature, activeLogo,
      }).then(() => toast.success('Report downloaded')).catch(() => toast.error('Failed to generate report'))
    },
    onError: (err) => toastError(err, 'Failed to generate report'),
  })

  const approve = useMutation({
    mutationFn: async (orderId: number) => {
      let pdfBase64: string | undefined
      let plainPdfBase64: string | undefined
      try {
        const { order: orderData, results } = await orderService.getResults(orderId)
        const reportOpts = {
          order: orderData,
          results: results.map(r => ({
            fieldName: r.fieldName,
            fieldType: r.fieldType,
            value: r.value,
            unit: r.unit ?? null,
            referenceRange: r.referenceRange ?? null,
            isSectionHeader: r.isSectionHeader ?? false,
          })),
          labSettings,
          signature: activeSignature,
          activeLogo,
        }
        ;[pdfBase64, plainPdfBase64] = await Promise.all([
          generateLabReportBase64(reportOpts).catch(() => undefined),
          generateReportBase64(reportOpts).catch(() => undefined),
        ])
      } catch { /* PDF generation failure must not block approval */ }
      return orderService.approve(orderId, pdfBase64, plainPdfBase64)
    },
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
    onSuccess: (order) => { qc.invalidateQueries({ queryKey: ['orders'] }); setReopenOrder(null); toast.success(`Order #${order.id} reopened`) },
    onError: (err) => toastError(err, 'Failed to reopen order'),
  })

  const revert = useMutation({
    mutationFn: ({ orderId, remark }: { orderId: number; remark: string }) => orderService.revert(orderId, remark),
    onSuccess: (order) => { qc.invalidateQueries({ queryKey: ['orders'] }); setRevertOrder(null); setRevertRemark(''); toast.success(`Order #${order.id} reverted`) },
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
            {pending.length > 0 && (
              <span className="flex h-8 items-center rounded-full bg-amber-100 px-3 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                {pending.length} pending
              </span>
            )}
            {/* View toggle */}
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
            <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={() => refetch()} size="sm">
              Refresh
            </Button>
          </div>
        }
      />

      {/* Bulk action bar */}
      {selectedCount > 0 && (
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
            <div>
              <div className="mb-4 flex items-center gap-3">
                {/* Select-all checkbox */}
                {pending.length > 0 && (
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={toggleAll}
                  />
                )}
                <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">Pending Review</h2>
                {pending.length > 0 && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                    {pending.length}
                  </span>
                )}
              </div>

              {pending.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 className="h-12 w-12" />}
                  title="All caught up!"
                  description="No orders are waiting for your approval right now."
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
                              #{order.id}
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

            {/* ── Reviewed section ─────────────────────────────── */}
            {reviewed.length > 0 && (
              <div>
                <div className="mb-4 flex items-center gap-3">
                  <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">Recently Reviewed</h2>
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                    {reviewed.length}
                  </span>
                </div>

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
                            <td className="whitespace-nowrap px-5 py-4 font-bold text-gray-700 dark:text-gray-300">#{order.id}</td>
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
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Review modal ──────────────────────────────────────── */}
      <Modal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        title={`Test Results — Order #${selectedReport?.order.id ?? ''}`}
        subtitle={`${selectedReport?.order.patient?.fullName ?? ''} · ${selectedReport?.order.template?.name ?? ''}`}
        size="lg"
        footer={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" onClick={() => setReportModalOpen(false)}>Close</Button>
            {selectedReport?.order.status === 'AWAITING_APPROVAL' && (
              <>
                <Button variant="danger" icon={<XCircle className="h-4 w-4" />}
                  onClick={() => { setReportModalOpen(false); setConfirmAction({ type: 'reject', order: selectedReport.order }) }}>
                  Reject
                </Button>
                <Button variant="success" icon={<CheckCircle2 className="h-4 w-4" />}
                  onClick={() => { setReportModalOpen(false); setConfirmAction({ type: 'approve', order: selectedReport.order }) }}>
                  Approve
                </Button>
              </>
            )}
          </div>
        }
      >
        {selectedReport && (
          <div>
            <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl bg-gray-50 p-4 text-sm sm:grid-cols-2 dark:bg-gray-900/50">
              <div><span className="text-gray-400">Patient:</span>{' '}<span className="font-medium text-gray-800 dark:text-gray-200">{selectedReport.order.patient?.fullName ?? '—'}</span></div>
              <div><span className="text-gray-400">Code:</span>{' '}<span className="font-mono text-gray-700 dark:text-gray-300">{selectedReport.order.patient?.patientCode ?? '—'}</span></div>
              <div><span className="text-gray-400">Test:</span>{' '}<span className="font-medium text-gray-800 dark:text-gray-200">{selectedReport.order.template?.name ?? '—'}</span></div>
              <div><span className="text-gray-400">Status:</span>{' '}<OrderStatusBadge status={selectedReport.order.status} /></div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {selectedReport.results.filter(r => !r.isSectionHeader).map((result, i) => (
                <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/50">
                  <p className="text-xs uppercase tracking-wide text-gray-400">{result.fieldName}</p>
                  <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
                    {String(result.value ?? '—')}
                    {result.unit && <span className="ml-1.5 text-sm font-normal text-gray-400">{result.unit}</span>}
                  </p>
                  {result.referenceRange && <p className="mt-0.5 text-xs text-gray-400">Ref: {result.referenceRange}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

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
        title={`Revert Order #${revertOrder?.id ?? ''}`}
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
        message={`Re-open Order #${reopenOrder?.id} for ${reopenOrder?.patient?.fullName ?? ''}? All previously submitted results will be cleared.`}
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
            ? `Approve Order #${confirmAction?.order.id}? This will publish the results.`
            : `Reject Order #${confirmAction?.order.id}?`
        }
        confirmLabel={confirmAction?.type === 'approve' ? 'Approve' : 'Reject'}
        variant={confirmAction?.type === 'approve' ? 'primary' : 'danger'}
        loading={approve.isPending || reject.isPending}
      />
    </div>
  )
}
