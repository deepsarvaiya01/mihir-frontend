import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Save, FlaskConical, Tag, Building2, Calculator,
  X, Plus, Loader2, ChevronDown, ChevronUp, ToggleLeft, ToggleRight, Pencil,
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
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-600">{icon}</div>
      <h3 className="text-sm font-bold uppercase tracking-wide text-gray-600">{title}</h3>
    </div>
  )
}
function FormCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">{children}</div>
}

const emptyFieldForm = {
  fieldName: '', fieldType: 'text' as FieldType, required: false,
  options: '', unit: '', referenceRange: '', isSectionHeader: false,
  formulaFirstKind: 'field' as FormulaOperandKind,
  formulaFirstFieldId: '', formulaFirstValue: '',
  formulaPairs: [] as FormulaPair[],
}

function fieldToForm(field: TestTemplateField): typeof emptyFieldForm {
  if (field.isSectionHeader) {
    return { ...emptyFieldForm, fieldName: field.fieldName, isSectionHeader: true }
  }
  const base = { ...emptyFieldForm, fieldName: field.fieldName, fieldType: field.fieldType, required: field.required, unit: field.unit ?? '', referenceRange: field.referenceRange ?? '' }
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
    onError: (err: unknown) =>
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save'),
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
          referenceRange: fieldForm.referenceRange || undefined,
        })
      }
      return templateService.addField(Number(id), {
        fieldName: fieldForm.fieldName, fieldType: fieldForm.fieldType,
        required: fieldForm.required, unit: fieldForm.unit || undefined,
        options: fieldForm.fieldType === 'select'
          ? fieldForm.options.split(',').map(o => o.trim()).filter(Boolean) : undefined,
        referenceRange: fieldForm.referenceRange || undefined,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['template', id] })
      qc.invalidateQueries({ queryKey: ['templates'] })
      setFieldForm(emptyFieldForm)
      setAddFieldOpen(false)
      toast.success('Field added')
    },
    onError: (err: unknown) =>
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to add field'),
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
          referenceRange: fieldForm.referenceRange || undefined,
        })
      }
      return templateService.updateField(Number(id), editingField.id, {
        fieldName: fieldForm.fieldName, fieldType: fieldForm.fieldType,
        required: fieldForm.required, unit: fieldForm.unit || undefined,
        options: fieldForm.fieldType === 'select'
          ? fieldForm.options.split(',').map(o => o.trim()).filter(Boolean) : undefined,
        referenceRange: fieldForm.referenceRange || undefined,
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
    onError: (err: unknown) =>
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update field'),
  })

  const deleteFieldMutation = useMutation({
    mutationFn: (fieldId: number) => templateService.deleteField(Number(id), fieldId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['template', id] })
      qc.invalidateQueries({ queryKey: ['templates'] })
      setDeleteField(null)
      toast.success('Field removed')
    },
    onError: () => toast.error('Failed to remove field'),
  })

  const handleSave = () => {
    if (!name.trim() || !code.trim()) { toast.error('Name and code are required'); return }
    saveMutation.mutate()
  }

  const handleAddField = () => {
    if (!fieldForm.fieldName.trim()) { toast.error('Field name is required'); return }
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

  const closeFieldForm = () => {
    setAddFieldOpen(false)
    setEditingField(null)
    setFieldForm(emptyFieldForm)
  }

  if (isEdit && isLoading) return <PageLoader />

  const headerActions = (
    <div className="flex items-center gap-2">
      <Button variant="secondary" size="sm" onClick={() => navigate('/templates')} icon={<ArrowLeft className="h-4 w-4" />}>
        Back
      </Button>
      <Button
        size="sm"
        icon={saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        loading={saveMutation.isPending}
        onClick={handleSave}
      >
        {isEdit ? 'Save Changes' : 'Create Template'}
      </Button>
    </div>
  )

  return (
    <div>
      <Header
        title={isEdit ? 'Edit Template' : 'New Template'}
        subtitle={isEdit ? `Update ${template?.name ?? 'template'} fields and pricing` : 'Define a new lab test template'}
        action={headerActions}
      />

      <PageContent maxWidth="4xl" className="space-y-6">
        <FormCard>
          <SectionTitle icon={<FlaskConical className="h-4 w-4" />} title="Basic Information" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Template Name" placeholder="e.g. Complete Blood Count" value={name} onChange={e => setName(e.target.value)} required />
            <Input label="Template Code" placeholder="e.g. CBC" value={code} onChange={e => setCode(e.target.value.toUpperCase())} hint="Unique short identifier" required />
            <Input label="Default Amount (₹)" type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} hint="For individual (non-B2B) patients" />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</label>
              <button type="button" onClick={() => setActive(v => !v)}
                className={`flex items-center gap-2.5 w-fit rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${active ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                {active ? <ToggleRight className="h-5 w-5 text-emerald-600" /> : <ToggleLeft className="h-5 w-5 text-gray-400" />}
                {active ? 'Active' : 'Inactive'}
              </button>
            </div>
            <div className="sm:col-span-2">
              <Input
                label="Summary Title"
                placeholder="e.g. Clinical Interpretation"
                value={summaryTitle}
                onChange={e => setSummaryTitle(e.target.value)}
                hint="Optional heading shown above the summary on reports"
              />
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Summary</label>
              <textarea
                rows={4}
                placeholder="Enter test summary, clinical notes, or interpretation guidelines..."
                value={summary}
                onChange={e => setSummary(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-y"
              />
              <p className="text-xs text-gray-400">Optional descriptive text printed on reports below the test results.</p>
            </div>
          </div>
        </FormCard>

        <FormCard>
          <SectionTitle icon={<Building2 className="h-4 w-4" />} title="B2B Partner Pricing" />
          {activeB2bLabs.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 p-6 text-center">
              <Building2 className="mx-auto h-8 w-8 text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No active B2B labs found. Add partners first.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">Set a custom price per B2B partner. Leave empty to use the default amount.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {activeB2bLabs.map(lab => (
                  <div key={lab.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-xs font-bold text-violet-700">
                      {lab.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-700 truncate">{lab.name}</p>
                      {lab.city && <p className="text-xs text-gray-400">{lab.city}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-sm text-gray-400">₹</span>
                      <input
                        type="number" min="0" step="0.01" placeholder="Default"
                        value={b2bPrices[lab.id] ?? ''}
                        onChange={e => setB2bPrices(prev => ({ ...prev, [lab.id]: e.target.value }))}
                        className="w-24 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-right outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </FormCard>

        {isEdit && (
          <FormCard>
            <SectionTitle icon={<Tag className="h-4 w-4" />} title="Test Fields" />
            {(template?.fields?.length ?? 0) > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2 mb-4">
                {template!.fields.map(field => (
                  <div key={field.id} className="group flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 hover:border-blue-200 hover:bg-blue-50/30 transition-colors">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {field.fieldType === 'calculated' && <Calculator className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                        <p className="truncate text-sm font-semibold text-gray-700">{field.fieldName}</p>
                      </div>
                      {field.unit && <p className="text-xs text-gray-400 mt-0.5">Unit: {field.unit}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 ml-2">
                      <Badge variant={fieldTypeBadgeVariants[field.fieldType]}>{fieldTypeLabels[field.fieldType]}</Badge>
                      {field.required && <Badge variant="danger">Req</Badge>}
                      <button onClick={() => openEditField(field)}
                        className="ml-1 rounded p-1 text-gray-300 hover:bg-blue-100 hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100"
                        title="Edit field">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setDeleteField(field)}
                        className="rounded p-1 text-gray-300 hover:bg-red-100 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete field">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mb-4 rounded-xl border-2 border-dashed border-gray-200 p-5 text-center">
                <Tag className="mx-auto h-7 w-7 text-gray-300 mb-1.5" />
                <p className="text-sm text-gray-400">No fields yet. Add the first one below.</p>
              </div>
            )}

            <button onClick={() => { if (addFieldOpen && !editingField) { closeFieldForm() } else if (!addFieldOpen) { setAddFieldOpen(true) } }}
              className="flex w-full items-center justify-between rounded-xl border border-dashed border-blue-300 bg-blue-50/50 px-4 py-3 text-sm font-medium text-blue-700 hover:bg-blue-50 transition-colors">
              <span className="flex items-center gap-2">
                {editingField ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {editingField ? `Editing: ${editingField.fieldName}` : 'Add New Field'}
              </span>
              {addFieldOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {addFieldOpen && (
              <div className="mt-3 rounded-xl border border-blue-200 bg-white p-5 space-y-4">
                {/* Section header toggle */}
                <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 hover:bg-gray-100 w-fit">
                  <input type="checkbox" checked={fieldForm.isSectionHeader}
                    onChange={e => setFieldForm(p => ({ ...p, isSectionHeader: e.target.checked, required: false }))}
                    className="h-4 w-4 rounded accent-blue-600" />
                  <span className="text-sm font-medium text-gray-700">Section Header</span>
                  <span className="text-xs text-gray-400">(a bold group title in the report — no value entered)</span>
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Field Name" placeholder={fieldForm.isSectionHeader ? 'e.g. RBC Indices :' : 'e.g. Hemoglobin'} value={fieldForm.fieldName}
                    onChange={e => setFieldForm(p => ({ ...p, fieldName: e.target.value }))} required />
                  {!fieldForm.isSectionHeader && (
                    <Select label="Field Type" value={fieldForm.fieldType}
                      onChange={e => setFieldForm(p => ({ ...p, fieldType: e.target.value as FieldType, formulaFirstFieldId: '', formulaPairs: [] }))}>
                      {(Object.entries(fieldTypeLabels) as [FieldType, string][]).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </Select>
                  )}
                </div>

                {fieldForm.fieldType === 'calculated' && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-semibold text-amber-800">Formula Builder</span>
                    </div>
                    {numericFields.length === 0 && fieldForm.formulaFirstKind === 'field' ? (
                      <p className="text-sm text-gray-500">No numeric fields yet — add numeric fields first, or use a constant number as the first operand.</p>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-start gap-2">

                          {/* ── First operand ── */}
                          <div className="flex flex-col gap-1">
                            <div className="flex rounded-lg border border-amber-300 overflow-hidden text-xs font-semibold">
                              {(['field', 'constant'] as FormulaOperandKind[]).map(k => (
                                <button key={k} type="button"
                                  onClick={() => setFieldForm(p => ({ ...p, formulaFirstKind: k, formulaFirstFieldId: '', formulaFirstValue: '' }))}
                                  className={`px-2.5 py-1 transition-colors ${fieldForm.formulaFirstKind === k ? 'bg-amber-400 text-white' : 'bg-white text-amber-700 hover:bg-amber-50'}`}>
                                  {k === 'field' ? 'Field' : '123'}
                                </button>
                              ))}
                            </div>
                            {fieldForm.formulaFirstKind === 'field' ? (
                              <select value={fieldForm.formulaFirstFieldId}
                                onChange={e => setFieldForm(p => ({ ...p, formulaFirstFieldId: e.target.value }))}
                                className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-amber-500">
                                <option value="">Select field</option>
                                {numericFields.map(f => <option key={f.id} value={f.id}>{f.fieldName}</option>)}
                              </select>
                            ) : (
                              <input type="number" placeholder="e.g. 100"
                                value={fieldForm.formulaFirstValue}
                                onChange={e => setFieldForm(p => ({ ...p, formulaFirstValue: e.target.value }))}
                                className="w-28 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-amber-500" />
                            )}
                          </div>

                          {/* ── Pairs ── */}
                          {fieldForm.formulaPairs.map((pair, i) => (
                            <div key={i} className="flex items-end gap-1.5">
                              <div className="flex flex-col gap-1">
                                <span className="text-xs text-amber-600 font-semibold px-0.5">Op</span>
                                <select value={pair.op}
                                  onChange={e => setFieldForm(p => ({ ...p, formulaPairs: p.formulaPairs.map((fp, fi) => fi === i ? { ...fp, op: e.target.value as FormulaPair['op'] } : fp) }))}
                                  className="rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-sm outline-none">
                                  {Object.entries(OP_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                </select>
                              </div>
                              <div className="flex flex-col gap-1">
                                <div className="flex rounded-lg border border-amber-300 overflow-hidden text-xs font-semibold">
                                  {(['field', 'constant'] as FormulaOperandKind[]).map(k => (
                                    <button key={k} type="button"
                                      onClick={() => setFieldForm(p => ({ ...p, formulaPairs: p.formulaPairs.map((fp, fi) => fi === i ? { ...fp, kind: k, fieldId: '', value: '' } : fp) }))}
                                      className={`px-2.5 py-1 transition-colors ${pair.kind === k ? 'bg-amber-400 text-white' : 'bg-white text-amber-700 hover:bg-amber-50'}`}>
                                      {k === 'field' ? 'Field' : '123'}
                                    </button>
                                  ))}
                                </div>
                                {pair.kind === 'field' ? (
                                  <select value={pair.fieldId}
                                    onChange={e => setFieldForm(p => ({ ...p, formulaPairs: p.formulaPairs.map((fp, fi) => fi === i ? { ...fp, fieldId: e.target.value } : fp) }))}
                                    className="rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-sm outline-none">
                                    <option value="">Select field</option>
                                    {numericFields.map(f => <option key={f.id} value={f.id}>{f.fieldName}</option>)}
                                  </select>
                                ) : (
                                  <input type="number" placeholder="e.g. 1.73"
                                    value={pair.value}
                                    onChange={e => setFieldForm(p => ({ ...p, formulaPairs: p.formulaPairs.map((fp, fi) => fi === i ? { ...fp, value: e.target.value } : fp) }))}
                                    className="w-28 rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-sm outline-none" />
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
                          <div className="mt-3 rounded-lg bg-white border border-amber-200 px-3 py-2">
                            <span className="text-xs text-amber-600 font-medium">Preview: </span>
                            <span className="text-sm font-mono text-gray-700">
                              {previewFormulaText(fieldForm.formulaFirstKind, fieldForm.formulaFirstFieldId, fieldForm.formulaFirstValue, fieldForm.formulaPairs, numericFields)}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {fieldForm.fieldType === 'select' && (
                  <Input label="Dropdown Options" placeholder="Option 1, Option 2, Option 3"
                    value={fieldForm.options} onChange={e => setFieldForm(p => ({ ...p, options: e.target.value }))}
                    hint="Comma-separated list" />
                )}

                {!fieldForm.isSectionHeader && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Unit (Optional)" placeholder="e.g. mg/dL, g/L, %"
                      value={fieldForm.unit} onChange={e => setFieldForm(p => ({ ...p, unit: e.target.value }))} />
                    <Input label="Reference Range (Optional)" placeholder="e.g. 13.0-18.0"
                      value={fieldForm.referenceRange} onChange={e => setFieldForm(p => ({ ...p, referenceRange: e.target.value }))}
                      hint="Used for out-of-range highlighting in reports" />
                  </div>
                )}
                {!fieldForm.isSectionHeader && fieldForm.fieldType !== 'calculated' && fieldForm.fieldType !== 'checkbox' && (
                  <div className="flex flex-col justify-end">
                    <label className="flex cursor-pointer items-center gap-2.5 pb-0.5">
                      <input type="checkbox" checked={fieldForm.required}
                        onChange={e => setFieldForm(p => ({ ...p, required: e.target.checked }))}
                        className="h-4 w-4 rounded accent-blue-600" />
                      <span className="text-sm font-medium text-gray-700">Required field</span>
                    </label>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-1">
                  <button onClick={closeFieldForm}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                    Cancel
                  </button>
                  <Button
                    size="sm"
                    icon={editingField ? <Save className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    loading={editingField ? updateFieldMutation.isPending : addFieldMutation.isPending}
                    onClick={handleAddField}
                  >
                    {editingField ? 'Update Field' : 'Add Field'}
                  </Button>
                </div>
              </div>
            )}
          </FormCard>
        )}

        {!isEdit && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-700">
            <strong>Note:</strong> After creating the template, you'll be taken to the edit page where you can add test fields.
          </div>
        )}

        <div className="flex justify-end gap-3 pb-8">
          <button onClick={() => navigate('/templates')}
            className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <Button
            icon={saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            loading={saveMutation.isPending} onClick={handleSave}>
            {isEdit ? 'Save Changes' : 'Create Template'}
          </Button>
        </div>
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

