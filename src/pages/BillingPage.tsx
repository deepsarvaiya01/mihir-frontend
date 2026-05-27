import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search, Receipt, ChevronDown, DollarSign,
  CheckCircle, Clock, FileText, Pencil, X,
  RefreshCw, Download,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { PageLoader } from '../components/ui/Spinner'
import { Badge } from '../components/ui/Badge'
import { orderService } from '../services/orders'
import { labSettingsService } from '../services/labSettings'
import { signatureService } from '../services/signatures'
import { generateLabReport } from '../utils/generateReport'
import type { Order, PaymentStatus, PaymentType } from '../types'
import { toast } from 'sonner'

type PaymentFilter = 'ALL' | PaymentStatus

const PAYMENT_VARIANTS: Record<PaymentStatus, 'success' | 'warning' | 'info'> = {
  PAID: 'success',
  PENDING: 'warning',
  PARTIAL: 'info',
}

/* ─── Receipt print helper ───────────────────────────────── */
function printReceipt(order: Order) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt ${order.receiptNumber ?? ''}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:40px;color:#111;max-width:480px;margin:0 auto}
    .header{text-align:center;border-bottom:2px solid #e5e7eb;padding-bottom:20px;margin-bottom:24px}
    .logo{font-size:22px;font-weight:800;color:#4f46e5;letter-spacing:-0.5px}
    .subtitle{font-size:12px;color:#6b7280;margin-top:4px}
    .receipt-title{font-size:18px;font-weight:700;margin:16px 0 4px}
    .receipt-num{font-size:13px;color:#6b7280}
    .section{margin-bottom:16px}
    .section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;margin-bottom:8px}
    .row{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#374151}
    .row:last-child{border-bottom:none}
    .row .label{color:#6b7280}
    .total-row{display:flex;justify-content:space-between;align-items:center;padding:12px 0 0;font-size:16px;font-weight:800;color:#111;border-top:2px solid #e5e7eb;margin-top:8px}
    .badge{display:inline-block;padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:600}
    .badge-paid{background:#dcfce7;color:#166534}
    .badge-pending{background:#fef9c3;color:#854d0e}
    .badge-partial{background:#dbeafe;color:#1e40af}
    .footer{text-align:center;margin-top:32px;font-size:11px;color:#9ca3af;border-top:1px solid #f1f5f9;padding-top:16px}
    @media print{body{padding:20px}.no-print{display:none}}
  </style></head><body>
  <div class="header">
    <div class="logo">LabOps</div>
    <div class="subtitle">Laboratory Information System</div>
    <div class="receipt-title">Payment Receipt</div>
    <div class="receipt-num">Receipt # ${order.receiptNumber ?? '—'}</div>
  </div>
  <div class="section">
    <div class="section-title">Patient Info</div>
    <div class="row"><span class="label">Patient</span><span>${order.patient?.fullName ?? '—'}</span></div>
    <div class="row"><span class="label">Patient Code</span><span>${order.patient?.patientCode ?? '—'}</span></div>
    ${order.patient?.doctorName ? `<div class="row"><span class="label">Doctor</span><span>${order.patient.doctorName}</span></div>` : ''}
    <div class="row"><span class="label">Date</span><span>${order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span></div>
  </div>
  <div class="section">
    <div class="section-title">Test Details</div>
    <div class="row"><span class="label">Test</span><span>${order.template?.name ?? '—'}</span></div>
    <div class="row"><span class="label">Code</span><span>${order.template?.code ?? '—'}</span></div>
  </div>
  <div class="section">
    <div class="section-title">Payment Details</div>
    <div class="row"><span class="label">Amount</span><span>₹${Number(order.amount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
    ${(order.discount ?? 0) > 0 ? `<div class="row"><span class="label">Discount (${order.discount}%)</span><span style="color:#16a34a">−₹${Math.round(Number(order.amount ?? 0) * (order.discount ?? 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>` : ''}
    <div class="total-row"><span>Net Amount</span><span>₹${Number(order.netAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
    <div class="row" style="margin-top:12px"><span class="label">Payment Method</span><span>${order.paymentType ? order.paymentType.charAt(0) + order.paymentType.slice(1).toLowerCase() : '—'}</span></div>
    <div class="row"><span class="label">Status</span>
      <span class="badge badge-${(order.paymentStatus ?? 'pending').toLowerCase()}">${order.paymentStatus ?? '—'}</span>
    </div>
  </div>
  <div class="footer">Thank you for choosing our laboratory services.<br>This is a computer-generated receipt.</div>
  </body></html>`
  const w = window.open('', '_blank')
  if (!w) { toast.error('Pop-up blocked. Please allow pop-ups and try again.'); return }
  w.document.write(html); w.document.close(); w.focus()
  setTimeout(() => w.print(), 300)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Update Payment — Order #{order.id}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {order.patient?.fullName} · {order.template?.name}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {/* Amount + Discount row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Amount (₹)
              </label>
              <input
                type="number" min="0" step="0.01"
                value={form.amount}
                onChange={e => set('amount', e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Discount (%)
              </label>
              <input
                type="number" min="0" max="100" step="0.5"
                value={form.discount}
                onChange={e => set('discount', e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          {/* Net amount (read-only calculated) */}
          <div className="flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
            <span className="text-sm font-medium text-indigo-700">Net Amount</span>
            <span className="text-xl font-bold text-indigo-800">
              ₹{netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Payment status */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Payment Status <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['PENDING', 'PARTIAL', 'PAID'] as PaymentStatus[]).map(s => (
                <button
                  key={s}
                  onClick={() => set('paymentStatus', s)}
                  className={`rounded-xl border-2 py-2.5 text-sm font-semibold transition-all ${
                    form.paymentStatus === s
                      ? s === 'PAID'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : s === 'PARTIAL'
                          ? 'border-blue-400 bg-blue-50 text-blue-700'
                          : 'border-amber-400 bg-amber-50 text-amber-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Payment method */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Payment Method
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['', 'CASH', 'CHEQUE', 'ONLINE'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => set('paymentType', m)}
                  className={`rounded-xl border-2 py-2.5 text-sm font-semibold transition-all ${
                    form.paymentType === m
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {m === '' ? 'None' : m.charAt(0) + m.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Receipt number info */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Receipt #</span>
            <span className="font-mono text-sm text-slate-600">
              {order.receiptNumber ?? <span className="italic text-slate-400">Auto-generated on save</span>}
            </span>
          </div>
        </div>

        {/* footer */}
        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(order.id, form)}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
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
    onError: () => toast.error('Failed to update payment'),
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
      })
      toast.success('Report downloaded')
    },
    onError: () => toast.error('Failed to generate report'),
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
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
                <DollarSign className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total Billed</p>
                <p className="text-xl font-bold text-slate-900">₹{totalRevenue.toLocaleString()}</p>
              </div>
            </div>
          </Card>
          <Card padding="md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Collected</p>
                <p className="text-xl font-bold text-emerald-700">₹{paidRevenue.toLocaleString()}</p>
              </div>
            </div>
          </Card>
          <Card padding="md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Pending</p>
                <p className="text-xl font-bold text-amber-700">₹{pendingRevenue.toLocaleString()}</p>
              </div>
            </div>
          </Card>
          <Card padding="md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
                <FileText className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Reports Ready</p>
                <p className="text-xl font-bold text-violet-700">{approvedCount}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by patient, order #, receipt..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div className="relative">
            <select
              value={paymentFilter}
              onChange={e => setPaymentFilter(e.target.value as PaymentFilter)}
              className="appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-4 pr-9 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="ALL">All Payment Statuses</option>
              <option value="PAID">Paid</option>
              <option value="PENDING">Pending</option>
              <option value="PARTIAL">Partial</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <span className="self-center ml-auto text-sm text-slate-500">
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
          <div className="overflow-x-auto overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Order</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Patient</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Test</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Amount</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Net</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Method</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Payment</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Receipt #</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(order => (
                  <tr key={order.id} className="group hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-4">
                      <span className="font-bold text-slate-700">#{order.id}</span>
                      <p className="text-[11px] text-slate-400">{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ''}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-800">{order.patient?.fullName ?? '—'}</p>
                      <p className="text-xs text-slate-400">{order.patient?.patientCode ?? ''}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-600 max-w-[160px] truncate">{order.template?.name ?? '—'}</td>
                    <td className="px-5 py-4 text-slate-700">
                      <span>₹{Number(order.amount ?? 0).toLocaleString()}</span>
                      {(order.discount ?? 0) > 0 && (
                        <span className="ml-1.5 text-xs text-emerald-600">−{order.discount}%</span>
                      )}
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-900">₹{Number(order.netAmount ?? 0).toLocaleString()}</td>
                    <td className="px-5 py-4">
                      {order.paymentType ? (
                        <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 capitalize">
                          {order.paymentType.toLowerCase()}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={PAYMENT_VARIANTS[order.paymentStatus] ?? 'default'} dot>
                        {order.paymentStatus?.charAt(0) + order.paymentStatus?.slice(1).toLowerCase()}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-500">
                      {order.receiptNumber ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        {/* Update payment */}
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Pencil className="h-3.5 w-3.5" />}
                          onClick={() => setEditOrder(order)}
                        >
                          Payment
                        </Button>

                        {/* Receipt — always available (pending orders show without receipt number) */}
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<Receipt className="h-3.5 w-3.5" />}
                          onClick={() => printReceipt(order)}
                        >
                          Receipt
                        </Button>

                        {order.status === 'APPROVED' && (
                          <Button
                            size="sm"
                            variant="success"
                            icon={<Download className="h-3.5 w-3.5" />}
                            loading={downloadReport.isPending && downloadReport.variables === order.id}
                            onClick={() => downloadReport.mutate(order.id)}
                          >
                            Report
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
