import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Users, Search, Pencil, Trash2,
  Building2, History, Archive, RotateCcw,
  Eye, X, Phone, Mail, MapPin, UserCircle2,
  Calendar, Stethoscope, AlertCircle, FileText, ExternalLink,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { ConfirmModal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { PageLoader } from '../components/ui/Spinner'
import { PageContent } from '../components/ui/PageContent'
import { FilterBar, FilterSelect } from '../components/ui/FilterBar'
import { Pagination } from '../components/ui/Pagination'
import { patientService } from '../services/patients'
import type { Patient } from '../types'
import { toast } from 'sonner'
import { toastError } from '../lib/errors'

/* ── Patient detail slide-over ───────────────────────────────────────────── */

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</span>
      <span className="text-sm text-gray-800 dark:text-gray-200">{value}</span>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-gray-400 dark:text-gray-500">{icon}</span>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{title}</h4>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{children}</div>
    </div>
  )
}

function PatientDrawer({ patientId, onClose, onEdit }: { patientId: number; onClose: () => void; onEdit: () => void }) {
  const { data: p, isLoading } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => patientService.getById(patientId),
  })

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-gray-900 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Patient Details</h3>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" icon={<Pencil className="h-3.5 w-3.5" />} onClick={onEdit}>Edit</Button>
            <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {isLoading || !p ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">

            {/* Profile hero */}
            <div className="bg-gradient-to-br from-blue-50 to-white px-5 py-5 dark:from-gray-800 dark:to-gray-900">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-bold text-white shadow-md">
                  {p.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">{p.fullName}</h2>
                  <p className="font-mono text-sm text-blue-600 dark:text-blue-400">{p.patientCode}</p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {p.isB2b ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-400">
                        <Building2 className="h-3 w-3" /> B2B
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Individual
                      </span>
                    )}
                    {p.gender && (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        {p.gender}
                      </span>
                    )}
                    {p.bloodGroup && (
                      <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600 dark:bg-red-900/30 dark:text-red-400">
                        {p.bloodGroup}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6 px-5 py-5">

              {/* Personal */}
              <Section title="Personal" icon={<UserCircle2 className="h-4 w-4" />}>
                <DetailRow label="Age" value={p.age != null ? `${p.age} years` : null} />
                <DetailRow label="Date of Birth" value={p.dateOfBirth ? new Date(p.dateOfBirth).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null} />
                <DetailRow label="Gender" value={p.gender} />
                <DetailRow label="Blood Group" value={p.bloodGroup} />
              </Section>

              {/* Contact */}
              {(p.phoneNumber || p.email) && (
                <Section title="Contact" icon={<Phone className="h-4 w-4" />}>
                  <DetailRow label="Phone" value={p.phoneNumber} />
                  <DetailRow label="Email" value={p.email} />
                </Section>
              )}

              {/* Address */}
              {(p.addressLine || p.city || p.state || p.postalCode) && (
                <Section title="Address" icon={<MapPin className="h-4 w-4" />}>
                  {p.addressLine && <div className="col-span-2 sm:col-span-3"><DetailRow label="Street" value={p.addressLine} /></div>}
                  <DetailRow label="City" value={p.city} />
                  <DetailRow label="State" value={p.state} />
                  <DetailRow label="Postal Code" value={p.postalCode} />
                </Section>
              )}

              {/* Medical */}
              {(p.doctorName || p.reportDate) && (
                <Section title="Medical" icon={<Stethoscope className="h-4 w-4" />}>
                  <DetailRow label="Referring Doctor" value={p.doctorName} />
                  <DetailRow label="Report Date" value={p.reportDate ? new Date(p.reportDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null} />
                </Section>
              )}

              {/* B2B */}
              {p.isB2b && p.b2bLab && (
                <Section title="B2B Lab" icon={<Building2 className="h-4 w-4" />}>
                  <div className="col-span-2 sm:col-span-3">
                    <DetailRow label="Lab Name" value={p.b2bLab.name} />
                  </div>
                  <DetailRow label="Contact Person" value={p.b2bLab.contactPerson} />
                  <DetailRow label="Phone" value={p.b2bLab.phone} />
                  <DetailRow label="Email" value={p.b2bLab.email} />
                  {p.b2bLab.city && <DetailRow label="City" value={p.b2bLab.city} />}
                </Section>
              )}

              {/* Emergency Contact */}
              {(p.emergencyContactName || p.emergencyContactPhone) && (
                <Section title="Emergency Contact" icon={<AlertCircle className="h-4 w-4" />}>
                  <DetailRow label="Name" value={p.emergencyContactName} />
                  <DetailRow label="Phone" value={p.emergencyContactPhone} />
                </Section>
              )}

              {/* Documents */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Documents
                  </h4>
                  {(p.documents?.length ?? 0) > 0 && (
                    <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                      {p.documents!.length}
                    </span>
                  )}
                </div>
                {(p.documents?.length ?? 0) === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 py-8 text-center dark:border-gray-700 dark:bg-gray-800">
                    <FileText className="mb-2 h-7 w-7 text-gray-300 dark:text-gray-600" />
                    <p className="text-sm text-gray-400 dark:text-gray-500">No documents uploaded</p>
                    <p className="mt-0.5 text-xs text-gray-300 dark:text-gray-600">Add documents from the edit page</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {p.documents!.map(doc => (
                      <a
                        key={doc.id}
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 transition-colors hover:border-blue-200 hover:bg-blue-50/40 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-800 dark:hover:bg-blue-900/20"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-700">
                          <FileText className="h-4 w-4 text-blue-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-800 group-hover:text-blue-700 dark:text-gray-200 dark:group-hover:text-blue-400">
                            {doc.name}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {new Date(doc.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-gray-300 group-hover:text-blue-500 dark:text-gray-600 dark:group-hover:text-blue-400" />
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Registered on */}
              <p className="text-center text-xs text-gray-300 dark:text-gray-600">
                Registered on {p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Status badge ─────────────────────────────────────────────────────────────
function TypeBadge({ isB2b }: { isB2b: boolean }) {
  return isB2b ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
      <Building2 className="h-3 w-3" /> B2B
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Individual
    </span>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PatientsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const [viewPatientId, setViewPatientId] = useState<number | null>(null)
  const [deletePatient, setDeletePatient] = useState<Patient | null>(null)
  const [search, setSearch] = useState('')
  const [genderFilter, setGenderFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'B2B' | 'INDIVIDUAL'>('ALL')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [showArchived, setShowArchived] = useState(false)
  const [permanentDeletePatient, setPermanentDeletePatient] = useState<Patient | null>(null)

  const { data: patients = [], isLoading, isFetching, refetch } = useQuery({
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
    onError: (err) => toastError(err, 'Failed to delete patient'),
  })

  const { data: archivedPatients = [] } = useQuery({
    queryKey: ['patients', 'archived'],
    queryFn: patientService.getArchived,
    enabled: showArchived,
  })

  const restoreMutation = useMutation({
    mutationFn: (id: number) => patientService.restore(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patients'] })
      qc.invalidateQueries({ queryKey: ['patients', 'archived'] })
      toast.success('Patient restored')
    },
    onError: (err) => toastError(err, 'Failed to restore patient'),
  })

  const permanentDeleteMutation = useMutation({
    mutationFn: (id: number) => patientService.permanentDelete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patients', 'archived'] })
      setPermanentDeletePatient(null)
      toast.success('Patient permanently deleted')
    },
    onError: (err) => toastError(err, 'Failed to permanently delete patient'),
  })

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1) }, [search, genderFilter, typeFilter, pageSize])

  const filtered = patients.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      p.fullName.toLowerCase().includes(q) ||
      p.patientCode.toLowerCase().includes(q) ||
      (p.phoneNumber ?? '').includes(q) ||
      (p.city ?? '').toLowerCase().includes(q) ||
      (p.doctorName ?? '').toLowerCase().includes(q)
    const matchGender = !genderFilter || p.gender === genderFilter
    const matchType = typeFilter === 'ALL' ||
      (typeFilter === 'B2B' && p.isB2b) ||
      (typeFilter === 'INDIVIDUAL' && !p.isB2b)
    return matchSearch && matchGender && matchType
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  return (
    <div>
      <Header
        title="Patients"
        subtitle="Manage patient profiles and records"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant={showArchived ? 'secondary' : 'ghost'}
              icon={<Archive className="h-4 w-4" />}
              onClick={() => setShowArchived(p => !p)}
              size="sm"
            >
              {showArchived ? 'Hide Archived' : 'Archived'}
            </Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/patients/new')}>
              New Patient
            </Button>
          </div>
        }
      />

      <PageContent className="space-y-4">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Name, code, phone, city..."
          onRefresh={() => refetch()}
          isRefreshing={isFetching}
          count={filtered.length}
          countLabel={`patient${filtered.length !== 1 ? 's' : ''}`}
        >
          <FilterSelect value={genderFilter} onChange={setGenderFilter}>
            <option value="">All Genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </FilterSelect>
          <FilterSelect value={typeFilter} onChange={v => setTypeFilter(v as typeof typeFilter)}>
            <option value="ALL">All Types</option>
            <option value="INDIVIDUAL">Individual</option>
            <option value="B2B">B2B</option>
          </FilterSelect>
        </FilterBar>

        {/* ── Table ── */}
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
          <EmptyState icon={<Search className="h-10 w-10" />} title="No results" description="Try adjusting your search or filters" />
        ) : (
          <>
            <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <table className="min-w-[780px] w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left dark:border-gray-700 dark:bg-gray-900/50">
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">#</th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Patient</th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Age / Gender</th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Contact</th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">City</th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Status</th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Report Date</th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                  {paginated.map((patient, idx) => (
                    <tr key={patient.id} className="group hover:bg-gray-50/60 transition-colors dark:hover:bg-gray-700/40">
                      {/* # */}
                      <td className="px-5 py-3.5 text-xs text-gray-400 font-mono dark:text-gray-500">
                        {(safePage - 1) * pageSize + idx + 1}
                      </td>

                      {/* Patient */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">
                            {patient.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p
                              className="font-semibold text-gray-800 cursor-pointer hover:text-blue-600 transition-colors dark:text-white"
                              onClick={() => setViewPatientId(patient.id)}
                            >{patient.fullName}</p>
                            <p className="text-xs font-mono text-gray-400 dark:text-gray-500">{patient.patientCode}</p>
                          </div>
                        </div>
                      </td>

                      {/* Age / Gender */}
                      <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300">
                        {patient.age || patient.gender ? (
                          <span>
                            {patient.age ? `${patient.age} yrs` : '—'}
                            {patient.gender ? <span className="ml-1.5 text-gray-400">· {patient.gender}</span> : null}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>

                      {/* Contact */}
                      <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300">
                        {patient.phoneNumber ?? <span className="text-gray-300">—</span>}
                      </td>

                      {/* City */}
                      <td className="px-5 py-3.5 text-gray-600 max-w-[140px] truncate dark:text-gray-300">
                        {patient.city
                          ? [patient.city, patient.state].filter(Boolean).join(', ')
                          : <span className="text-gray-300">—</span>}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <TypeBadge isB2b={patient.isB2b} />
                      </td>

                      {/* Report Date */}
                      <td className="px-5 py-3.5 text-xs text-gray-500 dark:text-gray-400">
                        {patient.reportDate
                          ? new Date(patient.reportDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                          : <span className="text-gray-300">—</span>}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => setViewPatientId(patient.id)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                            title="View Details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => navigate(`/history?patientId=${patient.id}`)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                            title="View History"
                          >
                            <History className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => navigate(`/patients/${patient.id}/edit`)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletePatient(patient)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ── */}
            <Pagination
              page={safePage}
              totalPages={totalPages}
              pageSize={pageSize}
              total={filtered.length}
              onPage={setPage}
              onPageSize={s => { setPageSize(s); setPage(1) }}
              itemLabel="patients"
            />
          </>
        )}

        {/* ── Archived Patients Section ── */}
        {showArchived && (
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <Archive className="h-4 w-4" />
              Archived Patients ({archivedPatients.length})
            </h3>
            {archivedPatients.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 py-8 text-center text-sm text-gray-400">No archived patients</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/30 dark:bg-amber-900/10">
                <table className="min-w-[600px] w-full text-sm">
                  <thead>
                    <tr className="border-b border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/20">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-amber-700 dark:text-amber-500">Patient</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-amber-700 dark:text-amber-500">Code</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-amber-700 dark:text-amber-500">Phone</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-amber-700 dark:text-amber-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100 dark:divide-amber-800/20">
                    {archivedPatients.map(p => (
                      <tr key={p.id} className="opacity-70 hover:opacity-100 transition-opacity">
                        <td className="px-5 py-3 font-medium text-gray-700 dark:text-gray-300">{p.fullName}</td>
                        <td className="px-5 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{p.patientCode}</td>
                        <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{p.phoneNumber ?? '—'}</td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="secondary" icon={<RotateCcw className="h-3.5 w-3.5" />}
                              loading={restoreMutation.isPending && restoreMutation.variables === p.id}
                              onClick={() => restoreMutation.mutate(p.id)}>
                              Restore
                            </Button>
                            <Button size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />}
                              className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                              onClick={() => setPermanentDeletePatient(p)}>
                              Delete Forever
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </PageContent>

      {viewPatientId && (
        <PatientDrawer
          patientId={viewPatientId}
          onClose={() => setViewPatientId(null)}
          onEdit={() => { navigate(`/patients/${viewPatientId}/edit`); setViewPatientId(null) }}
        />
      )}

      <ConfirmModal
        open={!!deletePatient}
        onClose={() => setDeletePatient(null)}
        onConfirm={() => deletePatient && deleteMutation.mutate(deletePatient.id)}
        title="Archive Patient"
        message={`Archive "${deletePatient?.fullName}"? The patient will be hidden from active lists but can be restored later.`}
        confirmLabel="Archive Patient"
        variant="danger"
        loading={deleteMutation.isPending}
      />

      <ConfirmModal
        open={!!permanentDeletePatient}
        onClose={() => setPermanentDeletePatient(null)}
        onConfirm={() => permanentDeletePatient && permanentDeleteMutation.mutate(permanentDeletePatient.id)}
        title="Delete Forever"
        message={`Permanently delete "${permanentDeletePatient?.fullName}"? This CANNOT be undone and will remove all associated data.`}
        confirmLabel="Delete Forever"
        variant="danger"
        loading={permanentDeleteMutation.isPending}
      />
    </div>
  )
}

