import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, FlaskConical, Tag, ChevronDown, ChevronUp,
  ToggleLeft, ToggleRight, Trash2, Pencil, Calculator, Building2, Archive, RotateCcw,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { ConfirmModal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { PageLoader } from '../components/ui/Spinner'
import { PageContent } from '../components/ui/PageContent'
import { FilterBar } from '../components/ui/FilterBar'
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
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [permanentDeleteTemplate, setPermanentDeleteTemplate] = useState<TestTemplate | null>(null)

  const { data: templates = [], isLoading } = useQuery({ queryKey: ['templates'], queryFn: templateService.getAll })
  const { data: b2bLabs = [] } = useQuery({ queryKey: ['b2b-labs'], queryFn: b2bLabService.getAll })
  const { data: archivedTemplates = [], isLoading: isLoadingArchived } = useQuery({
    queryKey: ['templates-archived'],
    queryFn: templateService.getArchived,
    enabled: showArchived,
  })
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
      qc.invalidateQueries({ queryKey: ['templates-archived'] })
      setDeleteTemplate(null)
      toast.success('Template archived')
    },
    onError: (err: unknown) =>
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to archive'),
  })

  const restoreMutation = useMutation({
    mutationFn: (id: number) => templateService.restore(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      qc.invalidateQueries({ queryKey: ['templates-archived'] })
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] })
      toast.success('Template restored')
    },
    onError: (err: unknown) =>
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to restore'),
  })

  const permanentDeleteMutation = useMutation({
    mutationFn: (id: number) => templateService.permanentDelete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates-archived'] })
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] })
      setPermanentDeleteTemplate(null)
      toast.success('Template permanently deleted')
    },
    onError: (err: unknown) =>
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to delete permanently'),
  })

  const filtered = templates.filter(t => {
    const q = search.toLowerCase()
    return !q || t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q)
  })

  return (
    <div>
      <Header
        title="Test Catalogue"
        subtitle="Manage test templates, fields and B2B pricing"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant={showArchived ? 'secondary' : 'outline'}
              icon={<Archive className="h-4 w-4" />}
              onClick={() => setShowArchived(v => !v)}
            >
              {showArchived ? 'Hide Archived' : 'Archived'}
            </Button>
            {templates.length > 0 && (
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/templates/new')}>New Template</Button>
            )}
          </div>
        }
      />
      <PageContent className="space-y-4">
        {isLoading ? <PageLoader /> : templates.length === 0 ? (
          <EmptyState icon={<FlaskConical className="h-12 w-12" />} title="No templates yet"
            description="Create your first test template"
            action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/templates/new')}>Create Template</Button>} />
        ) : (
          <>
            <FilterBar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search by name or code…"
              count={filtered.length}
              countLabel={`template${filtered.length !== 1 ? 's' : ''}`}
            />
            {filtered.length === 0 ? (
              <EmptyState icon={<FlaskConical className="h-10 w-10" />} title="No results" description="Try a different search term" />
            ) : filtered.map(template => (
          <Card key={template.id} hover>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950">
                  <FlaskConical className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-gray-800 dark:text-white">{template.name}</h3>
                    <span className="rounded-lg bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-500 dark:bg-gray-700 dark:text-gray-400">{template.code}</span>
                    <Badge variant={template.active ? 'success' : 'default'} dot>{template.active ? 'Active' : 'Inactive'}</Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
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
                  className="text-gray-400 hover:text-blue-600 transition-colors" title={template.active ? 'Deactivate' : 'Activate'}>
                  {template.active ? <ToggleRight className="h-6 w-6 text-blue-600" /> : <ToggleLeft className="h-6 w-6" />}
                </button>
                <Button variant="ghost" size="sm"
                  icon={expandedId === template.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  onClick={() => setExpandedId(expandedId === template.id ? null : template.id)}>
                  {expandedId === template.id ? 'Collapse' : 'Details'}
                </Button>
                <button onClick={() => navigate(`/templates/${template.id}/edit`)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950 transition-colors" title="Edit template">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => setDeleteTemplate(template)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 transition-colors" title="Delete template">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {expandedId === template.id && (
              <div className="mt-4 border-t border-gray-100 dark:border-gray-700 pt-4 space-y-4">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Fields</p>
                  {template.fields && template.fields.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {template.fields.map(field => (
                        <div key={field.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              {field.fieldType === 'calculated' && <Calculator className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                              <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-200">{field.fieldName}</p>
                            </div>
                            {field.unit && <p className="text-xs text-gray-400 dark:text-gray-500">Unit: {field.unit}</p>}
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5 ml-2">
                            <Badge variant={fieldTypeBadgeVariants[field.fieldType]}>{fieldTypeLabels[field.fieldType]}</Badge>
                            {field.required && <Badge variant="danger">Req</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-4 text-center">
                      <Tag className="mx-auto mb-2 h-6 w-6 text-gray-300 dark:text-gray-600" />
                      <p className="text-sm text-gray-400 dark:text-gray-500">No fields.{' '}
                        <button className="text-blue-600 hover:underline" onClick={() => navigate(`/templates/${template.id}/edit`)}>Add fields →</button>
                      </p>
                    </div>
                  )}
                </div>
                {(template.b2bPrices?.length ?? 0) > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">B2B Pricing</p>
                    <div className="flex flex-wrap gap-2">
                      {template.b2bPrices.map(p => (
                        <div key={p.id} className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs dark:border-violet-800 dark:bg-violet-950">
                          <Building2 className="h-3 w-3 text-violet-500 dark:text-violet-400" />
                          <span className="font-medium text-violet-800 dark:text-violet-300">{b2bLabMap[p.b2bLabId] ?? `Lab #${p.b2bLabId}`}</span>
                          <span className="text-violet-600 dark:text-violet-400">₹{Number(p.amount).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
            ))}
          </>
        )}
        {showArchived && (
          <div className="mt-6">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              <Archive className="h-4 w-4" />
              Archived Templates
            </h2>
            {isLoadingArchived ? (
              <div className="py-6 text-center text-sm text-gray-400">Loading archived templates…</div>
            ) : archivedTemplates.length === 0 ? (
              <EmptyState
                icon={<Archive className="h-10 w-10" />}
                title="No archived templates"
                description="Archived templates will appear here"
              />
            ) : (
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-700 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        <th className="pb-2 pr-4">Template Name</th>
                        <th className="pb-2 pr-4">Code</th>
                        <th className="pb-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {archivedTemplates.map((template: TestTemplate) => (
                        <tr key={template.id} className="group">
                          <td className="py-3 pr-4 font-medium text-gray-700 dark:text-gray-200">{template.name}</td>
                          <td className="py-3 pr-4">
                            <span className="rounded-lg bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-500 dark:bg-gray-700 dark:text-gray-400">{template.code}</span>
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => restoreMutation.mutate(template.id)}
                                disabled={restoreMutation.isPending}
                                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-green-600 hover:bg-green-50 dark:hover:bg-green-950 transition-colors disabled:opacity-50"
                                title="Restore template"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Restore
                              </button>
                              <button
                                onClick={() => setPermanentDeleteTemplate(template)}
                                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                                title="Delete forever"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete Forever
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )}
      </PageContent>
      <ConfirmModal
        open={!!deleteTemplate} onClose={() => setDeleteTemplate(null)}
        onConfirm={() => deleteTemplate && removeTemplate.mutate(deleteTemplate.id)}
        title="Archive Template"
        message={`Archive "${deleteTemplate?.name}"? The template will be hidden from active use but can be restored later.`}
        confirmLabel="Archive Template" variant="danger" loading={removeTemplate.isPending}
      />
      <ConfirmModal
        open={!!permanentDeleteTemplate} onClose={() => setPermanentDeleteTemplate(null)}
        onConfirm={() => permanentDeleteTemplate && permanentDeleteMutation.mutate(permanentDeleteTemplate.id)}
        title="Permanently Delete Template"
        message={`Permanently delete "${permanentDeleteTemplate?.name}"? This action cannot be undone and will remove all associated data.`}
        confirmLabel="Delete Forever" variant="danger" loading={permanentDeleteMutation.isPending}
      />
    </div>
  )
}

