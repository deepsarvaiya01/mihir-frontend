import { Fragment, useState } from 'react'
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
import { PageContent } from '../components/ui/PageContent'
import { FilterBar } from '../components/ui/FilterBar'
import { templateService } from '../services/templates'
import { b2bLabService } from '../services/b2bLabs'
import { useAuthStore } from '../store/authStore'
import type { FieldType, TestTemplate } from '../types'
import { toast } from 'sonner'
import { toastError } from '../lib/errors'

const fieldTypeLabels: Record<FieldType, string> = {
  text: 'Text', number: 'Number', checkbox: 'Checkbox', date: 'Date', select: 'Select', calculated: 'Calculated',
}
const fieldTypeBadgeVariants: Record<FieldType, 'default' | 'info' | 'success' | 'warning' | 'purple' | 'danger'> = {
  text: 'default', number: 'info', checkbox: 'success', date: 'warning', select: 'purple', calculated: 'danger',
}

export default function TemplatesPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const isAdmin = useAuthStore(s => s.user?.role === 'SUPER_ADMIN')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [deleteTemplate, setDeleteTemplate] = useState<TestTemplate | null>(null)
  const [search, setSearch] = useState('')

  const { data: templates = [], isLoading } = useQuery({ queryKey: ['templates'], queryFn: templateService.getAll })
  const { data: b2bLabs = [] } = useQuery({ queryKey: ['b2b-labs'], queryFn: b2bLabService.getAll })
  const b2bLabMap = Object.fromEntries(b2bLabs.map(l => [l.id, l.name]))

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => templateService.update(id, { active }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); toast.success('Status updated') },
    onError: (err) => toastError(err, 'Failed to update'),
  })

  const removeTemplate = useMutation({
    mutationFn: (id: number) => templateService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] })
      setDeleteTemplate(null)
      toast.success('Template archived')
    },
    onError: (err) => toastError(err, 'Failed to archive'),
  })

  const filtered = templates.filter(t => {
    const q = search.toLowerCase()
    return !q || t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q)
  })

  return (
    <div>
      <Header
        title="Test Catalogue"
        subtitle={isAdmin ? 'Manage test templates, fields and B2B pricing' : 'View test templates, fields and pricing'}
        action={
          isAdmin && templates.length > 0 ? (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/templates/new')}>New Template</Button>
          ) : undefined
        }
      />
      <PageContent className="space-y-4">
        {isLoading ? <PageLoader /> : templates.length === 0 ? (
          <EmptyState icon={<FlaskConical className="h-12 w-12" />} title="No templates yet"
            description={isAdmin ? 'Create your first test template' : 'No test templates are available yet'}
            action={isAdmin ? <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/templates/new')}>Create Template</Button> : undefined} />
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
            ) : (
              <Card padding="none">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-700 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        <th className="px-5 py-3">Template</th>
                        <th className="px-5 py-3">Category</th>
                        <th className="px-5 py-3">Fields</th>
                        <th className="px-5 py-3">Price</th>
                        <th className="px-5 py-3">B2B Price</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {filtered.map(template => (
                        <Fragment key={template.id}>
                          <tr className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40">
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950">
                                  <FlaskConical className="h-4 w-4 text-blue-600" />
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-gray-800 dark:text-white">{template.name}</p>
                                  <span className="font-mono text-xs text-gray-400 dark:text-gray-500">{template.code}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3.5">
                              {template.category ? (
                                <span className="rounded-lg bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                                  {template.category.name}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300">
                              <div className="flex items-center gap-2">
                                <span>{template.fields?.length ?? 0} field{(template.fields?.length ?? 0) !== 1 ? 's' : ''}</span>
                                {(template.b2bPrices?.length ?? 0) > 0 && (
                                  <span className="flex shrink-0 items-center gap-1 text-xs text-violet-600 dark:text-violet-400">
                                    <Building2 className="h-3 w-3" />
                                    {template.b2bPrices.length} B2B
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300">
                              {template.amount > 0 ? `₹${Number(template.amount).toLocaleString()}` : '—'}
                            </td>
                            <td className="px-5 py-3.5">
                              {(template.b2bPrices?.length ?? 0) === 0 ? (
                                <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                              ) : (
                                <div className="flex flex-col gap-0.5">
                                  {template.b2bPrices.map(p => (
                                    <span key={p.id} className="whitespace-nowrap text-xs text-violet-700 dark:text-violet-400">
                                      <span className="font-medium">{b2bLabMap[p.b2bLabId] ?? `Lab #${p.b2bLabId}`}</span>
                                      <span className="ml-1.5 font-semibold">₹{Number(p.amount).toLocaleString()}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="px-5 py-3.5">
                              <Badge variant={template.active ? 'success' : 'default'} dot>{template.active ? 'Active' : 'Inactive'}</Badge>
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center justify-end gap-1">
                                {isAdmin && (
                                <button onClick={() => toggleActive.mutate({ id: template.id, active: !template.active })}
                                  className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950 transition-colors" title={template.active ? 'Deactivate' : 'Activate'}>
                                  {template.active ? <ToggleRight className="h-5 w-5 text-blue-600" /> : <ToggleLeft className="h-5 w-5" />}
                                </button>
                                )}
                                <button onClick={() => setExpandedId(expandedId === template.id ? null : template.id)}
                                  className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950 transition-colors" title={expandedId === template.id ? 'Collapse' : 'Details'}>
                                  {expandedId === template.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </button>
                                {isAdmin && (
                                <>
                                <button onClick={() => navigate(`/templates/${template.id}/edit`)}
                                  className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950 transition-colors" title="Edit template">
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button onClick={() => setDeleteTemplate(template)}
                                  className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 transition-colors" title="Delete template">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                                </>
                                )}
                              </div>
                            </td>
                          </tr>

                          {expandedId === template.id && (
                            <tr>
                              <td colSpan={7} className="space-y-4 bg-gray-50/60 px-5 py-4 dark:bg-gray-800/30">
                                <div>
                                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Fields</p>
                                  {template.fields && template.fields.length > 0 ? (
                                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                      {template.fields.map(field => (
                                        <div key={field.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
                                          <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                              {field.fieldType === 'calculated' && <Calculator className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                                              <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-200">{field.fieldName}</p>
                                            </div>
                                            {field.unit && <p className="text-xs text-gray-400 dark:text-gray-500">Unit: {field.unit}</p>}
                                          </div>
                                          <div className="ml-2 flex shrink-0 items-center gap-1.5">
                                            <Badge variant={fieldTypeBadgeVariants[field.fieldType]}>{fieldTypeLabels[field.fieldType]}</Badge>
                                            {field.required && <Badge variant="danger">Req</Badge>}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="rounded-xl border-2 border-dashed border-gray-200 p-4 text-center dark:border-gray-700">
                                      <Tag className="mx-auto mb-2 h-6 w-6 text-gray-300 dark:text-gray-600" />
                                      <p className="text-sm text-gray-400 dark:text-gray-500">No fields.{' '}
                                        {isAdmin && (
                                        <button className="text-blue-600 hover:underline" onClick={() => navigate(`/templates/${template.id}/edit`)}>Add fields →</button>
                                        )}
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
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}
      </PageContent>
      <ConfirmModal
        open={!!deleteTemplate} onClose={() => setDeleteTemplate(null)}
        onConfirm={() => deleteTemplate && removeTemplate.mutate(deleteTemplate.id)}
        title="Archive Template"
        message={`Archive "${deleteTemplate?.name}"? The template will be hidden from active use but can be restored later.`}
        confirmLabel="Archive Template" variant="danger" loading={removeTemplate.isPending}
      />
    </div>
  )
}

