import { useState, useEffect, Fragment } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Save, FlaskConical, Tag, Building2, Calculator,
  X, Plus, Pencil,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { Header } from '../components/layout/Header'
import { PageContent } from '../components/ui/PageContent'
import { ConfirmModal } from '../components/ui/Modal'
import { PageLoader } from '../components/ui/Spinner'
import { templateService } from '../services/templates'
import { b2bLabService } from '../services/b2bLabs'
import type { FieldType, TestTemplateField } from '../types'
import { toast } from 'sonner'
import { toastError } from '../lib/errors'

const OP_LABELS: Record<string, string> = { '+': 'Add (+)', '-': 'Subtract (−)', '*': 'Multiply (×)', '/': 'Divide (÷)' }
const OP_SYMBOLS: Record<string, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' }

type FormulaOperandKind = 'field' | 'constant'
type FormulaPair = {
  op: '+' | '-' | '*' | '/'
  kind: FormulaOperandKind
  fieldId: string   // used when kind === 'field'
  value: string     // used when kind === 'constant'
}

const fieldTypeLabels: Record<FieldType, string> = {
  text: 'Text', number: 'Number', checkbox: 'Checkbox (Yes/No)',
  date: 'Date', select: 'Dropdown Select', calculated: 'Calculated (Auto)',
}
const fieldTypeBadgeVariants: Record<FieldType, 'default' | 'info' | 'success' | 'warning' | 'purple' | 'danger'> = {
  text: 'default', number: 'info', checkbox: 'success', date: 'warning', select: 'purple', calculated: 'danger',
}

function buildFormulaJson(
  firstKind: FormulaOperandKind, firstFieldId: string, firstValue: string,
  pairs: FormulaPair[]
): string {
  const steps: Array<{ fieldId?: number; op?: string; value?: number }> = []
  steps.push(firstKind === 'field' ? { fieldId: Number(firstFieldId) } : { value: Number(firstValue) })
  for (const pair of pairs) {
    steps.push({ op: pair.op })
    steps.push(pair.kind === 'field' ? { fieldId: Number(pair.fieldId) } : { value: Number(pair.value) })
  }
  return JSON.stringify(steps)
}
function previewFormulaText(
  firstKind: FormulaOperandKind, firstFieldId: string, firstValue: string,
  pairs: FormulaPair[], fields: TestTemplateField[]
): string {
  const fieldName = (id: string) => fields.find(f => String(f.id) === id)?.fieldName ?? `Field ${id}`
  const firstLabel = firstKind === 'field'
    ? (firstFieldId ? fieldName(firstFieldId) : '?')
    : (firstValue || '?')
  const parts: string[] = [firstLabel]
  for (const p of pairs) {
    parts.push(OP_SYMBOLS[p.op] ?? p.op)
    parts.push(p.kind === 'field' ? (p.fieldId ? fieldName(p.fieldId) : '?') : (p.value || '?'))
  }
  return parts.join(' ')
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">{icon}</div>
      <h3 className="text-sm font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">{title}</h3>
    </div>
  )
}
function FormCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">{children}</div>
}

const emptyFieldForm = {
  fieldName: '', fieldType: 'text' as FieldType, required: false,
  options: '', unit: '', referenceRangeMale: '', referenceRangeFemale: '', isSectionHeader: false,
  formulaFirstKind: 'field' as FormulaOperandKind,
  formulaFirstFieldId: '', formulaFirstValue: '',
  formulaPairs: [] as FormulaPair[],
}

function fieldToForm(field: TestTemplateField): typeof emptyFieldForm {
  if (field.isSectionHeader) {
    return { ...emptyFieldForm, fieldName: field.fieldName, isSectionHeader: true }
  }
  const base = { ...emptyFieldForm, fieldName: field.fieldName, fieldType: field.fieldType, required: field.required, unit: field.unit ?? '', referenceRangeMale: field.referenceRangeMale ?? '', referenceRangeFemale: field.referenceRangeFemale ?? '' }
  if (field.fieldType === 'select' && field.optionsJson) {
    try { base.options = (JSON.parse(field.optionsJson) as string[]).join(', ') } catch {}
  }
  if (field.fieldType === 'calculated' && field.optionsJson) {
    try {
      const steps: Array<{ fieldId?: number; op?: string; value?: number }> = JSON.parse(field.optionsJson)
      const operandSteps = steps.filter(s => 'fieldId' in s || 'value' in s)
      const opSteps = steps.filter(s => 'op' in s)
      if (operandSteps.length > 0) {
        const first = operandSteps[0]
        if ('fieldId' in first && first.fieldId !== undefined) {
          base.formulaFirstKind = 'field'
          base.formulaFirstFieldId = String(first.fieldId)
        } else if ('value' in first && first.value !== undefined) {
          base.formulaFirstKind = 'constant'
          base.formulaFirstValue = String(first.value)
        }
      }
      base.formulaPairs = opSteps.map((o, i) => {
        const operand = operandSteps[i + 1]
        if (!operand) return { op: (o.op ?? '+') as FormulaPair['op'], kind: 'field' as FormulaOperandKind, fieldId: '', value: '' }
        if ('fieldId' in operand && operand.fieldId !== undefined) {
          return { op: (o.op ?? '+') as FormulaPair['op'], kind: 'field' as FormulaOperandKind, fieldId: String(operand.fieldId), value: '' }
        }
        return { op: (o.op ?? '+') as FormulaPair['op'], kind: 'constant' as FormulaOperandKind, fieldId: '', value: String(operand.value ?? '') }
      })
    } catch {}
  }
  return base
}

