import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ListOrdered, Pencil, Trash2, ToggleLeft, ToggleRight, Archive, RotateCcw } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { Modal, ConfirmModal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { PageLoader } from '../components/ui/Spinner'
import { PageContent } from '../components/ui/PageContent'
import { StatSummaryGrid } from '../components/ui/StatSummaryGrid'
import { DataTable, DataTableHead, DataTableTh, DataTableBody, DataTableRow, DataTableTd } from '../components/ui/DataTable'
import { testCategoryService, type CreateTestCategoryDto } from '../services/testCategories'
import type { TestCategory } from '../types'
import { toast } from 'sonner'
import { toastError } from '../lib/errors'

const emptyForm: CreateTestCategoryDto = { name: '', code: '', displayOrder: 1, active: true }

function CategoryForm({
  form,
  setForm,
}: {
  form: CreateTestCategoryDto
  setForm: React.Dispatch<React.SetStateAction<CreateTestCategoryDto>>
}) {
  return (
    <div className="space-y-4">
      <Input
        label="Category Name"
        placeholder="e.g. Biochemistry"
        value={form.name}
        onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
        required
      />
      <Input
        label="Code"
        placeholder="e.g. BIOCHEM"
        value={form.code}
        onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
        required
      />
      <Input
        label="Order"
        type="number"
        min={1}
        hint="Lower numbers print first in a combined report"
        value={String(form.displayOrder ?? 1)}
        onChange={e => setForm(p => ({ ...p, displayOrder: Number(e.target.value) || 1 }))}
      />
      <label className="flex cursor-pointer items-center gap-3">
        <button
          type="button"
          onClick={() => setForm(p => ({ ...p, active: !p.active }))}
          className="text-gray-400 dark:text-gray-500 hover:text-blue-600 transition-colors"
        >
          {form.active
            ? <ToggleRight className="h-6 w-6 text-blue-600" />
            : <ToggleLeft className="h-6 w-6" />
          }
        </button>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Active (selectable on test templates)</span>
      </label>
    </div>
  )
}

export default function TestCategoriesPage() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editCategory, setEditCategory] = useState<TestCategory | null>(null)
  const [deleteCategory, setDeleteCategory] = useState<TestCategory | null>(null)
  const [createForm, setCreateForm] = useState<CreateTestCategoryDto>(emptyForm)
  const [editForm, setEditForm] = useState<CreateTestCategoryDto>(emptyForm)
  const [showArchived, setShowArchived] = useState(false)
  const [permDeleteCategory, setPermDeleteCategory] = useState<TestCategory | null>(null)

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['test-categories'],
    queryFn: testCategoryService.getAll,
  })

  const { data: archivedCategories = [] } = useQuery({
    queryKey: ['test-categories-archived'],
    queryFn: testCategoryService.getArchived,
    enabled: showArchived,
  })

  const createMutation = useMutation({
    mutationFn: testCategoryService.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['test-categories'] })
      setCreateForm(emptyForm)
      setCreateOpen(false)
      toast.success('Test category added successfully')
    },
    onError: (err) => toastError(err, 'Failed to add test category'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: Partial<CreateTestCategoryDto> }) => testCategoryService.update(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['test-categories'] })
      qc.invalidateQueries({ queryKey: ['templates'] })
      setEditCategory(null)
      toast.success('Test category updated successfully')
    },
    onError: (err) => toastError(err, 'Failed to update test category'),
  })

  const deleteMutation = useMutation({
    mutationFn: testCategoryService.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['test-categories'] })
      qc.invalidateQueries({ queryKey: ['test-categories-archived'] })
      setDeleteCategory(null)
      toast.success('Test category archived')
    },
    onError: (err) => toastError(err, 'Failed to archive test category'),
  })

  const restoreMutation = useMutation({
    mutationFn: testCategoryService.restore,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['test-categories'] })
      qc.invalidateQueries({ queryKey: ['test-categories-archived'] })
      toast.success('Test category restored')
    },
    onError: (err) => toastError(err, 'Failed to restore test category'),
  })

  const permanentDeleteMutation = useMutation({
    mutationFn: testCategoryService.permanentDelete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['test-categories-archived'] })
      setPermDeleteCategory(null)
      toast.success('Test category permanently deleted')
    },
    onError: (err) => toastError(err, 'Failed to permanently delete test category'),
  })

  const openEdit = (category: TestCategory) => {
    setEditCategory(category)
    setEditForm({ name: category.name, code: category.code, displayOrder: category.displayOrder, active: category.active })
  }

  const handleCreate = () => {
    if (!createForm.name.trim()) { toast.error('Category name is required'); return }
    if (!createForm.code.trim()) { toast.error('Category code is required'); return }
    createMutation.mutate(createForm)
  }

  const handleUpdate = () => {
    if (!editCategory) return
    if (!editForm.name.trim()) { toast.error('Category name is required'); return }
    updateMutation.mutate({ id: editCategory.id, dto: editForm })
  }

  const sorted = [...categories].sort((a, b) => a.displayOrder - b.displayOrder)
  const totalCategories = categories.length
  const activeCategories = categories.filter(c => c.active).length

  return (
    <div>
      <Header
        title="Test Categories"
        subtitle="Group tests and control the order they print in a combined report"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon={<Archive className="h-4 w-4" />} onClick={() => setShowArchived(v => !v)}>
              {showArchived ? 'Hide Archived' : 'Archived'}
            </Button>
            {categories.length > 0 && (
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>New Category</Button>
            )}
          </div>
        }
      />

      <PageContent className="space-y-6">
        <StatSummaryGrid
          columns={3}
          stats={[
            { title: 'Total Categories', value: totalCategories, icon: <ListOrdered className="h-5 w-5" />, color: 'blue' },
            { title: 'Active Categories', value: activeCategories, icon: <ListOrdered className="h-5 w-5" />, color: 'emerald' },
            { title: 'Inactive Categories', value: totalCategories - activeCategories, icon: <ListOrdered className="h-5 w-5" />, color: 'gray' },
          ]}
        />

        {isLoading ? <PageLoader /> : categories.length === 0 ? (
          <EmptyState
            icon={<ListOrdered className="h-12 w-12" />}
            title="No test categories yet"
            description="Add categories like Biochemistry or Hematology to control report ordering"
            action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>Add Category</Button>}
          />
        ) : (
          <DataTable title="All Test Categories" count={categories.length} minWidth="600px">
            <DataTableHead>
              <DataTableTh>Name</DataTableTh>
              <DataTableTh>Code</DataTableTh>
              <DataTableTh>Order</DataTableTh>
              <DataTableTh>Status</DataTableTh>
              <DataTableTh align="right">Actions</DataTableTh>
            </DataTableHead>
            <DataTableBody>
              {sorted.map((category) => (
                <DataTableRow key={category.id}>
                  <DataTableTd>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600">
                        <ListOrdered className="h-4 w-4" />
                      </div>
                      <p className="font-semibold text-gray-800 dark:text-gray-100">{category.name}</p>
                    </div>
                  </DataTableTd>
                  <DataTableTd>
                    <span className="rounded-lg bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400">{category.code}</span>
                  </DataTableTd>
                  <DataTableTd className="text-gray-600 dark:text-gray-400">{category.displayOrder}</DataTableTd>
                  <DataTableTd>
                    <Badge variant={category.active ? 'success' : 'default'} dot>
                      {category.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </DataTableTd>
                  <DataTableTd align="right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openEdit(category)}>Edit</Button>
                      <Button size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />}
                        className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => setDeleteCategory(category)}>
                        Delete
                      </Button>
                    </div>
                  </DataTableTd>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}

        {showArchived && (
          <DataTable title="Archived Test Categories" count={archivedCategories.length} minWidth="560px">
            <DataTableHead>
              <DataTableTh>Name</DataTableTh>
              <DataTableTh>Date Archived</DataTableTh>
              <DataTableTh align="right">Actions</DataTableTh>
            </DataTableHead>
            <DataTableBody>
              {archivedCategories.length === 0 ? (
                <DataTableRow>
                  <DataTableTd colSpan={3} className="py-8 text-center text-sm text-gray-400">No archived categories</DataTableTd>
                </DataTableRow>
              ) : archivedCategories.map(category => (
                <DataTableRow key={category.id}>
                  <DataTableTd>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-400">
                        <Archive className="h-4 w-4" />
                      </div>
                      <p className="font-semibold text-gray-700 dark:text-gray-300">{category.name}</p>
                    </div>
                  </DataTableTd>
                  <DataTableTd className="text-gray-500 dark:text-gray-400">
                    {category.deletedAt ? new Date(category.deletedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </DataTableTd>
                  <DataTableTd align="right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" icon={<RotateCcw className="h-3.5 w-3.5 text-blue-500" />}
                        className="text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        onClick={() => restoreMutation.mutate(category.id)}>Restore</Button>
                      <Button size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />}
                        className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => setPermDeleteCategory(category)}>
                        Delete Forever
                      </Button>
                    </div>
                  </DataTableTd>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </PageContent>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add Test Category"
        subtitle="Create a new test category"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button loading={createMutation.isPending} onClick={handleCreate}>Add Category</Button>
          </>
        }
      >
        <CategoryForm form={createForm} setForm={setCreateForm} />
      </Modal>

      <Modal
        open={!!editCategory}
        onClose={() => setEditCategory(null)}
        title="Edit Test Category"
        subtitle={`Editing ${editCategory?.name ?? ''}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditCategory(null)}>Cancel</Button>
            <Button loading={updateMutation.isPending} onClick={handleUpdate}>Save Changes</Button>
          </>
        }
      >
        <CategoryForm form={editForm} setForm={setEditForm} />
      </Modal>

      <ConfirmModal
        open={!!deleteCategory}
        onClose={() => setDeleteCategory(null)}
        onConfirm={() => deleteCategory && deleteMutation.mutate(deleteCategory.id)}
        title="Archive Test Category"
        message={`Are you sure you want to archive "${deleteCategory?.name}"? You can restore it later from the archived view.`}
        confirmLabel="Archive Category"
        variant="danger"
        loading={deleteMutation.isPending}
      />

      <ConfirmModal
        open={!!permDeleteCategory}
        onClose={() => setPermDeleteCategory(null)}
        onConfirm={() => permDeleteCategory && permanentDeleteMutation.mutate(permDeleteCategory.id)}
        title="Delete Forever"
        message={`Permanently delete "${permDeleteCategory?.name}"? This cannot be undone.`}
        confirmLabel="Delete Forever"
        variant="danger"
        loading={permanentDeleteMutation.isPending}
      />
    </div>
  )
}
