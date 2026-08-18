import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search, Receipt, ChevronDown, DollarSign,
  CheckCircle, Clock, FileText, Pencil,
  RefreshCw, Download, Share2, Loader2, Eye, Paperclip, X, Printer,
  Banknote, Landmark, Smartphone, CircleDot, Barcode,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { PageLoader } from '../components/ui/Spinner'
import { Badge } from '../components/ui/Badge'
import { orderService } from '../services/orders'
import { reportShareService } from '../services/reportShares'
import { labSettingsService } from '../services/labSettings'
import { signatureService } from '../services/signatures'
import { logoService } from '../services/logos'
import { generateReceipt, generateCombinedReport, viewCombinedReport, printCombinedReport, viewMergedAttachments, printTubeLabels } from '../utils/generateReport'
import type { Order, PaymentStatus, PaymentType } from '../types'
import { toast } from 'sonner'
import { toastError } from '../lib/errors'

const TODAY = new Date().toISOString().split('T')[0]

type PaymentFilter = 'ALL' | PaymentStatus

const PAYMENT_VARIANTS: Record<PaymentStatus, 'success' | 'warning' | 'info'> = {
  PAID: 'success',
  PENDING: 'warning',
  PARTIAL: 'info',
}

/* ─── Reusable icon action button ────────────────────────── */
function IBtn({
  title, onClick, disabled, loading, color, children,
}: {
  title: string
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  color: string   // tailwind hover classes e.g. "hover:bg-emerald-50 hover:text-emerald-600"
  children: React.ReactNode
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled || loading}
      className={`relative flex h-8 w-8 items-center justify-center rounded-lg transition-all disabled:opacity-40 ${color}`}
    >
      {loading
        ? <Loader2 className="h-4 w-4 animate-spin" />
        : children}
    </button>
  )
}

/* ─── Payment edit modal ─────────────────────────────────── */
interface PaymentForm {
  paymentStatus: PaymentStatus
  paymentType: PaymentType | ''
  amount: string
  discount: string
}

interface PaymentUpdate {
  id: number
  amount: number
  discount: number
  paymentStatus: PaymentStatus
  paymentType: PaymentType | ''
}

interface PaymentModalProps {
  orders: Order[]
  onClose: () => void
  onSave: (updates: PaymentUpdate[]) => void
  saving: boolean
}

/** Split a receipt total across tests using original amounts, last row takes rounding. */
function splitReceiptAmounts(orders: Order[], newGross: number): Map<number, number> {
  const origTotal = orders.reduce((s, o) => s + Number(o.amount ?? 0), 0)
  const result = new Map<number, number>()
  let allocated = 0
  orders.forEach((o, i) => {
    if (i === orders.length - 1) {
      result.set(o.id, Math.round((newGross - allocated) * 100) / 100)
      return
    }
    const share = origTotal > 0
      ? Math.round(newGross * (Number(o.amount ?? 0) / origTotal) * 100) / 100
      : Math.round((newGross / orders.length) * 100) / 100
    result.set(o.id, share)
    allocated += share
  })
  return result
}

