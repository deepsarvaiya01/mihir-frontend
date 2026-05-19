import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, FlaskConical, Tag, ChevronDown, ChevronUp, ToggleLeft, ToggleRight, Trash2, X, Calculator } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { Modal, ConfirmModal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { PageLoader } from '../components/ui/Spinner'
import { templateService } from '../services/templates'
import type { FieldType, TestTemplate, TestTemplateField } from '../types'
import { toast } from 'sonner'

const OP_LABELS: Record<string, string> = { '+': 'Add (+)', '-': 'Subtract (−)', '*': 'Multiply (×)', '/': 'Divide (÷)' }
const OP_SYMBOLS: Record<string, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' }

type FormulaPair = { op: '+' | '-' | '*' | '/'; fieldId: string }

type FieldFormState = {
  templateId: string
  fieldName: string
  fieldType: FieldType
  required: boolean
  options: string
  unit: string
  formulaFirstFieldId: string
  formulaPairs: FormulaPair[]
}

const fieldTypeLabels: Record<FieldType, string> = {
  text: 'Text',
  number: 'Number',
  checkbox: 'Checkbox (Yes/No)',
  date: 'Date',
  select: 'Dropdown Select',
  calculated: 'Calculated (Auto)',
}

const fieldTypeBadgeVariants: Record<FieldType, 'default' | 'info' | 'success' | 'warning' | 'purple' | 'danger'> = {
  text: 'default',
  number: 'info',
  checkbox: 'success',
  date: 'warning',
  select: 'purple',
  calculated: 'danger',
}

function buildFormulaJson(firstFieldId: string, pairs: FormulaPair[]): string {
  const steps: Array<{ fieldId?: number; op?: string }> = [{ fieldId: Number(firstFieldId) }]
  for (const pair of pairs) {
    steps.push({ op: pair.op })
    steps.push({ fieldId: Number(pair.fieldId) })
  }
  return JSON.stringify(steps)
}

function previewFormulaText(firstFieldId: string, pairs: FormulaPair[], fields: TestTemplateField[]): string {
  const name = (id: string) => fields.find(f => String(f.id) === id)?.fieldName ?? `Field ${id}`
  if (!firstFieldId) return 'Select fields to build formula'
  const parts: string[] = [name(firstFieldId)]
  for (const p of pairs) {
    parts.push(OP_SYMBOLS[p.op] ?? p.op)
    parts.push(p.fieldId ? name(p.fieldId) : '?')
  }
  return parts.join(' ')
}

export default function TemplatesPage() {
  const qc = useQueryClient()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [fieldModalOpen, setFieldModalOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [templateForm, setTemplateForm] = useState({ name: '', code: '' })
  const [fieldForm, setFieldForm] = useState<FieldFormState>({
    templateId: '', fieldName: '', fieldType: 'text', required: false,
    options: '', unit: '', formulaFirstFieldId: '', formulaPairs: [],
  })
  const [deleteTemplate, setDeleteTemplate] = useState<TestTemplate | null>(null)
  const [deleteField, setDeleteField] = useState<{ template: TestTemplate; field: TestTemplateField } | null>(null)

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: templateService.getAll,
  })

  const createTemplate = useMutation({
    mutationFn: templateService.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] })
      setTemplateForm({ name: '', code: '' })
      setCreateModalOpen(false)
      toast.success('Template created successfully')
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create template'),
  })

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => templateService.update(id, { active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      toast.success('Template updated')
    },
    onError: () => toast.error('Failed to update template'),
  })

  const removeTemplate = useMutation({
    mutationFn: (id: number) => templateService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] })
      setDeleteTemplate(null)
      toast.success('Template deleted')
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to delete template'),
  })

  const removeField = useMutation({
    mutationFn: ({ templateId, fieldId }: { templateId: number; fieldId: number }) =>
      templateService.deleteField(templateId, fieldId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      setDeleteField(null)
      toast.success('Field removed')
    },
    onError: () => toast.error('Failed to remove field'),
  })

  const addField = useMutation({
    mutationFn: ({ templateId, payload }: { templateId: number; payload: Parameters<typeof templateService.addField>[1] }) =>
      templateService.addField(templateId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      setFieldForm({ templateId: '', fieldName: '', fieldType: 'text', required: false, options: '', unit: '', formulaFirstFieldId: '', formulaPairs: [] })
      setFieldModalOpen(false)
      toast.success('Field added to template')
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to add field'),
  })

  const selectedTemplate = templates.find(t => t.id === Number(fieldForm.templateId))
  const numericFields = selectedTemplate?.fields?.filter(f => f.fieldType === 'number') ?? []

  const handleAddField = () => {
    if (!fieldForm.templateId || !fieldForm.fieldName) return

    if (fieldForm.fieldType === 'calculated') {
      if (!fieldForm.formulaFirstFieldId) {
        toast.error('Select at least one field for the formula')
        return
      }
      if (fieldForm.formulaPairs.length === 0) {
        toast.error('Formula needs at least two fields and one operation')
        return
      }
      const incomplete = fieldForm.formulaPairs.find(p => !p.fieldId || !p.op)
      if (incomplete) {
        toast.error('Complete all formula steps before saving')
        return
      }
      addField.mutate({
        templateId: Number(fieldForm.templateId),
        payload: {
          fieldName: fieldForm.fieldName,
          fieldType: 'calculated',
          required: false,
          unit: fieldForm.unit || undefined,
          formulaJson: buildFormulaJson(fieldForm.formulaFirstFieldId, fieldForm.formulaPairs),
        },
      })
      return
    }

    addField.mutate({
      templateId: Number(fieldForm.templateId),
      payload: {
        fieldName: fieldForm.fieldName,
        fieldType: fieldForm.fieldType,
        required: fieldForm.required,
        unit: fieldForm.unit || undefined,
        options: fieldForm.fieldType === 'select'
          ? fieldForm.options.split(',').map(o => o.trim()).filter(Boolean)
          : undefined,
      },
    })
  }

  const updatePair = (index: number, update: Partial<FormulaPair>) => {
    setFieldForm(p => ({
      ...p,
      formulaPairs: p.formulaPairs.map((pair, i) => i === index ? { ...pair, ...update } : pair),
    }))
  }

  const addPair = () => {
    setFieldForm(p => ({ ...p, formulaPairs: [...p.formulaPairs, { op: '+', fieldId: '' }] }))
  }

  const removePair = (index: number) => {
    setFieldForm(p => ({ ...p, formulaPairs: p.formulaPairs.filter((_, i) => i !== index) }))
  }

  return (
    <div>
      <Header
        title="Test Catalogue"
        subtitle="Manage dynamic test templates and their fields"
        action={
          <div className="flex gap-2">
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setFieldModalOpen(true)} variant="secondary">
              Add Field
            </Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateModalOpen(true)}>
              New Template
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        {isLoading ? (
          <PageLoader />
        ) : templates.length === 0 ? (
          <EmptyState
            icon={<FlaskConical className="h-12 w-12" />}
            title="No templates yet"
            description="Create your first test template to get started"
            action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateModalOpen(true)}>Create Template</Button>}
          />
        ) : (
          templates.map(template => (
            <Card key={template.id} hover>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
                    <FlaskConical className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-slate-800">{template.name}</h3>
                      <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-500">{template.code}</span>
                      <Badge variant={template.active ? 'success' : 'default'} dot>
                        {template.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {template.fields?.length ?? 0} field{(template.fields?.length ?? 0) !== 1 ? 's' : ''} configured
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActive.mutate({ id: template.id, active: !template.active })}
                    className="text-slate-400 hover:text-indigo-600 transition-colors"
                    title={template.active ? 'Deactivate' : 'Activate'}
                  >
                    {template.active ? <ToggleRight className="h-6 w-6 text-indigo-600" /> : <ToggleLeft className="h-6 w-6" />}
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={expandedId === template.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    onClick={() => setExpandedId(expandedId === template.id ? null : template.id)}
                  >
                    {expandedId === template.id ? 'Collapse' : 'View Fields'}
                  </Button>
                  <button
                    onClick={() => setDeleteTemplate(template)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                    title="Delete template"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {expandedId === template.id && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  {template.fields && template.fields.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {template.fields.map(field => (
                        <div key={field.id} className="group flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              {field.fieldType === 'calculated' && <Calculator className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                              <p className="truncate font-medium text-sm text-slate-700">{field.fieldName}</p>
                            </div>
                            {field.unit && <p className="text-xs text-slate-400">Unit: {field.unit}</p>}
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5 ml-2">
                            <Badge variant={fieldTypeBadgeVariants[field.fieldType]}>{fieldTypeLabels[field.fieldType]}</Badge>
                            {field.required && <Badge variant="danger">Required</Badge>}
                            <button
                              onClick={() => setDeleteField({ template, field })}
                              className="ml-1 rounded p-0.5 text-slate-300 hover:bg-rose-100 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                              title="Remove field"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center">
                      <Tag className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                      <p className="text-sm text-slate-400">No fields configured yet.</p>
                      <button
                        className="mt-2 text-sm text-indigo-600 hover:underline"
                        onClick={() => {
                          setFieldForm(f => ({ ...f, templateId: String(template.id) }))
                          setFieldModalOpen(true)
                        }}
                      >
                        Add the first field
                      </button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Create Template Modal */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Test Template"
        subtitle="Define a new laboratory test template"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateModalOpen(false)}>Cancel</Button>
            <Button loading={createTemplate.isPending} onClick={() => createTemplate.mutate(templateForm)}>
              Create Template
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Template Name"
            placeholder="e.g. Complete Blood Count"
            value={templateForm.name}
            onChange={e => setTemplateForm(p => ({ ...p, name: e.target.value }))}
            required
          />
          <Input
            label="Template Code"
            placeholder="e.g. CBC"
            value={templateForm.code}
            onChange={e => setTemplateForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
            hint="Unique short identifier for this template"
            required
          />
        </div>
      </Modal>

      {/* Add Field Modal */}
      <Modal
        open={fieldModalOpen}
        onClose={() => setFieldModalOpen(false)}
        title="Add Field"
        subtitle="Configure a new field for a test template"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFieldModalOpen(false)}>Cancel</Button>
            <Button loading={addField.isPending} onClick={handleAddField}>Add Field</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Template"
            value={fieldForm.templateId}
            onChange={e => setFieldForm(p => ({ ...p, templateId: e.target.value, formulaFirstFieldId: '', formulaPairs: [] }))}
            required
          >
            <option value="">Select a template</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>

          <Input
            label="Field Name"
            placeholder="e.g. Hemoglobin"
            value={fieldForm.fieldName}
            onChange={e => setFieldForm(p => ({ ...p, fieldName: e.target.value }))}
            required
          />

          <Select
            label="Field Type"
            value={fieldForm.fieldType}
            onChange={e => setFieldForm(p => ({ ...p, fieldType: e.target.value as FieldType, formulaFirstFieldId: '', formulaPairs: [] }))}
          >
            {(Object.entries(fieldTypeLabels) as [FieldType, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>

          {/* Calculated — Formula Builder */}
          {fieldForm.fieldType === 'calculated' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Calculator className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-800">Formula Builder</span>
                <span className="text-xs text-amber-600">(numeric fields only)</span>
              </div>

              {numericFields.length === 0 ? (
                <div className="rounded-lg border border-amber-200 bg-white p-3 text-center text-sm text-slate-500">
                  No numeric fields in this template yet. Add numeric fields first.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* First field */}
                    <select
                      value={fieldForm.formulaFirstFieldId}
                      onChange={e => setFieldForm(p => ({ ...p, formulaFirstFieldId: e.target.value }))}
                      className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                    >
                      <option value="">Select field</option>
                      {numericFields.map(f => <option key={f.id} value={f.id}>{f.fieldName}</option>)}
                    </select>

                    {/* Operation pairs */}
                    {fieldForm.formulaPairs.map((pair, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <select
                          value={pair.op}
                          onChange={e => updatePair(i, { op: e.target.value as FormulaPair['op'] })}
                          className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                        >
                          {Object.entries(OP_LABELS).map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                          ))}
                        </select>
                        <select
                          value={pair.fieldId}
                          onChange={e => updatePair(i, { fieldId: e.target.value })}
                          className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                        >
                          <option value="">Select field</option>
                          {numericFields.map(f => <option key={f.id} value={f.id}>{f.fieldName}</option>)}
                        </select>
                        <button
                          type="button"
                          onClick={() => removePair(i)}
                          className="rounded-lg p-1 text-amber-600 hover:bg-amber-100 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}

                    {/* Add pair button */}
                    <button
                      type="button"
                      onClick={addPair}
                      className="rounded-lg border border-dashed border-amber-400 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
                    >
                      + Add Step
                    </button>
                  </div>

                  {/* Preview */}
                  {fieldForm.formulaFirstFieldId && (
                    <div className="mt-3 rounded-lg bg-white px-3 py-2 border border-amber-200">
                      <span className="text-xs text-amber-600 font-medium">Preview: </span>
                      <span className="text-sm font-mono text-slate-700">
                        {previewFormulaText(fieldForm.formulaFirstFieldId, fieldForm.formulaPairs, numericFields)}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Select options */}
          {fieldForm.fieldType === 'select' && (
            <Input
              label="Dropdown Options"
              placeholder="Option 1, Option 2, Option 3"
              value={fieldForm.options}
              onChange={e => setFieldForm(p => ({ ...p, options: e.target.value }))}
              hint="Comma-separated list of options"
            />
          )}

          {fieldForm.fieldType !== 'calculated' && (
            <>
              <Input
                label="Unit (Optional)"
                placeholder="e.g. mg/dL, g/L, %"
                value={fieldForm.unit}
                onChange={e => setFieldForm(p => ({ ...p, unit: e.target.value }))}
              />
              {fieldForm.fieldType !== 'checkbox' && (
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={fieldForm.required}
                    onChange={e => setFieldForm(p => ({ ...p, required: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Required field</span>
                </label>
              )}
            </>
          )}

          {fieldForm.fieldType === 'calculated' && (
            <Input
              label="Unit (Optional)"
              placeholder="e.g. mg/dL, g/L, %"
              value={fieldForm.unit}
              onChange={e => setFieldForm(p => ({ ...p, unit: e.target.value }))}
            />
          )}
        </div>
      </Modal>

      {/* Delete Template Confirm */}
      <ConfirmModal
        open={!!deleteTemplate}
        onClose={() => setDeleteTemplate(null)}
        onConfirm={() => deleteTemplate && removeTemplate.mutate(deleteTemplate.id)}
        title="Delete Template"
        message={`Are you sure you want to delete "${deleteTemplate?.name}"? All associated fields and orders will be affected. This action cannot be undone.`}
        confirmLabel="Delete Template"
        variant="danger"
        loading={removeTemplate.isPending}
      />

      {/* Delete Field Confirm */}
      <ConfirmModal
        open={!!deleteField}
        onClose={() => setDeleteField(null)}
        onConfirm={() => deleteField && removeField.mutate({ templateId: deleteField.template.id, fieldId: deleteField.field.id })}
        title="Remove Field"
        message={`Remove field "${deleteField?.field.fieldName}" from "${deleteField?.template.name}"? This cannot be undone.`}
        confirmLabel="Remove Field"
        variant="danger"
        loading={removeField.isPending}
      />
    </div>
  )
}
