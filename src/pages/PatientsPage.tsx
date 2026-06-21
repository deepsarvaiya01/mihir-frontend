import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Users, Search, Pencil, Trash2, RefreshCw,
  ChevronLeft, ChevronRight, Building2, ChevronDown,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { ConfirmModal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { PageLoader } from '../components/ui/Spinner'
import { patientService } from '../services/patients'
import type { Patient } from '../types'
import { toast } from 'sonner'

const PAGE_SIZES = [10, 20, 50]

// ── Status badge ─────────────────────────────────────────────────────────────
function TypeBadge({ isB2b }: { isB2b: boolean }) {
  return isB2b ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
      <Building2 className="h-3 w-3" /> B2B
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Individual
    </span>
  )
}

// ── Pagination ────────────────────────────────────────────────────────────────
function Pagination({
  page, totalPages, pageSize, total,
  onPage, onPageSize,
}: {
  page: number; totalPages: number; pageSize: number; total: number
  onPage: (p: number) => void; onPageSize: (s: number) => void
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const pages: (number | '…')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('…')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('…')
    pages.push(totalPages)
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
      <p className="text-sm text-gray-500">
        Showing <span className="font-semibold text-gray-700">{from}–{to}</span> of{' '}
        <span className="font-semibold text-gray-700">{total}</span> patients
      </p>
      <div className="flex items-center gap-2">
        {/* Page size */}
        <div className="relative">
          <select
            value={pageSize}
            onChange={e => onPageSize(Number(e.target.value))}
            className="appearance-none rounded-lg border border-gray-200 bg-white py-1.5 pl-3 pr-7 text-sm text-gray-700 outline-none focus:border-blue-400"
          >
            {PAGE_SIZES.map(s => <option key={s} value={s}>{s} / page</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        </div>

        {/* Prev */}
        <button
          onClick={() => onPage(page - 1)} disabled={page === 1}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Pages */}
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} className="px-1 text-sm text-gray-400">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p as number)}
              className={`h-8 min-w-[32px] rounded-lg border px-2 text-sm font-medium transition-colors ${
                p === page
                  ? 'border-blue-500 bg-blue-600 text-white shadow-sm'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p}
            </button>
          )
        )}

        {/* Next */}
        <button
          onClick={() => onPage(page + 1)} disabled={page >= totalPages}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
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
    onError: () => toast.error('Failed to delete patient'),
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
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/patients/new')}>
            New Patient
          </Button>
        }
      />

      <div className="p-6 space-y-4">
        {/* ── Filter bar ── */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Name, code, phone, city..."
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Gender */}
          <div className="relative">
            <select
              value={genderFilter}
              onChange={e => setGenderFilter(e.target.value)}
              className="appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-4 pr-9 text-sm text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">All Genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>

          {/* Type */}
          <div className="relative">
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as typeof typeFilter)}
              className="appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-4 pr-9 text-sm text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="ALL">All Types</option>
              <option value="INDIVIDUAL">Individual</option>
              <option value="B2B">B2B</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>

          {/* Refresh */}
          <button
            onClick={() => refetch()}
            title="Refresh"
            className={`flex h-[42px] w-[42px] items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-blue-600 ${isFetching ? 'animate-spin text-blue-500' : ''}`}
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          <span className="ml-auto text-sm text-gray-400">
            {filtered.length} patient{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

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
            <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
              <table className="min-w-[780px] w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left">
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400">#</th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Patient</th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Age / Gender</th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Contact</th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400">City</th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Status</th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Report Date</th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginated.map((patient, idx) => (
                    <tr key={patient.id} className="group hover:bg-gray-50/60 transition-colors">
                      {/* # */}
                      <td className="px-5 py-3.5 text-xs text-gray-400 font-mono">
                        {(safePage - 1) * pageSize + idx + 1}
                      </td>

                      {/* Patient */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">
                            {patient.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800">{patient.fullName}</p>
                            <p className="text-xs font-mono text-gray-400">{patient.patientCode}</p>
                          </div>
                        </div>
                      </td>

                      {/* Age / Gender */}
                      <td className="px-5 py-3.5 text-gray-600">
                        {patient.age || patient.gender ? (
                          <span>
                            {patient.age ? `${patient.age} yrs` : '—'}
                            {patient.gender ? <span className="ml-1.5 text-gray-400">· {patient.gender}</span> : null}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>

                      {/* Contact */}
                      <td className="px-5 py-3.5 text-gray-600">
                        {patient.phoneNumber ?? <span className="text-gray-300">—</span>}
                      </td>

                      {/* City */}
                      <td className="px-5 py-3.5 text-gray-600 max-w-[140px] truncate">
                        {patient.city
                          ? [patient.city, patient.state].filter(Boolean).join(', ')
                          : <span className="text-gray-300">—</span>}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <TypeBadge isB2b={patient.isB2b} />
                      </td>

                      {/* Report Date */}
                      <td className="px-5 py-3.5 text-xs text-gray-500">
                        {patient.reportDate
                          ? new Date(patient.reportDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                          : <span className="text-gray-300">—</span>}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
            />
          </>
        )}
      </div>

      <ConfirmModal
        open={!!deletePatient}
        onClose={() => setDeletePatient(null)}
        onConfirm={() => deletePatient && deleteMutation.mutate(deletePatient.id)}
        title="Delete Patient"
        message={`Delete "${deletePatient?.fullName}"? All associated orders and results will also be removed. This cannot be undone.`}
        confirmLabel="Delete Patient"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}

