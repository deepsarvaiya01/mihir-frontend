import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Users, Search, User, Phone, MapPin, AlertCircle,
  Pencil, Trash2, Building2, CalendarDays,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { ConfirmModal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { PageLoader } from '../components/ui/Spinner'
import { patientService } from '../services/patients'
import type { Patient } from '../types'
import { toast } from 'sonner'

export default function PatientsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [deletePatient, setDeletePatient] = useState<Patient | null>(null)
  const [search, setSearch] = useState('')

  const { data: patients = [], isLoading } = useQuery({
    queryKey: ['patients'],
    queryFn: () => patientService.getAll(),
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

  const filtered = patients.filter(p =>
    p.fullName.toLowerCase().includes(search.toLowerCase()) ||
    p.patientCode.toLowerCase().includes(search.toLowerCase()) ||
    (p.phoneNumber ?? '').includes(search)
  )

  return (
    <div>
      <Header
        title="Patients"
        subtitle="Manage patient profiles and records"
        action={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/patients/new')}>
            New Patient
          </Button>
        }
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
            action={
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/patients/new')}>
                Add Patient
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Search className="h-10 w-10" />}
            title="No results found"
            description={`No patients match "${search}"`}
          />
        ) : (
          <>
            <p className="text-sm text-slate-400">{filtered.length} patient{filtered.length !== 1 ? 's' : ''}</p>
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
                        onClick={() => navigate(`/patients/${patient.id}/edit`)}
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
                        <span>
                          {patient.gender}
                          {patient.bloodGroup ? ` · ${patient.bloodGroup}` : ''}
                          {patient.age ? ` · ${patient.age} yrs` : ''}
                        </span>
                      </div>
                    )}
                    {patient.isB2b && (
                      <div className="flex items-center gap-2 text-sm text-violet-600">
                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                        <span className="font-medium">B2B Referral</span>
                      </div>
                    )}
                    {patient.reportDate && (
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <CalendarDays className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>Report: {new Date(patient.reportDate).toLocaleDateString()}</span>
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
          </>
        )}
      </div>

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
