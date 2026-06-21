import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, ClipboardList, Search, FileText, ChevronDown,
  Trash2, RotateCcw, ExternalLink, Paperclip, FlaskConical,
  X, CheckSquare, SendHorizonal, Receipt,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { Modal, ConfirmModal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { PageLoader } from '../components/ui/Spinner'
import { OrderStatusBadge } from '../components/ui/Badge'
import { orderService } from '../services/orders'
import type { Order, OrderResult, PaymentStatus, PaymentType } from '../types'
import { patientService } from '../services/patients'
import { templateService } from '../services/templates'
import { toast } from 'sonner'

type StatusFilter = 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'AWAITING_APPROVAL' | 'REJECTED'

interface BatchForm {
  patientId: string
  selectedIds: number[]
  discount: string
  paymentStatus: PaymentStatus | ''
  paymentType: PaymentType | ''
}

const EMPTY_BATCH: BatchForm = {
  patientId: '',
  selectedIds: [],
  discount: '',
  paymentStatus: '',
  paymentType: '',
}

export default function OrdersPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [createOpen, setCreateOpen] = useState(false)
  const [viewResultsOpen, setViewResultsOpen] = useState(false)
  const [deleteOrder, setDeleteOrder] = useState<Order | null>(null)
  const [reopenOrder, setReopenOrder] = useState<Order | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [selectedResults, setSelectedResults] = useState<OrderResult | null>(null)

  // Create modal state
  const [batchForm, setBatchForm] = useState<BatchForm>(EMPTY_BATCH)
  const [patientSearch, setPatientSearch] = useState('')
  const [testSearch, setTestSearch] = useState('')

  const { data: orders = [], isLoading } = useQuery({ queryKey: ['orders'], queryFn: orderService.getAll })
  const { data: patients = [] } = useQuery({ queryKey: ['patients'], queryFn: () => patientService.getAll() })
  const { data: templates = [] } = useQuery({ queryKey: ['templates'], queryFn: templateService.getAll })

  const activeTemplates = templates.filter(t => t.active)

  // Filtered lists for the create modal
  const filteredPatients = useMemo(() =>
    patientSearch
      ? patients.filter(p =>
          p.fullName.toLowerCase().includes(patientSearch.toLowerCase()) ||
          p.patientCode.toLowerCase().includes(patientSearch.toLowerCase()) ||
          (p.phoneNumber ?? '').includes(patientSearch)
        )
      : patients,
    [patients, patientSearch]
  )

  const filteredTests = useMemo(() =>
    testSearch
      ? activeTemplates.filter(t =>
          t.name.toLowerCase().includes(testSearch.toLowerCase()) ||
          t.code.toLowerCase().includes(testSearch.toLowerCase())
        )
      : activeTemplates,
    [activeTemplates, testSearch]
  )

  // Total amount for selected tests
  const selectedTemplates = useMemo(
    () => activeTemplates.filter(t => batchForm.selectedIds.includes(t.id)),
    [activeTemplates, batchForm.selectedIds]
  )
  const subtotal = selectedTemplates.reduce((s, t) => s + Number(t.amount ?? 0), 0)
  const discountPct = parseFloat(batchForm.discount) || 0
  const total = Math.round(subtotal * (1 - discountPct / 100) * 100) / 100

  const toggleTest = (id: number) => {
    setBatchForm(prev => ({
      ...prev,
      selectedIds: prev.selectedIds.includes(id)
        ? prev.selectedIds.filter(x => x !== id)
        : [...prev.selectedIds, id],
    }))
  }

  const openCreate = () => {
    setBatchForm(EMPTY_BATCH)
    setPatientSearch('')
    setTestSearch('')
    setCreateOpen(true)
  }

  // ── Create batch orders ──────────────────────────────────
  const createBatch = useMutation({
    mutationFn: () => {
      if (!batchForm.patientId) throw new Error('Select a patient')
      if (batchForm.selectedIds.length === 0) throw new Error('Select at least one test')
      return orderService.createBatch({
        patientId: Number(batchForm.patientId),
        orders: batchForm.selectedIds.map(id => ({ templateId: id })),
        discount: discountPct || undefined,
        paymentStatus: (batchForm.paymentStatus || undefined) as PaymentStatus | undefined,
        paymentType: (batchForm.paymentType || undefined) as PaymentType | undefined,
      })
    },
    onSuccess: ({ orders: created, receiptNumber }) => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      setCreateOpen(false)
      toast.success(
        `${created.length} order${created.length > 1 ? 's' : ''} created${receiptNumber ? ` · Receipt ${receiptNumber}` : ''}`
      )
    },
    onError: (err: unknown) => {
      const msg = (err as { message?: string; response?: { data?: { message?: string } } })
        ?.response?.data?.message
        ?? (err as { message?: string })?.message
        ?? 'Failed to create orders'
      toast.error(msg)
    },
  })

  // ── Load submitted results ───────────────────────────────
  const loadOrderResults = useMutation({
    mutationFn: (orderId: number) => orderService.getResults(orderId),
    onSuccess: (data) => { setSelectedResults(data); setViewResultsOpen(true) },
    onError: () => toast.error('Failed to load results'),
  })

  const removeOrder = useMutation({
    mutationFn: (id: number) => orderService.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); setDeleteOrder(null); toast.success('Order deleted') },
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

  const batchSubmitMut = useMutation({
    mutationFn: (receiptNumber: string) => orderService.batchSubmit(receiptNumber),
    onSuccess: ({ count }) => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      toast.success(`${count} test${count !== 1 ? 's' : ''} submitted for approval`)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to submit batch'
      toast.error(msg)
    },
  })

  const activeOrders = orders.filter(o => o.status !== 'APPROVED')
  const filtered = activeOrders.filter(o => {
    const matchSearch = !search ||
      String(o.id).includes(search) ||
      (o.patient?.fullName ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (o.template?.name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'ALL' || o.status === statusFilter
    return matchSearch && matchStatus
  })

  // Map receipt → all active orders in that receipt (used for batch-submit eligibility)
  const receiptMap = useMemo(() => {
    const map = new Map<string, Order[]>()
    for (const o of activeOrders) {
      if (!o.receiptNumber) continue
      const g = map.get(o.receiptNumber) ?? []
      g.push(o)
      map.set(o.receiptNumber, g)
    }
    return map
  }, [activeOrders])

  // Build flat list of rows: group-header rows + individual order rows
  const tableRows = useMemo(() => {
    type Row =
      | { kind: 'group'; receipt: string; patient: string; totalTests: number }
      | { kind: 'order'; order: Order; grouped: boolean }

    const rows: Row[] = []
    let lastReceipt: string | null = null

    // Sort: receipts together, then by id desc
    const sorted = [...filtered].sort((a, b) => {
      if (a.receiptNumber && b.receiptNumber && a.receiptNumber !== b.receiptNumber)
        return a.receiptNumber.localeCompare(b.receiptNumber)
      if (a.receiptNumber && !b.receiptNumber) return -1
      if (!a.receiptNumber && b.receiptNumber) return 1
      return b.id - a.id
    })

    for (const order of sorted) {
      const receipt = order.receiptNumber
      const groupOrders = receipt ? receiptMap.get(receipt) ?? [] : []
      const isMultiGroup = groupOrders.length > 1

      if (isMultiGroup && receipt && receipt !== lastReceipt) {
        rows.push({
          kind: 'group',
          receipt,
          patient: order.patient?.fullName ?? '—',
          totalTests: groupOrders.length,
        })
        lastReceipt = receipt
      } else if (!isMultiGroup) {
        lastReceipt = null
      }
      rows.push({ kind: 'order', order, grouped: isMultiGroup })
    }
    return rows
  }, [filtered, receiptMap])

  const canSubmitBatch = (receipt: string) => {
    const g = receiptMap.get(receipt) ?? []
    return g.length > 1 && g.every(o => o.status === 'IN_PROGRESS')
  }

  return (
    <div>
      <Header
        title="Orders & Results"
        subtitle="Create diagnostic orders and enter test results for approval"
        action={<Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>New Order</Button>}
      />

      <div className="p-6 space-y-5">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by order #, patient, or test..."
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div className="relative">
            <select
              value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              className="appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-4 pr-9 text-sm text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="AWAITING_APPROVAL">Awaiting Approval</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
          <span className="self-center text-sm text-gray-500 ml-auto">
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
            action={<Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Create Order</Button>}
          />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Search className="h-10 w-10" />} title="No orders found" description="Try adjusting your search or filter" />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-[720px] w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Order</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Patient</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Test</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Status</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Date</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tableRows.map((row, idx) => {
                  if (row.kind === 'group') {
                    const ready = canSubmitBatch(row.receipt)
                    return (
                      <tr key={`grp-${row.receipt}`} className="bg-blue-50/60 border-y border-blue-100">
                        <td colSpan={5} className="px-5 py-3">
                          <div className="flex items-center gap-2 text-sm">
                            <Receipt className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                            <span className="font-semibold text-blue-700 font-mono">{row.receipt}</span>
                            <span className="text-gray-500">·</span>
                            <span className="font-medium text-gray-700">{row.patient}</span>
                            <span className="text-gray-400 text-xs">({row.totalTests} tests)</span>
                            {!ready && (
                              <span className="ml-2 text-xs text-gray-400 italic">Enter results for all tests, then submit</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right">
                          {ready && (
                            <Button
                              size="sm"
                              icon={<SendHorizonal className="h-3.5 w-3.5" />}
                              loading={batchSubmitMut.isPending && batchSubmitMut.variables === row.receipt}
                              onClick={() => batchSubmitMut.mutate(row.receipt)}
                            >
                              Submit All for Approval
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  }

                  const order = row.order
                  return (
                    <tr key={order.id} className={`hover:bg-gray-50/50 transition-colors ${row.grouped ? 'bg-white' : ''}`}>
                      <td className={`px-5 py-4 ${row.grouped ? 'pl-9' : ''}`}>
                        <span className="font-bold text-gray-700">#{order.id}</span>
                      </td>
                      <td className="px-5 py-4">
                        {!row.grouped && (
                          <>
                            <p className="font-medium text-gray-800">{order.patient?.fullName ?? '—'}</p>
                            <p className="text-xs text-gray-400">{order.patient?.patientCode ?? ''}</p>
                          </>
                        )}
                        {row.grouped && (
                          <p className="text-xs text-gray-400">{order.patient?.patientCode ?? ''}</p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-gray-600 max-w-[180px] truncate">{order.template?.name ?? '—'}</td>
                      <td className="px-5 py-4"><OrderStatusBadge status={order.status} /></td>
                      <td className="px-5 py-4 text-xs text-gray-400">
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          {(order.status === 'PENDING' || order.status === 'IN_PROGRESS') && (
                            <Button size="sm" variant="secondary" icon={<ExternalLink className="h-3.5 w-3.5" />}
                              onClick={() => navigate(`/orders/${order.id}/enter-results`)}>
                              Enter Results
                            </Button>
                          )}
                          {order.status === 'AWAITING_APPROVAL' && (
                            <Button size="sm" variant="ghost" icon={<FileText className="h-3.5 w-3.5" />}
                              loading={loadOrderResults.isPending && loadOrderResults.variables === order.id}
                              onClick={() => loadOrderResults.mutate(order.id)}>
                              View Submitted
                            </Button>
                          )}
                          {order.status === 'REJECTED' && (
                            <Button size="sm" variant="secondary" icon={<RotateCcw className="h-3.5 w-3.5" />}
                              onClick={() => setReopenOrder(order)}>
                              Re-open
                            </Button>
                          )}
                          {(order.status === 'PENDING' || order.status === 'REJECTED') && (
                            <Button size="sm" variant="ghost"
                              icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />}
                              className="text-red-500 hover:bg-red-50"
                              onClick={() => setDeleteOrder(order)}>
                              Delete
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create Order Modal (multi-test batch) ────────────── */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Diagnostic Orders"
        subtitle="Select a patient and one or more tests"
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              loading={createBatch.isPending}
              disabled={!batchForm.patientId || batchForm.selectedIds.length === 0}
              icon={<CheckSquare className="h-4 w-4" />}
              onClick={() => createBatch.mutate()}
            >
              Create {batchForm.selectedIds.length > 0 ? `${batchForm.selectedIds.length} ` : ''}Order{batchForm.selectedIds.length !== 1 ? 's' : ''}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Patient selector with search */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Patient <span className="text-red-500">*</span>
            </label>
            <div className="relative mb-1.5">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                value={patientSearch} onChange={e => setPatientSearch(e.target.value)}
                placeholder="Search by name, code or phone..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-8 pr-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <select
              value={batchForm.patientId}
              onChange={e => setBatchForm(p => ({ ...p, patientId: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
              size={Math.min(5, Math.max(2, filteredPatients.length))}
            >
              {filteredPatients.length === 0
                ? <option disabled>No patients match</option>
                : filteredPatients.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} ({p.patientCode}){p.phoneNumber ? ` · ${p.phoneNumber}` : ''}
                    </option>
                  ))
              }
            </select>
          </div>

          {/* Test catalogue + summary side-by-side */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

            {/* Left: test catalogue */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Select Tests <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  value={testSearch} onChange={e => setTestSearch(e.target.value)}
                  placeholder="Search tests..."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-8 pr-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100">
                {filteredTests.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-400">No active tests found</div>
                ) : filteredTests.map(t => {
                  const checked = batchForm.selectedIds.includes(t.id)
                  return (
                    <label
                      key={t.id}
                      className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors ${
                        checked ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox" checked={checked}
                        onChange={() => toggleTest(t.id)}
                        className="h-4 w-4 rounded accent-blue-600 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-800">{t.name}</p>
                        <p className="text-xs text-gray-400">{t.code}</p>
                      </div>
                      {Number(t.amount) > 0 && (
                        <span className="shrink-0 text-sm font-semibold text-gray-700">
                          ₹{Number(t.amount).toLocaleString()}
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
              {batchForm.selectedIds.length > 0 && (
                <button
                  className="self-start text-xs text-gray-400 hover:text-red-500"
                  onClick={() => setBatchForm(p => ({ ...p, selectedIds: [] }))}
                >
                  Clear selection
                </button>
              )}
            </div>

            {/* Right: order summary + payment */}
            <div className="flex flex-col gap-4">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Order Summary
              </label>

              {batchForm.selectedIds.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 px-4 py-10 text-center">
                  <FlaskConical className="mb-2 h-8 w-8 text-gray-300" />
                  <p className="text-sm text-gray-400">Select tests on the left</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {/* Selected tests list */}
                  <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                    {selectedTemplates.map(t => (
                      <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-800">{t.name}</p>
                          <p className="text-xs text-gray-400">{t.code}</p>
                        </div>
                        <span className="shrink-0 text-sm text-gray-600">
                          ₹{Number(t.amount).toLocaleString()}
                        </span>
                        <button onClick={() => toggleTest(t.id)} className="shrink-0 text-gray-300 hover:text-red-400">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Discount */}
                  <div className="flex items-center gap-3">
                    <label className="shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Discount %
                    </label>
                    <input
                      type="number" min="0" max="100" step="1" placeholder="0"
                      value={batchForm.discount}
                      onChange={e => setBatchForm(p => ({ ...p, discount: e.target.value }))}
                      className="w-20 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-right outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  {/* Total */}
                  <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                    <div>
                      {discountPct > 0 && (
                        <p className="text-xs text-gray-400 line-through">₹{subtotal.toLocaleString()}</p>
                      )}
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Total</p>
                    </div>
                    <span className="text-xl font-bold text-blue-800">₹{total.toLocaleString()}</span>
                  </div>

                  {/* Payment status */}
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Payment Status</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['', 'PENDING', 'PAID'] as const).map(s => (
                        <button key={s}
                          onClick={() => setBatchForm(p => ({ ...p, paymentStatus: s as PaymentStatus | '' }))}
                          className={`rounded-xl border py-2 text-xs font-semibold transition-all ${
                            batchForm.paymentStatus === s
                              ? s === 'PAID'
                                ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                                : 'border-blue-400 bg-blue-50 text-blue-700'
                              : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                          }`}
                        >
                          {s === '' ? 'Default' : s.charAt(0) + s.slice(1).toLowerCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Payment method */}
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Payment Method</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(['', 'CASH', 'CHEQUE', 'ONLINE'] as const).map(m => (
                        <button key={m}
                          onClick={() => setBatchForm(p => ({ ...p, paymentType: m as PaymentType | '' }))}
                          className={`rounded-xl border py-2 text-xs font-semibold transition-all ${
                            batchForm.paymentType === m
                              ? 'border-blue-400 bg-blue-50 text-blue-700'
                              : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                          }`}
                        >
                          {m === '' ? 'None' : m.charAt(0) + m.slice(1).toLowerCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* View Submitted Results Modal */}
      <Modal
        open={viewResultsOpen}
        onClose={() => setViewResultsOpen(false)}
        title={`Submitted Results — Order #${selectedResults?.order.id ?? ''}`}
        subtitle={selectedResults?.order.patient?.fullName}
        size="lg"
        footer={<Button variant="secondary" onClick={() => setViewResultsOpen(false)}>Close</Button>}
      >
        {selectedResults && (
          <div>
            <div className="mb-5 grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-4 text-sm">
              <div>
                <span className="text-gray-400 text-xs uppercase tracking-wide">Patient</span>
                <p className="font-semibold text-gray-800 mt-0.5">{selectedResults.order.patient?.fullName ?? '—'}</p>
              </div>
              <div>
                <span className="text-gray-400 text-xs uppercase tracking-wide">Test</span>
                <p className="font-semibold text-gray-800 mt-0.5">{selectedResults.order.template?.name ?? '—'}</p>
              </div>
              <div>
                <span className="text-gray-400 text-xs uppercase tracking-wide">Status</span>
                <div className="mt-0.5"><OrderStatusBadge status={selectedResults.order.status} /></div>
              </div>
              <div>
                <span className="text-gray-400 text-xs uppercase tracking-wide">Date</span>
                <p className="font-medium text-gray-700 mt-0.5">
                  {selectedResults.order.createdAt ? new Date(selectedResults.order.createdAt).toLocaleDateString() : '—'}
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {selectedResults.results.filter(r => !r.isSectionHeader).map((result, i) => (
                <div key={i} className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">{result.fieldName}</p>
                  <p className="mt-1 text-xl font-bold text-gray-900">
                    {String(result.value ?? '—')}
                    {result.unit && <span className="ml-1.5 text-sm font-normal text-gray-400">{result.unit}</span>}
                  </p>
                  {result.referenceRange && (
                    <p className="mt-0.5 text-xs text-gray-400">Ref: {result.referenceRange}</p>
                  )}
                </div>
              ))}
            </div>
            {selectedResults.order.attachmentName && selectedResults.order.attachmentBase64 && (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                <Paperclip className="h-4 w-4 shrink-0 text-blue-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-800">{selectedResults.order.attachmentName}</p>
                  <p className="text-xs text-gray-500">Attached PDF document</p>
                </div>
                <a href={selectedResults.order.attachmentBase64} download={selectedResults.order.attachmentName}
                  className="shrink-0 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100">
                  Download
                </a>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Re-open Confirm */}
      <ConfirmModal
        open={!!reopenOrder} onClose={() => setReopenOrder(null)}
        onConfirm={() => reopenOrder && reopenMutation.mutate(reopenOrder.id)}
        title="Re-open Order"
        message={`Re-open Order #${reopenOrder?.id}? All previously submitted results will be cleared and the order returns to Pending.`}
        confirmLabel="Re-open Order" variant="primary" loading={reopenMutation.isPending}
      />

      {/* Delete Confirm */}
      <ConfirmModal
        open={!!deleteOrder} onClose={() => setDeleteOrder(null)}
        onConfirm={() => deleteOrder && removeOrder.mutate(deleteOrder.id)}
        title="Delete Order"
        message={`Delete Order #${deleteOrder?.id}? This will permanently remove the order and all submitted results.`}
        confirmLabel="Delete Order" variant="danger" loading={removeOrder.isPending}
      />
    </div>
  )
}