function PaymentModal({ orders, onClose, onSave, saving }: PaymentModalProps) {
  const order = orders[0]
  const isSingle = orders.length === 1
  const originalGross = orders.reduce((s, o) => s + Number(o.amount ?? 0), 0)

  const [form, setForm] = useState<PaymentForm>({
    paymentStatus: order.paymentStatus ?? 'PENDING',
    paymentType: order.paymentType ?? '',
    amount: String(originalGross),
    discount: String(order.discount ?? 0),
  })

  const amount = parseFloat(form.amount) || 0
  const discount = parseFloat(form.discount) || 0
  const netAmount = Math.round(amount * (1 - discount / 100) * 100) / 100
  const allocations = splitReceiptAmounts(orders, amount)

  const set = (key: keyof PaymentForm, val: string) =>
    setForm(prev => ({ ...prev, [key]: val }))

  const handleSave = () => {
    onSave(
      orders.map(o => ({
        id: o.id,
        amount: allocations.get(o.id) ?? 0,
        discount,
        paymentStatus: form.paymentStatus,
        paymentType: form.paymentType,
      })),
    )
  }

  const statusOpts: { value: PaymentStatus; label: string; hint: string; icon: React.ReactNode; active: string }[] = [
    { value: 'PENDING', label: 'Pending', hint: 'Not collected', icon: <Clock className="h-4 w-4" />, active: 'border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-300' },
    { value: 'PARTIAL', label: 'Partial', hint: 'Part paid', icon: <CircleDot className="h-4 w-4" />, active: 'border-blue-400 bg-blue-50 text-blue-800 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-300' },
    { value: 'PAID', label: 'Paid', hint: 'Fully collected', icon: <CheckCircle className="h-4 w-4" />, active: 'border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300' },
  ]

  const methodOpts: { value: PaymentType | ''; label: string; icon: React.ReactNode }[] = [
    { value: '', label: 'None', icon: <X className="h-4 w-4" /> },
    { value: 'CASH', label: 'Cash', icon: <Banknote className="h-4 w-4" /> },
    { value: 'CHEQUE', label: 'Cheque', icon: <Landmark className="h-4 w-4" /> },
    { value: 'ONLINE', label: 'Online', icon: <Smartphone className="h-4 w-4" /> },
  ]

  return (
    <Modal
      open
      onClose={onClose}
      title="Update Payment"
      subtitle={`${order.patient?.fullName ?? 'Patient'} · ${isSingle ? (order.template?.name ?? 'Test') : `${orders.length} tests`}`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={handleSave}>Save Payment</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/40">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Receipt</p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-gray-800 dark:text-gray-100">
                {order.receiptNumber ?? <span className="italic font-sans font-normal text-gray-400">Generated on save</span>}
              </p>
              {!isSingle && (
                <p className="mt-1 text-xs text-gray-500">{orders.length} tests on this receipt</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Payable</p>
              <p className="mt-0.5 text-2xl font-bold tracking-tight text-[#1d4ed8]">
                ₹{netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {!isSingle && (
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
            {orders.map(o => {
              const share = allocations.get(o.id) ?? 0
              const shareNet = Math.round(share * (1 - discount / 100) * 100) / 100
              return (
                <div key={o.id} className="flex items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 last:border-0 text-sm dark:border-gray-700">
                  <span className="truncate text-gray-700 dark:text-gray-200">{o.template?.name ?? 'Test'}</span>
                  <span className="shrink-0 tabular-nums text-gray-500">
                    ₹{shareNet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Input label={isSingle ? 'Amount (₹)' : 'Total amount (₹)'} type="number" min={0} step="0.01"
            value={form.amount} onChange={e => set('amount', e.target.value)} />
          <Input label="Discount (%)" type="number" min={0} max={100} step="0.5"
            value={form.discount} onChange={e => set('discount', e.target.value)} />
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Payment status</p>
          <div className="grid grid-cols-3 gap-2">
            {statusOpts.map(s => (
              <button
                key={s.value}
                type="button"
                onClick={() => set('paymentStatus', s.value)}
                className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-center transition-all ${
                  form.paymentStatus === s.value
                    ? s.active
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'
                }`}
              >
                {s.icon}
                <span className="text-sm font-semibold">{s.label}</span>
                <span className="text-[10px] opacity-70">{s.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Payment method</p>
          <div className="grid grid-cols-4 gap-2">
            {methodOpts.map(m => (
              <button
                key={m.value || 'none'}
                type="button"
                onClick={() => set('paymentType', m.value)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 text-xs font-semibold transition-all ${
                  form.paymentType === m.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'
                }`}
              >
                {m.icon}
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

/* ─── Main page ──────────────────────────────────────────── */
export default function BillingPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('ALL')
  const [dateFrom, setDateFrom] = useState(TODAY)
  const [dateTo, setDateTo] = useState('')
  const [editGroup, setEditGroup] = useState<Order[] | null>(null)

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['orders'],
    queryFn: orderService.getAll,
  })

  // Pre-fetch lab settings and active signature for report generation
  const { data: labSettings = {} } = useQuery({
    queryKey: ['lab-settings'],
    queryFn: labSettingsService.getAll,
  })
  const { data: activeSignatures = [] } = useQuery({
    queryKey: ['active-signature'],
    queryFn: signatureService.getActive,
  })
  const { data: activeLogo = null } = useQuery({
    queryKey: ['logos', 'active'],
    queryFn: logoService.getActive,
  })

  const updatePayment = useMutation({
    mutationFn: (updates: PaymentUpdate[]) =>
      Promise.all(updates.map(u => orderService.updatePayment(u.id, {
        paymentStatus: u.paymentStatus,
        paymentType: u.paymentType || null,
        amount: u.amount,
        discount: u.discount,
      }))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      setEditGroup(null)
      toast.success('Payment updated')
    },
    onError: (err) => toastError(err, 'Failed to update payment'),
  })

  // Fetches results for every approved test sharing this order's receipt, ready to feed a report generator
  const fetchReportOptions = async (order: Order) => {
    const siblings = order.receiptNumber
      ? orders.filter(o => o.receiptNumber === order.receiptNumber && o.status === 'APPROVED')
      : []
    const targets = siblings.length > 0 ? siblings : [order]
    const results = await Promise.all(targets.map(o => orderService.getResults(o.id)))
    return results.map(data => ({
      order: data.order,
      results: data.results.map(r => ({
        fieldName: r.fieldName,
        fieldType: r.fieldType,
        value: r.value,
        unit: r.unit ?? null,
        referenceRange: r.referenceRange ?? null,
        isSectionHeader: r.isSectionHeader ?? false,
        isMainHeader: r.isMainHeader ?? false,
        isLineResult: r.isLineResult ?? false,
      })),
      labSettings,
      signatures: activeSignatures,
      activeLogo,
    }))
  }

  // Downloads the PDF report — combined across every approved test on the same receipt, since that's always what's wanted
  const downloadReport = useMutation({
    mutationFn: fetchReportOptions,
    onSuccess: (optionsList) => {
      generateCombinedReport(optionsList, 'letterhead')
        .then(() => toast.success('Report downloaded'))
        .catch(() => toast.error('Failed to generate report'))
    },
    onError: (err) => toastError(err, 'Failed to generate report'),
  })

  // Opens the same combined report in a new tab instead of downloading it
  const viewReportMutation = useMutation({
    mutationFn: fetchReportOptions,
    onSuccess: (optionsList) => {
      viewCombinedReport(optionsList, 'letterhead')
        .catch(() => toast.error('Failed to open report'))
    },
    onError: (err) => toastError(err, 'Failed to open report'),
  })

  // Sends the letterhead report straight to the browser's print dialog
  const printReportMutation = useMutation({
    mutationFn: fetchReportOptions,
    onSuccess: (optionsList) => {
      printCombinedReport(optionsList, 'letterhead')
        .catch(() => toast.error('Failed to print report'))
    },
    onError: (err) => toastError(err, 'Failed to print report'),
  })

  // Merges every uploaded attachment on this receipt (one per test) into a single PDF and opens it
  const viewAttachmentsMutation = useMutation({
    mutationFn: (group: Order[]) => {
      const urls = group.map(o => o.attachmentUrl).filter((u): u is string => !!u)
      return viewMergedAttachments(urls)
    },
    onError: () => toast.error('Failed to open uploaded document'),
  })

  const shareReport = useMutation({
    mutationFn: (orderId: number) => reportShareService.createToken(orderId),
    onSuccess: (data) => {
      const url = `${window.location.origin}/r/${data.token}`
      navigator.clipboard.writeText(url).then(() => toast.success('Report link copied to clipboard!'))
    },
    onError: (err) => toastError(err, 'Failed to create share link'),
  })

  const printReceiptMutation = useMutation({
    mutationFn: (orders: Order[]) =>
      generateReceipt({ orders, labSettings, signatures: activeSignatures, activeLogo }),
    onSuccess: () => toast.success('Receipt downloaded'),
    onError: (err) => toastError(err, 'Failed to generate receipt'),
  })

  // Plain report — combined across every approved test on the same receipt, like the letterhead report
  const plainReportMutation = useMutation({
    mutationFn: (order: Order) => {
      const siblings = order.receiptNumber
        ? orders.filter(o => o.receiptNumber === order.receiptNumber && o.status === 'APPROVED')
        : []
      const targets = siblings.length > 0 ? siblings : [order]
      return Promise.all(targets.map(o => orderService.getResults(o.id)))
    },
    onSuccess: (results) => {
      const optionsList = results.map(data => ({
        order: data.order,
        results: data.results.map(r => ({
          fieldName: r.fieldName,
          fieldType: r.fieldType,
          value: r.value,
          unit: r.unit ?? null,
          referenceRange: r.referenceRange ?? null,
          isSectionHeader: r.isSectionHeader ?? false,
          isMainHeader: r.isMainHeader ?? false,
          isLineResult: r.isLineResult ?? false,
        })),
        labSettings,
        signatures: activeSignatures,
        activeLogo,
      }))
      generateCombinedReport(optionsList, 'plain')
        .then(() => toast.success('Plain report downloaded'))
        .catch(() => toast.error('Failed to generate report'))
    },
    onError: (err) => toastError(err, 'Failed to generate report'),
  })

  // Sends the plain report straight to the browser's print dialog
  const printPlainReportMutation = useMutation({
    mutationFn: fetchReportOptions,
    onSuccess: (optionsList) => {
      printCombinedReport(optionsList, 'plain')
        .catch(() => toast.error('Failed to print report'))
    },
    onError: (err) => toastError(err, 'Failed to print report'),
  })

  // Group orders sharing one receipt into a single billing row — we always bill/report a receipt as one unit
  const receiptGroups: Order[][] = []
  const groupByKey = new Map<string, Order[]>()
  for (const o of orders) {
    const key = o.receiptNumber ?? `order-${o.id}`
    const existing = groupByKey.get(key)
    if (existing) existing.push(o)
    else {
      const group: Order[] = [o]
      groupByKey.set(key, group)
      receiptGroups.push(group)
    }
  }

  const filtered = receiptGroups.filter(group => {
    const primary = group[0]
    const q = search.toLowerCase()
    const matchSearch = !search ||
      group.some(o => String(o.id).includes(search)) ||
      (primary.patient?.fullName ?? '').toLowerCase().includes(q) ||
      (primary.receiptNumber ?? '').toLowerCase().includes(q) ||
      (primary.patient?.patientCode ?? '').toLowerCase().includes(q) ||
      group.some(o => (o.template?.name ?? '').toLowerCase().includes(q))
    const matchPayment = paymentFilter === 'ALL' || primary.paymentStatus === paymentFilter
    const orderDate = primary.createdAt ? new Date(primary.createdAt) : null
    const matchFrom = !dateFrom || (orderDate && orderDate >= new Date(dateFrom))
    const matchTo = !dateTo || (orderDate && orderDate <= new Date(dateTo + 'T23:59:59'))
    return matchSearch && matchPayment && matchFrom && matchTo
  })

  // Summary stats
  const totalRevenue = orders.reduce((s, o) => s + Number(o.netAmount ?? 0), 0)
  const paidRevenue = orders.filter(o => o.paymentStatus === 'PAID').reduce((s, o) => s + Number(o.netAmount ?? 0), 0)
  const pendingRevenue = orders.filter(o => o.paymentStatus === 'PENDING').reduce((s, o) => s + Number(o.netAmount ?? 0), 0)
  const approvedCount = orders.filter(o => o.status === 'APPROVED').length

  return (
    <div>
      <Header
        title="Billing & Reports"
        subtitle="Manage payments, print receipts and download approved lab reports"
      />

      <div className="p-6 space-y-6">
        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card padding="md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Billed</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">₹{totalRevenue.toLocaleString()}</p>
              </div>
            </div>
          </Card>
          <Card padding="md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Collected</p>
                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">₹{paidRevenue.toLocaleString()}</p>
              </div>
            </div>
          </Card>
          <Card padding="md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Pending</p>
                <p className="text-xl font-bold text-amber-700 dark:text-amber-400">₹{pendingRevenue.toLocaleString()}</p>
              </div>
            </div>
          </Card>
          <Card padding="md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30">
                <FileText className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Reports Ready</p>
                <p className="text-xl font-bold text-violet-700 dark:text-violet-400">{approvedCount}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by patient, order #, receipt..."
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-500"
            />
          </div>
          <div className="relative">
            <select
              value={paymentFilter}
              onChange={e => setPaymentFilter(e.target.value as PaymentFilter)}
              className="appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-4 pr-9 text-sm text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              <option value="ALL">All Payment Statuses</option>
              <option value="PAID">Paid</option>
              <option value="PENDING">Pending</option>
              <option value="PARTIAL">Partial</option>
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
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          {(search || paymentFilter !== 'ALL' || dateFrom !== TODAY || dateTo) && (
            <button onClick={() => { setSearch(''); setPaymentFilter('ALL'); setDateFrom(TODAY); setDateTo('') }}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
          <span className="self-center ml-auto text-sm text-gray-500">
            {filtered.length} record{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Table */}
        {isLoading ? (
          <PageLoader />
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-12 w-12" />}
            title="No billing records"
            description="Billing records appear here once patients are registered with tests"
          />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Search className="h-10 w-10" />} title="No records found" description="Try adjusting your search or filter" />
        ) : (
          <div className="overflow-x-auto overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Order</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Patient</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">B2B</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Test</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Amount</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Payment</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {filtered.map(group => {
                  const primary = group[0]
                  const totalAmount = group.reduce((s, o) => s + Number(o.amount ?? 0), 0)
                  const totalNet = group.reduce((s, o) => s + Number(o.netAmount ?? 0), 0)
                  const savings = totalAmount - totalNet
                  const testNames = group.map(o => o.template?.name).filter(Boolean).join(', ')
                  const anyApproved = group.some(o => o.status === 'APPROVED')
                  const attachmentUrls = group.map(o => o.attachmentUrl).filter((u): u is string => !!u)

                  return (
                    <tr key={primary.receiptNumber ?? primary.id} className="group hover:bg-gray-50/60 transition-colors dark:hover:bg-gray-700/30">
                      <td className="px-5 py-4">
                        <span className="font-bold text-gray-700 dark:text-gray-300">{primary.receiptNumber ?? primary.template?.name ?? '—'}</span>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500">{primary.createdAt ? new Date(primary.createdAt).toLocaleDateString() : ''}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-800 dark:text-white">{primary.patient?.fullName ?? '—'}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{primary.patient?.patientCode ?? ''}</p>
                      </td>
                      <td className="px-5 py-4">
                        {primary.patient?.isB2b
                          ? <span className="text-sm text-violet-700 dark:text-violet-400">{primary.patient.b2bLab?.name ?? 'B2B'}</span>
                          : <span className="text-xs text-gray-300 dark:text-gray-600">—</span>}
                      </td>
                      <td className="px-5 py-4 text-gray-600 dark:text-gray-300 max-w-[200px] truncate" title={testNames || undefined}>
                        {testNames || '—'}
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-bold text-gray-900 dark:text-white">₹{totalNet.toLocaleString()}</span>
                        {savings > 0 && (
                          <>
                            <span className="ml-1.5 text-xs text-gray-400 line-through dark:text-gray-500">₹{totalAmount.toLocaleString()}</span>
                            <span className="ml-1 text-xs text-emerald-600">−₹{savings.toLocaleString()}</span>
                          </>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant={PAYMENT_VARIANTS[primary.paymentStatus] ?? 'default'} dot>
                          {primary.paymentStatus?.charAt(0) + primary.paymentStatus?.slice(1).toLowerCase()}
                        </Badge>
                        {primary.paymentStatus !== 'PENDING' && primary.paymentType && (
                          <span className="ml-1.5 inline-flex items-center rounded-lg bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 capitalize dark:bg-gray-700 dark:text-gray-300">
                            {primary.paymentType.toLowerCase()}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-0.5">
                          {/* Edit payment */}
                          <IBtn
                            title="Edit Payment"
                            onClick={() => setEditGroup(group)}
                            color="text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                          >
                            <Pencil className="h-4 w-4" />
                          </IBtn>

                          {/* Receipt — generatable regardless of payment or approval status */}
                          <IBtn
                            title="Download Receipt"
                            onClick={() => printReceiptMutation.mutate(group)}
                            loading={printReceiptMutation.isPending && printReceiptMutation.variables?.[0]?.id === primary.id}
                            color="text-amber-500 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-900/30"
                          >
                            <Receipt className="h-4 w-4" />
                          </IBtn>

                          {primary.receiptNumber && (
                            <IBtn
                              title="Print tube labels"
                              onClick={() => printTubeLabels(group)}
                              color="text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                            >
                              <Barcode className="h-4 w-4" />
                            </IBtn>
                          )}

                          {/* Uploaded document(s) — merged into one PDF if this receipt has more than one */}
                          {attachmentUrls.length > 0 && (
                            <IBtn
                              title={attachmentUrls.length > 1 ? `View Uploaded Documents (${attachmentUrls.length}, merged)` : 'View Uploaded Document'}
                              onClick={() => viewAttachmentsMutation.mutate(group)}
                              loading={viewAttachmentsMutation.isPending && viewAttachmentsMutation.variables === group}
                              color="text-cyan-500 hover:bg-cyan-50 hover:text-cyan-600 dark:hover:bg-cyan-900/30"
                            >
                              <Paperclip className="h-4 w-4" />
                            </IBtn>
                          )}

                          {anyApproved && (
                            <>
                              {/* Divider */}
                              <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />

                              {/* View report — combined across every approved test on this receipt, opened in a new tab */}
                              <IBtn
                                title="View Report"
                                onClick={() => viewReportMutation.mutate(primary)}
                                loading={viewReportMutation.isPending && viewReportMutation.variables?.id === primary.id}
                                color="text-violet-500 hover:bg-violet-50 hover:text-violet-600 dark:hover:bg-violet-900/30"
                              >
                                <Eye className="h-4 w-4" />
                              </IBtn>

                              {/* Letterhead report — combined across every approved test on this receipt */}
                              <IBtn
                                title="Download Report"
                                onClick={() => downloadReport.mutate(primary)}
                                loading={downloadReport.isPending && downloadReport.variables?.id === primary.id}
                                color="text-emerald-500 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/30"
                              >
                                <Download className="h-4 w-4" />
                              </IBtn>

                              {/* Print the same letterhead report directly */}
                              <IBtn
                                title="Print Report"
                                onClick={() => printReportMutation.mutate(primary)}
                                loading={printReportMutation.isPending && printReportMutation.variables?.id === primary.id}
                                color="text-emerald-500 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/30"
                              >
                                <Printer className="h-4 w-4" />
                              </IBtn>

                              {/* Plain report — also combined across every approved test on this receipt */}
                              <IBtn
                                title="Plain Report"
                                onClick={() => plainReportMutation.mutate(primary)}
                                loading={plainReportMutation.isPending && plainReportMutation.variables?.id === primary.id}
                                color="text-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30"
                              >
                                <FileText className="h-4 w-4" />
                              </IBtn>

                              {/* Print the same plain report directly */}
                              <IBtn
                                title="Print Plain Report"
                                onClick={() => printPlainReportMutation.mutate(primary)}
                                loading={printPlainReportMutation.isPending && printPlainReportMutation.variables?.id === primary.id}
                                color="text-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30"
                              >
                                <Printer className="h-4 w-4" />
                              </IBtn>

                              {/* Share link — points at the first test on this receipt */}
                              <IBtn
                                title="Share Report Link"
                                onClick={() => shareReport.mutate(primary.id)}
                                loading={shareReport.isPending && shareReport.variables === primary.id}
                                color="text-indigo-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/30"
                              >
                                <Share2 className="h-4 w-4" />
                              </IBtn>
                            </>
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

      {/* Payment edit modal */}
      {editGroup && (
        <PaymentModal
          orders={editGroup}
          onClose={() => setEditGroup(null)}
          saving={updatePayment.isPending}
          onSave={(updates) => updatePayment.mutate(updates)}
        />
      )}
    </div>
  )
}

