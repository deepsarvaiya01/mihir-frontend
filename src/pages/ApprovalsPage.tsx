import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, XCircle, FileText, Download, RefreshCw, RotateCcw } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal, ConfirmModal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { PageLoader } from '../components/ui/Spinner'
import { OrderStatusBadge } from '../components/ui/Badge'
import { orderService } from '../services/orders'
import { labSettingsService } from '../services/labSettings'
import { signatureService } from '../services/signatures'
import { generateLabReport } from '../utils/generateReport'
import type { Order, OrderResult } from '../types'
import { toast } from 'sonner'

export default function ApprovalsPage() {
  const qc = useQueryClient()
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [selectedReport, setSelectedReport] = useState<OrderResult | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ type: 'approve' | 'reject'; order: Order } | null>(null)
  const [reopenOrder, setReopenOrder] = useState<Order | null>(null)

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['orders'],
    queryFn: orderService.getAll,
  })

  // Pre-fetch lab settings and signature for PDF generation
  const { data: labSettings = {} } = useQuery({
    queryKey: ['lab-settings'],
    queryFn: labSettingsService.getAll,
  })
  const { data: activeSignature = null } = useQuery({
    queryKey: ['active-signature'],
    queryFn: signatureService.getActive,
  })

  // Loads results and opens review modal (AWAITING_APPROVAL — for approve/reject decision)
  const loadResults = useMutation({
    mutationFn: (orderId: number) => orderService.getResults(orderId),
    onSuccess: (data) => {
      setSelectedReport(data)
      setReportModalOpen(true)
    },
    onError: () => toast.error('Failed to load results'),
  })

  // Downloads PDF directly (APPROVED orders — no modal needed)
  const downloadReport = useMutation({
    mutationFn: (orderId: number) => orderService.getResults(orderId),
    onSuccess: (data) => {
      generateLabReport({
        order: data.order,
        results: data.results.map(r => ({
          fieldName: r.fieldName,
          fieldType: r.fieldType,
          value: r.value,
          unit: r.unit ?? null,
          referenceRange: r.referenceRange ?? null,
          isSectionHeader: r.isSectionHeader ?? false,
        })),
        labSettings,
        signature: activeSignature,
      })
      toast.success('Report downloaded')
    },
    onError: () => toast.error('Failed to generate report'),
  })

  const approve = useMutation({
    mutationFn: (orderId: number) => orderService.approve(orderId),
    onSuccess: (_, orderId) => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] })
      setConfirmAction(null)
      toast.success(`Order #${orderId} approved successfully`)
    },
    onError: () => toast.error('Failed to approve order'),
  })

  const reopen = useMutation({
    mutationFn: (orderId: number) => orderService.reopen(orderId),
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      setReopenOrder(null)
      toast.success(`Order #${order.id} reopened for re-submission`)
    },
    onError: () => toast.error('Failed to reopen order'),
  })

  const reject = useMutation({
    mutationFn: (orderId: number) => orderService.reject(orderId),
    onSuccess: (_, orderId) => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] })
      setConfirmAction(null)
      toast.success(`Order #${orderId} has been rejected`)
    },
    onError: () => toast.error('Failed to reject order'),
  })

  const pending  = orders.filter(o => o.status === 'AWAITING_APPROVAL')
  const reviewed = orders.filter(o => o.status === 'APPROVED' || o.status === 'REJECTED')

  return (
    <div className="flex h-full flex-col">
      <Header
        title="Approval Review"
        subtitle="Review and approve submitted test results"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {pending.length > 0 && (
              <span className="flex h-8 items-center rounded-full bg-amber-100 px-3 text-xs font-semibold text-amber-700">
                {pending.length} pending
              </span>
            )}
            <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={() => refetch()} size="sm">
              Refresh
            </Button>
          </div>
        }
      />

      <div className="space-y-5 p-3 sm:p-5 lg:p-6">
        {isLoading ? (
          <PageLoader />
        ) : (
          <>
            {/* ── Pending approvals ── */}
            <div>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">
                Pending Review ({pending.length})
              </h2>

              {pending.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 className="h-12 w-12" />}
                  title="All caught up!"
                  description="No orders are waiting for your approval right now."
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {pending.map(order => (
                    <Card key={order.id} className="border-amber-200">
                      <div className="mb-4 flex flex-row items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">Order #{order.id}</span>
                          </div>
                          <p className="mt-1 text-sm font-medium text-slate-700">{order.patient?.fullName ?? '—'}</p>
                          <p className="text-xs text-slate-500">{order.template?.name ?? '—'}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {order.createdAt ? new Date(order.createdAt).toLocaleString() : ''}
                          </p>
                        </div>
                        <OrderStatusBadge status={order.status} />
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                        {/* Review button opens the modal (needed to see results before deciding) */}
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<FileText className="h-3.5 w-3.5" />}
                          loading={loadResults.isPending && loadResults.variables === order.id}
                          onClick={() => loadResults.mutate(order.id)}
                        >
                          Review
                        </Button>

                        <Button
                          size="sm"
                          variant="success"
                          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                          onClick={() => setConfirmAction({ type: 'approve', order })}
                        >
                          Approve
                        </Button>

                        <Button
                          size="sm"
                          variant="danger"
                          icon={<XCircle className="h-3.5 w-3.5" />}
                          onClick={() => setConfirmAction({ type: 'reject', order })}
                        >
                          Reject
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* ── Reviewed orders ── */}
            {reviewed.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">
                  Recently Reviewed ({reviewed.length})
                </h2>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="w-full overflow-x-auto">
                    <table className="min-w-[750px] w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Order</th>
                          <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Patient</th>
                          <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Test</th>
                          <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Status</th>
                          <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {reviewed.map(order => (
                          <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="whitespace-nowrap px-5 py-4 align-middle font-bold text-slate-700">#{order.id}</td>
                            <td className="px-5 py-4 align-middle">
                              <p className="font-medium text-slate-800">{order.patient?.fullName ?? '—'}</p>
                              <p className="text-xs text-slate-400">{order.patient?.patientCode ?? ''}</p>
                            </td>
                            <td className="whitespace-nowrap px-5 py-4 align-middle text-slate-600">{order.template?.name ?? '—'}</td>
                            <td className="px-5 py-4 align-middle"><OrderStatusBadge status={order.status} /></td>
                            <td className="px-5 py-4 align-middle text-right">
                              <div className="flex flex-wrap justify-end gap-2">
                                {order.status === 'APPROVED' && (
                                  // Direct PDF download — no preview modal
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    icon={<Download className="h-3.5 w-3.5" />}
                                    loading={downloadReport.isPending && downloadReport.variables === order.id}
                                    onClick={() => downloadReport.mutate(order.id)}
                                  >
                                    Report
                                  </Button>
                                )}
                                {order.status === 'REJECTED' && (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    icon={<RotateCcw className="h-3.5 w-3.5" />}
                                    onClick={() => setReopenOrder(order)}
                                  >
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

      {/* Review modal — AWAITING_APPROVAL only (for approve / reject decision) */}
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
                <Button
                  variant="danger"
                  icon={<XCircle className="h-4 w-4" />}
                  onClick={() => {
                    setReportModalOpen(false)
                    setConfirmAction({ type: 'reject', order: selectedReport.order })
                  }}
                >
                  Reject
                </Button>
                <Button
                  variant="success"
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  onClick={() => {
                    setReportModalOpen(false)
                    setConfirmAction({ type: 'approve', order: selectedReport.order })
                  }}
                >
                  Approve
                </Button>
              </>
            )}
          </div>
        }
      >
        {selectedReport && (
          <div>
            <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
              <div>
                <span className="text-slate-400">Patient:</span>{' '}
                <span className="font-medium text-slate-800">{selectedReport.order.patient?.fullName ?? '—'}</span>
              </div>
              <div>
                <span className="text-slate-400">Code:</span>{' '}
                <span className="font-mono text-slate-700">{selectedReport.order.patient?.patientCode ?? '—'}</span>
              </div>
              <div>
                <span className="text-slate-400">Test:</span>{' '}
                <span className="font-medium text-slate-800">{selectedReport.order.template?.name ?? '—'}</span>
              </div>
              <div>
                <span className="text-slate-400">Status:</span>{' '}
                <OrderStatusBadge status={selectedReport.order.status} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {selectedReport.results
                .filter(r => !r.isSectionHeader)
                .map((result, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-400">{result.fieldName}</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">
                      {String(result.value ?? '—')}
                      {result.unit && (
                        <span className="ml-1.5 text-sm font-normal text-slate-400">{result.unit}</span>
                      )}
                    </p>
                    {result.referenceRange && (
                      <p className="mt-0.5 text-xs text-slate-400">Ref: {result.referenceRange}</p>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Reopen Order */}
      <ConfirmModal
        open={!!reopenOrder}
        onClose={() => setReopenOrder(null)}
        onConfirm={() => reopenOrder && reopen.mutate(reopenOrder.id)}
        title="Re-open Order"
        message={`Re-open Order #${reopenOrder?.id} for ${reopenOrder?.patient?.fullName ?? ''}? All previously submitted results will be cleared and the lab user can re-enter them.`}
        confirmLabel="Re-open Order"
        variant="primary"
        loading={reopen.isPending}
      />

      {/* Confirm Approve / Reject */}
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
            ? `Are you sure you want to approve Order #${confirmAction?.order.id}? This will publish the results.`
            : `Are you sure you want to reject Order #${confirmAction?.order.id}?`
        }
        confirmLabel={confirmAction?.type === 'approve' ? 'Approve' : 'Reject'}
        variant={confirmAction?.type === 'approve' ? 'primary' : 'danger'}
        loading={approve.isPending || reject.isPending}
      />
    </div>
  )
}
