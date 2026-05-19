import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Users, Search, User, Phone, MapPin, AlertCircle, Pencil, Trash2 } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Input'
import { Modal, ConfirmModal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { PageLoader } from '../components/ui/Spinner'
import { patientService, type CreatePatientDto } from '../services/patients'
import type { Patient } from '../types'
import { toast } from 'sonner'

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say']
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

interface PatientFormState extends Omit<CreatePatientDto, 'age'> {
  age: string
}

const emptyForm: PatientFormState = {
  fullName: '', patientCode: '', age: '', dateOfBirth: '',
  gender: '', bloodGroup: '', email: '', phoneNumber: '',
  addressLine: '', city: '', state: '', postalCode: '',
  emergencyContactName: '', emergencyContactPhone: '',
}

function patientToForm(p: Patient): PatientFormState {
  return {
    fullName: p.fullName ?? '',
    patientCode: p.patientCode ?? '',
    age: p.age != null ? String(p.age) : '',
    dateOfBirth: p.dateOfBirth ?? '',
    gender: p.gender ?? '',
    bloodGroup: p.bloodGroup ?? '',
    email: p.email ?? '',
    phoneNumber: p.phoneNumber ?? '',
    addressLine: p.addressLine ?? '',
    city: p.city ?? '',
    state: p.state ?? '',
    postalCode: p.postalCode ?? '',
    emergencyContactName: p.emergencyContactName ?? '',
    emergencyContactPhone: p.emergencyContactPhone ?? '',
  }
}

function formToDto(form: PatientFormState): CreatePatientDto {
  return {
    ...form,
    age: form.age ? Number(form.age) : undefined,
    dateOfBirth: form.dateOfBirth || undefined,
    gender: form.gender || undefined,
    bloodGroup: form.bloodGroup || undefined,
    email: form.email || undefined,
    phoneNumber: form.phoneNumber || undefined,
    addressLine: form.addressLine || undefined,
    city: form.city || undefined,
    state: form.state || undefined,
    postalCode: form.postalCode || undefined,
    emergencyContactName: form.emergencyContactName || undefined,
    emergencyContactPhone: form.emergencyContactPhone || undefined,
  }
}

export default function PatientsPage() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editPatient, setEditPatient] = useState<Patient | null>(null)
  const [deletePatient, setDeletePatient] = useState<Patient | null>(null)
  const [search, setSearch] = useState('')
  const [createForm, setCreateForm] = useState(emptyForm)
  const [editForm, setEditForm] = useState(emptyForm)

  const { data: patients = [], isLoading } = useQuery({
    queryKey: ['patients'],
    queryFn: () => patientService.getAll(),
  })

  const createMutation = useMutation({
    mutationFn: (dto: CreatePatientDto) => patientService.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patients'] })
      setCreateForm(emptyForm)
      setCreateOpen(false)
      toast.success('Patient profile created successfully')
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create patient'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: Partial<CreatePatientDto> }) => patientService.update(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patients'] })
      setEditPatient(null)
      toast.success('Patient updated successfully')
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update patient'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => patientService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patients'] })
      setDeletePatient(null)
      toast.success('Patient deleted')
    },
    onError: () => toast.error('Failed to delete patient'),
  })

  const openEdit = (p: Patient) => {
    setEditPatient(p)
    setEditForm(patientToForm(p))
  }

  const handleCreate = () => {
    if (!createForm.fullName.trim() || !createForm.patientCode.trim()) {
      toast.error('Full name and patient code are required')
      return
    }
    createMutation.mutate(formToDto(createForm))
  }

  const handleUpdate = () => {
    if (!editPatient) return
    if (!editForm.fullName.trim() || !editForm.patientCode.trim()) {
      toast.error('Full name and patient code are required')
      return
    }
    updateMutation.mutate({ id: editPatient.id, dto: formToDto(editForm) })
  }

  const setCreate = (key: keyof PatientFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setCreateForm(p => ({ ...p, [key]: e.target.value }))

  const setEdit = (key: keyof PatientFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setEditForm(p => ({ ...p, [key]: e.target.value }))

  const filtered = patients.filter(p =>
    p.fullName.toLowerCase().includes(search.toLowerCase()) ||
    p.patientCode.toLowerCase().includes(search.toLowerCase()) ||
    (p.phoneNumber ?? '').includes(search)
  )

  const PatientForm = ({ form, onChange }: { form: PatientFormState; onChange: (key: keyof PatientFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void }) => (
    <div className="space-y-6">
      <div>
        <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Basic Information</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Full Name" placeholder="John Doe" value={form.fullName} onChange={onChange('fullName')} required />
          <Input label="Patient Code" placeholder="P001" value={form.patientCode} onChange={onChange('patientCode')} required />
          <Input label="Age" type="number" placeholder="25" value={form.age} onChange={onChange('age')} />
          <Input label="Date of Birth" type="date" value={form.dateOfBirth} onChange={onChange('dateOfBirth')} />
          <Select label="Gender" value={form.gender} onChange={onChange('gender')}>
            <option value="">Select gender</option>
            {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
          </Select>
          <Select label="Blood Group" value={form.bloodGroup} onChange={onChange('bloodGroup')}>
            <option value="">Select blood group</option>
            {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
          </Select>
        </div>
      </div>
      <div>
        <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Contact Information</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Email" type="email" placeholder="patient@email.com" value={form.email} onChange={onChange('email')} />
          <Input label="Phone Number" placeholder="+1 234 567 8900" value={form.phoneNumber} onChange={onChange('phoneNumber')} />
        </div>
      </div>
      <div>
        <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Address</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Address Line" placeholder="123 Main Street" value={form.addressLine} onChange={onChange('addressLine')} className="sm:col-span-2" />
          <Input label="City" placeholder="New York" value={form.city} onChange={onChange('city')} />
          <Input label="State" placeholder="NY" value={form.state} onChange={onChange('state')} />
          <Input label="Postal Code" placeholder="10001" value={form.postalCode} onChange={onChange('postalCode')} />
        </div>
      </div>
      <div>
        <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Emergency Contact</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Contact Name" placeholder="Jane Doe" value={form.emergencyContactName} onChange={onChange('emergencyContactName')} />
          <Input label="Contact Phone" placeholder="+1 234 567 8900" value={form.emergencyContactPhone} onChange={onChange('emergencyContactPhone')} />
        </div>
      </div>
    </div>
  )

  return (
    <div>
      <Header
        title="Patients"
        subtitle="Manage patient profiles and records"
        action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>New Patient</Button>}
      />

      <div className="p-6 space-y-5">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, code, or phone..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-700 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        {isLoading ? (
          <PageLoader />
        ) : patients.length === 0 ? (
          <EmptyState
            icon={<Users className="h-12 w-12" />}
            title="No patients registered"
            description="Start by adding your first patient profile"
            action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>Add Patient</Button>}
          />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Search className="h-10 w-10" />} title="No results found" description={`No patients match "${search}"`} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map(patient => (
              <Card key={patient.id} hover padding="md">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-600">
                    {patient.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-800 truncate">{patient.fullName}</p>
                    <p className="text-xs font-mono text-slate-500 mt-0.5">{patient.patientCode}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(patient)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                      title="Edit patient"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletePatient(patient)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                      title="Delete patient"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {patient.phoneNumber && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>{patient.phoneNumber}</span>
                    </div>
                  )}
                  {(patient.city || patient.state) && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{[patient.city, patient.state].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                  {patient.gender && (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>{patient.gender}{patient.bloodGroup ? ` · ${patient.bloodGroup}` : ''}{patient.age ? ` · ${patient.age} yrs` : ''}</span>
                    </div>
                  )}
                  {patient.emergencyContactName && (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <AlertCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                      <span className="truncate">Emergency: {patient.emergencyContactName}</span>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Patient Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Register New Patient"
        subtitle="Create a comprehensive patient profile"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button loading={createMutation.isPending} onClick={handleCreate}>Create Patient Profile</Button>
          </>
        }
      >
        <PatientForm form={createForm} onChange={setCreate} />
      </Modal>

      {/* Edit Patient Modal */}
      <Modal
        open={!!editPatient}
        onClose={() => setEditPatient(null)}
        title="Edit Patient"
        subtitle={`Editing ${editPatient?.fullName ?? ''}`}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditPatient(null)}>Cancel</Button>
            <Button loading={updateMutation.isPending} onClick={handleUpdate}>Save Changes</Button>
          </>
        }
      >
        <PatientForm form={editForm} onChange={setEdit} />
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal
        open={!!deletePatient}
        onClose={() => setDeletePatient(null)}
        onConfirm={() => deletePatient && deleteMutation.mutate(deletePatient.id)}
        title="Delete Patient"
        message={`Are you sure you want to delete "${deletePatient?.fullName}"? This will also remove all associated orders and results. This action cannot be undone.`}
        confirmLabel="Delete Patient"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
