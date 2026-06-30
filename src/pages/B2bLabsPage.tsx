import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Building2, Pencil, Trash2, ToggleLeft, ToggleRight, Archive, RotateCcw } from 'lucide-react'
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
import { b2bLabService, type CreateB2bLabDto } from '../services/b2bLabs'
import type { B2bLab } from '../types'
import { toast } from 'sonner'

const emptyForm: CreateB2bLabDto = {
  name: '', contactPerson: '', phone: '', email: '', address: '', city: '', active: true,
}

function LabForm({
  form,
  setForm,
}: {
  form: CreateB2bLabDto
  setForm: React.Dispatch<React.SetStateAction<CreateB2bLabDto>>
}) {
  return (
    <div className="space-y-4">
      <Input
        label="Lab Name"
        placeholder="e.g. City Diagnostics Centre"
        value={form.name}
        onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Contact Person"
          placeholder="Dr. John Smith"
          value={form.contactPerson ?? ''}
          onChange={e => setForm(p => ({ ...p, contactPerson: e.target.value }))}
        />
        <Input
          label="Phone"
          placeholder="+91 98765 43210"
          value={form.phone ?? ''}
          onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
        />
        <Input
          label="Email"
          type="email"
          placeholder="lab@example.com"
          value={form.email ?? ''}
          onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
        />
        <Input
          label="City"
          placeholder="Mumbai"
          value={form.city ?? ''}
          onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
        />
      </div>
      <Input
        label="Address"
        placeholder="Full address"
        value={form.address ?? ''}
        onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
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
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Active partner</span>
      </label>
    </div>
  )
}

