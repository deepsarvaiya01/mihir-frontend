import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Search, Receipt, Printer, ChevronDown, DollarSign,
  CheckCircle, Clock, AlertCircle, FileText,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { PageLoader } from '../components/ui/Spinner'
import { Badge } from '../components/ui/Badge'
import { orderService } from '../services/orders'
import type { Order, OrderResult, PaymentStatus } from '../types'
import { toast } from 'sonner'

type PaymentFilter = 'ALL' | PaymentStatus

const PAYMENT_VARIANTS: Record<PaymentStatus, 'success' | 'warning' | 'info'> = {
  PAID: 'success',
  PENDING: 'warning',
  PARTIAL: 'info',
}

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
    ${order.isEmergency ? '<div class="row"><span class="label">Type</span><span style="color:#d97706;font-weight:600">⚡ Emergency</span></div>' : ''}
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
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 300)
}

function printReport(report: OrderResult) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Lab Report — Order #${report.order.id}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:40px;color:#111;max-width:700px;margin:0 auto}
    .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #4f46e5;padding-bottom:20px;margin-bottom:24px}
    .logo{font-size:22px;font-weight:800;color:#4f46e5}
    .logo small{display:block;font-size:11px;font-weight:400;color:#6b7280;margin-top:2px}
    .report-title{text-align:right}
    .report-title h2{font-size:18px;font-weight:700;color:#111}
    .report-title .order-num{font-size:12px;color:#6b7280;margin-top:3px}
    .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:24px;font-size:13px}
    .info-item .label{color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em}
    .info-item .value{color:#111;font-weight:500;margin-top:2px}
    .approved{display:inline-block;background:#dcfce7;color:#166534;padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:700;letter-spacing:0.03em}
    .section-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#4f46e5;margin-bottom:12px;border-bottom:2px solid #e0e7ff;padding-bottom:6px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{background:#f8fafc;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#6b7280;padding:10px 14px;text-align:left;border-bottom:2px solid #e5e7eb}
    td{padding:12px 14px;border-bottom:1px solid #f1f5f9;color:#374151}
    td.value{font-weight:700;font-size:15px;color:#111}
    td.unit{color:#9ca3af;font-size:12px}
    tr:last-child td{border-bottom:none}
    .footer{margin-top:32px;border-top:1px solid #e5e7eb;padding-top:16px;font-size:11px;color:#9ca3af;display:flex;justify-content:space-between}
    @media print{body{padding:20px}}
  </style></head><body>
  <div class="header">
    <div class="logo">LabOps<small>Laboratory Information System</small></div>
    <div class="report-title">
      <h2>Laboratory Test Report</h2>
      <div class="order-num">Order #${report.order.id}</div>
    </div>
  </div>
  <div class="info-grid">
    <div class="info-item"><div class="label">Patient Name</div><div class="value">${report.order.patient?.fullName ?? '—'}</div></div>
    <div class="info-item"><div class="label">Patient Code</div><div class="value">${report.order.patient?.patientCode ?? '—'}</div></div>
    <div class="info-item"><div class="label">Test Name</div><div class="value">${report.order.template?.name ?? '—'}</div></div>
    <div class="info-item"><div class="label">Test Code</div><div class="value">${report.order.template?.code ?? '—'}</div></div>
    ${report.order.patient?.doctorName ? `<div class="info-item"><div class="label">Referring Doctor</div><div class="value">${report.order.patient.doctorName}</div></div>` : ''}
    <div class="info-item"><div class="label">Report Date</div><div class="value">${report.order.createdAt ? new Date(report.order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}</div></div>
    <div class="info-item"><div class="label">Status</div><div class="value"><span class="approved">✓ APPROVED</span></div></div>
  </div>
  <div class="section-title">Test Results</div>
  <table>
    <thead><tr><th>Parameter</th><th>Result</th><th>Unit</th></tr></thead>
    <tbody>
      ${report.results.map(r => `<tr><td>${r.fieldName}</td><td class="value">${String(r.value ?? '—')}</td><td class="unit">${r.unit ?? '—'}</td></tr>`).join('')}
    </tbody>
  </table>
  <div class="footer">
    <span>Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
    <span>This is a computer-generated report.</span>
  </div>
  </body></html>`
  const w = window.open('', '_blank')
  if (!w) { toast.error('Pop-up blocked. Please allow pop-ups and try again.'); return }
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 300)
}

export default function BillingPage() {
  const [search, setSearch] = useState('')
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('ALL')
  const [reportModal, setReportModal] = useState<OrderResult | null>(null)

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: orderService.getAll,
  })

  const loadReport = useMutation({
    mutationFn: (id: number) => orderService.getResults(id),
    onSuccess: data => setReportModal(data),
    onError: () => toast.error('Failed to load report'),
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
                  <tr key={order.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-700">#{order.id}</span>
                        {order.isEmergency && (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">⚡ EMRG</span>
                        )}
                      </div>
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
                    <td className="px-5 py-4 font-mono text-xs text-slate-500">{order.receiptNumber ?? <span className="text-slate-300">—</span>}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        {order.receiptNumber && (
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={<Receipt className="h-3.5 w-3.5" />}
                            onClick={() => printReceipt(order)}
                          >
                            Receipt
                          </Button>
                        )}
                        {order.status === 'APPROVED' && (
                          <Button
                            size="sm"
                            variant="success"
                            icon={<Printer className="h-3.5 w-3.5" />}
                            loading={loadReport.isPending && loadReport.variables === order.id}
                            onClick={() => loadReport.mutate(order.id)}
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

      {/* Report Preview Modal */}
      <Modal
        open={!!reportModal}
        onClose={() => setReportModal(null)}
        title={`Lab Report — Order #${reportModal?.order.id ?? ''}`}
        subtitle={reportModal?.order.patient?.fullName}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReportModal(null)}>Close</Button>
            {reportModal && (
              <Button variant="primary" icon={<Printer className="h-4 w-4" />} onClick={() => printReport(reportModal)}>
                Print / Download
              </Button>
            )}
          </>
        }
      >
        {reportModal && (
          <div>
            <div className="mb-5 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm">
              <div>
                <span className="text-slate-400 text-xs uppercase tracking-wide">Patient</span>
                <p className="font-semibold text-slate-800 mt-0.5">{reportModal.order.patient?.fullName ?? '—'}</p>
              </div>
              <div>
                <span className="text-slate-400 text-xs uppercase tracking-wide">Code</span>
                <p className="font-mono font-semibold text-slate-700 mt-0.5">{reportModal.order.patient?.patientCode ?? '—'}</p>
              </div>
              <div>
                <span className="text-slate-400 text-xs uppercase tracking-wide">Test</span>
                <p className="font-semibold text-slate-800 mt-0.5">{reportModal.order.template?.name ?? '—'}</p>
              </div>
              <div>
                <span className="text-slate-400 text-xs uppercase tracking-wide">Status</span>
                <p className="mt-0.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                    <AlertCircle className="h-3 w-3" /> APPROVED
                  </span>
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {reportModal.results.map((result, i) => (
                <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 hover:border-indigo-200 transition-colors">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">{result.fieldName}</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">
                    {String(result.value ?? '—')}
                    {result.unit && <span className="ml-1.5 text-sm font-normal text-slate-400">{result.unit}</span>}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
