import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Stethoscope, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
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
import { doctorService, type CreateDoctorDto } from '../services/doctors'
import type { Doctor } from '../types'
import { toast } from 'sonner'
import { toastError } from '../lib/errors'
import { toTitleCase } from '../lib/utils'

const emptyForm: CreateDoctorDto = { name: '', degreeName: '', active: true }

function DoctorForm({
  form,
  setForm,
}: {
  form: CreateDoctorDto
  setForm: React.Dispatch<React.SetStateAction<CreateDoctorDto>>
}) {
  return (
    <div className="space-y-4">
      <Input
        label="Doctor Name"
        placeholder="e.g. Dr. Sharma"
        value={form.name}
        onChange={e => setForm(p => ({ ...p, name: toTitleCase(e.target.value) }))}
        required
      />
      <Input
        label="Degree"
        placeholder="e.g. MD, Pathologist"
        value={form.degreeName ?? ''}
        onChange={e => setForm(p => ({ ...p, degreeName: toTitleCase(e.target.value) }))}
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
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Active (shown in patient form)</span>
      </label>
    </div>
  )
}

export default function DoctorsPage() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editDoctor, setEditDoctor] = useState<Doctor | null>(null)
  const [deleteDoctor, setDeleteDoctor] = useState<Doctor | null>(null)
  const [createForm, setCreateForm] = useState<CreateDoctorDto>(emptyForm)
  const [editForm, setEditForm] = useState<CreateDoctorDto>(emptyForm)

  const { data: doctors = [], isLoading } = useQuery({
    queryKey: ['doctors'],
    queryFn: doctorService.getAll,
  })

  const createMutation = useMutation({
    mutationFn: doctorService.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctors'] })
      setCreateForm(emptyForm)
      setCreateOpen(false)
      toast.success('Doctor added successfully')
    },
    onError: (err) => toastError(err, 'Failed to add doctor'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: Partial<CreateDoctorDto> }) => doctorService.update(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctors'] })
      setEditDoctor(null)
      toast.success('Doctor updated successfully')
    },
    onError: (err) => toastError(err, 'Failed to update doctor'),
  })

  const deleteMutation = useMutation({
    mutationFn: doctorService.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctors'] })
      setDeleteDoctor(null)
      toast.success('Doctor archived')
    },
    onError: (err) => toastError(err, 'Failed to archive doctor'),
  })

  const openEdit = (doctor: Doctor) => {
    setEditDoctor(doctor)
    setEditForm({ name: doctor.name, degreeName: doctor.degreeName ?? '', active: doctor.active })
  }

  const handleCreate = () => {
    if (!createForm.name.trim()) { toast.error('Doctor name is required'); return }
    createMutation.mutate(createForm)
  }

  const handleUpdate = () => {
    if (!editDoctor) return
    if (!editForm.name.trim()) { toast.error('Doctor name is required'); return }
    updateMutation.mutate({ id: editDoctor.id, dto: editForm })
  }

  const totalDoctors = doctors.length
  const activeDoctors = doctors.filter(d => d.active).length

  return (
    <div>
      <Header
        title="Doctors"
        subtitle="Manage referring doctors shown in the patient form"
        action={
          doctors.length > 0 ? (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>New Doctor</Button>
          ) : undefined
        }
      />

      <PageContent className="space-y-6">
        <StatSummaryGrid
          columns={3}
          stats={[
            { title: 'Total Doctors', value: totalDoctors, icon: <Stethoscope className="h-5 w-5" />, color: 'blue' },
            { title: 'Active Doctors', value: activeDoctors, icon: <Stethoscope className="h-5 w-5" />, color: 'emerald' },
            { title: 'Inactive Doctors', value: totalDoctors - activeDoctors, icon: <Stethoscope className="h-5 w-5" />, color: 'gray' },
          ]}
        />

        {isLoading ? <PageLoader /> : doctors.length === 0 ? (
          <EmptyState
            icon={<Stethoscope className="h-12 w-12" />}
            title="No doctors yet"
            description="Add referring doctors so they can be selected in the patient form"
            action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>Add Doctor</Button>}
          />
        ) : (
          <DataTable title="All Doctors" count={doctors.length} minWidth="600px">
            <DataTableHead>
              <DataTableTh>Name</DataTableTh>
              <DataTableTh>Degree</DataTableTh>
              <DataTableTh>Status</DataTableTh>
              <DataTableTh align="right">Actions</DataTableTh>
            </DataTableHead>
            <DataTableBody>
              {doctors.map((doctor) => (
                <DataTableRow key={doctor.id}>
                  <DataTableTd>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600">
                        <Stethoscope className="h-4 w-4" />
                      </div>
                      <p className="font-semibold text-gray-800 dark:text-gray-100">{doctor.name}</p>
                    </div>
                  </DataTableTd>
                  <DataTableTd className="text-gray-600 dark:text-gray-400">{doctor.degreeName ?? '—'}</DataTableTd>
                  <DataTableTd>
                    <Badge variant={doctor.active ? 'success' : 'default'} dot>
                      {doctor.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </DataTableTd>
                  <DataTableTd align="right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openEdit(doctor)}>Edit</Button>
                      <Button size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />}
                        className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => setDeleteDoctor(doctor)}>
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

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add Doctor"
        subtitle="Register a new referring doctor"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button loading={createMutation.isPending} onClick={handleCreate}>Add Doctor</Button>
          </>
        }
      >
        <DoctorForm form={createForm} setForm={setCreateForm} />
      </Modal>

      <Modal
        open={!!editDoctor}
        onClose={() => setEditDoctor(null)}
        title="Edit Doctor"
        subtitle={`Editing ${editDoctor?.name ?? ''}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditDoctor(null)}>Cancel</Button>
            <Button loading={updateMutation.isPending} onClick={handleUpdate}>Save Changes</Button>
          </>
        }
      >
        <DoctorForm form={editForm} setForm={setEditForm} />
      </Modal>

      <ConfirmModal
        open={!!deleteDoctor}
        onClose={() => setDeleteDoctor(null)}
        onConfirm={() => deleteDoctor && deleteMutation.mutate(deleteDoctor.id)}
        title="Archive Doctor"
        message={`Are you sure you want to archive "${deleteDoctor?.name}"? You can restore it later from the archived view.`}
        confirmLabel="Archive Doctor"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
