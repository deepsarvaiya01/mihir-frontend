import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, MapPin, Pencil, Trash2, Archive, RotateCcw } from 'lucide-react'
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
import { labBranchService, type CreateLabBranchDto } from '../services/labBranches'
import type { LabBranch } from '../types'
import { toast } from 'sonner'

const emptyForm: CreateLabBranchDto = {
  name: '', address: '', phone: '', active: true,
}

function BranchForm({
  form,
  setForm,
}: {
  form: CreateLabBranchDto
  setForm: React.Dispatch<React.SetStateAction<CreateLabBranchDto>>
}) {
  return (
    <div className="space-y-4">
      <Input
        label="Branch Name"
        placeholder="e.g. Main Branch, North Centre"
        value={form.name}
        onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
        required
      />
      <Input
        label="Phone"
        placeholder="+91 98765 43210"
        value={form.phone ?? ''}
        onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
      />
      <Input
        label="Address"
        placeholder="Full address of branch"
        value={form.address ?? ''}
        onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
      />
      <label className="flex cursor-pointer items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={form.active}
          onClick={() => setForm(p => ({ ...p, active: !p.active }))}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
            form.active ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
              form.active ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
        <span className={`text-sm font-medium ${form.active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
          {form.active ? 'Active branch' : 'Inactive branch'}
        </span>
      </label>
    </div>
  )
}

export default function LabBranchesPage() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editBranch, setEditBranch] = useState<LabBranch | null>(null)
  const [deleteBranch, setDeleteBranch] = useState<LabBranch | null>(null)
  const [createForm, setCreateForm] = useState<CreateLabBranchDto>(emptyForm)
  const [editForm, setEditForm] = useState<CreateLabBranchDto>(emptyForm)
  const [showArchived, setShowArchived] = useState(false)
  const [permDeleteBranch, setPermDeleteBranch] = useState<LabBranch | null>(null)

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['lab-branches'],
    queryFn: labBranchService.getAll,
  })

  const { data: archivedBranches = [] } = useQuery({
    queryKey: ['lab-branches-archived'],
    queryFn: labBranchService.getArchived,
    enabled: showArchived,
  })

  const createMutation = useMutation({
    mutationFn: labBranchService.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lab-branches'] })
      setCreateForm(emptyForm)
      setCreateOpen(false)
      toast.success('Lab branch created successfully')
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create branch'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: Partial<CreateLabBranchDto> }) => labBranchService.update(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lab-branches'] })
      setEditBranch(null)
      toast.success('Branch updated successfully')
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update branch'),
  })

  const deleteMutation = useMutation({
    mutationFn: labBranchService.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lab-branches'] })
      qc.invalidateQueries({ queryKey: ['lab-branches-archived'] })
      setDeleteBranch(null)
      toast.success('Branch archived')
    },
    onError: () => toast.error('Failed to archive branch'),
  })

  const restoreMutation = useMutation({
    mutationFn: labBranchService.restore,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lab-branches'] })
      qc.invalidateQueries({ queryKey: ['lab-branches-archived'] })
      toast.success('Branch restored')
    },
    onError: () => toast.error('Failed to restore branch'),
  })

  const permanentDeleteMutation = useMutation({
    mutationFn: labBranchService.permanentDelete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lab-branches-archived'] })
      setPermDeleteBranch(null)
      toast.success('Branch permanently deleted')
    },
    onError: () => toast.error('Failed to permanently delete branch'),
  })

  const openEdit = (branch: LabBranch) => {
    setEditBranch(branch)
    setEditForm({
      name: branch.name,
      address: branch.address ?? '',
      phone: branch.phone ?? '',
      active: branch.active,
    })
  }

  const handleCreate = () => {
    if (!createForm.name.trim()) {
      toast.error('Branch name is required')
      return
    }
    createMutation.mutate(createForm)
  }

  const handleUpdate = () => {
    if (!editBranch) return
    if (!editForm.name.trim()) {
      toast.error('Branch name is required')
      return
    }
    updateMutation.mutate({ id: editBranch.id, dto: editForm })
  }

  const totalBranches = branches.length
  const activeBranches = branches.filter(b => b.active).length

  return (
    <div>
      <Header
        title="Lab Branches"
        subtitle="Manage your laboratory branches and locations"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              icon={<Archive className="h-4 w-4" />}
              onClick={() => setShowArchived(v => !v)}
            >
              {showArchived ? 'Hide Archived' : 'Archived'}
            </Button>
            {branches.length > 0 && (
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>New Branch</Button>
            )}
          </div>
        }
      />

      <PageContent className="space-y-6">
        <StatSummaryGrid
          columns={3}
          stats={[
            { title: 'Total Branches', value: totalBranches, icon: <MapPin className="h-5 w-5" />, color: 'blue' },
            { title: 'Active Branches', value: activeBranches, icon: <MapPin className="h-5 w-5" />, color: 'emerald' },
            { title: 'Inactive Branches', value: totalBranches - activeBranches, icon: <MapPin className="h-5 w-5" />, color: 'gray' },
          ]}
        />

        {isLoading ? <PageLoader /> : branches.length === 0 ? (
          <EmptyState
            icon={<MapPin className="h-12 w-12" />}
            title="No branches yet"
            description="Add your first laboratory branch location"
            action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>Add Branch</Button>}
          />
        ) : (
          <DataTable title="All Branches" count={branches.length}>
            <DataTableHead>
              <DataTableTh>Branch Name</DataTableTh>
              <DataTableTh>Address</DataTableTh>
              <DataTableTh>Phone</DataTableTh>
              <DataTableTh>Status</DataTableTh>
              <DataTableTh align="right">Actions</DataTableTh>
            </DataTableHead>
            <DataTableBody>
              {branches.map((branch) => (
                <DataTableRow key={branch.id}>
                  <DataTableTd>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600">
                        <MapPin className="h-4 w-4" />
                      </div>
                      <p className="font-semibold text-gray-800 dark:text-gray-100">{branch.name}</p>
                    </div>
                  </DataTableTd>
                  <DataTableTd className="max-w-[200px] truncate text-gray-600 dark:text-gray-400">{branch.address ?? '—'}</DataTableTd>
                  <DataTableTd className="text-gray-600 dark:text-gray-400">{branch.phone ?? '—'}</DataTableTd>
                  <DataTableTd>
                    <Badge variant={branch.active ? 'success' : 'default'} dot>
                      {branch.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </DataTableTd>
                  <DataTableTd align="right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openEdit(branch)}>Edit</Button>
                      <Button size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />}
                        className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => setDeleteBranch(branch)}>
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
          <DataTable title="Archived Branches" count={archivedBranches.length} minWidth="560px">
            <DataTableHead>
              <DataTableTh>Branch Name</DataTableTh>
              <DataTableTh>Phone</DataTableTh>
              <DataTableTh>Date Archived</DataTableTh>
              <DataTableTh align="right">Actions</DataTableTh>
            </DataTableHead>
            <DataTableBody>
              {archivedBranches.length === 0 ? (
                <DataTableRow>
                  <DataTableTd colSpan={4} className="py-8 text-center text-sm text-gray-400">No archived branches</DataTableTd>
                </DataTableRow>
              ) : archivedBranches.map(branch => (
                <DataTableRow key={branch.id}>
                  <DataTableTd>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-400">
                        <Archive className="h-4 w-4" />
                      </div>
                      <p className="font-semibold text-gray-700 dark:text-gray-300">{branch.name}</p>
                    </div>
                  </DataTableTd>
                  <DataTableTd className="text-gray-500 dark:text-gray-400">{branch.phone ?? '—'}</DataTableTd>
                  <DataTableTd className="text-gray-500 dark:text-gray-400">
                    {branch.deletedAt ? new Date(branch.deletedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </DataTableTd>
                  <DataTableTd align="right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" icon={<RotateCcw className="h-3.5 w-3.5 text-blue-500" />}
                        className="text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        onClick={() => restoreMutation.mutate(branch.id)}>Restore</Button>
                      <Button size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />}
                        className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => setPermDeleteBranch(branch)}>
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

      {/* Create Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add Lab Branch"
        subtitle="Register a new branch location"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button loading={createMutation.isPending} onClick={handleCreate}>Add Branch</Button>
          </>
        }
      >
        <BranchForm form={createForm} setForm={setCreateForm} />
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={!!editBranch}
        onClose={() => setEditBranch(null)}
        title="Edit Branch"
        subtitle={`Editing ${editBranch?.name ?? ''}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditBranch(null)}>Cancel</Button>
            <Button loading={updateMutation.isPending} onClick={handleUpdate}>Save Changes</Button>
          </>
        }
      >
        <BranchForm form={editForm} setForm={setEditForm} />
      </Modal>

      {/* Archive Confirm */}
      <ConfirmModal
        open={!!deleteBranch}
        onClose={() => setDeleteBranch(null)}
        onConfirm={() => deleteBranch && deleteMutation.mutate(deleteBranch.id)}
        title="Archive Branch"
        message={`Are you sure you want to archive "${deleteBranch?.name}"? You can restore it later from the archived view.`}
        confirmLabel="Archive Branch"
        variant="danger"
        loading={deleteMutation.isPending}
      />

      {/* Permanent Delete Confirm */}
      <ConfirmModal
        open={!!permDeleteBranch}
        onClose={() => setPermDeleteBranch(null)}
        onConfirm={() => permDeleteBranch && permanentDeleteMutation.mutate(permDeleteBranch.id)}
        title="Delete Forever"
        message={`Permanently delete "${permDeleteBranch?.name}"? This cannot be undone.`}
        confirmLabel="Delete Forever"
        variant="danger"
        loading={permanentDeleteMutation.isPending}
      />
    </div>
  )
}

