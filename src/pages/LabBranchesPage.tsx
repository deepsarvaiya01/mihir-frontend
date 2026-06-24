import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, MapPin, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
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

export default function LabBranchesPage() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editBranch, setEditBranch] = useState<LabBranch | null>(null)
  const [deleteBranch, setDeleteBranch] = useState<LabBranch | null>(null)
  const [createForm, setCreateForm] = useState<CreateLabBranchDto>(emptyForm)
  const [editForm, setEditForm] = useState<CreateLabBranchDto>(emptyForm)

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['lab-branches'],
    queryFn: labBranchService.getAll,
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
      setDeleteBranch(null)
      toast.success('Branch deleted')
    },
    onError: () => toast.error('Failed to delete branch'),
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

  const BranchForm = ({
    form,
    setForm,
  }: {
    form: CreateLabBranchDto
    setForm: React.Dispatch<React.SetStateAction<CreateLabBranchDto>>
  }) => (
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
          onClick={() => setForm(p => ({ ...p, active: !p.active }))}
          className="text-gray-400 hover:text-blue-600 transition-colors"
        >
          {form.active
            ? <ToggleRight className="h-6 w-6 text-blue-600" />
            : <ToggleLeft className="h-6 w-6" />
          }
        </button>
        <span className="text-sm font-medium text-gray-700">Active branch</span>
      </label>
    </div>
  )

  return (
    <div>
      <Header
        title="Lab Branches"
        subtitle="Manage your laboratory branches and locations"
        action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>New Branch</Button>}
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
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <MapPin className="h-4 w-4" />
                      </div>
                      <p className="font-semibold text-gray-800">{branch.name}</p>
                    </div>
                  </DataTableTd>
                  <DataTableTd className="max-w-[200px] truncate text-gray-600">{branch.address ?? '—'}</DataTableTd>
                  <DataTableTd className="text-gray-600">{branch.phone ?? '—'}</DataTableTd>
                  <DataTableTd>
                    <Badge variant={branch.active ? 'success' : 'default'} dot>
                      {branch.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </DataTableTd>
                  <DataTableTd align="right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openEdit(branch)}>Edit</Button>
                      <Button size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />}
                        className="text-red-500 hover:bg-red-50" onClick={() => setDeleteBranch(branch)}>
                        Delete
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

      {/* Delete Confirm */}
      <ConfirmModal
        open={!!deleteBranch}
        onClose={() => setDeleteBranch(null)}
        onConfirm={() => deleteBranch && deleteMutation.mutate(deleteBranch.id)}
        title="Delete Branch"
        message={`Are you sure you want to delete "${deleteBranch?.name}"? This action cannot be undone.`}
        confirmLabel="Delete Branch"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}

