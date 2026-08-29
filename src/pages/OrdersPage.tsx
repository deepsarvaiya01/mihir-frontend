import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, ClipboardList, Search, FileText, ChevronDown,
  Trash2, RotateCcw, ExternalLink, Paperclip, FlaskConical,
  X, CheckSquare, SendHorizonal, User, Check, Banknote, Landmark, Smartphone, Barcode,
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
import { profileService } from '../services/profiles'
import { toast } from 'sonner'
import { toastError } from '../lib/errors'
import { formatAge } from '../lib/utils'
import { printTubeLabels } from '../utils/generateReport'

/** B2B column cell — shows the referring B2B lab name, or "—" if the patient isn't a B2B referral. */
function B2bCell({ patient }: { patient?: { isB2b?: boolean; b2bLab?: { name: string } | null } | null }) {
  if (!patient?.isB2b) return <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
  return <span className="text-sm text-violet-700 dark:text-violet-400">{patient.b2bLab?.name ?? 'B2B'}</span>
}

/** Status column for a collapsed receipt row — one badge if every test shares a status, otherwise one badge per distinct status with a count. */
function GroupStatusSummary({ orders }: { orders: Order[] }) {
  const statuses = Array.from(new Set(orders.map(o => o.status)))
  if (statuses.length === 1) return <OrderStatusBadge status={statuses[0]} />
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {statuses.map(s => (
        <span key={s} className="inline-flex items-center gap-1">
          <OrderStatusBadge status={s} />
          <span className="text-[10px] text-gray-400">×{orders.filter(o => o.status === s).length}</span>
        </span>
      ))}
    </div>
  )
}

function formatDateTime(iso?: string | null) {
  if (!iso) return { date: '—', time: '' }
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  return { date, time }
}

type StatusFilter = 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'AWAITING_APPROVAL' | 'REJECTED'

interface BatchForm {
  patientId: string
  selectedItems: Array<{ kind: 'template' | 'profile'; id: number }>
  discount: string
  paymentStatus: PaymentStatus
  paymentType: PaymentType
}

const EMPTY_BATCH: BatchForm = {
  patientId: '',
  selectedItems: [],
  discount: '',
  paymentStatus: 'PENDING',
  paymentType: 'CASH',
}

const TODAY = new Date().toISOString().split('T')[0]

