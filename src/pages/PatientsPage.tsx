import { useState, useMemo, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Users, Search, Pencil, History, Eye, Trash2, ChevronRight, Building2,
  CalendarDays, ChevronsUpDown, ChevronsDownUp, X,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { PageLoader } from '../components/ui/Spinner'
import { PageContent } from '../components/ui/PageContent'
import { FilterBar, FilterSelect } from '../components/ui/FilterBar'
import { Pagination } from '../components/ui/Pagination'
import { ConfirmModal } from '../components/ui/Modal'
import { PatientDrawer } from '../components/patients/PatientDrawer'
import { RemarksModal } from '../components/patients/RemarksModal'
import { PaymentModal } from '../components/billing/PaymentModal'
import { ReceiptCard, BillActions } from '../components/billing/ReceiptCard'
import { formatDateTime } from '../components/billing/format'
import { useReceiptActions, groupByReceipt } from '../components/billing/useReceiptActions'
import { patientService } from '../services/patients'
import { orderService } from '../services/orders'
import { doctorService } from '../services/doctors'
import { labBranchService } from '../services/labBranches'
import { b2bLabService } from '../services/b2bLabs'
import { formatAge } from '../lib/utils'
import { toast } from 'sonner'
import { toastError } from '../lib/errors'
import type { Order, Patient, PaymentStatus } from '../types'

type PaymentFilter = 'ALL' | PaymentStatus

/** yyyy-mm-dd in local time (toISOString would shift the day for IST before 5:30 am) */
function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const daysAgo = (n: number) => localDate(new Date(Date.now() - n * 86_400_000))

/** Quick ranges just fill in the From / To dates. */
const DATE_SHORTCUTS: { label: string; range: () => [string, string] }[] = [
  { label: 'Today', range: () => [daysAgo(0), daysAgo(0)] },
  { label: '7 days', range: () => [daysAgo(6), daysAgo(0)] },
  { label: '30 days', range: () => [daysAgo(29), daysAgo(0)] },
  { label: 'All', range: () => ['', ''] },
]

/** B2B filter values: ALL · B2B (any lab) · INDIVIDUAL · <lab id> */
type B2bFilter = string
/** Doctor filter values: ALL · SELF (no doctor) · <doctor name> */
type DoctorFilter = string

const sameName = (a: string | null | undefined, b: string) => (a ?? '').trim().toLowerCase() === b.trim().toLowerCase()

function TypeBadge({ patient }: { patient: Patient }) {
  return patient.isB2b ? (
    <span className="inline-flex max-w-[160px] items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700 ring-1 ring-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:ring-violet-800">
      <Building2 className="h-3 w-3 shrink-0" />
      <span className="truncate">{patient.b2bLab?.name ?? 'B2B'}</span>
    </span>
  ) : null
}

const GENDER_EMOJI = {
  male: { emoji: '👨', label: 'Male' },
  female: { emoji: '👩', label: 'Female' },
}

/** Older records store gender as "male", "M", etc. — match any spelling. */
function genderInfo(gender: string | null): { emoji: string; label: string } | undefined {
  const g = gender?.trim().toLowerCase()
  if (g === 'male' || g === 'm') return GENDER_EMOJI.male
  if (g === 'female' || g === 'f') return GENDER_EMOJI.female
  return undefined
}

type BillStage = 'APPROVED' | 'AWAITING' | 'RESULTS_PENDING' | 'NONE'

/** Where a bill stands: results still to enter → waiting for approval → all approved. */
function billStage(bill: Order[] | undefined): BillStage {
  if (!bill || bill.length === 0) return 'NONE'
  if (bill.some(o => o.status === 'PENDING' || o.status === 'IN_PROGRESS' || o.status === 'REJECTED')) return 'RESULTS_PENDING'
  if (bill.some(o => o.status === 'AWAITING_APPROVAL')) return 'AWAITING'
  return 'APPROVED'
}

const STAGE_STYLE: Record<BillStage, { chip: string; dot: string; label: string }> = {
  APPROVED:        { chip: 'bg-emerald-600 text-white', dot: 'bg-emerald-600', label: 'Approved' },
  AWAITING:        { chip: 'bg-orange-500 text-white', dot: 'bg-orange-500', label: 'Approval pending' },
  RESULTS_PENDING: { chip: 'bg-gray-700 text-white dark:bg-gray-600', dot: 'bg-gray-700 dark:bg-gray-500', label: 'Result pending' },
  NONE:            { chip: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300', dot: '', label: 'No bills yet' },
}

/** Gender emoji — age (and gender) appear in a tooltip on hover. */
function GenderEmoji({ gender, age }: { gender: string | null; age: string | null }) {
  const g = genderInfo(gender)
  if (!g && !age) return <span className="text-gray-300">—</span>
  const label = [g?.label ?? gender, age].filter(Boolean).join(' · ')
  return (
    <span className="group/gender relative inline-flex" tabIndex={0} aria-label={label}>
      <span className="flex h-8 w-8 cursor-default items-center justify-center rounded-full text-lg leading-none transition-colors group-hover/gender:bg-gray-100 dark:group-hover/gender:bg-gray-700" aria-hidden>
        {g?.emoji ?? '🧑'}
      </span>
      {/* Opens to the right so the table's scroll container never clips it */}
      <span role="tooltip"
        className="pointer-events-none absolute left-full top-1/2 z-20 ml-1.5 -translate-y-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-100 group-hover/gender:opacity-100 group-focus/gender:opacity-100 dark:bg-gray-100 dark:text-gray-900">
        {label}
      </span>
    </span>
  )
}

/** Opens the remarks window — 📝 with a count badge once the patient has remarks. */
function RemarksButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button type="button" onClick={e => { e.stopPropagation(); onClick() }}
      title={count > 0 ? `${count} remark${count !== 1 ? 's' : ''} — click to view or add` : 'Add a remark'}
      className={`relative flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-all hover:bg-amber-50 dark:hover:bg-amber-900/20 ${
        count > 0 ? '' : 'opacity-35 grayscale hover:opacity-100 hover:grayscale-0'
      }`}>
      <span aria-hidden>📝</span>
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white dark:ring-gray-800">
          {count}
        </span>
      )}
    </button>
  )
}

