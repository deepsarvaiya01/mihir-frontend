import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Users, Search, Pencil, Trash2,
  Building2, History, Archive, RotateCcw,
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
                              onClick={() => navigate(`/history?patientId=${patient.id}`)}
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