export default function OrdersPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [createOpen, setCreateOpen] = useState(false)
  const [viewResultsOpen, setViewResultsOpen] = useState(false)
  const [deleteOrder, setDeleteOrder] = useState<Order | null>(null)
  const [deleteGroupOrders, setDeleteGroupOrders] = useState<Order[] | null>(null)
  const [reopenOrder, setReopenOrder] = useState<Order | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [dateFrom, setDateFrom] = useState(TODAY)
  const [dateTo, setDateTo]     = useState('')
  const [templateFilter, setTemplateFilter] = useState('')
  const [selectedResults, setSelectedResults] = useState<OrderResult | null>(null)
  const [testsModalOrders, setTestsModalOrders] = useState<Order[] | null>(null)

  // Create modal state
  const [batchForm, setBatchForm] = useState<BatchForm>(EMPTY_BATCH)
  const [patientSearch, setPatientSearch] = useState('')
  const [testSearch, setTestSearch] = useState('')

  const { data: orders = [], isLoading } = useQuery({ queryKey: ['orders'], queryFn: orderService.getAll })
  const { data: patients = [] } = useQuery({ queryKey: ['patients'], queryFn: () => patientService.getAll() })
  const { data: templates = [] } = useQuery({ queryKey: ['templates'], queryFn: templateService.getAll })
  const { data: profiles = [] } = useQuery({ queryKey: ['profiles'], queryFn: profileService.getAll })

  const activeTemplates = templates.filter(t => t.active)
  const activeProfiles = profiles.filter(p => p.active)

  // Profiles (packages) listed first, then individual tests — one combined, searchable list.
  const pickableItems = useMemo(() => [
    ...activeProfiles.map(p => ({ kind: 'profile' as const, id: p.id, name: p.name, code: p.code, price: Number(p.amount), testCount: p.templates.length })),
    ...activeTemplates.map(t => ({ kind: 'template' as const, id: t.id, name: t.name, code: t.code, price: Number(t.amount ?? 0), testCount: null as number | null })),
  ], [activeProfiles, activeTemplates])

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
      ? pickableItems.filter(it =>
          it.name.toLowerCase().includes(testSearch.toLowerCase()) ||
          it.code.toLowerCase().includes(testSearch.toLowerCase())
        )
      : pickableItems,
    [pickableItems, testSearch]
  )

  // Total amount for selected items
  const selectedTemplates = useMemo(
    () => pickableItems.filter(it => batchForm.selectedItems.some(s => s.kind === it.kind && s.id === it.id)),
    [pickableItems, batchForm.selectedItems]
  )
  const subtotal = selectedTemplates.reduce((s, it) => s + it.price, 0)
  const discountPct = parseFloat(batchForm.discount) || 0
  const total = Math.round(subtotal * (1 - discountPct / 100) * 100) / 100
  const selectedPatient = patients.find(p => String(p.id) === batchForm.patientId)

  // Tests that belong to a currently-selected profile — disabled individually to avoid double-booking the same test.
  const disabledTemplateInfo = new Map<number, string>()
  for (const sel of batchForm.selectedItems) {
    if (sel.kind !== 'profile') continue
    const profile = activeProfiles.find(p => p.id === sel.id)
    if (!profile) continue
    for (const t of profile.templates) {
      if (!disabledTemplateInfo.has(t.id)) disabledTemplateInfo.set(t.id, profile.name)
    }
  }

  const toggleTest = (kind: 'template' | 'profile', id: number) => {
    if (kind === 'template' && disabledTemplateInfo.has(id)) return
    setBatchForm(prev => {
      if (prev.selectedItems.some(s => s.kind === kind && s.id === id)) {
        return { ...prev, selectedItems: prev.selectedItems.filter(s => !(s.kind === kind && s.id === id)) }
      }
      if (kind === 'profile') {
        // Selecting a profile supersedes any of its member tests already picked individually
        const memberIds = new Set(activeProfiles.find(p => p.id === id)?.templates.map(t => t.id) ?? [])
        const withoutMembers = prev.selectedItems.filter(s => !(s.kind === 'template' && memberIds.has(s.id)))
        return { ...prev, selectedItems: [...withoutMembers, { kind, id }] }
      }
      return { ...prev, selectedItems: [...prev.selectedItems, { kind, id }] }
    })
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
      if (batchForm.selectedItems.length === 0) throw new Error('Select at least one test')
      return orderService.createBatch({
        patientId: Number(batchForm.patientId),
        orders: batchForm.selectedItems.map(s => s.kind === 'profile' ? { profileId: s.id } : { templateId: s.id }),
        discount: discountPct || undefined,
        paymentStatus: batchForm.paymentStatus,
        paymentType: batchForm.paymentType,
      })
    },
    onSuccess: ({ orders: created, receiptNumber }) => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      setCreateOpen(false)
      toast.success(
        `${created.length} test${created.length > 1 ? 's' : ''} added${receiptNumber ? ` · Receipt ${receiptNumber}` : ''}`
      )
      if (created.length) printTubeLabels(created)
    },
    onError: (err) => toastError(err, 'Failed to create orders'),
  })

  // ── Load submitted results ───────────────────────────────
  const loadOrderResults = useMutation({
    mutationFn: (orderId: number) => orderService.getResults(orderId),
    onSuccess: (data) => { setSelectedResults(data); setViewResultsOpen(true) },
    onError: (err) => toastError(err, 'Failed to load results'),
  })

  const removeOrder = useMutation({
    mutationFn: (id: number) => orderService.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); setDeleteOrder(null); toast.success('Order deleted') },
    onError: (err) => toastError(err, 'Failed to delete order'),
  })

  const removeGroupMutation = useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map(id => orderService.delete(id))),
    onSuccess: (_, ids) => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      setDeleteGroupOrders(null)
      toast.success(`${ids.length} test${ids.length !== 1 ? 's' : ''} deleted`)
    },
    onError: (err) => toastError(err, 'Failed to delete order'),
  })

  const reopenMutation = useMutation({
    mutationFn: (id: number) => orderService.reopen(id),
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      setReopenOrder(null)
      toast.success(`${order.receiptNumber ?? order.template?.name ?? 'Order'} reopened — ready for re-entry`)
    },
    onError: (err) => toastError(err, 'Failed to reopen order'),
  })

  const batchSubmitMut = useMutation({
    mutationFn: (receiptNumber: string) => orderService.batchSubmit(receiptNumber),
    onSuccess: ({ count }) => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      toast.success(`${count} test${count !== 1 ? 's' : ''} submitted for approval`)
    },
    onError: (err) => toastError(err, 'Failed to submit batch'),
  })

  const activeOrders = orders.filter(o => o.status !== 'APPROVED')
  const filtered = activeOrders.filter(o => {
    const matchSearch = !search ||
      String(o.id).includes(search) ||
      (o.patient?.fullName ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (o.template?.name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'ALL' || o.status === statusFilter
    const matchTemplate = !templateFilter || String(o.template?.id) === templateFilter
    const orderDate = o.createdAt ? new Date(o.createdAt) : null
    const matchFrom = !dateFrom || (orderDate && orderDate >= new Date(dateFrom))
    const matchTo   = !dateTo   || (orderDate && orderDate <= new Date(dateTo + 'T23:59:59'))
    return matchSearch && matchStatus && matchTemplate && matchFrom && matchTo
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

  // Build flat list of rows: one row per receipt (all its tests collapsed together), one row per unreceipted single order
  const tableRows = useMemo(() => {
    type Row =
      | { kind: 'group'; receipt: string; orders: Order[] }
      | { kind: 'single'; order: Order }

    const rows: Row[] = []
    const seenReceipts = new Set<string>()

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

      if (receipt && groupOrders.length > 1) {
        if (seenReceipts.has(receipt)) continue
        seenReceipts.add(receipt)
        rows.push({ kind: 'group', receipt, orders: groupOrders })
      } else {
        rows.push({ kind: 'single', order })
      }
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
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-500"
            />
          </div>
          <div className="relative">
            <select
              value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              className="appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-4 pr-9 text-sm text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="AWAITING_APPROVAL">Awaiting Approval</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
          <div className="relative">
            <select value={templateFilter} onChange={e => setTemplateFilter(e.target.value)}
              className="appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-4 pr-9 text-sm text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
              <option value="">All Tests</option>
              {activeTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white py-2.5 px-3 text-sm text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200" />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white py-2.5 px-3 text-sm text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200" />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo('') }}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
              Show All
            </button>
          )}
          {(search || statusFilter !== 'ALL' || templateFilter || dateFrom !== TODAY || dateTo) && (
            <button onClick={() => { setSearch(''); setStatusFilter('ALL'); setTemplateFilter(''); setDateFrom(TODAY); setDateTo('') }}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
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
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <table className="min-w-[720px] w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Date & Time</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Patient Code</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Patient</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">B2B</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Status</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {tableRows.map((row) => {
                  if (row.kind === 'group') {
                    const group = row.orders
                    const primary = group[0]
                    const testNames = group.map(o => o.template?.name || o.template?.code).filter(Boolean).join(', ')
                    const editableOrder = group.find(o => o.status === 'PENDING' || o.status === 'IN_PROGRESS')
                    const readyToSubmit = canSubmitBatch(row.receipt)
                    const allAwaiting = group.every(o => o.status === 'AWAITING_APPROVAL')
                    const firstRejected = group.find(o => o.status === 'REJECTED')
                    const allPending = group.every(o => o.status === 'PENDING')
                    const dt = formatDateTime(primary.createdAt)

                    return (
                      <tr key={`grp-${row.receipt}`} className="hover:bg-gray-50/50 transition-colors dark:hover:bg-gray-700/30">
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-800 dark:text-gray-200 text-xs">{dt.date}</span>
                            <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">{dt.time}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 font-mono text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                            {primary.patient?.patientCode || '—'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-medium text-gray-800 dark:text-gray-200">{primary.patient?.fullName ?? '—'}</p>
                        </td>
                        <td className="px-5 py-4"><B2bCell patient={primary.patient} /></td>
                        <td className="px-5 py-4"><GroupStatusSummary orders={group} /></td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button size="sm" variant="ghost" icon={<FlaskConical className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
                              title={testNames ? `Tests on this order:\n${group.map((o, idx) => `${idx + 1}. ${o.template?.name || o.template?.code}`).join('\n')}` : 'View tests'}
                              onClick={() => setTestsModalOrders(group)}>
                              Tests ({group.length})
                            </Button>
                            {row.receipt && (
                              <Button size="sm" variant="ghost" icon={<Barcode className="h-3.5 w-3.5" />}
                                onClick={() => printTubeLabels(group)}>
                                Labels
                              </Button>
                            )}
                            {editableOrder && (
                              <Button size="sm" variant="secondary" icon={<ExternalLink className="h-3.5 w-3.5" />}
                                onClick={() => navigate(`/orders/${editableOrder.id}/enter-results`)}>
                                Enter Results
                              </Button>
                            )}
                            {readyToSubmit && (
                              <Button size="sm" icon={<SendHorizonal className="h-3.5 w-3.5" />}
                                loading={batchSubmitMut.isPending && batchSubmitMut.variables === row.receipt}
                                onClick={() => batchSubmitMut.mutate(row.receipt)}>
                                Submit All for Approval
                              </Button>
                            )}
                            {allAwaiting && (
                              <Button size="sm" variant="ghost" icon={<FileText className="h-3.5 w-3.5" />}
                                loading={loadOrderResults.isPending && loadOrderResults.variables === primary.id}
                                onClick={() => loadOrderResults.mutate(primary.id)}>
                                View Submitted
                              </Button>
                            )}
                            {firstRejected && (
                              <Button size="sm" variant="secondary" icon={<RotateCcw className="h-3.5 w-3.5" />}
                                onClick={() => setReopenOrder(firstRejected)}>
                                Re-open
                              </Button>
                            )}
                            {allPending && (
                              <Button size="sm" variant="ghost"
                                icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />}
                                className="text-red-500 hover:bg-red-50"
                                onClick={() => setDeleteGroupOrders(group)}>
                                Delete
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  const order = row.order
                  const dt = formatDateTime(order.createdAt)
                  return (
                    <tr key={order.id} className="hover:bg-gray-50/50 transition-colors dark:hover:bg-gray-700/30">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-800 dark:text-gray-200 text-xs">{dt.date}</span>
                          <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">{dt.time}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 font-mono text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                          {order.patient?.patientCode || '—'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-800 dark:text-gray-200">{order.patient?.fullName ?? '—'}</p>
                      </td>
                      <td className="px-5 py-4"><B2bCell patient={order.patient} /></td>
                      <td className="px-5 py-4"><OrderStatusBadge status={order.status} /></td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" icon={<FlaskConical className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
                            title={order.template?.name ? `Test: ${order.template.name}${order.template.code ? ` (${order.template.code})` : ''}` : 'View test'}
                            onClick={() => setTestsModalOrders([order])}>
                            Test
                          </Button>
                          {order.receiptNumber && (
                            <Button size="sm" variant="ghost" icon={<Barcode className="h-3.5 w-3.5" />}
                              onClick={() => printTubeLabels([order])}>
                              Labels
                            </Button>
                          )}
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
        title="New Diagnostic Order"
        subtitle="Pick a patient, add tests, then confirm payment"
        size="2xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              loading={createBatch.isPending}
              disabled={!batchForm.patientId || batchForm.selectedItems.length === 0}
              icon={<CheckSquare className="h-4 w-4" />}
              onClick={() => createBatch.mutate()}
            >
              Create {batchForm.selectedItems.length > 0 ? `${batchForm.selectedItems.length} ` : ''}Order{batchForm.selectedItems.length !== 1 ? 's' : ''}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12 xl:gap-6">
          {/* Patient column */}
          <div className="flex min-h-0 flex-col xl:col-span-4">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
                1 · Patient <span className="text-red-500">*</span>
              </label>
              {selectedPatient && (
                <button
                  type="button"
                  onClick={() => { setBatchForm(p => ({ ...p, patientId: '' })); setPatientSearch('') }}
                  className="text-[11px] font-medium text-gray-400 hover:text-red-500"
                >
                  Change
                </button>
              )}
            </div>

            {selectedPatient ? (
              <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4 dark:border-blue-900/50 dark:from-blue-950/40 dark:to-gray-800">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                    {selectedPatient.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-gray-900 dark:text-white">{selectedPatient.fullName}</p>
                    <p className="mt-0.5 font-mono text-xs text-blue-600 dark:text-blue-400">{selectedPatient.patientCode}</p>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                      {formatAge(selectedPatient.ageYears, selectedPatient.ageMonths, selectedPatient.ageDays) && (
                        <span>{formatAge(selectedPatient.ageYears, selectedPatient.ageMonths, selectedPatient.ageDays)}</span>
                      )}
                      {selectedPatient.gender && <span>{selectedPatient.gender}</span>}
                      {selectedPatient.phoneNumber && <span>{selectedPatient.phoneNumber}</span>}
                    </div>
                    {selectedPatient.isB2b && (
                      <span className="mt-2 inline-flex rounded-md bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                        B2B · {selectedPatient.b2bLab?.name ?? 'Partner'}
                      </span>
                    )}
                  </div>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            ) : (
              <>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <input
                    value={patientSearch} onChange={e => setPatientSearch(e.target.value)}
                    placeholder="Name, code or phone…"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-8 pr-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-200 dark:placeholder-gray-500 dark:focus:bg-gray-700"
                  />
                </div>
                <div className="max-h-72 overflow-y-auto rounded-2xl border border-gray-200 dark:border-gray-600">
                  {filteredPatients.length === 0 ? (
                    <div className="flex flex-col items-center px-4 py-10 text-center">
                      <User className="mb-2 h-7 w-7 text-gray-300" />
                      <p className="text-sm text-gray-400">No patients match</p>
                    </div>
                  ) : filteredPatients.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setBatchForm(prev => ({ ...prev, patientId: String(p.id) }))}
                      className="flex w-full items-center gap-3 border-b border-gray-100 px-3.5 py-2.5 text-left last:border-0 hover:bg-blue-50 dark:border-gray-700 dark:hover:bg-blue-950/30"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        {p.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">{p.fullName}</p>
                        <p className="truncate text-[11px] text-gray-400">
                          {p.patientCode}
                          {p.phoneNumber ? ` · ${p.phoneNumber}` : ''}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Test catalogue */}
          <div className="flex min-h-0 flex-col xl:col-span-4">
            <label className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
              2 · Tests <span className="text-red-500">*</span>
            </label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                value={testSearch} onChange={e => setTestSearch(e.target.value)}
                placeholder="Search tests or packages…"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-8 pr-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-200 dark:placeholder-gray-500 dark:focus:bg-gray-700"
              />
            </div>
            <div className="max-h-80 overflow-y-auto rounded-2xl border border-gray-200 dark:border-gray-600">
              {filteredTests.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-gray-400">No active tests found</div>
              ) : filteredTests.map(it => {
                const checked = batchForm.selectedItems.some(s => s.kind === it.kind && s.id === it.id)
                const coveredByProfile = it.kind === 'template' ? disabledTemplateInfo.get(it.id) : undefined
                return (
                  <label
                    key={`${it.kind}-${it.id}`}
                    title={coveredByProfile ? `Already included in the "${coveredByProfile}" package` : undefined}
                    className={`flex items-center gap-3 border-b border-gray-100 px-3.5 py-2.5 last:border-0 dark:border-gray-700 ${
                      coveredByProfile
                        ? 'cursor-not-allowed bg-gray-50 opacity-50 dark:bg-gray-800/40'
                        : `cursor-pointer ${checked ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'}`
                    }`}
                  >
                    <input
                      type="checkbox" checked={checked}
                      disabled={!!coveredByProfile}
                      onChange={() => toggleTest(it.kind, it.id)}
                      className="h-4 w-4 rounded accent-blue-600 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {it.kind === 'profile' && (
                          <span className="shrink-0 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                            Package · {it.testCount}
                          </span>
                        )}
                        <p className="truncate text-sm font-semibold text-gray-800 dark:text-gray-200">{it.name}</p>
                        {coveredByProfile && (
                          <span className="shrink-0 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                            In {coveredByProfile}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{it.code}</p>
                    </div>
                    {it.price > 0 && (
                      <span className="shrink-0 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        ₹{it.price.toLocaleString()}
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
            {batchForm.selectedItems.length > 0 && (
              <button
                type="button"
                className="mt-2 self-start text-xs text-gray-400 hover:text-red-500"
                onClick={() => setBatchForm(p => ({ ...p, selectedItems: [] }))}
              >
                Clear selection
              </button>
            )}
          </div>

          {/* Summary + payment */}
          <div className="flex min-h-0 flex-col xl:col-span-4">
            <label className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
              3 · Summary
            </label>

            {batchForm.selectedItems.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 px-4 py-12 text-center dark:border-gray-600">
                <FlaskConical className="mb-2 h-8 w-8 text-gray-300" />
                <p className="text-sm text-gray-400">Select tests to build this order</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-600">
                <div className="max-h-40 overflow-y-auto">
                  {selectedTemplates.map(it => (
                    <div key={`${it.kind}-${it.id}`} className="flex items-center gap-3 border-b border-gray-100 px-4 py-2.5 dark:border-gray-700">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{it.name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{it.code}</p>
                      </div>
                      <span className="shrink-0 text-sm tabular-nums text-gray-600 dark:text-gray-300">
                        ₹{it.price.toLocaleString()}
                      </span>
                      <button type="button" onClick={() => toggleTest(it.kind, it.id)} className="shrink-0 text-gray-300 hover:text-red-400">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 border-t border-gray-100 bg-gray-50 px-4 py-4 dark:border-gray-700 dark:bg-gray-900/40">
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>Subtotal</span>
                    <span className="tabular-nums text-gray-700 dark:text-gray-300">₹{subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-gray-500">Discount</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number" min="0" max="100" step="1" placeholder="0"
                        value={batchForm.discount}
                        onChange={e => setBatchForm(p => ({ ...p, discount: e.target.value }))}
                        className="w-16 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-right text-sm tabular-nums outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                      />
                      <span className="text-sm text-gray-400">%</span>
                    </div>
                  </div>
                  {discountPct > 0 && (
                    <div className="flex items-center justify-between text-sm text-emerald-600">
                      <span>Saved</span>
                      <span className="tabular-nums">− ₹{(subtotal - total).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-gray-200 pt-3 dark:border-gray-700">
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Total</span>
                    <span className="text-xl font-bold tabular-nums text-gray-900 dark:text-white">₹{total.toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-4 border-t border-gray-100 px-4 py-4 dark:border-gray-700">
                  <div>
                    <p className="mb-2 text-xs font-medium text-gray-500">Status</p>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { value: 'PENDING' as const, label: 'Unpaid' },
                        { value: 'PAID' as const, label: 'Paid' },
                      ]).map(s => (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => setBatchForm(p => ({ ...p, paymentStatus: s.value }))}
                          className={`rounded-lg border py-2 text-sm font-medium transition-all ${
                            batchForm.paymentStatus === s.value
                              ? s.value === 'PAID'
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300'
                                : 'border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-300'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-medium text-gray-500">Method</p>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { value: 'CASH' as const, label: 'Cash', icon: Banknote },
                        { value: 'CHEQUE' as const, label: 'Cheque', icon: Landmark },
                        { value: 'ONLINE' as const, label: 'Online', icon: Smartphone },
                      ]).map(m => (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setBatchForm(p => ({ ...p, paymentType: m.value }))}
                          className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium transition-all ${
                            batchForm.paymentType === m.value
                              ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400'
                          }`}
                        >
                          <m.icon className="h-3.5 w-3.5" />
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* View Submitted Results Modal */}
      <Modal
        open={viewResultsOpen}
        onClose={() => setViewResultsOpen(false)}
        title={`Submitted Results — ${selectedResults?.order.receiptNumber ?? selectedResults?.order.template?.name ?? ''}`}
        subtitle={selectedResults?.order.patient?.fullName}
        size="lg"
        footer={<Button variant="secondary" onClick={() => setViewResultsOpen(false)}>Close</Button>}
      >
        {selectedResults && (
          <div>
            <div className="mb-5 grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-4 text-sm dark:bg-gray-700/50">
              <div>
                <span className="text-gray-400 text-xs uppercase tracking-wide dark:text-gray-500">Patient</span>
                <p className="font-semibold text-gray-800 mt-0.5 dark:text-gray-200">{selectedResults.order.patient?.fullName ?? '—'}</p>
              </div>
              <div>
                <span className="text-gray-400 text-xs uppercase tracking-wide dark:text-gray-500">Test</span>
                <p className="font-semibold text-gray-800 mt-0.5 dark:text-gray-200">{selectedResults.order.template?.name ?? '—'}</p>
              </div>
              <div>
                <span className="text-gray-400 text-xs uppercase tracking-wide dark:text-gray-500">Status</span>
                <div className="mt-0.5"><OrderStatusBadge status={selectedResults.order.status} /></div>
              </div>
              <div>
                <span className="text-gray-400 text-xs uppercase tracking-wide dark:text-gray-500">Date</span>
                <p className="font-medium text-gray-700 mt-0.5 dark:text-gray-300">
                  {selectedResults.order.createdAt ? new Date(selectedResults.order.createdAt).toLocaleDateString() : '—'}
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {selectedResults.results.filter(r => !r.isSectionHeader).map((result, i) => (
                <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                  <p className="text-xs text-gray-400 uppercase tracking-wide dark:text-gray-500">{result.fieldName}</p>
                  <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
                    {String(result.value ?? '—')}
                    {result.unit && <span className="ml-1.5 text-sm font-normal text-gray-400 dark:text-gray-500">{result.unit}</span>}
                  </p>
                  {result.referenceRange && (
                    <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">Ref: {result.referenceRange}</p>
                  )}
                </div>
              ))}
            </div>
            {selectedResults.order.attachmentName && selectedResults.order.attachmentUrl && (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900/50 dark:bg-blue-900/20">
                <Paperclip className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-800 dark:text-gray-200">{selectedResults.order.attachmentName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Attached PDF document</p>
                </div>
                <a href={selectedResults.order.attachmentUrl} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-gray-800 dark:text-blue-400 dark:hover:bg-gray-700">
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

      {/* Archive Confirm */}
      <ConfirmModal
        open={!!deleteOrder} onClose={() => setDeleteOrder(null)}
        onConfirm={() => deleteOrder && removeOrder.mutate(deleteOrder.id)}
        title="Archive Order"
        message={`Archive Order #${deleteOrder?.id}? The order will be moved to the archive and can be restored later.`}
        confirmLabel="Archive Order" variant="danger" loading={removeOrder.isPending}
      />

      {/* Archive Receipt (all tests) Confirm */}
      <ConfirmModal
        open={!!deleteGroupOrders} onClose={() => setDeleteGroupOrders(null)}
        onConfirm={() => deleteGroupOrders && removeGroupMutation.mutate(deleteGroupOrders.map(o => o.id))}
        title="Archive Receipt"
        message={`Archive all ${deleteGroupOrders?.length ?? 0} tests on this receipt? They will be moved to the archive and can be restored later.`}
        confirmLabel="Archive All" variant="danger" loading={removeGroupMutation.isPending}
      />

      {/* Tests list modal */}
      {testsModalOrders && (
        <Modal
          open={!!testsModalOrders}
          onClose={() => setTestsModalOrders(null)}
          title="Order Tests"
          subtitle={`${testsModalOrders[0]?.patient?.fullName ?? 'Patient'} ${testsModalOrders[0]?.patient?.patientCode ? `(${testsModalOrders[0].patient.patientCode})` : ''}`}
          size="md"
          footer={
            <Button variant="secondary" onClick={() => setTestsModalOrders(null)}>
              Close
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/80 px-3.5 py-2.5 dark:border-gray-700 dark:bg-gray-800/60">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                <span>Date: </span>
                <span className="font-semibold text-gray-700 dark:text-gray-200">
                  {formatDateTime(testsModalOrders[0]?.createdAt).date} {formatDateTime(testsModalOrders[0]?.createdAt).time}
                </span>
              </div>
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                {testsModalOrders.length} {testsModalOrders.length === 1 ? 'Test' : 'Tests'}
              </span>
            </div>

            <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden dark:divide-gray-700 dark:border-gray-700">
              {testsModalOrders.map((o, idx) => (
                <div key={o.id || idx} className="flex items-center justify-between gap-3 bg-white p-3.5 dark:bg-gray-800">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-gray-800 dark:text-gray-100 truncate">
                        {o.template?.name ?? 'Test'}
                      </p>
                      {o.template?.code && (
                        <p className="font-mono text-xs text-gray-400 dark:text-gray-500">
                          {o.template.code}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0">
                    <OrderStatusBadge status={o.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