export default function B2bLabsPage() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editLab, setEditLab] = useState<B2bLab | null>(null)
  const [deleteLab, setDeleteLab] = useState<B2bLab | null>(null)
  const [createForm, setCreateForm] = useState<CreateB2bLabDto>(emptyForm)
  const [editForm, setEditForm] = useState<CreateB2bLabDto>(emptyForm)
  const [showArchived, setShowArchived] = useState(false)
  const [permDeleteLab, setPermDeleteLab] = useState<B2bLab | null>(null)

  const { data: labs = [], isLoading } = useQuery({
    queryKey: ['b2b-labs'],
    queryFn: b2bLabService.getAll,
  })

  const { data: archivedLabs = [] } = useQuery({
    queryKey: ['b2b-labs-archived'],
    queryFn: b2bLabService.getArchived,
    enabled: showArchived,
  })

  const createMutation = useMutation({
    mutationFn: b2bLabService.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['b2b-labs'] })
      setCreateForm(emptyForm)
      setCreateOpen(false)
      toast.success('B2B lab partner created successfully')
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create B2B lab'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: Partial<CreateB2bLabDto> }) => b2bLabService.update(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['b2b-labs'] })
      setEditLab(null)
      toast.success('B2B lab updated successfully')
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update B2B lab'),
  })

  const deleteMutation = useMutation({
    mutationFn: b2bLabService.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['b2b-labs'] })
      qc.invalidateQueries({ queryKey: ['b2b-labs-archived'] })
      setDeleteLab(null)
      toast.success('B2B lab archived')
    },
    onError: () => toast.error('Failed to archive B2B lab'),
  })

  const restoreMutation = useMutation({
    mutationFn: b2bLabService.restore,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['b2b-labs'] })
      qc.invalidateQueries({ queryKey: ['b2b-labs-archived'] })
      toast.success('B2B lab restored')
    },
    onError: () => toast.error('Failed to restore B2B lab'),
  })

  const permanentDeleteMutation = useMutation({
    mutationFn: b2bLabService.permanentDelete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['b2b-labs-archived'] })
      setPermDeleteLab(null)
      toast.success('B2B lab permanently deleted')
    },
    onError: () => toast.error('Failed to permanently delete B2B lab'),
  })

  const openEdit = (lab: B2bLab) => {
    setEditLab(lab)
    setEditForm({
      name: lab.name,
      contactPerson: lab.contactPerson ?? '',
      phone: lab.phone ?? '',
      email: lab.email ?? '',
      address: lab.address ?? '',
      city: lab.city ?? '',
      active: lab.active,
    })
  }

  const handleCreate = () => {
    if (!createForm.name.trim()) {
      toast.error('Lab name is required')
      return
    }
    createMutation.mutate(createForm)
  }

  const handleUpdate = () => {
    if (!editLab) return
    if (!editForm.name.trim()) {
      toast.error('Lab name is required')
      return
    }
    updateMutation.mutate({ id: editLab.id, dto: editForm })
  }

  const totalLabs = labs.length
  const activeLabs = labs.filter(l => l.active).length

  return (
    <div>
      <Header
        title="B2B Partners"
        subtitle="Manage external laboratory partners"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              icon={<Archive className="h-4 w-4" />}
              onClick={() => setShowArchived(v => !v)}
            >
              {showArchived ? 'Hide Archived' : 'Archived'}
            </Button>
            {labs.length > 0 && (
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>New Partner</Button>
            )}
          </div>
        }
      />

      <PageContent className="space-y-6">
        <StatSummaryGrid
          columns={3}
          stats={[
            { title: 'Total Partners', value: totalLabs, icon: <Building2 className="h-5 w-5" />, color: 'blue' },
            { title: 'Active Partners', value: activeLabs, icon: <Building2 className="h-5 w-5" />, color: 'emerald' },
            { title: 'Inactive Partners', value: totalLabs - activeLabs, icon: <Building2 className="h-5 w-5" />, color: 'gray' },
          ]}
        />

        {isLoading ? <PageLoader /> : labs.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-12 w-12" />}
            title="No B2B partners yet"
            description="Add your first external laboratory partner"
            action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>Add Partner</Button>}
          />
        ) : (
          <DataTable title="All Partners" count={labs.length} minWidth="780px">
            <DataTableHead>
              <DataTableTh>Lab Name</DataTableTh>
              <DataTableTh>Contact</DataTableTh>
              <DataTableTh>Phone</DataTableTh>
              <DataTableTh>City</DataTableTh>
              <DataTableTh>Status</DataTableTh>
              <DataTableTh align="right">Actions</DataTableTh>
            </DataTableHead>
            <DataTableBody>
              {labs.map((lab) => (
                <DataTableRow key={lab.id}>
                  <DataTableTd>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800 dark:text-gray-100">{lab.name}</p>
                        {lab.email && <p className="text-xs text-gray-400 dark:text-gray-500">{lab.email}</p>}
                      </div>
                    </div>
                  </DataTableTd>
                  <DataTableTd className="text-gray-600 dark:text-gray-400">{lab.contactPerson ?? '—'}</DataTableTd>
                  <DataTableTd className="text-gray-600 dark:text-gray-400">{lab.phone ?? '—'}</DataTableTd>
                  <DataTableTd className="text-gray-600 dark:text-gray-400">{lab.city ?? '—'}</DataTableTd>
                  <DataTableTd>
                    <Badge variant={lab.active ? 'success' : 'default'} dot>
                      {lab.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </DataTableTd>
                  <DataTableTd align="right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openEdit(lab)}>Edit</Button>
                      <Button size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />}
                        className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => setDeleteLab(lab)}>
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
          <DataTable title="Archived Partners" count={archivedLabs.length} minWidth="560px">
            <DataTableHead>
              <DataTableTh>Lab Name</DataTableTh>
              <DataTableTh>City</DataTableTh>
              <DataTableTh>Date Archived</DataTableTh>
              <DataTableTh align="right">Actions</DataTableTh>
            </DataTableHead>
            <DataTableBody>
              {archivedLabs.length === 0 ? (
                <DataTableRow>
                  <DataTableTd colSpan={4} className="py-8 text-center text-sm text-gray-400">No archived partners</DataTableTd>
                </DataTableRow>
              ) : archivedLabs.map(lab => (
                <DataTableRow key={lab.id}>
                  <DataTableTd>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-400">
                        <Archive className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-700 dark:text-gray-300">{lab.name}</p>
                        {lab.email && <p className="text-xs text-gray-400">{lab.email}</p>}
                      </div>
                    </div>
                  </DataTableTd>
                  <DataTableTd className="text-gray-500 dark:text-gray-400">{lab.city ?? '—'}</DataTableTd>
                  <DataTableTd className="text-gray-500 dark:text-gray-400">
                    {lab.deletedAt ? new Date(lab.deletedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </DataTableTd>
                  <DataTableTd align="right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" icon={<RotateCcw className="h-3.5 w-3.5 text-blue-500" />}
                        className="text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        onClick={() => restoreMutation.mutate(lab.id)}>Restore</Button>
                      <Button size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />}
                        className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => setPermDeleteLab(lab)}>
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
        title="Add B2B Partner"
        subtitle="Register a new external laboratory partner"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button loading={createMutation.isPending} onClick={handleCreate}>Add Partner</Button>
          </>
        }
      >
        <LabForm form={createForm} setForm={setCreateForm} />
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={!!editLab}
        onClose={() => setEditLab(null)}
        title="Edit B2B Partner"
        subtitle={`Editing ${editLab?.name ?? ''}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditLab(null)}>Cancel</Button>
            <Button loading={updateMutation.isPending} onClick={handleUpdate}>Save Changes</Button>
          </>
        }
      >
        <LabForm form={editForm} setForm={setEditForm} />
      </Modal>

      {/* Archive Confirm */}
      <ConfirmModal
        open={!!deleteLab}
        onClose={() => setDeleteLab(null)}
        onConfirm={() => deleteLab && deleteMutation.mutate(deleteLab.id)}
        title="Archive B2B Partner"
        message={`Are you sure you want to archive "${deleteLab?.name}"? You can restore it later from the archived view.`}
        confirmLabel="Archive Partner"
        variant="danger"
        loading={deleteMutation.isPending}
      />

      {/* Permanent Delete Confirm */}
      <ConfirmModal
        open={!!permDeleteLab}
        onClose={() => setPermDeleteLab(null)}
        onConfirm={() => permDeleteLab && permanentDeleteMutation.mutate(permDeleteLab.id)}
        title="Delete Forever"
        message={`Permanently delete "${permDeleteLab?.name}"? This cannot be undone.`}
        confirmLabel="Delete Forever"
        variant="danger"
        loading={permanentDeleteMutation.isPending}
      />
    </div>
  )
}

