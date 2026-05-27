import { useRef, useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Calculator,
  CheckCircle2,
  FileText,
  Paperclip,
  Send,
  Trash2,
  Upload,
  User,
} from 'lucide-react'
import { toast } from 'sonner'
import { orderService } from '../services/orders'
import { OrderStatusBadge } from '../components/ui/Badge'
import { Input, Select } from '../components/ui/Input'
import type { TestTemplateField } from '../types'

/* ─── formula evaluator ─────────────────────────────────── */
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/* ─── card wrapper ───────────────────────────────────────── */
function FormCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4">
        <span className="text-indigo-600">{icon}</span>
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

/* ─── single result field ────────────────────────────────── */
function ResultField({
  field,
  values,
  onChange,
}: {
  field: TestTemplateField
  values: Record<number, string | boolean>
  onChange: (id: number, val: string | boolean) => void
}) {
  if (field.fieldType === 'calculated') {
    const computed = evalFormula(field.optionsJson, values)
    return (
      <div className="relative">
        <Calculator className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-500" />
        <input
          type="number" value={computed} readOnly
          className="w-full cursor-not-allowed rounded-xl border border-amber-200 bg-amber-50 py-2.5 pl-10 pr-14 text-sm font-semibold text-amber-800 outline-none"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-amber-500">auto</span>
      </div>
    )
  }

  const value = values[field.id]

  if (field.fieldType === 'checkbox') {
    return (
      <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 hover:bg-slate-100">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={e => onChange(field.id, e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
        />
        <span className="text-sm text-slate-700">{Boolean(value) ? 'Yes' : 'No'}</span>
      </label>
    )
  }

  if (field.fieldType === 'select') {
    const options = field.optionsJson ? (JSON.parse(field.optionsJson) as string[]) : []
    return (
      <Select value={String(value ?? '')} onChange={e => onChange(field.id, e.target.value)}>
        <option value="">Select option</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </Select>
    )
  }

  return (
    <Input
      type={field.fieldType === 'number' ? 'number' : field.fieldType === 'date' ? 'date' : 'text'}
      value={String(value ?? '')}
      onChange={e => onChange(field.id, e.target.value)}
      placeholder={field.fieldType === 'number' ? '0.00' : 'Enter value'}
    />
  )
}

