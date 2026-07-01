import { useRef, useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Calculator,
  CheckCircle2,
  FileText,
  Info,
  Lock,
  Paperclip,
  Save,
  Send,
  Trash2,
  Undo2,
  Upload,
  User,
} from 'lucide-react'
import { toast } from 'sonner'
import { toastError } from '../lib/errors'
import { orderService } from '../services/orders'
import { OrderStatusBadge } from '../components/ui/Badge'
import { Header } from '../components/layout/Header'
import { PageContent } from '../components/ui/PageContent'
import { PageLoader } from '../components/ui/Spinner'
import { Input, Select } from '../components/ui/Input'
import type { TestTemplateField } from '../types'

/* ─── formula evaluator ─────────────────────────────────── */
function evalFormula(optionsJson: string | null, values: Record<number, string | boolean>): number {
  if (!optionsJson) return 0
  try {
    const steps: Array<{ fieldId?: number; op?: string; value?: number }> = JSON.parse(optionsJson)
    let result = 0
    let pendingOp: string | null = null
    let isFirst = true
    const applyOp = (val: number) => {
      if (isFirst) { result = val; isFirst = false; return }
      if (pendingOp === '+') result += val
      else if (pendingOp === '-') result -= val
      else if (pendingOp === '*') result *= val
      else if (pendingOp === '/') result = val !== 0 ? result / val : 0
      pendingOp = null
    }
    for (const step of steps) {
      if ('fieldId' in step && step.fieldId !== undefined) {
        applyOp(Number(values[step.fieldId] ?? 0) || 0)
      } else if ('value' in step && step.value !== undefined) {
        applyOp(Number(step.value) || 0)
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
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center gap-2 border-b border-gray-100 px-6 py-4 dark:border-gray-700">
        <span className="text-blue-600">{icon}</span>
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</h2>
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
          className="w-full cursor-not-allowed rounded-xl border border-amber-200 bg-amber-50 py-2.5 pl-10 pr-14 text-sm font-semibold text-amber-800 outline-none dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-300"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-amber-500 dark:text-amber-400">auto</span>
      </div>
    )
  }

  const value = values[field.id]

  if (field.fieldType === 'checkbox') {
    return (
      <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-700/40 dark:hover:bg-gray-700">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={e => onChange(field.id, e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 accent-blue-600 dark:border-gray-600"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">{Boolean(value) ? 'Yes' : 'No'}</span>
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

  /* ── Fetch order form (fields + order info) ── */
  const { data: form, isLoading, isError } = useQuery({
    queryKey: ['order-form', orderId],
    queryFn: () => orderService.getForm(orderId),
    enabled: !isNaN(orderId),
  })

  /* ── Detect batch siblings (same receipt, different order) ── */
  const { data: allOrders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: orderService.getAll,
    staleTime: 30_000,
    enabled: !!form?.order.receiptNumber,
  })
  const isBatchOrder = useMemo(() => {
    if (!form?.order.receiptNumber) return false
    return allOrders.some(o => o.receiptNumber === form.order.receiptNumber && o.id !== orderId)
  }, [allOrders, form?.order.receiptNumber, orderId])

  /* ── Fetch existing saved results for IN_PROGRESS orders ── */
  const hasExisting = form?.order.status === 'IN_PROGRESS' || form?.order.status === 'AWAITING_APPROVAL'
  const { data: existingResults } = useQuery({
    queryKey: ['order-results', orderId],
    queryFn: () => orderService.getResults(orderId),
    enabled: !isNaN(orderId) && hasExisting,
  })

  /* ── Initialise form values ── */
  useEffect(() => {
    if (!form) return
    // Fresh order — start empty
    if (form.order.status === 'PENDING') setValues({})
  }, [form?.order.id])

  useEffect(() => {
    if (!existingResults) return
    // Pre-populate from previously saved results
    const preloaded: Record<number, string | boolean> = {}
    for (const r of existingResults.results) {
      if (!r.isSectionHeader && r.fieldId !== undefined && r.value !== null) {
        preloaded[r.fieldId] = typeof r.value === 'boolean' ? r.value : String(r.value)
      }
    }
    setValues(preloaded)
  }, [existingResults])

  /* ── Build the payload for save/submit ── */
  function buildPayload(isDraft: boolean) {
    const nonSectionFields = (form?.fields ?? []).filter(f => !f.isSectionHeader)

    // Draft: only send fields the user has actually touched — avoids writing blank placeholders
    // Submit: send every field so the backend can verify completeness
    const fieldsToSend = isDraft
      ? nonSectionFields.filter(f => {
          if (f.fieldType === 'calculated') return true
          if (f.fieldType === 'checkbox') return values[f.id] !== undefined
          const v = values[f.id]
          return v !== undefined && v !== ''
        })
      : nonSectionFields

    return {
      values: fieldsToSend.map(field => ({
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
      isDraft,
      ...(attachment ? { attachmentBase64: attachment.base64, attachmentName: attachment.name } : {}),
    }
  }

  /* ── Save / Submit mutation ── */
  const saveMut = useMutation({
    mutationFn: (isDraft: boolean) => orderService.submitResults(orderId, buildPayload(isDraft)),
    onSuccess: (_, isDraft) => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['order-form', orderId] })
      qc.invalidateQueries({ queryKey: ['order-results', orderId] })
      if (isDraft) {
        toast.success('Results saved — you can continue later')
        // Stay on page so user can keep entering values
      } else {
        toast.success('Results submitted for approval')
        navigate('/orders')
      }
    },
    onError: (err, isDraft) => toastError(err, isDraft ? 'Failed to save' : 'Failed to submit'),
  })

  /* ── Submit with required-field validation ── */
  const handleSubmit = () => {
    const missing = (form?.fields ?? [])
      .filter(f => !f.isSectionHeader && f.required)
      .filter(f => {
        const val = values[f.id]
        return val === undefined || val === '' || (typeof val === 'boolean' ? false : false)
      })
    if (missing.length > 0) {
      toast.error(`Fill in required fields: ${missing.map(f => f.fieldName).join(', ')}`)
      return
    }
    saveMut.mutate(false)
  }

  /* ── PDF handling ── */
  const handlePdfFile = (file: File) => {
    if (file.type !== 'application/pdf') { toast.error('Only PDF files are allowed'); return }
    if (file.size > 15 * 1024 * 1024) { toast.error('PDF must be under 15 MB'); return }
    const reader = new FileReader()
    reader.onload = () => setAttachment({ name: file.name, size: file.size, base64: reader.result as string })
    reader.readAsDataURL(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handlePdfFile(file)
  }

  /* ── Guards ── */
  if (isNaN(orderId)) return <div className="p-8 text-center text-gray-500 dark:text-gray-400">Invalid order ID.</div>

  if (isLoading) return <PageLoader />

  if (isError || !form) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">Could not load order form.</p>
        <button onClick={() => navigate('/orders')} className="mt-3 text-sm text-blue-600 hover:underline dark:text-blue-400">
          ← Back to Orders
        </button>
      </div>
    )
  }

  const { order, fields } = form
  const isLocked = order.status === 'APPROVED' || order.status === 'AWAITING_APPROVAL'
  const inputFields = fields.filter(f => !f.isSectionHeader && f.fieldType !== 'calculated')
  const requiredCount = inputFields.filter(f => f.required).length
  const filledCount = inputFields.filter(f => {
    const v = values[f.id]
    return v !== undefined && v !== ''
  }).length

  return (
    <div>
      <Header
        title={`Enter Results — Order #${order.id}`}
        subtitle={`${order.template?.name} · ${order.patient?.fullName}`}
        action={
          <div className="flex items-center gap-3">
            {inputFields.length > 0 && (
              <span className="hidden text-xs text-gray-400 sm:block">
                {filledCount} / {inputFields.length} filled
                {requiredCount > 0 && ` · ${requiredCount} required`}
              </span>
            )}
            <OrderStatusBadge status={order.status} />
          </div>
        }
      />

      <PageContent maxWidth="4xl" className="space-y-6">

        {/* Locked notice */}
        {isLocked && (
          <div className={`flex items-start gap-3 rounded-2xl border px-5 py-4 ${
            order.status === 'APPROVED'
              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-900/20'
              : 'border-amber-200 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-900/20'
          }`}>
            <Lock className={`mt-0.5 h-5 w-5 shrink-0 ${order.status === 'APPROVED' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${order.status === 'APPROVED' ? 'text-emerald-800 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300'}`}>
                {order.status === 'APPROVED' ? 'Results Approved — Read Only' : 'Awaiting Approval — Read Only'}
              </p>
              <p className={`mt-0.5 text-xs ${order.status === 'APPROVED' ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                {order.status === 'APPROVED'
                  ? 'These results have been approved and are locked. A SUPER_ADMIN can revert the order from the Approvals page if a correction is needed.'
                  : 'This order has been submitted and is pending review. Results cannot be changed until it is approved or rejected.'}
              </p>
            </div>
          </div>
        )}

        {/* Revert remark notice (shown when order was previously approved & reverted) */}
        {order.revertRemark && order.status === 'IN_PROGRESS' && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 dark:border-red-800/60 dark:bg-red-900/20">
            <Undo2 className="mt-0.5 h-5 w-5 shrink-0 text-red-500 dark:text-red-400" />
            <div>
              <p className="text-sm font-semibold text-red-800 dark:text-red-300">Reverted for Correction</p>
              <p className="mt-0.5 text-xs text-red-700 dark:text-red-400">{order.revertRemark}</p>
            </div>
          </div>
        )}

        {/* Patient info */}
        <FormCard title="Patient Information" icon={<User className="h-4 w-4" />}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">Patient</p>
              <p className="mt-0.5 font-semibold text-gray-800 dark:text-gray-100">{order.patient?.fullName ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">Code</p>
              <p className="mt-0.5 font-mono text-sm text-gray-700 dark:text-gray-300">{order.patient?.patientCode ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">Test</p>
              <p className="mt-0.5 font-semibold text-gray-800 dark:text-gray-100">{order.template?.name ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">Order Date</p>
              <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">
                {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
              </p>
            </div>
          </div>
        </FormCard>

        {/* Result fields */}
        <FormCard title="Test Results" icon={<FileText className="h-4 w-4" />}>
          {fields.length === 0 ? (
            <p className="text-center text-sm text-gray-400">No fields defined for this test template.</p>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {fields.map(field => {
                // Section headers render as bold dividers, not inputs
                if (field.isSectionHeader) {
                  return (
                    <div key={field.id} className="sm:col-span-2 pt-2">
                      <div className="border-b-2 border-gray-200 pb-1.5 dark:border-gray-600">
                        <span className="text-sm font-bold text-gray-700 underline underline-offset-2 dark:text-gray-200">
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
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {field.fieldName}
                      {field.unit && (
                        <span className="ml-1 normal-case font-normal text-gray-400 dark:text-gray-500">({field.unit})</span>
                      )}
                      {(() => {
                        const gender = order.patient?.gender
                        const ref = gender === 'Male'
                          ? (field.referenceRangeMale ?? field.referenceRange)
                          : gender === 'Female'
                            ? (field.referenceRangeFemale ?? field.referenceRange)
                            : (field.referenceRangeMale || field.referenceRangeFemale || field.referenceRange)
                        return ref ? (
                          <span className="ml-1 normal-case font-normal text-gray-400 dark:text-gray-500">Ref: {ref}</span>
                        ) : null
                      })()}
                      {field.required && <span className="ml-1 text-red-500">*</span>}
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
          <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
            Attach a PDF document (e.g. external lab report). It will be merged with the final report.
          </p>

          {/* Show existing attachment notice */}
          {!attachment && order.attachmentName && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-700/40 dark:text-gray-400">
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-blue-400" />
              Existing attachment: <span className="font-semibold text-gray-700 dark:text-gray-200">{order.attachmentName}</span>
              <span className="ml-1 text-gray-400 dark:text-gray-500">(upload a new file to replace)</span>
            </div>
          )}

          {attachment ? (
            <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800/60 dark:bg-blue-900/20">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/40">
                  <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{attachment.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatBytes(attachment.size)} · PDF</p>
                </div>
              </div>
              <button
                onClick={() => { setAttachment(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                className="ml-3 shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:text-gray-500 dark:hover:bg-red-900/30 dark:hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition-colors
                ${dragOver ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20' : 'border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/40 dark:border-gray-700 dark:bg-gray-700/30 dark:hover:border-blue-600 dark:hover:bg-blue-900/10'}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload className="mb-3 h-8 w-8 text-gray-400 dark:text-gray-500" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Drop PDF here or <span className="text-blue-600 dark:text-blue-400">browse</span>
              </p>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">PDF only · max 15 MB</p>
              <input
                ref={fileInputRef} type="file" accept="application/pdf" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handlePdfFile(f) }}
              />
            </div>
          )}
        </FormCard>

        {/* Footer actions */}
        <div className={`flex items-center justify-between rounded-2xl border px-6 py-4 shadow-sm ${isLocked ? 'border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-800' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'}`}>
          <button
            onClick={() => navigate('/orders')}
            className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <ArrowLeft className="h-4 w-4" /> Cancel
          </button>

          <div className="flex items-center gap-3">
            {isLocked ? (
              <div className="flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                <Lock className="h-3.5 w-3.5" /> Results locked
              </div>
            ) : (
              <>
                {attachment && (
                  <div className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    <Paperclip className="h-3.5 w-3.5" /> PDF attached
                  </div>
                )}

                {/* Save draft */}
                <button
                  onClick={() => saveMut.mutate(true)}
                  disabled={saveMut.isPending || fields.length === 0}
                  className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  {saveMut.isPending && saveMut.variables === true ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent dark:border-gray-500" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save
                </button>

                {/* Batch notice vs individual submit */}
                {isBatchOrder ? (
                  <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-300">
                    <Info className="h-4 w-4 shrink-0" />
                    Save each test, then go to <button onClick={() => navigate('/orders')} className="underline font-semibold">Orders</button> to submit all for approval
                  </div>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={saveMut.isPending || fields.length === 0}
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
                  >
                    {saveMut.isPending && saveMut.variables === false ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Submit for Approval
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {saveMut.isSuccess && saveMut.variables === false && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" /> Results submitted! Redirecting…
          </div>
        )}
      </PageContent>
    </div>
  )
}

