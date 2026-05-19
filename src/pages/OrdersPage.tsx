import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ClipboardList, Search, FileText, Printer, ChevronDown, Trash2, RotateCcw, Calculator } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Input'
import { Modal, ConfirmModal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { PageLoader } from '../components/ui/Spinner'
import { OrderStatusBadge } from '../components/ui/Badge'
import { orderService, type SubmitResultsDto } from '../services/orders'
import type { Order, OrderFormData, OrderResult, TestTemplateField } from '../types'
import { patientService } from '../services/patients'
import { templateService } from '../services/templates'
import { toast } from 'sonner'

function evalFormula(optionsJson: string | null, values: Record<number, string | boolean>): number {
  if (!optionsJson) return 0
  try {
    const steps: Array<{ fieldId?: number; op?: string }> = JSON.parse(optionsJson)
    let result = 0
    let pendingOp: string | null = null
    let isFirst = true
    for (const step of steps) {
      if ('fieldId' in step && step.fieldId !== undefined) {
        const val = Number(values[step.fieldId] ?? 0) || 0
        if (isFirst) { result = val; isFirst = false }
        else if (pendingOp === '+') result += val
        else if (pendingOp === '-') result -= val
        else if (pendingOp === '*') result *= val
        else if (pendingOp === '/') result = val !== 0 ? result / val : 0
        pendingOp = null
      } else if ('op' in step) {
        pendingOp = step.op!
      }
    }
    return Math.round(result * 1000) / 1000
  } catch {
    return 0
  }
}

type StatusFilter = 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'AWAITING_APPROVAL' | 'APPROVED' | 'REJECTED'

export default function OrdersPage() {
  const qc = useQueryClient()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [resultModalOpen, setResultModalOpen] = useState(false)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [deleteOrder, setDeleteOrder] = useState<Order | null>(null)
  const [reopenOrder, setReopenOrder] = useState<Order | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [orderForm, setOrderForm] = useState({ patientId: '', templateId: '' })
  const [selectedOrderForm, setSelectedOrderForm] = useState<OrderFormData | null>(null)
  const [selectedReport, setSelectedReport] = useState<OrderResult | null>(null)
  const [resultValues, setResultValues] = useState<Record<number, string | boolean>>({})

  const { data: orders = [], isLoading } = useQuery({ queryKey: ['orders'], queryFn: orderService.getAll })
  const { data: patients = [] } = useQuery({ queryKey: ['patients'], queryFn: () => patientService.getAll() })
  const { data: templates = [] } = useQuery({ queryKey: ['templates'], queryFn: templateService.getAll })

  const createOrder = useMutation({
    mutationFn: () => orderService.create({ patientId: Number(orderForm.patientId), templateId: Number(orderForm.templateId) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      setOrderForm({ patientId: '', templateId: '' })
      setCreateModalOpen(false)
      toast.success('Diagnostic order created')
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create order'),
  })

  const loadOrderForm = useMutation({
    mutationFn: (orderId: number) => orderService.getForm(orderId),
    onSuccess: (data) => {
      setSelectedOrderForm(data)
      setResultValues({})
      setResultModalOpen(true)
    },
    onError: () => toast.error('Failed to load order form'),
  })

  const loadOrderResults = useMutation({
    mutationFn: (orderId: number) => orderService.getResults(orderId),
    onSuccess: (data) => {
      setSelectedReport(data)
      setReportModalOpen(true)
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
      toast.success(`Order #${order.id} reopened — results cleared, ready for re-entry`)
    },
    onError: () => toast.error('Failed to reopen order'),
  })

  const submitResults = useMutation({
    mutationFn: (dto: SubmitResultsDto) => orderService.submitResults(selectedOrderForm!.order.id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      setResultModalOpen(false)
      setSelectedOrderForm(null)
      toast.success('Results submitted for approval')
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to submit results'),
  })

  const handleSubmitResults = () => {
    if (!selectedOrderForm) return
    const values: SubmitResultsDto['values'] = selectedOrderForm.fields.map(field => ({
      fieldId: field.id,
      textValue: field.fieldType === 'text' || field.fieldType === 'select' ? String(resultValues[field.id] ?? '') : undefined,
      numberValue: field.fieldType === 'number' && resultValues[field.id] !== undefined
        ? Number(resultValues[field.id])
        : field.fieldType === 'calculated'
        ? evalFormula(field.optionsJson, resultValues)
        : undefined,
      booleanValue: field.fieldType === 'checkbox' ? Boolean(resultValues[field.id]) : undefined,
      dateValue: field.fieldType === 'date' ? String(resultValues[field.id] ?? '') : undefined,
    }))
    submitResults.mutate({ values })
  }

  const printReport = (report: OrderResult) => {
    const html = `
      <html><head><title>Order #${report.order.id} Report</title>
      <style>body{font-family:system-ui,sans-serif;padding:32px;color:#111;max-width:700px;margin:0 auto}
      h1{font-size:24px;font-weight:700;margin-bottom:4px}
      .meta{color:#555;font-size:14px;margin-bottom:24px;border-bottom:1px solid #e5e7eb;padding-bottom:16px}
      .badge{display:inline-block;padding:4px 12px;border-radius:9999px;font-size:12px;font-weight:600;background:#dcfce7;color:#166534}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th{background:#f8fafc;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;padding:10px 12px;text-align:left;border-bottom:2px solid #e5e7eb}
      td{padding:12px;border-bottom:1px solid #f1f5f9;font-size:14px}
      tr:last-child td{border-bottom:none}
      @media print{body{padding:16px}}</style>
      </head><body>
      <h1>Order #${report.order.id} — Test Report</h1>
      <div class="meta">
        <p><strong>Patient:</strong> ${report.order.patient?.fullName ?? '—'} (${report.order.patient?.patientCode ?? '—'})</p>
        <p><strong>Test:</strong> ${report.order.template?.name ?? '—'} (${report.order.template?.code ?? '—'})</p>
        <p><strong>Status:</strong> <span class="badge">${report.order.status}</span></p>
        <p><strong>Date:</strong> ${report.order.createdAt ? new Date(report.order.createdAt).toLocaleString() : '—'}</p>
      </div>
      <table>
        <thead><tr><th>Parameter</th><th>Result</th><th>Unit</th></tr></thead>
        <tbody>${report.results.map(r => `<tr><td>${r.fieldName}</td><td><strong>${String(r.value)}</strong></td><td>${r.unit ?? '—'}</td></tr>`).join('')}</tbody>
      </table>
      </body></html>`
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
    w.print()
  }

  const renderResultField = (field: TestTemplateField) => {
    if (field.fieldType === 'calculated') {
      const computed = evalFormula(field.optionsJson, resultValues)
      return (
        <div className="relative">
          <Calculator className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-500" />
          <input
            type="number"
            value={computed}
            readOnly
            className="w-full cursor-not-allowed rounded-xl border border-amber-200 bg-amber-50 py-2.5 pl-10 pr-4 text-sm font-medium text-amber-800 outline-none"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-amber-500">auto</span>
        </div>
      )
    }
    const value = resultValues[field.id]
    if (field.fieldType === 'checkbox') {
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={e => setResultValues(p => ({ ...p, [field.id]: e.target.checked }))}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm text-slate-600">Yes</span>
        </label>
      )
    }
    if (field.fieldType === 'select') {
      const options = field.optionsJson ? (JSON.parse(field.optionsJson) as string[]) : []
      return (
        <Select value={String(value ?? '')} onChange={e => setResultValues(p => ({ ...p, [field.id]: e.target.value }))}>
          <option value="">Select option</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </Select>
      )
    }
    return (
      <Input
        type={field.fieldType === 'number' ? 'number' : field.fieldType === 'date' ? 'date' : 'text'}
        value={String(value ?? '')}
        onChange={e => setResultValues(p => ({ ...p, [field.id]: e.target.value }))}
        placeholder={field.fieldType === 'number' ? '0.00' : 'Enter value'}
      />
    )
  }

  const filtered = orders.filter(o => {
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
        subtitle="Create diagnostic orders and enter test results"
        action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateModalOpen(true)}>New Order</Button>}
      />

      <div className="p-6 space-y-5">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search orders..."
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
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
          <span className="self-center text-sm text-slate-500 ml-auto">{filtered.length} order{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {isLoading ? (
          <PageLoader />
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-12 w-12" />}
            title="No orders yet"
            description="Create your first diagnostic order to get started"
            action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateModalOpen(true)}>Create Order</Button>}
          />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Search className="h-10 w-10" />} title="No orders found" description="Try adjusting your search or filter" />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
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
                    <td className="px-5 py-4 font-bold text-slate-700">#{order.id}</td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-800">{order.patient?.fullName ?? '—'}</p>
                      <p className="text-xs text-slate-400">{order.patient?.patientCode ?? ''}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{order.template?.name ?? '—'}</td>
                    <td className="px-5 py-4"><OrderStatusBadge status={order.status} /></td>
                    <td className="px-5 py-4 text-xs text-slate-400">
                      {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        {(order.status === 'PENDING' || order.status === 'IN_PROGRESS') && (
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={<FileText className="h-3.5 w-3.5" />}
                            loading={loadOrderForm.isPending && loadOrderForm.variables === order.id}
                            onClick={() => loadOrderForm.mutate(order.id)}
                          >
                            Enter Results
                          </Button>
                        )}
                        {order.status === 'APPROVED' && (
                          <Button
                            size="sm"
                            variant="success"
                            icon={<Printer className="h-3.5 w-3.5" />}
                            loading={loadOrderResults.isPending && loadOrderResults.variables === order.id}
                            onClick={() => loadOrderResults.mutate(order.id)}
                          >
                            View Report
                          </Button>
                        )}
                        {order.status === 'AWAITING_APPROVAL' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<FileText className="h-3.5 w-3.5" />}
                            onClick={() => loadOrderResults.mutate(order.id)}
                          >
                            View Submitted
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
                        {(order.status === 'PENDING' || order.status === 'REJECTED') && (
                          <Button
                            size="sm"
                            variant="ghost"
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
          <Select label="Patient" value={orderForm.patientId} onChange={e => setOrderForm(p => ({ ...p, patientId: e.target.value }))} required>
            <option value="">Select a patient</option>
            {patients.map(p => <option key={p.id} value={p.id}>{p.fullName} ({p.patientCode})</option>)}
          </Select>
          <Select label="Test Template" value={orderForm.templateId} onChange={e => setOrderForm(p => ({ ...p, templateId: e.target.value }))} required>
            <option value="">Select a test</option>
            {templates.filter(t => t.active).map(t => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
          </Select>
        </div>
      </Modal>

      {/* Result Entry Modal */}
      <Modal
        open={resultModalOpen}
        onClose={() => setResultModalOpen(false)}
        title={`Enter Results — Order #${selectedOrderForm?.order.id ?? ''}`}
        subtitle={selectedOrderForm?.order.template?.name}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setResultModalOpen(false)}>Cancel</Button>
            <Button loading={submitResults.isPending} onClick={handleSubmitResults}>Submit for Approval</Button>
          </>
        }
      >
        {selectedOrderForm && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
              <div>
                <p className="font-semibold text-slate-800">Patient: {selectedOrderForm.order.patient?.fullName ?? '—'}</p>
                <p className="text-sm text-slate-500">Order #{selectedOrderForm.order.id} · {selectedOrderForm.order.template?.name}</p>
              </div>
              <OrderStatusBadge status={selectedOrderForm.order.status} />
            </div>
            {selectedOrderForm.fields.map(field => (
              <div key={field.id}>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {field.fieldName}
                  {field.unit && <span className="ml-1 text-slate-400 normal-case">({field.unit})</span>}
                  {field.required && <span className="ml-1 text-rose-500">*</span>}
                </label>
                {renderResultField(field)}
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Reopen Order Confirm */}
      <ConfirmModal
        open={!!reopenOrder}
        onClose={() => setReopenOrder(null)}
        onConfirm={() => reopenOrder && reopenMutation.mutate(reopenOrder.id)}
        title="Re-open Order"
        message={`Re-open Order #${reopenOrder?.id}? All previously submitted results will be cleared and the order will return to Pending status so results can be re-entered.`}
        confirmLabel="Re-open Order"
        variant="primary"
        loading={reopenMutation.isPending}
      />

      {/* Delete Order Confirm */}
      <ConfirmModal
        open={!!deleteOrder}
        onClose={() => setDeleteOrder(null)}
        onConfirm={() => deleteOrder && removeOrder.mutate(deleteOrder.id)}
        title="Delete Order"
        message={`Delete Order #${deleteOrder?.id}? This will permanently remove the order and any submitted results. This action cannot be undone.`}
        confirmLabel="Delete Order"
        variant="danger"
        loading={removeOrder.isPending}
      />

      {/* Report View Modal */}
      <Modal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        title={`Test Report — Order #${selectedReport?.order.id ?? ''}`}
        subtitle={selectedReport?.order.patient?.fullName}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReportModalOpen(false)}>Close</Button>
            {selectedReport && (
              <Button variant="primary" icon={<Printer className="h-4 w-4" />} onClick={() => printReport(selectedReport)}>
                Print / Export
              </Button>
            )}
          </>
        }
      >
        {selectedReport && (
          <div>
            <div className="mb-5 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm">
              <div><span className="text-slate-400">Patient:</span> <span className="font-medium text-slate-800">{selectedReport.order.patient?.fullName ?? '—'}</span></div>
              <div><span className="text-slate-400">Code:</span> <span className="font-mono font-medium text-slate-700">{selectedReport.order.patient?.patientCode ?? '—'}</span></div>
              <div><span className="text-slate-400">Test:</span> <span className="font-medium text-slate-800">{selectedReport.order.template?.name ?? '—'}</span></div>
              <div><span className="text-slate-400">Status:</span> <OrderStatusBadge status={selectedReport.order.status} /></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {selectedReport.results.map((result, i) => (
                <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 hover:border-indigo-200 transition-colors">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">{result.fieldName}</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {String(result.value)}
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