function RowIcon({ title, onClick, hover, children }: { title: string; onClick: () => void; hover: string; children: React.ReactNode }) {
  return (
    <button type="button" title={title}
      onClick={e => { e.stopPropagation(); onClick() }}
      className={`rounded-lg p-1.5 text-gray-400 transition-colors ${hover}`}>
      {children}
    </button>
  )
}

export default function PatientsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [viewPatientId, setViewPatientId] = useState<number | null>(null)
  const [deletePatient, setDeletePatient] = useState<Patient | null>(null)
  const [editBill, setEditBill] = useState<Order[] | null>(null)
  const [remarksPatient, setRemarksPatient] = useState<Patient | null>(null)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const [search, setSearch] = useState('')
  const [genderFilter, setGenderFilter] = useState('')
  const [b2bFilter, setB2bFilter] = useState<B2bFilter>('ALL')
  const [doctorFilter, setDoctorFilter] = useState<DoctorFilter>('ALL')
  const [branchFilter, setBranchFilter] = useState('ALL')
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const patientsQuery = useQuery({ queryKey: ['patients'], queryFn: () => patientService.getAll() })
  const ordersQuery = useQuery({ queryKey: ['orders'], queryFn: orderService.getAll })
  const patients = useMemo(() => patientsQuery.data ?? [], [patientsQuery.data])
  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data])
  const { data: doctors = [] } = useQuery({ queryKey: ['doctors'], queryFn: doctorService.getAll })
  /** Degree for the doctor names stored on patients (patients keep the name only) */
  const doctorDegree = useMemo(() => new Map(doctors.map(d => [d.name, d.degreeName])), [doctors])
  const { data: branches = [] } = useQuery({ queryKey: ['lab-branches'], queryFn: labBranchService.getAll })
  const { data: b2bLabs = [] } = useQuery({ queryKey: ['b2b-labs'], queryFn: b2bLabService.getAll })

  /** Doctors list plus any older doctor names saved on patients that aren't in it */
  const doctorOptions = useMemo(() => {
    const names = new Map<string, string>()
    for (const d of doctors) names.set(d.name.trim().toLowerCase(), d.name)
    for (const p of patients) {
      const n = p.doctorName?.trim()
      if (n && !names.has(n.toLowerCase())) names.set(n.toLowerCase(), n)
    }
    return Array.from(names.values()).sort((a, b) => a.localeCompare(b))
  }, [doctors, patients])

  const actions = useReceiptActions(orders, () => setEditBill(null))

  const deleteMutation = useMutation({
    mutationFn: (id: number) => patientService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patients'] })
      setDeletePatient(null)
      if (viewPatientId === deletePatient?.id) setViewPatientId(null)
      toast.success('Patient deleted')
    },
    onError: (err) => toastError(err, 'Failed to delete patient'),
  })

  // Reset to page 1 whenever filters change (adjusting state during render, not in an effect)
  const filterKey = [search, genderFilter, b2bFilter, doctorFilter, branchFilter, paymentFilter, dateFrom, dateTo, pageSize].join('|')
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey)
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey)
    setPage(1)
  }

  /** Bills (orders grouped by receipt, newest first) per patient id. */
  const billsByPatient = useMemo(() => {
    const map = new Map<number, Order[][]>()
    for (const g of groupByReceipt(orders)) {
      const pid = g[0].patient?.id
      if (pid === undefined) continue
      const list = map.get(pid)
      if (list) list.push(g)
      else map.set(pid, [g])
    }
    return map
  }, [orders])

  const billFilterActive = paymentFilter !== 'ALL' || !!dateFrom || !!dateTo

  const rows = useMemo(() => {
    const start = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null
    const end = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null
    const billMatches = (g: Order[]) => {
      const p = g[0]
      if (paymentFilter !== 'ALL' && p.paymentStatus !== paymentFilter) return false
      const d = p.createdAt ? new Date(p.createdAt) : null
      if (start && (!d || d < start)) return false
      if (end && (!d || d > end)) return false
      return true
    }
    const q = search.trim().toLowerCase()

    return patients
      .map(patient => {
        const allBills = billsByPatient.get(patient.id) ?? []
        const bills = billFilterActive ? allBills.filter(billMatches) : allBills
        const lastVisit = allBills[0]?.[0]?.createdAt ?? null
        return { patient, allBills, bills, lastVisit }
      })
      .filter(({ patient: p, allBills, bills }) => {
        if (genderFilter && genderInfo(p.gender)?.label !== genderFilter) return false
        if (branchFilter !== 'ALL' && String(p.labBranchId ?? '') !== branchFilter) return false
        if (b2bFilter === 'B2B' && !p.isB2b) return false
        if (b2bFilter === 'INDIVIDUAL' && p.isB2b) return false
        if (b2bFilter !== 'ALL' && b2bFilter !== 'B2B' && b2bFilter !== 'INDIVIDUAL' && String(p.b2bLabId ?? '') !== b2bFilter) return false
        if (doctorFilter === 'SELF' && p.doctorName?.trim()) return false
        if (doctorFilter !== 'ALL' && doctorFilter !== 'SELF' && !sameName(p.doctorName, doctorFilter)) return false
        if (billFilterActive && bills.length === 0) return false
        if (!q) return true
        return p.fullName.toLowerCase().includes(q) ||
          p.patientCode.toLowerCase().includes(q) ||
          (p.phoneNumber ?? '').includes(q) ||
          (p.city ?? '').toLowerCase().includes(q) ||
          (p.doctorName ?? '').toLowerCase().includes(q) ||
          allBills.some(g => (g[0].receiptNumber ?? '').toLowerCase().includes(q) ||
            g.some(o => (o.template?.name ?? '').toLowerCase().includes(q)))
      })
      // Most recent activity first: latest visit, else registration date
      .sort((a, b) => {
        const ta = new Date(a.lastVisit ?? a.patient.createdAt ?? 0).getTime()
        const tb = new Date(b.lastVisit ?? b.patient.createdAt ?? 0).getTime()
        return tb - ta || b.patient.id - a.patient.id
      })
  }, [patients, billsByPatient, search, genderFilter, b2bFilter, doctorFilter, branchFilter, paymentFilter, dateFrom, dateTo, billFilterActive])

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginated = rows.slice((safePage - 1) * pageSize, safePage * pageSize)
  const allExpanded = paginated.length > 0 && paginated.every(r => expanded.has(r.patient.id))

  const toggleRow = (id: number) => setExpanded(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const toggleAll = () => setExpanded(prev => {
    const next = new Set(prev)
    for (const r of paginated) {
      if (allExpanded) next.delete(r.patient.id)
      else next.add(r.patient.id)
    }
    return next
  })

  const filtersActive = !!search || !!genderFilter || b2bFilter !== 'ALL' || doctorFilter !== 'ALL' || branchFilter !== 'ALL' || billFilterActive
  const clearFilters = () => {
    setSearch(''); setGenderFilter(''); setB2bFilter('ALL'); setDoctorFilter('ALL'); setBranchFilter('ALL'); setPaymentFilter('ALL')
    setDateFrom(''); setDateTo('')
  }

  const isLoading = patientsQuery.isLoading || ordersQuery.isLoading
  const viewRow = viewPatientId !== null ? rows.find(r => r.patient.id === viewPatientId) : undefined

  return (
    <div>
      <Header
        title="Patient Registration"
        subtitle="Patient records, bills, payments and reports in one place"
        action={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/patients/new')}>
            New Patient
          </Button>
        }
      />

      <PageContent className="space-y-5">
        {/* Filters */}
        <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Name, code, phone, receipt no., test..."
            onRefresh={() => { patientsQuery.refetch(); ordersQuery.refetch() }}
            isRefreshing={patientsQuery.isFetching || ordersQuery.isFetching}
          >
            <FilterSelect value={paymentFilter} onChange={v => setPaymentFilter(v as PaymentFilter)}>
              <option value="ALL">All Payments</option>
              <option value="PENDING">Pending</option>
              <option value="PARTIAL">Partial</option>
              <option value="PAID">Paid</option>
            </FilterSelect>
            <FilterSelect value={branchFilter} onChange={setBranchFilter}>
              <option value="ALL">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={String(b.id)}>{b.name}{b.active ? '' : ' (inactive)'}</option>
              ))}
            </FilterSelect>
            <FilterSelect value={b2bFilter} onChange={setB2bFilter} className="max-w-[200px]">
              <option value="ALL">All B2B / Individual</option>
              <option value="B2B">B2B only</option>
              <option value="INDIVIDUAL">Individual only</option>
              {b2bLabs.length > 0 && (
                <optgroup label="B2B Partners">
                  {b2bLabs.map(l => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
                </optgroup>
              )}
            </FilterSelect>
            <FilterSelect value={doctorFilter} onChange={setDoctorFilter} className="max-w-[200px]">
              <option value="ALL">All Doctors</option>
              <option value="SELF">Self (no doctor)</option>
              {doctorOptions.length > 0 && (
                <optgroup label="Doctors">
                  {doctorOptions.map(n => <option key={n} value={n}>{n}</option>)}
                </optgroup>
              )}
            </FilterSelect>
            <FilterSelect value={genderFilter} onChange={setGenderFilter}>
              <option value="">All Genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </FilterSelect>
          </FilterBar>

          <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-700">
            <CalendarDays className="h-4 w-4 text-gray-400" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Visit date</span>
            <div className="flex items-center gap-1.5">
              <label className="flex items-center gap-1.5 text-xs text-gray-400">
                From
                <input type="date" value={dateFrom} max={dateTo || undefined} onChange={e => setDateFrom(e.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200" />
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-400">
                To
                <input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200" />
              </label>
            </div>
            <div className="flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-900/60">
              {DATE_SHORTCUTS.map(d => {
                const [f, t] = d.range()
                const active = dateFrom === f && dateTo === t
                return (
                  <button key={d.label} type="button" onClick={() => { setDateFrom(f); setDateTo(t) }}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      active
                        ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                        : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}>
                    {d.label}
                  </button>
                )
              })}
            </div>
            <div className="ml-auto flex items-center gap-3">
              {filtersActive && (
                <button type="button" onClick={clearFilters}
                  className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-red-600 dark:text-gray-400">
                  <X className="h-3.5 w-3.5" /> Clear filters
                </button>
              )}
              <div className="hidden items-center gap-3 border-l border-gray-200 pl-3 md:flex dark:border-gray-700">
                {(['APPROVED', 'AWAITING', 'RESULTS_PENDING'] as const).map(st => (
                  <span key={st} className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                    <span className={`h-2.5 w-2.5 rounded-sm ${STAGE_STYLE[st].dot}`} />
                    {STAGE_STYLE[st].label}
                  </span>
                ))}
              </div>
              <span className="text-xs text-gray-400">
                {rows.length} patient{rows.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Patient list */}
        {isLoading ? (
          <PageLoader />
        ) : patients.length === 0 ? (
          <EmptyState
            icon={<Users className="h-12 w-12" />}
            title="No patients registered"
            description="Start by adding your first patient profile"
            action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/patients/new')}>Add Patient</Button>}
          />
        ) : rows.length === 0 ? (
          <EmptyState icon={<Search className="h-10 w-10" />} title="No results" description="Try adjusting your search or filters" />
        ) : (
          <>
            <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80 text-left dark:border-gray-700 dark:bg-gray-900/50">
                    <th className="w-10 py-3 pl-4">
                      <button type="button" onClick={toggleAll} title={allExpanded ? 'Collapse all' : 'Expand all'}
                        className="rounded-md p-1 text-gray-400 hover:bg-gray-200/60 hover:text-gray-600 dark:hover:bg-gray-700">
                        {allExpanded ? <ChevronsDownUp className="h-4 w-4" /> : <ChevronsUpDown className="h-4 w-4" />}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Date</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Patient Code</th>
                    <th className="w-14 px-2 py-3" aria-label="Gender" />
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Patient Name</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Doc / B2B</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(({ patient, allBills, bills }) => {
                    const isOpen = expanded.has(patient.id)
                    const age = formatAge(patient.ageYears, patient.ageMonths, patient.ageDays)
                    // The bill the row's actions work on (latest, after filters); fall back to registration date
                    const rowDate = formatDateTime(bills[0]?.[0]?.createdAt ?? patient.createdAt)
                    return (
                      <Fragment key={patient.id}>
                        <tr
                          onClick={() => toggleRow(patient.id)}
                          className={`cursor-pointer border-b border-gray-100 transition-colors dark:border-gray-700/60 ${
                            isOpen ? 'bg-blue-50/40 dark:bg-blue-900/10' : 'hover:bg-gray-50/70 dark:hover:bg-gray-700/30'
                          }`}
                        >
                          <td className="py-3.5 pl-4">
                            <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-90 text-blue-600' : ''}`} />
                          </td>

                          <td className="whitespace-nowrap px-4 py-3.5">
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">{rowDate.date}</span>
                              <span className="text-[11px] text-gray-400">{bills[0] ? rowDate.time : 'Registered'}</span>
                            </div>
                          </td>

                          <td className="whitespace-nowrap px-4 py-3.5">
                            {(() => {
                              const stage = STAGE_STYLE[billStage(bills[0])]
                              return (
                                <span title={stage.label}
                                  className={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${stage.chip}`}>
                                  {patient.patientCode}
                                </span>
                              )
                            })()}
                          </td>

                          <td className="px-2 py-3.5">
                            <GenderEmoji gender={patient.gender} age={age} />
                          </td>

                          <td className="px-4 py-3.5">
                            <p className="max-w-[240px] truncate font-semibold text-gray-900 dark:text-white" title={patient.fullName}>{patient.fullName}</p>
                            {allBills.length > 1 && (
                              <p className="text-[11px] text-gray-400">{allBills.length} visits</p>
                            )}
                          </td>

                          <td className="px-4 py-3.5">
                            {patient.isB2b ? (
                              <div className="flex flex-col items-start gap-0.5">
                                <TypeBadge patient={patient} />
                                {patient.doctorName && (
                                  <span className="max-w-[180px] truncate text-[11px] text-gray-400" title={patient.doctorName}>{patient.doctorName}</span>
                                )}
                              </div>
                            ) : patient.doctorName ? (
                              <div className="flex max-w-[200px] flex-col">
                                <span className="truncate text-gray-700 dark:text-gray-200" title={patient.doctorName}>{patient.doctorName}</span>
                                {doctorDegree.get(patient.doctorName) && (
                                  <span className="truncate text-[11px] text-gray-400">{doctorDegree.get(patient.doctorName)}</span>
                                )}
                              </div>
                            ) : <span className="text-xs text-gray-400">Self</span>}
                          </td>


                          {/* Actions — bill actions apply to the latest (filtered) bill; expand the row for older bills */}
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              {bills[0] ? (
                                <div title={`Latest bill: ${bills[0][0].receiptNumber ?? `Order #${bills[0][0].id}`}`}>
                                  <BillActions group={bills[0]} actions={actions} onEditPayment={setEditBill} reportScope={allBills.flat()} className="flex-nowrap" />
                                </div>
                              ) : (
                                <span className="px-2 text-xs text-gray-300 dark:text-gray-600">No bills</span>
                              )}
                              <span className="h-6 w-px shrink-0 bg-gray-200 dark:bg-gray-700" />
                              <div className="flex shrink-0 items-center gap-0.5">
                                <RemarksButton count={patient.remarkCount ?? 0} onClick={() => setRemarksPatient(patient)} />
                                <RowIcon title="Patient details" onClick={() => setViewPatientId(patient.id)} hover="hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30">
                                  <Eye className="h-4 w-4" />
                                </RowIcon>
                                <RowIcon title="Result history" onClick={() => navigate(`/history?patientId=${patient.id}`)} hover="hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-900/30">
                                  <History className="h-4 w-4" />
                                </RowIcon>
                                <RowIcon title="Edit patient" onClick={() => navigate(`/patients/${patient.id}/edit`)} hover="hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30">
                                  <Pencil className="h-4 w-4" />
                                </RowIcon>
                                <RowIcon title="Delete patient" onClick={() => setDeletePatient(patient)} hover="hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30">
                                  <Trash2 className="h-4 w-4" />
                                </RowIcon>
                              </div>
                            </div>
                            {bills.length > 1 && (
                              <button type="button" onClick={() => toggleRow(patient.id)}
                                className="mt-1 block w-full text-right text-[10px] text-gray-400 hover:text-blue-600">
                                Actions apply to latest bill · {isOpen ? 'hide' : 'show'} all {bills.length} bills
                              </button>
                            )}
                          </td>
                        </tr>

                        {isOpen && (
                          <tr className="border-b border-gray-100 dark:border-gray-700/60">
                            <td colSpan={7} className="bg-gray-50/70 px-4 pb-4 pt-3 dark:bg-gray-900/30">
                              <div className="ml-6 space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                                    Bills & Reports
                                    {billFilterActive && bills.length !== allBills.length && (
                                      <span className="ml-2 font-normal normal-case tracking-normal">
                                        showing {bills.length} of {allBills.length} (filtered)
                                      </span>
                                    )}
                                  </p>
                                </div>
                                {bills.length === 0 ? (
                                  <div className="flex items-center justify-between rounded-xl border border-dashed border-gray-200 bg-white px-4 py-5 dark:border-gray-700 dark:bg-gray-800">
                                    <p className="text-sm text-gray-400">No bills yet for this patient.</p>
                                    <Button size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />}
                                      onClick={() => navigate('/orders')}>
                                      Order Tests
                                    </Button>
                                  </div>
                                ) : (
                                  bills.map(g => (
                                    <ReceiptCard key={g[0].receiptNumber ?? g[0].id} group={g} actions={actions} onEditPayment={setEditBill} />
                                  ))
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              page={safePage}
              totalPages={totalPages}
              pageSize={pageSize}
              total={rows.length}
              onPage={setPage}
              onPageSize={s => { setPageSize(s); setPage(1) }}
              itemLabel="patients"
            />
          </>
        )}
      </PageContent>

      {viewPatientId !== null && (
        <PatientDrawer
          patientId={viewPatientId}
          bills={viewRow?.allBills ?? billsByPatient.get(viewPatientId) ?? []}
          onClose={() => setViewPatientId(null)}
          onEdit={() => { navigate(`/patients/${viewPatientId}/edit`); setViewPatientId(null) }}
        />
      )}

      {remarksPatient && (
        <RemarksModal patient={remarksPatient} onClose={() => setRemarksPatient(null)} />
      )}

      {editBill && (
        <PaymentModal
          orders={editBill}
          onClose={() => setEditBill(null)}
          saving={actions.updatePayment.isPending}
          onSave={(updates) => actions.updatePayment.mutate(updates)}
        />
      )}

      <ConfirmModal
        open={!!deletePatient}
        onClose={() => setDeletePatient(null)}
        onConfirm={() => deletePatient && deleteMutation.mutate(deletePatient.id)}
        title="Delete Patient"
        message={`Delete "${deletePatient?.fullName ?? ''}"? They will be removed from the patients list.`}
        confirmLabel="Delete Patient"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