/* ─── main page ──────────────────────────────────────────── */
export default function EnterResultsPage() {
  const { id } = useParams<{ id: string }>()
  const orderId = Number(id)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [values, setValues] = useState<Record<number, string | boolean>>({})
  const [attachment, setAttachment] = useState<{ name: string; size: number; base64: string } | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const { data: form, isLoading, isError } = useQuery({
    queryKey: ['order-form', orderId],
    queryFn: () => orderService.getForm(orderId),
    enabled: !isNaN(orderId),
  })

  // Reset values when form loads
  useEffect(() => {
    if (form) setValues({})
  }, [form?.order.id])

  const submitMut = useMutation({
    mutationFn: () =>
      orderService.submitResults(orderId, {
        // Section headers have no value — skip them
        values: (form?.fields ?? []).filter(f => !f.isSectionHeader).map(field => ({
          fieldId: field.id,
          textValue: field.fieldType === 'text' || field.fieldType === 'select'
            ? String(values[field.id] ?? '') : undefined,
          numberValue: field.fieldType === 'number' && values[field.id] !== undefined
            ? Number(values[field.id])
            : field.fieldType === 'calculated'
              ? evalFormula(field.optionsJson, values)
              : undefined,
          booleanValue: field.fieldType === 'checkbox' ? Boolean(values[field.id]) : undefined,
          dateValue: field.fieldType === 'date' ? String(values[field.id] ?? '') : undefined,
        })),
        ...(attachment ? { attachmentBase64: attachment.base64, attachmentName: attachment.name } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      toast.success('Results submitted for approval')
      navigate('/orders')
    },
    onError: (err: unknown) =>
      toast.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || 'Failed to submit results'
      ),
  })

  /* ── PDF handling ── */
  const handlePdfFile = (file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are allowed')
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error('PDF must be under 15 MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setAttachment({ name: file.name, size: file.size, base64: reader.result as string })
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handlePdfFile(file)
  }

  /* ── guards ── */
  if (isNaN(orderId)) {
    return <div className="p-8 text-center text-slate-500">Invalid order ID.</div>
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  if (isError || !form) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">Could not load order form.</p>
        <button onClick={() => navigate('/orders')} className="mt-3 text-sm text-indigo-600 hover:underline">
          ← Back to Orders
        </button>
      </div>
    )
  }

  const { order, fields } = form

  return (
    <div>
      {/* Sticky page header */}
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-4 px-6 py-4">
          <button
            onClick={() => navigate('/orders')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-slate-900">
              Enter Results — Order #{order.id}
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {order.template?.name} · {order.patient?.fullName}
            </p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-6 p-6">

        {/* Patient info */}
        <FormCard title="Patient Information" icon={<User className="h-4 w-4" />}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Patient</p>
              <p className="mt-0.5 font-semibold text-slate-800">{order.patient?.fullName ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Code</p>
              <p className="mt-0.5 font-mono text-sm text-slate-700">{order.patient?.patientCode ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Test</p>
              <p className="mt-0.5 font-semibold text-slate-800">{order.template?.name ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Order Date</p>
              <p className="mt-0.5 text-sm text-slate-700">
                {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
              </p>
            </div>
          </div>
        </FormCard>

        {/* Result fields */}
        <FormCard title="Test Results" icon={<FileText className="h-4 w-4" />}>
          {fields.length === 0 ? (
            <p className="text-center text-sm text-slate-400">No fields defined for this test template.</p>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {fields.map(field => {
                // Section headers render as bold dividers, not inputs
                if (field.isSectionHeader) {
                  return (
                    <div key={field.id} className="sm:col-span-2 pt-2">
                      <div className="border-b-2 border-slate-200 pb-1.5">
                        <span className="text-sm font-bold text-slate-700 underline underline-offset-2">
                          {field.fieldName}
                        </span>
                      </div>
                    </div>
                  )
                }
                return (
                  <div
                    key={field.id}
                    className={field.fieldType === 'text' && !field.optionsJson ? 'sm:col-span-2' : ''}
                  >
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {field.fieldName}
                      {field.unit && (
                        <span className="ml-1 normal-case font-normal text-slate-400">({field.unit})</span>
                      )}
                      {field.required && <span className="ml-1 text-rose-500">*</span>}
                    </label>
                    <ResultField
                      field={field}
                      values={values}
                      onChange={(fid, val) => setValues(prev => ({ ...prev, [fid]: val }))}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </FormCard>

        {/* PDF attachment */}
        <FormCard title="Attach Document (optional)" icon={<Paperclip className="h-4 w-4" />}>
          <p className="mb-4 text-xs text-slate-500">
            Attach a PDF document (e.g. external lab report, referral letter). It will be merged with the final report.
          </p>

          {attachment ? (
            /* Attached file preview */
            <div className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-100">
                  <FileText className="h-5 w-5 text-rose-600" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{attachment.name}</p>
                  <p className="text-xs text-slate-500">{formatBytes(attachment.size)} · PDF</p>
                </div>
              </div>
              <button
                onClick={() => { setAttachment(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                className="ml-3 shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ) : (
            /* Drop zone */
            <div
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition-colors
                ${dragOver
                  ? 'border-indigo-400 bg-indigo-50'
                  : 'border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/40'
                }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload className="mb-3 h-8 w-8 text-slate-400" />
              <p className="text-sm font-medium text-slate-600">
                Drop PDF here or <span className="text-indigo-600">browse</span>
              </p>
              <p className="mt-1 text-xs text-slate-400">PDF only · max 15 MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handlePdfFile(f) }}
              />
            </div>
          )}
        </FormCard>

        {/* Footer actions */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
          <button
            onClick={() => navigate('/orders')}
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" /> Cancel
          </button>

          <div className="flex items-center gap-3">
            {attachment && (
              <div className="flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                <Paperclip className="h-3.5 w-3.5" />
                PDF attached
              </div>
            )}
            <button
              onClick={() => submitMut.mutate()}
              disabled={submitMut.isPending || fields.length === 0}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
            >
              {submitMut.isPending ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Submit for Approval
            </button>
          </div>
        </div>

        {/* Success hint */}
        {submitMut.isSuccess && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Results submitted! Redirecting…
          </div>
        )}
      </div>
    </div>
  )
}
