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
  <div className="w-full overflow-x-hidden">
    <Header
      title="Test Catalogue"
      subtitle="Manage dynamic test templates and their fields"
      action={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setFieldModalOpen(true)}
            variant="secondary"
            className="w-full sm:w-auto"
          >
            Add Field
          </Button>

          <Button
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setCreateModalOpen(true)}
            className="w-full sm:w-auto"
          >
            New Template
          </Button>
        </div>
      }
    />

    <div className="space-y-4 p-3 sm:p-5 lg:p-6">
      {isLoading ? (
        <PageLoader />
      ) : templates.length === 0 ? (
        <EmptyState
          icon={<FlaskConical className="h-12 w-12" />}
          title="No templates yet"
          description="Create your first test template to get started"
          action={
            <Button
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setCreateModalOpen(true)}
            >
              Create Template
            </Button>
          }
        />
      ) : (
        templates.map(template => (
          <Card key={template.id} hover>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              {/* LEFT */}
              <div className="flex items-start gap-4 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
                  <FlaskConical className="h-5 w-5 text-indigo-600" />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="break-words font-bold text-slate-800">
                      {template.name}
                    </h3>

                    <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-500">
                      {template.code}
                    </span>

                    <Badge
                      variant={template.active ? 'success' : 'default'}
                      dot
                    >
                      {template.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  <p className="mt-0.5 text-sm text-slate-500">
                    {template.fields?.length ?? 0} field
                    {(template.fields?.length ?? 0) !== 1 ? 's' : ''}{' '}
                    configured
                  </p>
                </div>
              </div>

              {/* RIGHT */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() =>
                    toggleActive.mutate({
                      id: template.id,
                      active: !template.active,
                    })
                  }
                  className="text-slate-400 transition-colors hover:text-indigo-600"
                  title={template.active ? 'Deactivate' : 'Activate'}
                >
                  {template.active ? (
                    <ToggleRight className="h-6 w-6 text-indigo-600" />
                  ) : (
                    <ToggleLeft className="h-6 w-6" />
                  )}
                </button>

                <Button
                  variant="ghost"
                  size="sm"
                  icon={
                    expandedId === template.id ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )
                  }
                  onClick={() =>
                    setExpandedId(
                      expandedId === template.id ? null : template.id
                    )
                  }
                >
                  {expandedId === template.id
                    ? 'Collapse'
                    : 'View Fields'}
                </Button>

                <button
                  onClick={() => setDeleteTemplate(template)}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                  title="Delete template"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {expandedId === template.id && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                {template.fields && template.fields.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {template.fields.map(field => (
                      <div
                        key={field.id}
                        className="group flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-indigo-200 hover:bg-indigo-50/30 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {field.fieldType === 'calculated' && (
                              <Calculator className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                            )}

                            <p className="truncate text-sm font-medium text-slate-700">
                              {field.fieldName}
                            </p>
                          </div>

                          {field.unit && (
                            <p className="text-xs text-slate-400">
                              Unit: {field.unit}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge
                            variant={
                              fieldTypeBadgeVariants[field.fieldType]
                            }
                          >
                            {fieldTypeLabels[field.fieldType]}
                          </Badge>

                          {field.required && (
                            <Badge variant="danger">
                              Required
                            </Badge>
                          )}

                          <button
                            onClick={() =>
                              setDeleteField({ template, field })
                            }
                            className="rounded p-0.5 text-slate-300 transition-colors hover:bg-rose-100 hover:text-rose-500 sm:opacity-0 sm:group-hover:opacity-100"
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
                    <Tag className="mx-auto mb-2 h-8 w-8 text-slate-300" />

                    <p className="text-sm text-slate-400">
                      No fields configured yet.
                    </p>

                    <button
                      className="mt-2 text-sm text-indigo-600 hover:underline"
                      onClick={() => {
                        setFieldForm(f => ({
                          ...f,
                          templateId: String(template.id),
                        }))

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
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="secondary"
            onClick={() => setCreateModalOpen(false)}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>

          <Button
            loading={createTemplate.isPending}
            onClick={() => createTemplate.mutate(templateForm)}
            className="w-full sm:w-auto"
          >
            Create Template
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input
          label="Template Name"
          placeholder="e.g. Complete Blood Count"
          value={templateForm.name}
          onChange={e =>
            setTemplateForm(p => ({
              ...p,
              name: e.target.value,
            }))
          }
          required
        />

        <Input
          label="Template Code"
          placeholder="e.g. CBC"
          value={templateForm.code}
          onChange={e =>
            setTemplateForm(p => ({
              ...p,
              code: e.target.value.toUpperCase(),
            }))
          }
          hint="Unique short identifier for this template"
          required
        />
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