export default function TemplateFormPage() {
  const { id } = useParams<{ id?: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [amount, setAmount] = useState('')
  const [active, setActive] = useState(true)
  const [summaryTitle, setSummaryTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [b2bPrices, setB2bPrices] = useState<Record<number, string>>({})
  const [addFieldOpen, setAddFieldOpen] = useState(false)
  const [fieldForm, setFieldForm] = useState(emptyFieldForm)
  const [editingField, setEditingField] = useState<TestTemplateField | null>(null)
  const [deleteField, setDeleteField] = useState<TestTemplateField | null>(null)
  const [pendingFields, setPendingFields] = useState<Array<typeof emptyFieldForm>>([])
  const [editingPendingIndex, setEditingPendingIndex] = useState<number | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const { data: b2bLabs = [] } = useQuery({ queryKey: ['b2b-labs'], queryFn: b2bLabService.getAll })
  const activeB2bLabs = b2bLabs.filter(l => l.active)

  const { data: template, isLoading } = useQuery({
    queryKey: ['template', id],
    queryFn: () => templateService.getById(Number(id)),
    enabled: isEdit,
  })

  useEffect(() => {
    if (template) {
      setName(template.name)
      setCode(template.code)
      setAmount(template.amount > 0 ? String(template.amount) : '')
      setActive(template.active)
      setSummaryTitle(template.summaryTitle ?? '')
      setSummary(template.summary ?? '')
      const prices: Record<number, string> = {}
      for (const p of template.b2bPrices ?? []) prices[p.b2bLabId] = String(p.amount)
      setB2bPrices(prices)
    }
  }, [template])

  const numericFields = (template?.fields ?? []).filter(f => f.fieldType === 'number')

  function buildAddFieldDto(pf: typeof emptyFieldForm) {
    if (pf.isSectionHeader) return { fieldName: pf.fieldName, fieldType: 'text' as FieldType, required: false, isSectionHeader: true }
    return {
      fieldName: pf.fieldName, fieldType: pf.fieldType,
      required: pf.required, unit: pf.unit || undefined,
      options: pf.fieldType === 'select' ? pf.options.split(',').map(o => o.trim()).filter(Boolean) : undefined,
      referenceRangeMale: pf.referenceRangeMale || undefined,
      referenceRangeFemale: pf.referenceRangeFemale || undefined,
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const b2bPricesPayload = activeB2bLabs
        .filter(l => b2bPrices[l.id] && Number(b2bPrices[l.id]) > 0)
        .map(l => ({ b2bLabId: l.id, amount: Number(b2bPrices[l.id]) }))
      if (isEdit) {
        return templateService.update(Number(id), {
          name, code, active, amount: Number(amount) || 0,
          summaryTitle: summaryTitle.trim() || undefined,
          summary: summary.trim() || undefined,
          b2bPrices: b2bPricesPayload,
        })
      }
      return templateService.create({
        name, code, amount: Number(amount) || 0,
        summaryTitle: summaryTitle.trim() || undefined,
        summary: summary.trim() || undefined,
        b2bPrices: b2bPricesPayload,
      })
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      toast.success(isEdit ? 'Template updated' : 'Template created')
      if (!isEdit && result) {
        navigate(`/templates/${result.id}/edit`)
      } else {
        navigate('/templates')
      }
    },
    onError: (err) => toastError(err, 'Failed to save'),
  })

  const addFieldMutation = useMutation({
    mutationFn: () => {
      if (!isEdit || !id) throw new Error('Save the template first')
      if (fieldForm.isSectionHeader) {
        return templateService.addField(Number(id), {
          fieldName: fieldForm.fieldName, fieldType: 'text', required: false,
          isSectionHeader: true,
        })
      }
      if (fieldForm.fieldType === 'calculated') {
        return templateService.addField(Number(id), {
          fieldName: fieldForm.fieldName, fieldType: 'calculated', required: false,
          unit: fieldForm.unit || undefined,
          formulaJson: buildFormulaJson(fieldForm.formulaFirstKind, fieldForm.formulaFirstFieldId, fieldForm.formulaFirstValue, fieldForm.formulaPairs),
          referenceRangeMale: fieldForm.referenceRangeMale || undefined,
          referenceRangeFemale: fieldForm.referenceRangeFemale || undefined,
        })
      }
      return templateService.addField(Number(id), {
        fieldName: fieldForm.fieldName, fieldType: fieldForm.fieldType,
        required: fieldForm.required, unit: fieldForm.unit || undefined,
        options: fieldForm.fieldType === 'select'
          ? fieldForm.options.split(',').map(o => o.trim()).filter(Boolean) : undefined,
        referenceRangeMale: fieldForm.referenceRangeMale || undefined,
        referenceRangeFemale: fieldForm.referenceRangeFemale || undefined,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['template', id] })
      qc.invalidateQueries({ queryKey: ['templates'] })
      setFieldForm(emptyFieldForm)
      setAddFieldOpen(false)
      toast.success('Field added')
    },
    onError: (err) => toastError(err, 'Failed to add field'),
  })

  const updateFieldMutation = useMutation({
    mutationFn: () => {
      if (!isEdit || !id || !editingField) throw new Error('No field selected')
      if (fieldForm.isSectionHeader) {
        return templateService.updateField(Number(id), editingField.id, {
          fieldName: fieldForm.fieldName, fieldType: 'text', required: false, isSectionHeader: true,
        })
      }
      if (fieldForm.fieldType === 'calculated') {
        return templateService.updateField(Number(id), editingField.id, {
          fieldName: fieldForm.fieldName, fieldType: 'calculated', required: false,
          unit: fieldForm.unit || undefined,
          formulaJson: buildFormulaJson(fieldForm.formulaFirstKind, fieldForm.formulaFirstFieldId, fieldForm.formulaFirstValue, fieldForm.formulaPairs),
          referenceRangeMale: fieldForm.referenceRangeMale || undefined,
          referenceRangeFemale: fieldForm.referenceRangeFemale || undefined,
        })
      }
      return templateService.updateField(Number(id), editingField.id, {
        fieldName: fieldForm.fieldName, fieldType: fieldForm.fieldType,
        required: fieldForm.required, unit: fieldForm.unit || undefined,
        options: fieldForm.fieldType === 'select'
          ? fieldForm.options.split(',').map(o => o.trim()).filter(Boolean) : undefined,
        referenceRangeMale: fieldForm.referenceRangeMale || undefined,
        referenceRangeFemale: fieldForm.referenceRangeFemale || undefined,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['template', id] })
      qc.invalidateQueries({ queryKey: ['templates'] })
      setFieldForm(emptyFieldForm)
      setEditingField(null)
      setAddFieldOpen(false)
      toast.success('Field updated')
    },
    onError: (err) => toastError(err, 'Failed to update field'),
  })

  const deleteFieldMutation = useMutation({
    mutationFn: (fieldId: number) => templateService.deleteField(Number(id), fieldId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['template', id] })
      qc.invalidateQueries({ queryKey: ['templates'] })
      setDeleteField(null)
      toast.success('Field removed')
    },
    onError: (err) => toastError(err, 'Failed to remove field'),
  })

  const handleSave = async () => {
    if (!name.trim() || !code.trim()) { toast.error('Name and code are required'); return }
    if (isEdit) { saveMutation.mutate(); return }

    // Create mode: create template then add any pending fields
    setIsCreating(true)
    try {
      const b2bPricesPayload = activeB2bLabs
        .filter(l => b2bPrices[l.id] && Number(b2bPrices[l.id]) > 0)
        .map(l => ({ b2bLabId: l.id, amount: Number(b2bPrices[l.id]) }))
      const result = await templateService.create({
        name, code, amount: Number(amount) || 0,
        summaryTitle: summaryTitle.trim() || undefined,
        summary: summary.trim() || undefined,
        b2bPrices: b2bPricesPayload,
      })
      for (const pf of pendingFields) {
        await templateService.addField(result.id, buildAddFieldDto(pf))
      }
      qc.invalidateQueries({ queryKey: ['templates'] })
      toast.success('Template created')
      navigate(`/templates/${result.id}/edit`)
    } catch (err) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save')
    } finally {
      setIsCreating(false)
    }
  }

  const handleAddField = () => {
    if (!fieldForm.fieldName.trim()) { toast.error('Field name is required'); return }

    if (!isEdit) {
      // Create mode: buffer locally
      if (editingPendingIndex !== null) {
        setPendingFields(prev => prev.map((pf, i) => i === editingPendingIndex ? { ...fieldForm } : pf))
      } else {
        setPendingFields(prev => [...prev, { ...fieldForm }])
      }
      closeFieldForm()
      return
    }

    // Edit mode: call API
    if (fieldForm.isSectionHeader) {
      editingField ? updateFieldMutation.mutate() : addFieldMutation.mutate(); return
    }
    if (fieldForm.fieldType === 'calculated') {
      const firstEmpty = fieldForm.formulaFirstKind === 'field' ? !fieldForm.formulaFirstFieldId : !fieldForm.formulaFirstValue
      if (firstEmpty) { toast.error('Set the first operand for the formula'); return }
      if (fieldForm.formulaPairs.length === 0) { toast.error('Formula needs at least two operands'); return }
      const pairIncomplete = fieldForm.formulaPairs.some(p =>
        p.kind === 'field' ? !p.fieldId : !p.value
      )
      if (pairIncomplete) { toast.error('Complete all formula steps'); return }
    }
    editingField ? updateFieldMutation.mutate() : addFieldMutation.mutate()
  }

  const openEditField = (field: TestTemplateField) => {
    setEditingField(field)
    setFieldForm(fieldToForm(field))
    setAddFieldOpen(true)
  }

  const openEditPending = (i: number) => {
    setEditingPendingIndex(i)
    setFieldForm(pendingFields[i])
    setAddFieldOpen(true)
  }

  const closeFieldForm = () => {
    setAddFieldOpen(false)
    setEditingField(null)
    setEditingPendingIndex(null)
    setFieldForm(emptyFieldForm)
  }

  if (isEdit && isLoading) return <PageLoader />

  const headerActions = (
    <div className="flex items-center gap-2">
      <Button variant="secondary" size="sm" onClick={() => navigate('/templates')} icon={<ArrowLeft className="h-4 w-4" />}>
        Back
      </Button>
      {isEdit && (
        <Button
          size="sm"
          icon={<Save className="h-4 w-4" />}
          loading={saveMutation.isPending}
          onClick={handleSave}
        >
          Save Changes
        </Button>
      )}
    </div>
  )

  return (
    <div>
      <Header
        title={isEdit ? 'Edit Template' : 'New Template'}
        subtitle={isEdit ? `Update ${template?.name ?? 'template'} fields and pricing` : 'Define a new lab test template'}
        action={headerActions}
      />

      <PageContent className="space-y-5">

        {/* ── Main card: Basic Info + Test Fields + actions ── */}
        <FormCard>
          {/* Basic Info header row with inline Status toggle for edit mode */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
                <FlaskConical className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">Basic Information</h3>
            </div>
            {isEdit && (
              <div className="flex items-center gap-2.5">
                <span className="text-xs text-gray-400 dark:text-gray-500">Status</span>
                <button
                  type="button" role="switch" aria-checked={active}
                  onClick={() => setActive(v => !v)}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
                <span className={`text-xs font-semibold ${active ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>
                  {active ? 'Active' : 'Inactive'}
                </span>
              </div>
            )}
          </div>

          {/* All fields in one row */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <div className="col-span-2 lg:col-span-2">
              <Input size="sm" label="Template Name" placeholder="e.g. Complete Blood Count" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <Input size="sm" label="Template Code" placeholder="e.g. CBC" value={code} onChange={e => setCode(e.target.value.toUpperCase())} required />
            <Input size="sm" label="Default Amount (₹)" type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
            <Input size="sm" label="Summary Title" placeholder="e.g. Clinical Interpretation" value={summaryTitle} onChange={e => setSummaryTitle(e.target.value)} />
          </div>

          {/* Summary textarea — full width */}
          <div className="mt-3 flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Summary</label>
            <textarea
              rows={2}
              placeholder="Enter test summary, clinical notes, or interpretation guidelines..."
              value={summary}
              onChange={e => setSummary(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-y dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
          </div>

          {/* ── Divider ── */}
          <div className="my-6 border-t border-gray-100 dark:border-gray-700/60" />

          {/* ── Test Fields ── */}
          <div className="flex items-center gap-2 mb-5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
              <Tag className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">Test Fields</h3>
          </div>

                {/* Fields table */}
                <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/40">
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Field Name</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 w-28">Type</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 w-24">Unit</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 w-40">Ref Range (M / F)</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 w-10">Req</th>
                        <th className="w-16" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                      {isEdit ? (
                        template?.fields?.map(field => (
                          <Fragment key={field.id}>
                            <tr className={`group ${editingField?.id === field.id ? 'bg-blue-50/30 dark:bg-blue-900/15' : 'hover:bg-gray-50/60 dark:hover:bg-gray-700/20'}`}>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-1.5">
                                  {field.fieldType === 'calculated' && <Calculator className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                                  <span className={`font-medium ${field.isSectionHeader ? 'text-blue-700 dark:text-blue-400' : 'text-gray-800 dark:text-gray-100'}`}>{field.fieldName}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5">
                                <Badge variant={field.isSectionHeader ? 'default' : fieldTypeBadgeVariants[field.fieldType]}>
                                  {field.isSectionHeader ? 'Section' : fieldTypeLabels[field.fieldType]}
                                </Badge>
                              </td>
                              <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">{field.unit || <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                              <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">
                                {(field.referenceRangeMale || field.referenceRangeFemale) ? (
                                  <span className="flex flex-col gap-0.5">
                                    <span>♂ {field.referenceRangeMale || <span className="text-gray-300 dark:text-gray-600">—</span>}</span>
                                    <span>♀ {field.referenceRangeFemale || <span className="text-gray-300 dark:text-gray-600">—</span>}</span>
                                  </span>
                                ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                              </td>
                              <td className="px-3 py-2.5 text-center text-xs">
                                {field.required ? <span className="font-bold text-emerald-500">✓</span> : <span className="text-gray-300 dark:text-gray-600">—</span>}
                              </td>
                              <td className="px-3 py-2.5">
                                {editingField?.id !== field.id && (
                                  <div className="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openEditField(field)} title="Edit" className="rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                                    <button onClick={() => setDeleteField(field)} title="Delete" className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-colors"><X className="h-3.5 w-3.5" /></button>
                                  </div>
                                )}
                              </td>
                            </tr>
                            {addFieldOpen && editingField?.id === field.id && (
                              <tr className="bg-blue-50/40 dark:bg-blue-900/10">
                                <td className="px-2 py-2">
                                  <div className="flex items-center gap-1.5">
                                    <input type="checkbox" checked={fieldForm.isSectionHeader}
                                      onChange={e => setFieldForm(p => ({ ...p, isSectionHeader: e.target.checked, required: false }))}
                                      className="h-3 w-3 shrink-0 rounded accent-blue-600" title="Section Header" />
                                    <Input size="sm" placeholder={fieldForm.isSectionHeader ? 'e.g. RBC Indices :' : 'e.g. Hemoglobin'}
                                      value={fieldForm.fieldName} onChange={e => setFieldForm(p => ({ ...p, fieldName: e.target.value }))} />
                                  </div>
                                </td>
                                <td className="px-2 py-2">
                                  {!fieldForm.isSectionHeader && (
                                    <Select size="sm" value={fieldForm.fieldType}
                                      onChange={e => setFieldForm(p => ({ ...p, fieldType: e.target.value as FieldType, formulaFirstFieldId: '', formulaPairs: [] }))}>
                                      {(Object.entries(fieldTypeLabels) as [FieldType, string][])
                                        .map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                    </Select>
                                  )}
                                </td>
                                <td className="px-2 py-2">
                                  {!fieldForm.isSectionHeader && (
                                    <Input size="sm" placeholder="e.g. mg/dL" value={fieldForm.unit}
                                      onChange={e => setFieldForm(p => ({ ...p, unit: e.target.value }))} />
                                  )}
                                </td>
                                <td className="px-2 py-2">
                                  {!fieldForm.isSectionHeader && (
                                    <div className="flex flex-col gap-1">
                                      <Input size="sm" placeholder="♂ Male range" value={fieldForm.referenceRangeMale}
                                        onChange={e => setFieldForm(p => ({ ...p, referenceRangeMale: e.target.value }))} />
                                      <Input size="sm" placeholder="♀ Female range" value={fieldForm.referenceRangeFemale}
                                        onChange={e => setFieldForm(p => ({ ...p, referenceRangeFemale: e.target.value }))} />
                                    </div>
                                  )}
                                </td>
                                <td className="px-2 py-2 text-center">
                                  {!fieldForm.isSectionHeader && fieldForm.fieldType !== 'calculated' && fieldForm.fieldType !== 'checkbox' && (
                                    <input type="checkbox" checked={fieldForm.required}
                                      onChange={e => setFieldForm(p => ({ ...p, required: e.target.checked }))}
                                      className="h-3.5 w-3.5 accent-blue-600" />
                                  )}
                                </td>
                                <td className="px-2 py-2">
                                  <div className="flex justify-end items-center gap-1">
                                    <button onClick={closeFieldForm} className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-600 transition-colors"><X className="h-3.5 w-3.5" /></button>
                                    <Button size="sm" icon={<Save className="h-3.5 w-3.5" />}
                                      loading={updateFieldMutation.isPending} onClick={handleAddField}>Save</Button>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        ))
                      ) : (
                        pendingFields.map((pf, i) => (
                          <Fragment key={i}>
                            <tr className={`group ${editingPendingIndex === i ? 'bg-blue-50/30 dark:bg-blue-900/15' : 'hover:bg-gray-50/60 dark:hover:bg-gray-700/20'}`}>
                              <td className="px-3 py-2.5">
                                <span className={`font-medium ${pf.isSectionHeader ? 'text-blue-700 dark:text-blue-400' : 'text-gray-800 dark:text-gray-100'}`}>{pf.fieldName}</span>
                              </td>
                              <td className="px-3 py-2.5">
                                <Badge variant={pf.isSectionHeader ? 'default' : fieldTypeBadgeVariants[pf.fieldType]}>
                                  {pf.isSectionHeader ? 'Section' : fieldTypeLabels[pf.fieldType]}
                                </Badge>
                              </td>
                              <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">{pf.unit || <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                              <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">
                                {(pf.referenceRangeMale || pf.referenceRangeFemale) ? (
                                  <span className="flex flex-col gap-0.5">
                                    <span>♂ {pf.referenceRangeMale || <span className="text-gray-300 dark:text-gray-600">—</span>}</span>
                                    <span>♀ {pf.referenceRangeFemale || <span className="text-gray-300 dark:text-gray-600">—</span>}</span>
                                  </span>
                                ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                              </td>
                              <td className="px-3 py-2.5 text-center text-xs">
                                {pf.required ? <span className="font-bold text-emerald-500">✓</span> : <span className="text-gray-300 dark:text-gray-600">—</span>}
                              </td>
                              <td className="px-3 py-2.5">
                                {editingPendingIndex !== i && (
                                  <div className="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openEditPending(i)} title="Edit" className="rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                                    <button onClick={() => setPendingFields(prev => prev.filter((_, fi) => fi !== i))} title="Remove" className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"><X className="h-3.5 w-3.5" /></button>
                                  </div>
                                )}
                              </td>
                            </tr>
                            {addFieldOpen && editingPendingIndex === i && (
                              <tr className="bg-blue-50/40 dark:bg-blue-900/10">
                                <td className="px-2 py-2">
                                  <div className="flex items-center gap-1.5">
                                    <input type="checkbox" checked={fieldForm.isSectionHeader}
                                      onChange={e => setFieldForm(p => ({ ...p, isSectionHeader: e.target.checked, required: false }))}
                                      className="h-3 w-3 shrink-0 rounded accent-blue-600" title="Section Header" />
                                    <Input size="sm" placeholder={fieldForm.isSectionHeader ? 'e.g. RBC Indices :' : 'e.g. Hemoglobin'}
                                      value={fieldForm.fieldName} onChange={e => setFieldForm(p => ({ ...p, fieldName: e.target.value }))} />
                                  </div>
                                </td>
                                <td className="px-2 py-2">
                                  {!fieldForm.isSectionHeader && (
                                    <Select size="sm" value={fieldForm.fieldType}
                                      onChange={e => setFieldForm(p => ({ ...p, fieldType: e.target.value as FieldType, formulaFirstFieldId: '', formulaPairs: [] }))}>
                                      {(Object.entries(fieldTypeLabels) as [FieldType, string][])
                                        .filter(([v]) => v !== 'calculated')
                                        .map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                    </Select>
                                  )}
                                </td>
                                <td className="px-2 py-2">
                                  {!fieldForm.isSectionHeader && (
                                    <Input size="sm" placeholder="e.g. mg/dL" value={fieldForm.unit}
                                      onChange={e => setFieldForm(p => ({ ...p, unit: e.target.value }))} />
                                  )}
                                </td>
                                <td className="px-2 py-2">
                                  {!fieldForm.isSectionHeader && (
                                    <div className="flex flex-col gap-1">
                                      <Input size="sm" placeholder="♂ Male range" value={fieldForm.referenceRangeMale}
                                        onChange={e => setFieldForm(p => ({ ...p, referenceRangeMale: e.target.value }))} />
                                      <Input size="sm" placeholder="♀ Female range" value={fieldForm.referenceRangeFemale}
                                        onChange={e => setFieldForm(p => ({ ...p, referenceRangeFemale: e.target.value }))} />
                                    </div>
                                  )}
                                </td>
                                <td className="px-2 py-2 text-center">
                                  {!fieldForm.isSectionHeader && fieldForm.fieldType !== 'calculated' && fieldForm.fieldType !== 'checkbox' && (
                                    <input type="checkbox" checked={fieldForm.required}
                                      onChange={e => setFieldForm(p => ({ ...p, required: e.target.checked }))}
                                      className="h-3.5 w-3.5 accent-blue-600" />
                                  )}
                                </td>
                                <td className="px-2 py-2">
                                  <div className="flex justify-end items-center gap-1">
                                    <button onClick={closeFieldForm} className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-600 transition-colors"><X className="h-3.5 w-3.5" /></button>
                                    <Button size="sm" icon={<Save className="h-3.5 w-3.5" />}
                                      loading={false} onClick={handleAddField}>Save</Button>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        ))
                      )}

                      {/* Add new row — shown at bottom only when not editing an existing field */}
                      {addFieldOpen && !editingField && editingPendingIndex === null && (
                        <tr className="bg-blue-50/40 dark:bg-blue-900/10 border-t border-blue-100 dark:border-blue-900/40">
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-1.5">
                              <input type="checkbox" checked={fieldForm.isSectionHeader}
                                onChange={e => setFieldForm(p => ({ ...p, isSectionHeader: e.target.checked, required: false }))}
                                className="h-3 w-3 shrink-0 rounded accent-blue-600" title="Section Header" />
                              <Input size="sm" placeholder={fieldForm.isSectionHeader ? 'e.g. RBC Indices :' : 'e.g. Hemoglobin'}
                                value={fieldForm.fieldName} onChange={e => setFieldForm(p => ({ ...p, fieldName: e.target.value }))} />
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            {!fieldForm.isSectionHeader && (
                              <Select size="sm" value={fieldForm.fieldType}
                                onChange={e => setFieldForm(p => ({ ...p, fieldType: e.target.value as FieldType, formulaFirstFieldId: '', formulaPairs: [] }))}>
                                {(Object.entries(fieldTypeLabels) as [FieldType, string][])
                                  .filter(([v]) => isEdit || v !== 'calculated')
                                  .map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                              </Select>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            {!fieldForm.isSectionHeader && (
                              <Input size="sm" placeholder="e.g. mg/dL" value={fieldForm.unit}
                                onChange={e => setFieldForm(p => ({ ...p, unit: e.target.value }))} />
                            )}
                          </td>
                          <td className="px-2 py-2">
                            {!fieldForm.isSectionHeader && (
                              <div className="flex flex-col gap-1">
                                <Input size="sm" placeholder="♂ Male range" value={fieldForm.referenceRangeMale}
                                  onChange={e => setFieldForm(p => ({ ...p, referenceRangeMale: e.target.value }))} />
                                <Input size="sm" placeholder="♀ Female range" value={fieldForm.referenceRangeFemale}
                                  onChange={e => setFieldForm(p => ({ ...p, referenceRangeFemale: e.target.value }))} />
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-2 text-center">
                            {!fieldForm.isSectionHeader && fieldForm.fieldType !== 'calculated' && fieldForm.fieldType !== 'checkbox' && (
                              <input type="checkbox" checked={fieldForm.required}
                                onChange={e => setFieldForm(p => ({ ...p, required: e.target.checked }))}
                                className="h-3.5 w-3.5 accent-blue-600" />
                            )}
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex justify-end items-center gap-1">
                              <button onClick={closeFieldForm} className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-600 transition-colors">
                                <X className="h-3.5 w-3.5" />
                              </button>
                              <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />}
                                loading={addFieldMutation.isPending}
                                onClick={handleAddField}>Add</Button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* Dropdown options — below table for select type */}
                  {addFieldOpen && fieldForm.fieldType === 'select' && !fieldForm.isSectionHeader && (
                    <div className="border-t border-gray-200 dark:border-gray-700 bg-blue-50/30 dark:bg-blue-900/5 px-4 py-3">
                      <Input size="sm" label="Dropdown Options" placeholder="Option 1, Option 2, Option 3"
                        value={fieldForm.options} onChange={e => setFieldForm(p => ({ ...p, options: e.target.value }))}
                        hint="Comma-separated list" />
                    </div>
                  )}

                  {/* Formula builder — below table for calculated type */}
                  {addFieldOpen && fieldForm.fieldType === 'calculated' && (
                    <div className="border-t border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                      <div className="mb-3 flex items-center gap-2">
                        <Calculator className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">Formula Builder</span>
                      </div>
                      {numericFields.length === 0 && fieldForm.formulaFirstKind === 'field' ? (
                        <p className="text-sm text-gray-500">No numeric fields yet — add numeric fields first, or use a constant number as the first operand.</p>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-start gap-2">
                            <div className="flex flex-col gap-1">
                              <div className="flex rounded-lg border border-amber-300 overflow-hidden text-xs font-semibold">
                                {(['field', 'constant'] as FormulaOperandKind[]).map(k => (
                                  <button key={k} type="button"
                                    onClick={() => setFieldForm(p => ({ ...p, formulaFirstKind: k, formulaFirstFieldId: '', formulaFirstValue: '' }))}
                                    className={`px-2.5 py-1 transition-colors ${fieldForm.formulaFirstKind === k ? 'bg-amber-400 text-white' : 'bg-white text-amber-700 hover:bg-amber-50 dark:bg-gray-700 dark:text-amber-400 dark:hover:bg-gray-600'}`}>
                                    {k === 'field' ? 'Field' : '123'}
                                  </button>
                                ))}
                              </div>
                              {fieldForm.formulaFirstKind === 'field' ? (
                                <select value={fieldForm.formulaFirstFieldId}
                                  onChange={e => setFieldForm(p => ({ ...p, formulaFirstFieldId: e.target.value }))}
                                  className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-amber-500 dark:border-amber-700 dark:bg-gray-700 dark:text-gray-100">
                                  <option value="">Select field</option>
                                  {numericFields.map(f => <option key={f.id} value={f.id}>{f.fieldName}</option>)}
                                </select>
                              ) : (
                                <input type="number" placeholder="e.g. 100" value={fieldForm.formulaFirstValue}
                                  onChange={e => setFieldForm(p => ({ ...p, formulaFirstValue: e.target.value }))}
                                  className="w-28 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-amber-500 dark:border-amber-700 dark:bg-gray-700 dark:text-gray-100" />
                              )}
                            </div>
                            {fieldForm.formulaPairs.map((pair, i) => (
                              <div key={i} className="flex items-end gap-1.5">
                                <div className="flex flex-col gap-1">
                                  <span className="text-xs text-amber-600 font-semibold px-0.5">Op</span>
                                  <select value={pair.op}
                                    onChange={e => setFieldForm(p => ({ ...p, formulaPairs: p.formulaPairs.map((fp, fi) => fi === i ? { ...fp, op: e.target.value as FormulaPair['op'] } : fp) }))}
                                    className="rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-sm outline-none dark:border-amber-700 dark:bg-gray-700 dark:text-gray-100">
                                    {Object.entries(OP_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                  </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <div className="flex rounded-lg border border-amber-300 overflow-hidden text-xs font-semibold">
                                    {(['field', 'constant'] as FormulaOperandKind[]).map(k => (
                                      <button key={k} type="button"
                                        onClick={() => setFieldForm(p => ({ ...p, formulaPairs: p.formulaPairs.map((fp, fi) => fi === i ? { ...fp, kind: k, fieldId: '', value: '' } : fp) }))}
                                        className={`px-2.5 py-1 transition-colors ${pair.kind === k ? 'bg-amber-400 text-white' : 'bg-white text-amber-700 hover:bg-amber-50 dark:bg-gray-700 dark:text-amber-400 dark:hover:bg-gray-600'}`}>
                                        {k === 'field' ? 'Field' : '123'}
                                      </button>
                                    ))}
                                  </div>
                                  {pair.kind === 'field' ? (
                                    <select value={pair.fieldId}
                                      onChange={e => setFieldForm(p => ({ ...p, formulaPairs: p.formulaPairs.map((fp, fi) => fi === i ? { ...fp, fieldId: e.target.value } : fp) }))}
                                      className="rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-sm outline-none dark:border-amber-700 dark:bg-gray-700 dark:text-gray-100">
                                      <option value="">Select field</option>
                                      {numericFields.map(f => <option key={f.id} value={f.id}>{f.fieldName}</option>)}
                                    </select>
                                  ) : (
                                    <input type="number" placeholder="e.g. 1.73" value={pair.value}
                                      onChange={e => setFieldForm(p => ({ ...p, formulaPairs: p.formulaPairs.map((fp, fi) => fi === i ? { ...fp, value: e.target.value } : fp) }))}
                                      className="w-28 rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-sm outline-none dark:border-amber-700 dark:bg-gray-700 dark:text-gray-100" />
                                  )}
                                </div>
                                <button onClick={() => setFieldForm(p => ({ ...p, formulaPairs: p.formulaPairs.filter((_, fi) => fi !== i) }))}
                                  className="mb-0.5 rounded p-1.5 text-amber-600 hover:bg-amber-100"><X className="h-3.5 w-3.5" /></button>
                              </div>
                            ))}
                            <button
                              onClick={() => setFieldForm(p => ({ ...p, formulaPairs: [...p.formulaPairs, { op: '+', kind: 'field', fieldId: '', value: '' }] }))}
                              className="self-end rounded-lg border border-dashed border-amber-400 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 mb-0.5">
                              + Add Step
                            </button>
                          </div>
                          {(fieldForm.formulaFirstFieldId || fieldForm.formulaFirstValue) && (
                            <div className="mt-3 rounded-lg bg-white border border-amber-200 px-3 py-2 dark:bg-gray-700 dark:border-amber-700">
                              <span className="text-xs text-amber-600 font-medium dark:text-amber-400">Preview: </span>
                              <span className="text-sm font-mono text-gray-700 dark:text-gray-200">
                                {previewFormulaText(fieldForm.formulaFirstKind, fieldForm.formulaFirstFieldId, fieldForm.formulaFirstValue, fieldForm.formulaPairs, numericFields)}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Add field — footer button */}
                  {!addFieldOpen && (
                    <button onClick={() => setAddFieldOpen(true)}
                      className="flex w-full items-center gap-2 border-t border-gray-100 px-4 py-2.5 text-xs font-medium text-blue-600 hover:bg-blue-50/50 transition-colors dark:border-gray-700 dark:text-blue-400 dark:hover:bg-blue-900/10">
                      <Plus className="h-3.5 w-3.5" />
                      Add Field
                    </button>
                  )}
                </div>

          {/* Action buttons — inside the card */}
          <div className="flex items-center justify-end gap-3 pt-5 mt-2 border-t border-gray-100 dark:border-gray-700/60">
            <button onClick={() => navigate('/templates')}
              className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600">
              Cancel
            </button>
            <Button
              icon={<Save className="h-4 w-4" />}
              loading={isEdit ? saveMutation.isPending : isCreating}
              onClick={handleSave}>
              {isEdit ? 'Save Changes' : 'Create Template'}
            </Button>
          </div>
        </FormCard>

        {/* B2B Partner Pricing — at bottom */}
        <FormCard>
          <SectionTitle icon={<Building2 className="h-4 w-4" />} title="B2B Partner Pricing" />
          {activeB2bLabs.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 p-5 text-center dark:border-gray-600">
              <Building2 className="mx-auto h-7 w-7 text-gray-300 mb-2 dark:text-gray-600" />
              <p className="text-sm text-gray-400 dark:text-gray-500">No active B2B labs found. Add partners first.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">Set a custom price per partner. Leave empty to use the default amount.</p>
              <div className="space-y-2">
                {activeB2bLabs.map(lab => (
                  <div key={lab.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-700/50">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-xs font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-400">
                      {lab.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-700 truncate dark:text-white">{lab.name}</p>
                      {lab.city && <p className="text-xs text-gray-400">{lab.city}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-gray-400">₹</span>
                      <input
                        type="number" min="0" step="0.01" placeholder="Default"
                        value={b2bPrices[lab.id] ?? ''}
                        onChange={e => setB2bPrices(prev => ({ ...prev, [lab.id]: e.target.value }))}
                        className="w-20 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-right outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </FormCard>
      </PageContent>

      <ConfirmModal
        open={!!deleteField}
        onClose={() => setDeleteField(null)}
        onConfirm={() => deleteField && deleteFieldMutation.mutate(deleteField.id)}
        title="Remove Field"
        message={`Remove field "${deleteField?.fieldName}"? This cannot be undone.`}
        confirmLabel="Remove Field" variant="danger"
        loading={deleteFieldMutation.isPending}
      />
    </div>
  )
}

