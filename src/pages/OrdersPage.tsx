import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, ClipboardList, Search, FileText, ChevronDown,
  Trash2, RotateCcw, ExternalLink, Paperclip,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Input'
import { Modal, ConfirmModal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { PageLoader } from '../components/ui/Spinner'
import { OrderStatusBadge } from '../components/ui/Badge'
import { orderService } from '../services/orders'
import type { Order, OrderResult } from '../types'
import { patientService } from '../services/patients'
import { templateService } from '../services/templates'
import { toast } from 'sonner'

// Only show active (non-approved) orders in this page
type StatusFilter = 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'AWAITING_APPROVAL' | 'REJECTED'

export default function OrdersPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [viewResultsModalOpen, setViewResultsModalOpen] = useState(false)
  const [deleteOrder, setDeleteOrder] = useState<Order | null>(null)
  const [reopenOrder, setReopenOrder] = useState<Order | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [orderForm, setOrderForm] = useState({ patientId: '', templateId: '' })
  const [selectedResults, setSelectedResults] = useState<OrderResult | null>(null)

  const { data: orders = [], isLoading } = useQuery({ queryKey: ['orders'], queryFn: orderService.getAll })
  const { data: patients = [] } = useQuery({ queryKey: ['patients'], queryFn: () => patientService.getAll() })
  const { data: templates = [] } = useQuery({ queryKey: ['templates'], queryFn: templateService.getAll })

  const createOrder = useMutation({
    mutationFn: () => orderService.create({
      patientId: Number(orderForm.patientId),
      templateId: Number(orderForm.templateId),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      setOrderForm({ patientId: '', templateId: '' })
      setCreateModalOpen(false)
      toast.success('Diagnostic order created')
    },
    onError: (err: unknown) =>
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create order'),
  })

  const loadOrderResults = useMutation({
    mutationFn: (orderId: number) => orderService.getResults(orderId),
    onSuccess: (data) => {
      setSelectedResults(data)
      setViewResultsModalOpen(true)
    },
    onError: () => toast.error('Failed to load results'),
  })

  const removeOrder = useMutation({
    mutationFn: (id: number) => orderService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      setDeleteOrder(null)
      toast.success('Order deleted')
    },
    onError: () => toast.error('Failed to delete order'),
  })

  const reopenMutation = useMutation({
    mutationFn: (id: number) => orderService.reopen(id),
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      setReopenOrder(null)
      toast.success(`Order #${order.id} reopened — ready for re-entry`)
    },
    onError: () => toast.error('Failed to reopen order'),
  })

  // Exclude APPROVED orders — those live on the Billing page
  const activeOrders = orders.filter(o => o.status !== 'APPROVED')

  const filtered = activeOrders.filter(o => {
    const matchSearch = !search ||
      String(o.id).includes(search) ||
      (o.patient?.fullName ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (o.template?.name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'ALL' || o.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div>
      <Header
        title="Orders & Results"
        subtitle="Create diagnostic orders and enter test results for approval"
        action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateModalOpen(true)}>New Order</Button>}
      />

      <div className="p-6 space-y-5">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by order #, patient, or test..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              className="appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-4 pr-9 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="AWAITING_APPROVAL">Awaiting Approval</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
          <span className="self-center text-sm text-slate-500 ml-auto">
            {filtered.length} order{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {isLoading ? (
          <PageLoader />
        ) : activeOrders.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-12 w-12" />}
            title="No active orders"
            description="Create a new order to start entering test results"
            action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateModalOpen(true)}>Create Order</Button>}
          />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Search className="h-10 w-10" />} title="No orders found" description="Try adjusting your search or filter" />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-[720px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Order</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Patient</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Test</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Status</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Date</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <span className="font-bold text-slate-700">#{order.id}</span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-800">{order.patient?.fullName ?? '—'}</p>
                      <p className="text-xs text-slate-400">{order.patient?.patientCode ?? ''}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-600 max-w-[180px] truncate">
                      {order.template?.name ?? '—'}
                    </td>
                    <td className="px-5 py-4"><OrderStatusBadge status={order.status} /></td>
                    <td className="px-5 py-4 text-xs text-slate-400">
                      {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        {(order.status === 'PENDING' || order.status === 'IN_PROGRESS') && (
                          <Button
                            size="sm" variant="secondary"
                            icon={<ExternalLink className="h-3.5 w-3.5" />}
                            onClick={() => navigate(`/orders/${order.id}/enter-results`)}
                          >
                            Enter Results
                          </Button>
                        )}
                        {order.status === 'AWAITING_APPROVAL' && (
                          <Button
                            size="sm" variant="ghost"
                            icon={<FileText className="h-3.5 w-3.5" />}
                            loading={loadOrderResults.isPending && loadOrderResults.variables === order.id}
                            onClick={() => loadOrderResults.mutate(order.id)}
                          >
                            View Submitted
                          </Button>
                        )}
                        {order.status === 'REJECTED' && (
                          <Button
                            size="sm" variant="secondary"
                            icon={<RotateCcw className="h-3.5 w-3.5" />}
                            onClick={() => setReopenOrder(order)}
                          >
                            Re-open
                          </Button>
                        )}
                        {(order.status === 'PENDING' || order.status === 'REJECTED') && (
                          <Button
                            size="sm" variant="ghost"
                            icon={<Trash2 className="h-3.5 w-3.5 text-rose-500" />}
                            className="text-rose-500 hover:bg-rose-50"
                            onClick={() => setDeleteOrder(order)}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Order Modal */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Diagnostic Order"
        subtitle="Select a patient and test template"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateModalOpen(false)}>Cancel</Button>
            <Button loading={createOrder.isPending} onClick={() => createOrder.mutate()}>Create Order</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Patient" required
            value={orderForm.patientId}
            onChange={e => setOrderForm(p => ({ ...p, patientId: e.target.value }))}
          >
            <option value="">Select a patient</option>
            {patients.map(p => <option key={p.id} value={p.id}>{p.fullName} ({p.patientCode})</option>)}
          </Select>
          <Select
            label="Test Template" required
            value={orderForm.templateId}
            onChange={e => setOrderForm(p => ({ ...p, templateId: e.target.value }))}
          >
            <option value="">Select a test</option>
            {templates.filter(t => t.active).map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
            ))}
          </Select>
        </div>
      </Modal>

      {/* View Submitted Results Modal */}
      <Modal
        open={viewResultsModalOpen}
        onClose={() => setViewResultsModalOpen(false)}
        title={`Submitted Results — Order #${selectedResults?.order.id ?? ''}`}
        subtitle={selectedResults?.order.patient?.fullName}
        size="lg"
        footer={
          <Button variant="secondary" onClick={() => setViewResultsModalOpen(false)}>Close</Button>
        }
      >
        {selectedResults && (
          <div>
            <div className="mb-5 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm">
              <div>
                <span className="text-slate-400 text-xs uppercase tracking-wide">Patient</span>
                <p className="font-semibold text-slate-800 mt-0.5">{selectedResults.order.patient?.fullName ?? '—'}</p>
              </div>
              <div>
                <span className="text-slate-400 text-xs uppercase tracking-wide">Test</span>
                <p className="font-semibold text-slate-800 mt-0.5">{selectedResults.order.template?.name ?? '—'}</p>
              </div>
              <div>
                <span className="text-slate-400 text-xs uppercase tracking-wide">Status</span>
                <div className="mt-0.5"><OrderStatusBadge status={selectedResults.order.status} /></div>
              </div>
              <div>
                <span className="text-slate-400 text-xs uppercase tracking-wide">Date</span>
                <p className="font-medium text-slate-700 mt-0.5">
                  {selectedResults.order.createdAt ? new Date(selectedResults.order.createdAt).toLocaleDateString() : '—'}
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {selectedResults.results.map((result, i) => (
                <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">{result.fieldName}</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">
                    {String(result.value ?? '—')}
                    {result.unit && <span className="ml-1.5 text-sm font-normal text-slate-400">{result.unit}</span>}
                  </p>
                </div>
              ))}
            </div>

            {/* Attached PDF */}
            {selectedResults.order.attachmentName && selectedResults.order.attachmentBase64 && (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
                <Paperclip className="h-4 w-4 shrink-0 text-indigo-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{selectedResults.order.attachmentName}</p>
                  <p className="text-xs text-slate-500">Attached PDF document</p>
                </div>
                <a
                  href={selectedResults.order.attachmentBase64}
                  download={selectedResults.order.attachmentName}
                  className="shrink-0 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                >
                  Download
                </a>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Re-open Confirm */}
      <ConfirmModal
        open={!!reopenOrder}
        onClose={() => setReopenOrder(null)}
        onConfirm={() => reopenOrder && reopenMutation.mutate(reopenOrder.id)}
        title="Re-open Order"
        message={`Re-open Order #${reopenOrder?.id}? All previously submitted results will be cleared and the order returns to Pending so results can be re-entered.`}
        confirmLabel="Re-open Order"
        variant="primary"
        loading={reopenMutation.isPending}
      />

      {/* Delete Confirm */}
      <ConfirmModal
        open={!!deleteOrder}
        onClose={() => setDeleteOrder(null)}
        onConfirm={() => deleteOrder && removeOrder.mutate(deleteOrder.id)}
        title="Delete Order"
        message={`Delete Order #${deleteOrder?.id}? This will permanently remove the order and all submitted results. This cannot be undone.`}
        confirmLabel="Delete Order"
        variant="danger"
        loading={removeOrder.isPending}
      />
    </div>
  )
}
