import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search, Receipt, ChevronDown, DollarSign,
  CheckCircle, Clock, FileText, Pencil,
  RefreshCw, Download, Share2,
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
import { generateLabReport, generateReceipt, generatePlainReport } from '../utils/generateReport'
import type { Order, PaymentStatus, PaymentType } from '../types'
import { toast } from 'sonner'
import { toastError } from '../lib/errors'

type PaymentFilter = 'ALL' | PaymentStatus

const PAYMENT_VARIANTS: Record<PaymentStatus, 'success' | 'warning' | 'info'> = {
  PAID: 'success',
  PENDING: 'warning',
  PARTIAL: 'info',
}

/* ─── Payment edit modal ─────────────────────────────────── */
interface PaymentForm {
  paymentStatus: PaymentStatus
  paymentType: PaymentType | ''
  amount: string
  discount: string
}

interface PaymentModalProps {
  order: Order
  onClose: () => void
  onSave: (id: number, form: PaymentForm) => void
  saving: boolean
}

function PaymentModal({ order, onClose, onSave, saving }: PaymentModalProps) {
  const [form, setForm] = useState<PaymentForm>({
    paymentStatus: order.paymentStatus ?? 'PENDING',
    paymentType: order.paymentType ?? '',
    amount: String(order.amount ?? 0),
    discount: String(order.discount ?? 0),
  })

  const amount = parseFloat(form.amount) || 0
  const discount = parseFloat(form.discount) || 0
  const netAmount = Math.round(amount * (1 - discount / 100) * 100) / 100

  const set = (key: keyof PaymentForm, val: string) =>
    setForm(prev => ({ ...prev, [key]: val }))

  return (
    <Modal
      open
      onClose={onClose}
      title={`Update Payment — Order #${order.id}`}
      subtitle={`${order.patient?.fullName} · ${order.template?.name}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={() => onSave(order.id, form)}>Save Changes</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Amount (₹)" type="number" min={0} step="0.01"
            value={form.amount} onChange={e => set('amount', e.target.value)} />
          <Input label="Discount (%)" type="number" min={0} max={100} step="0.5"
            value={form.discount} onChange={e => set('discount', e.target.value)} />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 dark:border-blue-900 dark:bg-blue-900/20">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Net Amount</span>
          <span className="text-xl font-bold text-blue-800 dark:text-blue-300">
            ₹{netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">Payment Status</p>
          <div className="grid grid-cols-3 gap-2">
            {(['PENDING', 'PARTIAL', 'PAID'] as PaymentStatus[]).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => set('paymentStatus', s)}
                className={`rounded-lg border py-2 text-sm font-medium transition-all ${
                  form.paymentStatus === s
                    ? s === 'PAID'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : s === 'PARTIAL'
                        ? 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'
                }`}
              >
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">Payment Method</p>
          <div className="grid grid-cols-4 gap-2">
            {(['', 'CASH', 'CHEQUE', 'ONLINE'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => set('paymentType', m)}
                className={`rounded-lg border py-2 text-sm font-medium transition-all ${
                  form.paymentType === m
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'
                }`}
              >
                {m === '' ? 'None' : m.charAt(0) + m.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
          <span className="text-xs font-medium text-gray-400 dark:text-gray-500">Receipt #</span>
          <span className="font-mono text-sm text-gray-600 dark:text-gray-300">
            {order.receiptNumber ?? <span className="italic text-gray-400">Auto-generated on save</span>}
          </span>
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
  const [editOrder, setEditOrder] = useState<Order | null>(null)

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['orders'],
    queryFn: orderService.getAll,
  })

  // Pre-fetch lab settings and active signature for report generation
  const { data: labSettings = {} } = useQuery({
    queryKey: ['lab-settings'],
    queryFn: labSettingsService.getAll,
  })
  const { data: activeSignature = null } = useQuery({
    queryKey: ['active-signature'],
    queryFn: signatureService.getActive,
  })
  const { data: activeLogo = null } = useQuery({
    queryKey: ['logos', 'active'],
    queryFn: logoService.getActive,
  })

  const updatePayment = useMutation({
    mutationFn: ({ id, form }: { id: number; form: PaymentForm }) =>
      orderService.updatePayment(id, {
        paymentStatus: form.paymentStatus,
        paymentType: form.paymentType || null,
        amount: parseFloat(form.amount) || 0,
        discount: parseFloat(form.discount) || 0,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      setEditOrder(null)
      toast.success('Payment updated')
    },
    onError: (err) => toastError(err, 'Failed to update payment'),
  })

  // Directly generates & downloads the PDF report
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
        activeLogo,
      }).then(() => toast.success('Report downloaded')).catch(() => toast.error('Failed to generate report'))
    },
    onError: (err) => toastError(err, 'Failed to generate report'),
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
    mutationFn: (order: Order) =>
      generateReceipt({ order, labSettings, signature: activeSignature, activeLogo }),
    onSuccess: () => toast.success('Receipt downloaded'),
    onError: (err) => toastError(err, 'Failed to generate receipt'),
  })

  const plainReportMutation = useMutation({
    mutationFn: (orderId: number) => orderService.getResults(orderId),
    onSuccess: (data) => {
      generatePlainReport({
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
        activeLogo,
      }).then(() => toast.success('Plain report downloaded')).catch(() => toast.error('Failed to generate report'))
    },
    onError: (err) => toastError(err, 'Failed to generate report'),
  })

  const filtered = orders.filter(o => {
    const matchSearch = !search ||
      String(o.id).includes(search) ||
      (o.patient?.fullName ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (o.receiptNumber ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (o.patient?.patientCode ?? '').toLowerCase().includes(search.toLowerCase())
    const matchPayment = paymentFilter === 'ALL' || o.paymentStatus === paymentFilter
    return matchSearch && matchPayment
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
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
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
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Test</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Amount</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Net</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Method</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Payment</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Receipt #</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {filtered.map(order => (
                  <tr key={order.id} className="group hover:bg-gray-50/60 transition-colors dark:hover:bg-gray-700/30">
                    <td className="px-5 py-4">
                      <span className="font-bold text-gray-700 dark:text-gray-300">#{order.id}</span>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ''}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-800 dark:text-white">{order.patient?.fullName ?? '—'}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{order.patient?.patientCode ?? ''}</p>
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-300 max-w-[160px] truncate">{order.template?.name ?? '—'}</td>
                    <td className="px-5 py-4 text-gray-700 dark:text-gray-300">
                      <span>₹{Number(order.amount ?? 0).toLocaleString()}</span>
                      {(order.discount ?? 0) > 0 && (
                        <span className="ml-1.5 text-xs text-emerald-600">−{order.discount}%</span>
                      )}
                    </td>
                    <td className="px-5 py-4 font-bold text-gray-900 dark:text-white">₹{Number(order.netAmount ?? 0).toLocaleString()}</td>
                    <td className="px-5 py-4">
                      {order.paymentType ? (
                        <span className="inline-flex items-center rounded-lg bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 capitalize dark:bg-gray-700 dark:text-gray-300">
                          {order.paymentType.toLowerCase()}
                        </span>
                      ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={PAYMENT_VARIANTS[order.paymentStatus] ?? 'default'} dot>
                        {order.paymentStatus?.charAt(0) + order.paymentStatus?.slice(1).toLowerCase()}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-gray-500 dark:text-gray-400">
                      {order.receiptNumber ?? <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        {/* Edit payment */}
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Pencil className="h-3.5 w-3.5" />}
                          title="Edit Payment"
                          onClick={() => setEditOrder(order)}
                        />

                        {/* Receipt PDF */}
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<Receipt className="h-3.5 w-3.5" />}
                          title="Download Receipt"
                          loading={printReceiptMutation.isPending && printReceiptMutation.variables?.id === order.id}
                          onClick={() => printReceiptMutation.mutate(order)}
                        />

                        {order.status === 'APPROVED' && (
                          <Button
                            size="sm"
                            variant="success"
                            icon={<Download className="h-3.5 w-3.5" />}
                            title="Download Letterhead Report"
                            loading={downloadReport.isPending && downloadReport.variables === order.id}
                            onClick={() => downloadReport.mutate(order.id)}
                          />
                        )}

                        {order.status === 'APPROVED' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<FileText className="h-3.5 w-3.5" />}
                            title="Download Plain Report"
                            loading={plainReportMutation.isPending && plainReportMutation.variables === order.id}
                            onClick={() => plainReportMutation.mutate(order.id)}
                          />
                        )}

                        {order.status === 'APPROVED' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={<Share2 className="h-3.5 w-3.5" />}
                            title="Share Report Link"
                            loading={shareReport.isPending && shareReport.variables === order.id}
                            onClick={() => shareReport.mutate(order.id)}
                          />
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

      {/* Payment edit modal */}
      {editOrder && (
        <PaymentModal
          order={editOrder}
          onClose={() => setEditOrder(null)}
          saving={updatePayment.isPending}
          onSave={(id, form) => updatePayment.mutate({ id, form })}
        />
      )}
    </div>
  )
}

