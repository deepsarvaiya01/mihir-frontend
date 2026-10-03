import { useRef, useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Calculator,
  CheckCircle2,
  ChevronDown,
  Eye,
  FileText,
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
import { orderService, type SubmitResultsDto } from '../services/orders'
import { OrderStatusBadge } from '../components/ui/Badge'
import { Header } from '../components/layout/Header'
import { PageContent } from '../components/ui/PageContent'
import { PageLoader } from '../components/ui/Spinner'
import { Input, Select } from '../components/ui/Input'
import { evalFormula, evalCalculatedFields, formulaFieldIds } from '../utils/formula'
import { checkValidationRules } from '../utils/validationRules'
import { rangeStatus } from '../utils/rangeCheck'
import { sanitizeNumberInput, toNumber } from '../utils/numberInput'
import { genderInfo } from '../components/filters/patientFilters'
import { DocumentPreviewModal } from '../components/patients/DocumentPreviewModal'
import { OTHER_OPTION, isOtherOption, parseMultiValue, parseOptions, serializeMultiValue } from '../utils/selectOptions'
import type { TestTemplateField, Order, OrderFormData } from '../types'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type SectionValues = Record<number, string | boolean>
/** previewUrl is an object URL of the picked file, for viewing it before it's uploaded */
type Attachment = { name: string; size: number; base64: string; previewUrl: string } | null

/* ─── card wrapper ───────────────────────────────────────── */
function FormCard({ title, icon, children, action }: { title: string; icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-6 py-4 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-blue-600">{icon}</span>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</h2>
        </div>
        {action}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

/* ─── multi-select dropdown (checkbox list + optional free-text "Other") ── */
function MultiSelectInput({ field, value, onChange }: {
  field: TestTemplateField
  value: string
  onChange: (val: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { options, allowOther } = parseOptions(field.optionsJson)
  const { selected, otherOn, otherText } = parseMultiValue(value, options)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const toggle = (o: string) => {
    const next = selected.includes(o) ? selected.filter(s => s !== o) : [...selected, o]
    onChange(serializeMultiValue(next, options, otherOn, otherText))
  }
  const summary = [...selected, ...(otherOn ? [otherText || OTHER_OPTION] : [])].join(', ')

  return (
    <div ref={ref} className="relative space-y-2">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-left text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
        <span className={`truncate ${summary ? '' : 'text-gray-400'}`}>{summary || 'Select options'}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800">
          {options.map(o => (
            <label key={o} className="flex cursor-pointer items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700">
              <input type="checkbox" checked={selected.includes(o)} onChange={() => toggle(o)} className="h-4 w-4 accent-blue-600" />
              {o}
            </label>
          ))}
          {allowOther && (
            <label className="flex cursor-pointer items-center gap-2.5 border-t border-gray-100 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700">
              <input type="checkbox" checked={otherOn}
                onChange={() => onChange(serializeMultiValue(selected, options, !otherOn, otherText))}
                className="h-4 w-4 accent-blue-600" />
              {OTHER_OPTION}
            </label>
          )}
        </div>
      )}
      {otherOn && (
        <Input value={otherText} placeholder="Type other value"
          onChange={e => onChange(serializeMultiValue(selected, options, true, e.target.value))} />
      )}
    </div>
  )
}

/* ─── single result field ────────────────────────────────── */
function ResultField({
  field,
  values,
  calculatedValues,
  gender,
  onChange,
}: {
  field: TestTemplateField
  values: Record<number, string | boolean>
  calculatedValues?: Record<number, number>
  gender?: string | null
  onChange: (id: number, val: string | boolean) => void
}) {
  if (field.fieldType === 'calculated') {
    const computed = calculatedValues?.[field.id] ?? evalFormula(field.optionsJson, values, gender)
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

  if (field.fieldType === 'multiselect') {
    return <MultiSelectInput field={field} value={String(value ?? '')} onChange={v => onChange(field.id, v)} />
  }

  if (field.fieldType === 'select') {
    const { options, allowOther } = parseOptions(field.optionsJson)
    const v = String(value ?? '')
    // Any value that isn't a listed option was typed in via "Other" ("Other" itself = picked, nothing typed yet)
    const isOther = allowOther && v !== '' && !options.includes(v)
    return (
      <div className="space-y-2">
        <Select value={isOther ? OTHER_OPTION : v}
          onChange={e => onChange(field.id, e.target.value)}>
          <option value="">Select option</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
          {allowOther && <option value={OTHER_OPTION}>{OTHER_OPTION}</option>}
        </Select>
        {isOther && (
          <Input value={isOtherOption(v) ? '' : v} placeholder="Type other value"
            onChange={e => onChange(field.id, e.target.value || OTHER_OPTION)} />
        )}
      </div>
    )
  }

  if (field.fieldType === 'number') {
    // A text box with a decimal keypad, not <input type="number">: number inputs drop "0,5" (comma
    // locales), report partial input like "0." as empty, and change value on mouse-wheel scroll.
    return (
      <Input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={String(value ?? '')}
        onChange={e => onChange(field.id, sanitizeNumberInput(e.target.value))}
        placeholder="e.g. 0.5"
      />
    )
  }

  return (
    <Input
      type={field.fieldType === 'date' ? 'date' : 'text'}
      value={String(value ?? '')}
      onChange={e => onChange(field.id, e.target.value)}
      placeholder="Enter value"
    />
  )
}

/* ─── one test's fields as a table (shared by single + batch rendering) ── */
function FieldsGrid({
  fields, values, gender, onChange,
}: {
  fields: TestTemplateField[]
  values: SectionValues
  gender: string | null | undefined
  onChange: (fieldId: number, val: string | boolean) => void
}) {
  const calculatedValues = evalCalculatedFields(fields, values, gender)
  const g = genderInfo(gender)?.label

  if (fields.length === 0) {
    return <p className="text-center text-sm text-gray-400">No fields defined for this test template.</p>
  }

  const refFor = (field: TestTemplateField) => g === 'Male'
    ? (field.referenceRangeMale ?? field.referenceRange)
    : g === 'Female'
      ? (field.referenceRangeFemale ?? field.referenceRange)
      : (field.referenceRangeMale || field.referenceRangeFemale || field.referenceRange)

  const th = 'px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500'

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
            <th className={`${th} w-[34%]`}>Parameter</th>
            <th className={`${th} w-[30%]`}>Result</th>
            <th className={`${th} w-[12%]`}>Unit</th>
            <th className={th}>Reference Range</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
          {fields.map(field => {
            if (field.isSectionHeader) {
              return (
                <tr key={field.id} className={field.isMainHeader ? 'bg-blue-50/70 dark:bg-blue-900/20' : 'bg-gray-50/80 dark:bg-gray-900/30'}>
                  <td colSpan={4} className={`px-4 py-2 font-bold ${field.isMainHeader ? 'text-sm uppercase tracking-wide text-blue-800 dark:text-blue-300' : 'text-[13px] text-gray-700 dark:text-gray-200'}`}>
                    {field.fieldName}
                  </td>
                </tr>
              )
            }

            const name = (
              <span className="font-medium text-gray-800 dark:text-gray-100">
                {field.fieldName}
                {field.required && <span className="ml-0.5 text-red-500">*</span>}
              </span>
            )
            const input = <ResultField field={field} values={values} calculatedValues={calculatedValues} gender={gender} onChange={onChange} />

            if (field.isLineResult) {
              return (
                <tr key={field.id} className="align-top">
                  <td className="px-4 py-2.5 pt-4">{name}</td>
                  <td colSpan={3} className="px-4 py-2">{input}</td>
                </tr>
              )
            }

            const ref = refFor(field)
            const shown = field.fieldType === 'calculated' ? calculatedValues[field.id] : values[field.id]
            const numeric = field.fieldType === 'number' || field.fieldType === 'calculated'
            const status = numeric && shown !== undefined && shown !== '' ? rangeStatus(shown as string | number, ref) : null
            // Below range → blue, above → red, within → normal (black) text
            const tone = status === 'high'
              ? { row: 'bg-red-50/50 dark:bg-red-900/10', input: '[&_input]:font-semibold [&_input]:text-red-600 dark:[&_input]:text-red-400', label: 'text-red-600 dark:text-red-400', text: '↑ High' }
              : status === 'low'
                ? { row: 'bg-blue-50/50 dark:bg-blue-900/10', input: '[&_input]:font-semibold [&_input]:text-blue-600 dark:[&_input]:text-blue-400', label: 'text-blue-600 dark:text-blue-400', text: '↓ Low' }
                : null

            return (
              <tr key={field.id} className={`align-top ${tone?.row ?? ''}`}>
                <td className="px-4 py-2.5 pt-4">{name}</td>
                <td className={`px-4 py-2 ${tone?.input ?? ''}`}>
                  {input}
                  {tone && <span className={`mt-1 inline-block text-[11px] font-semibold ${tone.label}`}>{tone.text}</span>}
                </td>
                <td className="px-4 py-2.5 pt-4 text-gray-500 dark:text-gray-400">{field.unit || <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                <td className="px-4 py-2.5 pt-4 whitespace-pre-line text-gray-500 dark:text-gray-400">{ref || <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ─── PDF attachment uploader (shared by single + batch rendering) ── */
function AttachmentUploader({
  attachment, existingName, existingUrl, disabled, onAttach, onRemove,
}: {
  attachment: Attachment
  existingName: string | null
  existingUrl: string | null
  disabled: boolean
  onAttach: (file: File) => void
  onRemove: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState<{ name: string; url: string } | null>(null)

  if (disabled) return null

  const previewBtn = (name: string, url: string) => (
    <button type="button" onClick={() => setPreview({ name, url })}
      className="ml-auto flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/30">
      <Eye className="h-3.5 w-3.5" /> Preview
    </button>
  )

  return (
    <div>
      {!attachment && existingName && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-700/40 dark:text-gray-400">
          <Paperclip className="h-3.5 w-3.5 shrink-0 text-blue-400" />
          Existing attachment: <span className="font-semibold text-gray-700 dark:text-gray-200">{existingName}</span>
          <span className="ml-1 text-gray-400 dark:text-gray-500">(upload a new file to replace)</span>
          {existingUrl && previewBtn(existingName, existingUrl)}
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
          {previewBtn(attachment.name, attachment.previewUrl)}
          <button
            onClick={() => { onRemove(); if (fileInputRef.current) fileInputRef.current.value = '' }}
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
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) onAttach(f) }}
        >
          <Upload className="mb-3 h-8 w-8 text-gray-400 dark:text-gray-500" />
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
            Drop PDF here or <span className="text-blue-600 dark:text-blue-400">browse</span>
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">PDF only · max 15 MB</p>
          <input
            ref={fileInputRef} type="file" accept="application/pdf" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onAttach(f) }}
          />
        </div>
      )}
      {preview && <DocumentPreviewModal name={preview.name} url={preview.url} onClose={() => setPreview(null)} />}
    </div>
  )
}

/* ─── main page ──────────────────────────────────────────── */
export default function EnterResultsPage() {
  const { id } = useParams<{ id: string }>()
  const orderId = Number(id)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [values, setValues] = useState<Record<number, SectionValues>>({})
  const [attachments, setAttachments] = useState<Record<number, Attachment>>({})
  /** Per-test "result by document" switch; unset = whatever the order already has saved */
  const [docMode, setDocMode] = useState<Record<number, boolean>>({})
  const [activeIndex, setActiveIndex] = useState(0)

  // Reset the active tab when navigating to a different order/receipt
  useEffect(() => { setActiveIndex(0) }, [orderId])

  /* ── Fetch the primary order (also tells us the receipt number) ── */
  const { data: form, isLoading, isError } = useQuery({
    queryKey: ['order-form', orderId],
    queryFn: () => orderService.getForm(orderId),
    enabled: !isNaN(orderId),
  })

  /* ── Detect batch siblings (same receipt) ── */
  const { data: allOrders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: orderService.getAll,
    staleTime: 30_000,
    enabled: !!form?.order.receiptNumber,
  })

  const EDITABLE_STATUSES: Order['status'][] = ['PENDING', 'IN_PROGRESS']

  /** Every order sharing this receipt that's still editable, including the current one. */
  const batchOrderIds = useMemo(() => {
    if (!form?.order.receiptNumber) return [orderId]
    const editable = allOrders.filter(o =>
      o.receiptNumber === form.order.receiptNumber && (o.id === orderId || EDITABLE_STATUSES.includes(o.status)),
    )
    const ids = editable.length > 0 ? editable.map(o => o.id) : [orderId]
    return Array.from(new Set(ids)).sort((a, b) => a - b)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allOrders, form?.order.receiptNumber, orderId])

  /** Other orders on the same receipt already submitted/approved/rejected — shown as read-only context. */
  const lockedSiblings = useMemo(() => {
    if (!form?.order.receiptNumber) return []
    return allOrders.filter(o => o.receiptNumber === form.order.receiptNumber && !batchOrderIds.includes(o.id))
  }, [allOrders, form?.order.receiptNumber, batchOrderIds])

  const isBatch = batchOrderIds.length > 1

  /* ── Fetch form (fields) for every order in the batch ── */
  const formQueries = useQueries({
    queries: batchOrderIds.map(oid => ({
      queryKey: ['order-form', oid],
      queryFn: () => orderService.getForm(oid),
      enabled: !isNaN(oid),
    })),
  })

  /* ── Fetch previously saved results for orders that already have some ── */
  const resultQueries = useQueries({
    queries: batchOrderIds.map((oid, idx) => {
      const status = formQueries[idx]?.data?.order.status
      return {
        queryKey: ['order-results', oid],
        queryFn: () => orderService.getResults(oid),
        enabled: !isNaN(oid) && (status === 'IN_PROGRESS' || status === 'AWAITING_APPROVAL'),
      }
    }),
  })

  const sections: Array<{ orderId: number; data: OrderFormData }> = batchOrderIds
    .map((oid, idx) => ({ orderId: oid, data: formQueries[idx]?.data }))
    .filter((s): s is { orderId: number; data: OrderFormData } => !!s.data)

  const isDocMode = (oid: number) =>
    docMode[oid] ?? sections.find(s => s.orderId === oid)?.data.order.resultByDocument ?? false
  /** A result document is either picked now or already uploaded on the order */
  const hasDocument = (oid: number) =>
    !!attachments[oid] || !!sections.find(s => s.orderId === oid)?.data.order.attachmentUrl

  /** Tab status for one section: locked (already submitted), complete, partial, or empty. */
  function sectionStatus(s: { orderId: number; data: OrderFormData }): 'locked' | 'complete' | 'partial' | 'empty' {
    const order = s.data.order
    if (order.status === 'APPROVED' || order.status === 'AWAITING_APPROVAL') return 'locked'
    if (isDocMode(s.orderId)) return hasDocument(s.orderId) ? 'complete' : 'partial'
    const inputFields = s.data.fields.filter(f => !f.isSectionHeader && f.fieldType !== 'calculated')
    if (inputFields.length === 0) return 'empty'
    const sectionValues = values[s.orderId] ?? {}
    const filled = inputFields.filter(f => {
      const v = sectionValues[f.id]
      return v !== undefined && v !== ''
    }).length
    if (filled === 0) return 'empty'
    return filled === inputFields.length ? 'complete' : 'partial'
  }

  const activeSectionIndex = Math.min(activeIndex, Math.max(sections.length - 1, 0))
  const completeSectionCount = sections.filter(s => {
    const st = sectionStatus(s)
    return st === 'complete' || st === 'locked'
  }).length
  const overallPct = sections.length > 0 ? Math.round((completeSectionCount / sections.length) * 100) : 0

  /* ── Initialise values: blank for fresh (PENDING) orders ── */
  useEffect(() => {
    let changed = false
    const next = { ...values }
    for (const s of sections) {
      if (next[s.orderId] === undefined && s.data.order.status === 'PENDING') {
        next[s.orderId] = {}
        changed = true
      }
    }
    if (changed) setValues(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections.map(s => `${s.orderId}:${s.data.order.status}`).join(',')])

  /* ── Initialise values: preload from previously saved results ── */
  useEffect(() => {
    let changed = false
    const next = { ...values }
    batchOrderIds.forEach((oid, idx) => {
      const r = resultQueries[idx]?.data
      if (!r || next[oid] !== undefined) return
      const preloaded: SectionValues = {}
      for (const res of r.results) {
        if (!res.isSectionHeader && res.fieldId !== undefined && res.value !== null) {
          preloaded[res.fieldId] = typeof res.value === 'boolean' ? res.value : String(res.value)
        }
      }
      next[oid] = preloaded
      changed = true
    })
    if (changed) setValues(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultQueries.map(q => (q.data ? 1 : 0)).join(',')])

  const setFieldValue = (oid: number, fieldId: number, val: string | boolean) => {
    setValues(prev => ({ ...prev, [oid]: { ...prev[oid], [fieldId]: val } }))
  }

  const setAttachment = (oid: number, file: File) => {
    if (file.type !== 'application/pdf') { toast.error('Only PDF files are allowed'); return }
    if (file.size > 15 * 1024 * 1024) { toast.error('PDF must be under 15 MB'); return }
    const reader = new FileReader()
    reader.onload = () => setAttachments(prev => {
      const old = prev[oid]
      if (old) URL.revokeObjectURL(old.previewUrl)
      return { ...prev, [oid]: { name: file.name, size: file.size, base64: reader.result as string, previewUrl: URL.createObjectURL(file) } }
    })
    reader.readAsDataURL(file)
  }

  /* ── Build the payload for one section's save/submit ── */
  function buildPayload(oid: number, sectionFields: TestTemplateField[], isDraft: boolean): SubmitResultsDto {
    const sectionValues = values[oid] ?? {}
    const nonSectionFields = sectionFields.filter(f => !f.isSectionHeader)

    const docModeOn = isDocMode(oid)
    // Document mode makes values optional, so — like a draft — only send what was filled in
    const fieldsToSend = isDraft || docModeOn
      ? nonSectionFields.filter(f => {
          if (f.fieldType === 'calculated') return true
          if (f.fieldType === 'checkbox') return sectionValues[f.id] !== undefined
          const v = sectionValues[f.id]
          if (f.fieldType === 'number') return toNumber(v) !== undefined
          return v !== undefined && v !== ''
        })
      : nonSectionFields

    const attachment = attachments[oid]
    const gender = sections.find(s => s.orderId === oid)?.data.order.patient?.gender
    const calculatedValues = evalCalculatedFields(sectionFields, sectionValues, gender)

    const isFilled = (v: string | boolean | undefined) => v !== undefined && v !== '' && (typeof v !== 'string' || /\d|[a-z]/i.test(v))
    // A calculated field whose inputs were all left blank is saved blank (not 0), so it stays off the report
    const calculatedValue = (field: TestTemplateField, seen = new Set<number>()): number | undefined => {
      seen.add(field.id) // formulas can reference other calculated fields — never follow a cycle twice
      const inputs = formulaFieldIds(field.optionsJson)
      const anyInput = inputs.length === 0 || inputs.some(id => {
        if (isFilled(sectionValues[id])) return true
        const nested = sectionFields.find(f => f.id === id && f.fieldType === 'calculated')
        return !!nested && !seen.has(nested.id) && calculatedValue(nested, seen) !== undefined
      })
      return anyInput ? (calculatedValues[field.id] ?? 0) : undefined
    }

    return {
      values: fieldsToSend.map(field => ({
        fieldId: field.id,
        textValue: field.fieldType === 'text' || field.fieldType === 'select' || field.fieldType === 'multiselect'
          ? String(sectionValues[field.id] ?? '') : undefined,
        numberValue: field.fieldType === 'number'
          ? toNumber(sectionValues[field.id])
          : field.fieldType === 'calculated'
            ? calculatedValue(field)
            : undefined,
        booleanValue: field.fieldType === 'checkbox' ? Boolean(sectionValues[field.id]) : undefined,
        dateValue: field.fieldType === 'date' ? String(sectionValues[field.id] ?? '') : undefined,
      })),
      isDraft,
      resultByDocument: docModeOn,
      ...(attachment ? { attachmentBase64: attachment.base64, attachmentName: attachment.name } : {}),
    }
  }

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['orders'] })
    for (const oid of batchOrderIds) {
      qc.invalidateQueries({ queryKey: ['order-form', oid] })
      qc.invalidateQueries({ queryKey: ['order-results', oid] })
    }
  }

  /* ── Save all sections as drafts ── */
  const saveDraftMut = useMutation({
    mutationFn: () => Promise.all(sections.map(s => orderService.submitResults(s.orderId, buildPayload(s.orderId, s.data.fields, true)))),
    onSuccess: () => {
      invalidateAll()
      toast.success('Results saved — you can continue later')
    },
    onError: (err) => toastError(err, 'Failed to save'),
  })

  /* ── Single-order direct submit (non-batch path, preserves prior behaviour) ── */
  const submitSingleMut = useMutation({
    mutationFn: () => {
      const s = sections[0]
      return orderService.submitResults(s.orderId, buildPayload(s.orderId, s.data.fields, false))
    },
    onSuccess: () => {
      invalidateAll()
      toast.success('Results submitted for approval')
      navigate('/orders')
    },
    onError: (err) => toastError(err, 'Failed to submit'),
  })

  /* ── Batch submit: save all drafts, then flip the whole receipt to AWAITING_APPROVAL ── */
  const submitBatchMut = useMutation({
    mutationFn: async () => {
      await Promise.all(sections.map(s => orderService.submitResults(s.orderId, buildPayload(s.orderId, s.data.fields, true))))
      return orderService.batchSubmit(form!.order.receiptNumber!)
    },
    onSuccess: () => {
      invalidateAll()
      toast.success('All results submitted for approval')
      navigate('/orders')
    },
    onError: (err) => toastError(err, 'Failed to submit'),
  })

  const handleSubmit = () => {
    for (const s of sections) {
      const testName = s.data.order.template?.name
      if (isDocMode(s.orderId)) {
        // Values are optional in document mode — the document itself is mandatory
        if (!hasDocument(s.orderId)) {
          toast.error(`${testName ? `${testName}: ` : ''}upload the result document — it is required when "Result by document" is on`)
          setActiveIndex(sections.indexOf(s))
          return
        }
        continue
      }
      const sectionValues = values[s.orderId] ?? {}
      const calculated = evalCalculatedFields(s.data.fields, sectionValues, s.data.order.patient?.gender)
      const merged: Record<number, string | boolean | number> = { ...sectionValues }
      for (const [id, n] of Object.entries(calculated)) merged[Number(id)] = n
      const ruleError = checkValidationRules(
        s.data.order.template?.validationRules,
        s.data.fields,
        merged,
      )
      if (ruleError) {
        toast.error(testName ? `${testName}: ${ruleError}` : ruleError)
        return
      }
    }

    if (isBatch) {
      submitBatchMut.mutate()
      return
    }
    const s = sections[0]
    if (!s) return
    if (isDocMode(s.orderId)) { submitSingleMut.mutate(); return }
    const missing = s.data.fields
      .filter(f => !f.isSectionHeader && f.required)
      .filter(f => {
        const val = values[s.orderId]?.[f.id]
        if (f.fieldType === 'number') return toNumber(val) === undefined
        return val === undefined || val === ''
      })
    if (missing.length > 0) {
      toast.error(`Fill in required fields: ${missing.map(f => f.fieldName).join(', ')}`)
      return
    }
    submitSingleMut.mutate()
  }

  const isSaving = saveDraftMut.isPending || submitSingleMut.isPending || submitBatchMut.isPending

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

  const patient = form.order.patient
  const allLocked = sections.length > 0 && sections.every(s => s.data.order.status === 'APPROVED' || s.data.order.status === 'AWAITING_APPROVAL')

  return (
    <div>
      <Header
        title={isBatch
          ? `Enter Results — ${form.order.receiptNumber} (${sections.length} tests) · ${patient?.fullName ?? ''}`
          : `Enter Results — ${form.order.receiptNumber ?? form.order.template?.name} · ${patient?.fullName ?? ''}`}
        action={<OrderStatusBadge status={form.order.status} />}
      />

      <PageContent maxWidth="6xl" className="space-y-6">

        {/* Patient info (shown once, shared across all sections) */}
        <FormCard title="Patient Information" icon={<User className="h-4 w-4" />}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">Patient</p>
              <p className="mt-0.5 font-semibold text-gray-800 dark:text-gray-100">{patient?.fullName ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">Code</p>
              <p className="mt-0.5 font-mono text-sm text-gray-700 dark:text-gray-300">{patient?.patientCode ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">Receipt</p>
              <p className="mt-0.5 font-semibold text-gray-800 dark:text-gray-100">{form.order.receiptNumber ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">Order Date</p>
              <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">
                {form.order.createdAt ? new Date(form.order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
              </p>
            </div>
          </div>
        </FormCard>

        {/* Test tabs — jump between tests instead of scrolling through all of them */}
        {sections.length > 1 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex flex-wrap gap-1.5">
              {sections.map((s, i) => {
                const status = sectionStatus(s)
                const active = i === activeSectionIndex
                return (
                  <button
                    key={s.orderId}
                    onClick={() => setActiveIndex(i)}
                    className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700/60'
                    }`}
                  >
                    {status === 'complete' && <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-white' : 'text-emerald-500'}`} />}
                    {status === 'locked' && <Lock className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-white' : 'text-amber-500'}`} />}
                    <span className="max-w-[160px] truncate">{s.data.order.template?.name ?? `Test ${i + 1}`}</span>
                  </button>
                )
              })}
            </div>
            <div className="mt-3 flex items-center gap-2.5 border-t border-gray-100 pt-3 dark:border-gray-700">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${overallPct}%` }} />
              </div>
              <span className="shrink-0 text-xs font-medium text-gray-400 dark:text-gray-500">
                {completeSectionCount} / {sections.length} tests filled
              </span>
            </div>
          </div>
        )}

        {/* Active test's fields (only one section is shown at a time when there are several) */}
        {sections[activeSectionIndex] && (() => {
          const s = sections[activeSectionIndex]
          const order = s.data.order
          const fields = s.data.fields
          const locked = order.status === 'APPROVED' || order.status === 'AWAITING_APPROVAL'
          const docOn = isDocMode(s.orderId)
          const docMissing = docOn && !hasDocument(s.orderId)
          const sectionValues = values[s.orderId] ?? {}
          const inputFields = fields.filter(f => !f.isSectionHeader && f.fieldType !== 'calculated')
          const filledCount = inputFields.filter(f => {
            const v = sectionValues[f.id]
            return v !== undefined && v !== ''
          }).length

          return (
            <div key={s.orderId} className="space-y-3">
              {order.revertRemark && order.status === 'IN_PROGRESS' && (
                <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 dark:border-red-800/60 dark:bg-red-900/20">
                  <Undo2 className="mt-0.5 h-5 w-5 shrink-0 text-red-500 dark:text-red-400" />
                  <div>
                    <p className="text-sm font-semibold text-red-800 dark:text-red-300">Reverted for Correction</p>
                    <p className="mt-0.5 text-xs text-red-700 dark:text-red-400">{order.revertRemark}</p>
                  </div>
                </div>
              )}

              <FormCard
                title={order.template?.name ?? 'Test Results'}
                icon={<FileText className="h-4 w-4" />}
                action={
                  <div className="flex items-center gap-3">
                    {inputFields.length > 0 && !docOn && (
                      <span className="hidden text-xs text-gray-400 sm:block">{filledCount} / {inputFields.length} filled</span>
                    )}
                    {!locked && (
                      <label className="flex cursor-pointer select-none items-center gap-2 rounded-full border border-gray-200 py-1 pl-1 pr-3 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/50"
                        title="Turn on when the result comes as a document (e.g. outsourced report): values become optional, the document becomes mandatory">
                        <input type="checkbox" role="switch" className="peer sr-only" checked={docOn}
                          onChange={e => setDocMode(prev => ({ ...prev, [s.orderId]: e.target.checked }))} />
                        <span className="relative h-5 w-9 rounded-full bg-gray-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-blue-600 peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500/40 dark:bg-gray-600" />
                        Result by document
                      </label>
                    )}
                    {locked && order.resultByDocument && (
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Result by document</span>
                    )}
                    <OrderStatusBadge status={order.status} />
                  </div>
                }
              >
                {locked && (
                  <div className={`mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 ${
                    order.status === 'APPROVED'
                      ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-900/20'
                      : 'border-amber-200 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-900/20'
                  }`}>
                    <Lock className={`mt-0.5 h-4 w-4 shrink-0 ${order.status === 'APPROVED' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`} />
                    <p className={`text-xs ${order.status === 'APPROVED' ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                      {order.status === 'APPROVED' ? 'Approved and locked.' : 'Submitted and pending review — read only.'}
                    </p>
                  </div>
                )}

                {docOn && !locked && (
                  <div className={`mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 ${
                    docMissing
                      ? 'border-amber-200 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-900/20'
                      : 'border-blue-200 bg-blue-50 dark:border-blue-800/60 dark:bg-blue-900/20'
                  }`}>
                    <Paperclip className={`mt-0.5 h-4 w-4 shrink-0 ${docMissing ? 'text-amber-600' : 'text-blue-600'}`} />
                    <p className={`text-xs ${docMissing ? 'text-amber-800 dark:text-amber-300' : 'text-blue-800 dark:text-blue-300'}`}>
                      <strong>Result by document.</strong> Entering values below is optional.{' '}
                      {docMissing ? 'Upload the result document below — it is required to send for approval.' : 'Result document attached.'}
                    </p>
                  </div>
                )}

                <FieldsGrid
                  fields={fields}
                  values={sectionValues}
                  gender={patient?.gender}
                  onChange={(fid, val) => setFieldValue(s.orderId, fid, val)}
                />

                {!locked && (
                  <div className="mt-5 border-t border-gray-100 pt-5 dark:border-gray-700">
                    <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      <Paperclip className="h-3.5 w-3.5" /> Attach Document {docOn ? <span className="normal-case tracking-normal text-red-500">(required)</span> : '(optional)'}
                    </p>
                    <AttachmentUploader
                      attachment={attachments[s.orderId] ?? null}
                      existingName={order.attachmentName}
                      existingUrl={order.attachmentUrl}
                      disabled={false}
                      onAttach={file => setAttachment(s.orderId, file)}
                      onRemove={() => setAttachments(prev => {
                        const old = prev[s.orderId]
                        if (old) URL.revokeObjectURL(old.previewUrl)
                        return { ...prev, [s.orderId]: null }
                      })}
                    />
                  </div>
                )}
              </FormCard>
            </div>
          )
        })()}

        {/* Read-only context: other tests on this receipt already submitted/approved/rejected */}
        {lockedSiblings.length > 0 && (
          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4 dark:border-gray-700 dark:bg-gray-800/40">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Also on this receipt</p>
            <div className="flex flex-wrap gap-2">
              {lockedSiblings.map(o => (
                <span key={o.id} className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {o.template?.name ?? `Order #${o.id}`}
                  <OrderStatusBadge status={o.status} />
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Footer actions — one Save / Send for Approval for the whole batch */}
        <div className={`flex items-center justify-between rounded-2xl border px-6 py-4 shadow-sm ${allLocked ? 'border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-800' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'}`}>
          <button
            onClick={() => navigate('/orders')}
            className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <ArrowLeft className="h-4 w-4" /> Cancel
          </button>

          <div className="flex items-center gap-3">
            {allLocked ? (
              <div className="flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                <Lock className="h-3.5 w-3.5" /> Results locked
              </div>
            ) : (
              <>
                <button
                  onClick={() => saveDraftMut.mutate()}
                  disabled={isSaving || sections.length === 0}
                  className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  {saveDraftMut.isPending ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent dark:border-gray-500" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save
                </button>

                <button
                  onClick={handleSubmit}
                  disabled={isSaving || sections.length === 0}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
                >
                  {(submitSingleMut.isPending || submitBatchMut.isPending) ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Send for Approval
                </button>
              </>
            )}
          </div>
        </div>

        {(submitSingleMut.isSuccess || submitBatchMut.isSuccess) && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" /> Results submitted! Redirecting…
          </div>
        )}
      </PageContent>
    </div>
  )
}
