import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, FlaskConical, Tag, ChevronDown, ChevronUp,
  ToggleLeft, ToggleRight, Trash2, Pencil, Calculator, Building2,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { ConfirmModal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { PageLoader } from '../components/ui/Spinner'
import { templateService } from '../services/templates'
import { b2bLabService } from '../services/b2bLabs'
import type { FieldType, TestTemplate } from '../types'
import { toast } from 'sonner'

const fieldTypeLabels: Record<FieldType, string> = {
  text: 'Text', number: 'Number', checkbox: 'Checkbox', date: 'Date', select: 'Select', calculated: 'Calculated',
}
const fieldTypeBadgeVariants: Record<FieldType, 'default' | 'info' | 'success' | 'warning' | 'purple' | 'danger'> = {
  text: 'default', number: 'info', checkbox: 'success', date: 'warning', select: 'purple', calculated: 'danger',
}

export default function TemplatesPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [deleteTemplate, setDeleteTemplate] = useState<TestTemplate | null>(null)

  const { data: templates = [], isLoading } = useQuery({ queryKey: ['templates'], queryFn: templateService.getAll })
  const { data: b2bLabs = [] } = useQuery({ queryKey: ['b2b-labs'], queryFn: b2bLabService.getAll })
  const b2bLabMap = Object.fromEntries(b2bLabs.map(l => [l.id, l.name]))

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => templateService.update(id, { active }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); toast.success('Status updated') },
    onError: () => toast.error('Failed to update'),
  })

  const removeTemplate = useMutation({
    mutationFn: (id: number) => templateService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] })
      setDeleteTemplate(null)
      toast.success('Template deleted')
    },
    onError: (err: unknown) =>
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to delete'),
  })

  return (
    <div>
      <Header
        title="Test Catalogue"
        subtitle="Manage test templates, fields and B2B pricing"
        action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/templates/new')}>New Template</Button>}
      />
      <div className="p-6 space-y-4">
        {isLoading ? <PageLoader /> : templates.length === 0 ? (
          <EmptyState icon={<FlaskConical className="h-12 w-12" />} title="No templates yet"
            description="Create your first test template"
            action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/templates/new')}>Create Template</Button>} />
        ) : templates.map(template => (
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
                    <Badge variant={template.active ? 'success' : 'default'} dot>{template.active ? 'Active' : 'Inactive'}</Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                    <span>{template.fields?.length ?? 0} field{(template.fields?.length ?? 0) !== 1 ? 's' : ''}</span>
                    {template.amount > 0 && <span>Default: ₹{Number(template.amount).toLocaleString()}</span>}
                    {(template.b2bPrices?.length ?? 0) > 0 && (
                      <span className="flex items-center gap-1 text-violet-600">
                        <Building2 className="h-3 w-3" />
                        {template.b2bPrices.length} B2B price{template.b2bPrices.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => toggleActive.mutate({ id: template.id, active: !template.active })}
                  className="text-slate-400 hover:text-indigo-600 transition-colors" title={template.active ? 'Deactivate' : 'Activate'}>
                  {template.active ? <ToggleRight className="h-6 w-6 text-indigo-600" /> : <ToggleLeft className="h-6 w-6" />}
                </button>
                <Button variant="ghost" size="sm"
                  icon={expandedId === template.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  onClick={() => setExpandedId(expandedId === template.id ? null : template.id)}>
                  {expandedId === template.id ? 'Collapse' : 'Details'}
                </Button>
                <button onClick={() => navigate(`/templates/${template.id}/edit`)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors" title="Edit template">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => setDeleteTemplate(template)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors" title="Delete template">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {expandedId === template.id && (
              <div className="mt-4 border-t border-slate-100 pt-4 space-y-4">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Fields</p>
                  {template.fields && template.fields.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {template.fields.map(field => (
                        <div key={field.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              {field.fieldType === 'calculated' && <Calculator className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                              <p className="truncate text-sm font-medium text-slate-700">{field.fieldName}</p>
                            </div>
                            {field.unit && <p className="text-xs text-slate-400">Unit: {field.unit}</p>}
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5 ml-2">
                            <Badge variant={fieldTypeBadgeVariants[field.fieldType]}>{fieldTypeLabels[field.fieldType]}</Badge>
                            {field.required && <Badge variant="danger">Req</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border-2 border-dashed border-slate-200 p-4 text-center">
                      <Tag className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                      <p className="text-sm text-slate-400">No fields.{' '}
                        <button className="text-indigo-600 hover:underline" onClick={() => navigate(`/templates/${template.id}/edit`)}>Add fields →</button>
                      </p>
                    </div>
                  )}
                </div>
                {(template.b2bPrices?.length ?? 0) > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">B2B Pricing</p>
                    <div className="flex flex-wrap gap-2">
                      {template.b2bPrices.map(p => (
                        <div key={p.id} className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs">
                          <Building2 className="h-3 w-3 text-violet-500" />
                          <span className="font-medium text-violet-800">{b2bLabMap[p.b2bLabId] ?? `Lab #${p.b2bLabId}`}</span>
                          <span className="text-violet-600">₹{Number(p.amount).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
      <ConfirmModal
        open={!!deleteTemplate} onClose={() => setDeleteTemplate(null)}
        onConfirm={() => deleteTemplate && removeTemplate.mutate(deleteTemplate.id)}
        title="Delete Template"
        message={`Delete "${deleteTemplate?.name}"? All associated fields and orders will be affected.`}
        confirmLabel="Delete Template" variant="danger" loading={removeTemplate.isPending}
      />
    </div>
  )
}
