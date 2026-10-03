import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Users, Receipt, FlaskConical, IndianRupee, BadgePercent, CheckCircle2, Clock, Wallet,
  Download, FileSpreadsheet, FileText, ArrowUpDown, ArrowDown, ArrowUp, X,
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Header } from '../components/layout/Header'
import { PageContent } from '../components/ui/PageContent'
import { PageLoader } from '../components/ui/Spinner'
import { StatSummaryGrid } from '../components/ui/StatSummaryGrid'
import { FilterBar } from '../components/ui/FilterBar'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { PatientFilterSelects } from '../components/filters/PatientFilterSelects'
import { usePatientFilterOptions } from '../components/filters/usePatientFilterOptions'
import {
  EMPTY_PATIENT_FILTERS, inDateRange, localDate, matchesPatientFilters, patientFiltersActive, type PatientFilterValues,
} from '../components/filters/patientFilters'
import { orderService } from '../services/orders'
import { patientService } from '../services/patients'
import { templateService } from '../services/templates'
import { useThemeStore } from '../store/themeStore'
import { groupOrders, summarize, toCsv, TIME_GROUPS, type GroupBy, type GroupRow } from '../utils/analysis'
import { buildRegister, downloadRegisterPdf, REGISTER_TITLE } from '../utils/analysisRegister'
import { labSettingsService } from '../services/labSettings'

const GROUPS: { value: GroupBy; label: string }[] = [
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Yearly' },
  { value: 'day', label: 'Daily' },
  { value: 'doctor', label: 'By Doctor' },
  { value: 'b2b', label: 'By B2B Partner' },
  { value: 'test', label: 'By Test' },
  { value: 'category', label: 'By Category' },
  { value: 'branch', label: 'By Branch' },
]
const GROUP_COLUMN: Record<GroupBy, string> = {
  month: 'Month', year: 'Year', day: 'Date', doctor: 'Doctor', b2b: 'B2B Partner', test: 'Test', category: 'Category', branch: 'Branch',
}

/** Period shortcuts — each just fills in From / To */
function periods(): { label: string; range: [string, string] }[] {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth()
  return [
    { label: 'This month', range: [localDate(new Date(y, m, 1)), localDate(now)] },
    { label: 'Last month', range: [localDate(new Date(y, m - 1, 1)), localDate(new Date(y, m, 0))] },
    { label: 'This year', range: [localDate(new Date(y, 0, 1)), localDate(now)] },
    { label: 'Last year', range: [localDate(new Date(y - 1, 0, 1)), localDate(new Date(y - 1, 11, 31))] },
    { label: 'All time', range: ['', ''] },
  ]
}

type SortKey = 'label' | 'patients' | 'bills' | 'tests' | 'gross' | 'discount' | 'net' | 'collected' | 'outstanding' | 'approved'

const rupees = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
const rupeesExact = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
/** Compact axis ticks: ₹1.2L, ₹45K */
const rupeesShort = (n: number) =>
  n >= 1e7 ? `₹${(n / 1e7).toFixed(1)}Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(1)}L` : n >= 1e3 ? `₹${Math.round(n / 1e3)}K` : `₹${n}`

/** Single-series chart colour + recessive chrome, per theme (validated: ≥3:1 on both chart surfaces). */
const CHART = {
  light: { series: '#2a78d6', grid: '#e5e7eb', tick: '#6b7280', cursor: '#f3f4f6' },
  dark: { series: '#3987e5', grid: '#374151', tick: '#9ca3af', cursor: '#374151' },
}

type SortState = { key: SortKey; dir: 'asc' | 'desc' } | null

/** Sortable column header: click for high→low, again for low→high, a third time to reset. */
function Th({ k, label, right = true, sort, onSort }: { k: SortKey; label: string; right?: boolean; sort: SortState; onSort: (k: SortKey) => void }) {
  const icon = sort?.key !== k
    ? <ArrowUpDown className="h-3 w-3 opacity-40" />
    : sort.dir === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
  return (
    <th className={`px-3 py-2.5 ${right ? 'text-right' : 'text-left'}`} aria-sort={sort?.key === k ? (sort.dir === 'desc' ? 'descending' : 'ascending') : 'none'}>
      <button type="button" onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200 ${right ? 'flex-row-reverse' : ''}`}>
        {label} {icon}
      </button>
    </th>
  )
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: GroupRow }[] }) {
  if (!active || !payload?.length) return null
  const r = payload[0].payload
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-gray-700 dark:bg-gray-800">
      <p className="mb-1 font-semibold text-gray-900 dark:text-white">{r.label}</p>
      <p className="text-gray-700 dark:text-gray-200">Net revenue <span className="font-semibold tabular-nums">{rupeesExact(r.net)}</span></p>
      <p className="text-gray-500 dark:text-gray-400">{r.tests} tests · {r.bills} bills · {r.patients} patients</p>
    </div>
  )
}

export default function AnalysisPage() {
  const theme = useThemeStore(s => s.theme)
  const colors = CHART[theme === 'dark' ? 'dark' : 'light']

  const [groupBy, setGroupBy] = useState<GroupBy>('month')
  const initial = periods()[2].range // This year
  const [dateFrom, setDateFrom] = useState(initial[0])
  const [dateTo, setDateTo] = useState(initial[1])
  const [pf, setPf] = useState<PatientFilterValues>(EMPTY_PATIENT_FILTERS)
  const [sort, setSort] = useState<SortState>(null)

  const ordersQuery = useQuery({ queryKey: ['orders'], queryFn: orderService.getAll })
  const { data: patients = [] } = useQuery({ queryKey: ['patients'], queryFn: () => patientService.getAll() })
  const { data: templates = [] } = useQuery({ queryKey: ['templates'], queryFn: templateService.getAll })
  const { data: labSettings = {} } = useQuery({ queryKey: ['lab-settings'], queryFn: labSettingsService.getAll })
  const filterOptions = usePatientFilterOptions(patients)
  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data])

  const ctx = useMemo(() => ({
    categoryByTemplate: new Map(templates.filter(t => t.category).map(t => [t.id, t.category!.name])),
    branchName: new Map(filterOptions.branches.map(b => [b.id, b.name])),
  }), [templates, filterOptions.branches])

  const filtered = useMemo(
    () => orders.filter(o => inDateRange(o.createdAt, dateFrom, dateTo) && matchesPatientFilters(o.patient, pf)),
    [orders, dateFrom, dateTo, pf],
  )
  const totals = useMemo(() => summarize(filtered), [filtered])
  const isTime = TIME_GROUPS.includes(groupBy)

  const rows = useMemo(() => {
    const grouped = groupOrders(filtered, groupBy, ctx)
    if (!sort) {
      // Default: time groups chronologically (newest first in the table), others by revenue
      return isTime ? grouped.sort((a, b) => b.sortKey.localeCompare(a.sortKey)) : grouped.sort((a, b) => b.net - a.net)
    }
    const dir = sort.dir === 'asc' ? 1 : -1
    return grouped.sort((a, b) => sort.key === 'label'
      ? (isTime ? a.sortKey.localeCompare(b.sortKey) : a.label.localeCompare(b.label)) * dir
      : (a[sort.key] - b[sort.key]) * dir)
  }, [filtered, groupBy, ctx, sort, isTime])

  // Chart: time → chronological (oldest → newest); others → top 10 by revenue
  const chartData = useMemo(() => isTime
    ? [...rows].sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    : [...rows].sort((a, b) => b.net - a.net).slice(0, 10),
  [rows, isTime])

  const toggleSort = (key: SortKey) => setSort(prev =>
    prev?.key === key ? (prev.dir === 'desc' ? { key, dir: 'asc' } : null) : { key, dir: key === 'label' ? 'asc' : 'desc' })

  const periodLabel = dateFrom || dateTo
    ? `${dateFrom ? new Date(dateFrom).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Start'} – ${dateTo ? new Date(dateTo).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Today'}`
    : 'All time'

  const exportHeader = [GROUP_COLUMN[groupBy], 'Patients', 'Bills', 'Tests', 'Gross', 'Discount', 'Net revenue', 'Share %', 'Collected', 'Outstanding', 'Reports approved']
  const exportRows = rows.map(r => [
    r.label, r.patients, r.bills, r.tests, r.gross, r.discount, r.net,
    totals.net ? Math.round((r.net / totals.net) * 1000) / 10 : 0, r.collected, r.outstanding, r.approved,
  ])
  const totalRow = ['Total', totals.patients, totals.bills, totals.tests, totals.gross, totals.discount, totals.net, 100, totals.collected, totals.outstanding, totals.approved]
  const fileBase = `analysis-${groupBy}-${dateFrom || 'all'}${dateTo ? `-to-${dateTo}` : ''}`

  const downloadCsv = () => {
    const blob = new Blob([toCsv(exportHeader, [...exportRows, totalRow])], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${fileBase}.csv`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  /** Detailed register: a section per group, one line per bill, group and grand totals */
  const downloadRegister = () => downloadRegisterPdf({
    groups: buildRegister(filtered, groupBy, ctx),
    by: groupBy,
    labName: labSettings.lab_name ?? '',
    dateFrom,
    dateTo,
    filtersNote: patientFiltersActive(pf) ? 'Filtered (branch / B2B / doctor / gender)' : undefined,
  })

  const downloadPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14)
    doc.text(`Analysis — ${GROUPS.find(g => g.value === groupBy)?.label}`, 14, 15)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100)
    const filtersNote = patientFiltersActive(pf) ? ' · filtered' : ''
    doc.text(`Period: ${periodLabel}${filtersNote} · Generated ${new Date().toLocaleString('en-IN')}`, 14, 21)
    const money = (n: number | string) => typeof n === 'number' ? n.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : n
    autoTable(doc, {
      startY: 26,
      head: [exportHeader.map(h => (['Gross', 'Discount', 'Net revenue', 'Collected', 'Outstanding'].includes(h) ? `${h} (Rs.)` : h))],
      body: [...exportRows, totalRow].map(r => r.map((v, i) => ([4, 5, 6, 8, 9].includes(i) ? money(v) : String(v)))),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.8 },
      headStyles: { fillColor: [29, 78, 216], textColor: 255 },
      columnStyles: Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => [i, { halign: 'right' }])),
      didParseCell: (data) => { if (data.section === 'body' && data.row.index === exportRows.length) data.cell.styles.fontStyle = 'bold' },
    })
    doc.save(`${fileBase}.pdf`)
  }

  if (ordersQuery.isLoading) return <PageLoader />

  const th = { sort, onSort: toggleSort }

  return (
    <div>
      <Header title="Analysis" subtitle="Revenue, tests and collections — by month, year, doctor, B2B partner and more" />

      <PageContent className="space-y-5">
        {/* Filters */}
        <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap rounded-lg bg-gray-100 p-0.5 dark:bg-gray-900/60">
              {periods().map(p => {
                const active = dateFrom === p.range[0] && dateTo === p.range[1]
                return (
                  <button key={p.label} type="button" onClick={() => { setDateFrom(p.range[0]); setDateTo(p.range[1]) }}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      active ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}>
                    {p.label}
                  </button>
                )
              })}
            </div>
            <label className="flex items-center gap-1.5 text-xs text-gray-400">
              From
              <input type="date" value={dateFrom} max={dateTo || undefined} onChange={e => setDateFrom(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700 outline-none focus:border-blue-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200" />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-gray-400">
              To
              <input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700 outline-none focus:border-blue-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200" />
            </label>
          </div>
          <div className="border-t border-gray-100 pt-3 dark:border-gray-700">
            <FilterBar onRefresh={() => ordersQuery.refetch()} isRefreshing={ordersQuery.isFetching}>
              <PatientFilterSelects value={pf} onChange={setPf} options={filterOptions} />
              {patientFiltersActive(pf) && (
                <button type="button" onClick={() => setPf(EMPTY_PATIENT_FILTERS)}
                  className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-red-600 dark:text-gray-400">
                  <X className="h-3.5 w-3.5" /> Clear
                </button>
              )}
            </FilterBar>
          </div>
        </div>

        {/* Headline numbers for the selected period */}
        <StatSummaryGrid stats={[
          { title: 'Net Revenue', value: rupees(totals.net), subtitle: periodLabel, icon: <IndianRupee className="h-5 w-5" />, color: 'blue' },
          { title: 'Collected', value: rupees(totals.collected), subtitle: 'Fully paid', icon: <CheckCircle2 className="h-5 w-5" />, color: 'emerald' },
          { title: 'Outstanding', value: rupees(totals.outstanding), subtitle: 'Pending + partial', icon: <Clock className="h-5 w-5" />, color: 'amber' },
          { title: 'Discount Given', value: rupees(totals.discount), subtitle: `on ${rupees(totals.gross)} gross`, icon: <BadgePercent className="h-5 w-5" />, color: 'gray' },
          { title: 'Patients', value: totals.patients.toLocaleString('en-IN'), subtitle: 'Distinct patients', icon: <Users className="h-5 w-5" />, color: 'violet' },
          { title: 'Bills', value: totals.bills.toLocaleString('en-IN'), subtitle: 'Receipts', icon: <Receipt className="h-5 w-5" />, color: 'violet' },
          { title: 'Tests', value: totals.tests.toLocaleString('en-IN'), subtitle: `${totals.approved} reports approved`, icon: <FlaskConical className="h-5 w-5" />, color: 'violet' },
          { title: 'Avg. per Bill', value: rupees(totals.bills ? totals.net / totals.bills : 0), subtitle: 'Net revenue ÷ bills', icon: <Wallet className="h-5 w-5" />, color: 'gray' },
        ]} />

        {/* Report-by tabs */}
        <div className="flex flex-wrap gap-1.5">
          {GROUPS.map(g => (
            <button key={g.value} type="button" onClick={() => { setGroupBy(g.value); setSort(null) }}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                groupBy === g.value
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-gray-700'
              }`}>
              {g.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={<IndianRupee className="h-10 w-10" />} title="No billing in this period" description="Pick a wider period or clear the filters" />
        ) : (
          <>
            {/* Chart */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {isTime ? `Net revenue — ${GROUPS.find(g => g.value === groupBy)?.label.toLowerCase()}` : `Top ${chartData.length} by net revenue — ${GROUP_COLUMN[groupBy].toLowerCase()}`}
                </h2>
                <p className="text-xs text-gray-400">{periodLabel}{!isTime && rows.length > 10 ? ` · ${rows.length - 10} more in the table below` : ''}</p>
              </div>
              <div style={{ height: isTime ? 280 : Math.max(180, chartData.length * 34) }}>
                <ResponsiveContainer width="100%" height="100%">
                  {isTime ? (
                    <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid vertical={false} stroke={colors.grid} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: colors.tick }} tickLine={false} axisLine={{ stroke: colors.grid }} minTickGap={12} />
                      <YAxis tickFormatter={rupeesShort} tick={{ fontSize: 11, fill: colors.tick }} tickLine={false} axisLine={false} width={56} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: colors.cursor }} />
                      <Bar dataKey="net" fill={colors.series} radius={[4, 4, 0, 0]} maxBarSize={44} />
                    </BarChart>
                  ) : (
                    <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                      <CartesianGrid horizontal={false} stroke={colors.grid} />
                      <XAxis type="number" tickFormatter={rupeesShort} tick={{ fontSize: 11, fill: colors.tick }} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="label" width={170} tick={{ fontSize: 11, fill: colors.tick }} tickLine={false} axisLine={{ stroke: colors.grid }}
                        tickFormatter={(v: string) => (v.length > 26 ? `${v.slice(0, 25)}…` : v)} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: colors.cursor }} />
                      <Bar dataKey="net" fill={colors.series} radius={[0, 4, 4, 0]} maxBarSize={22} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            {/* Breakdown table */}
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-3 dark:border-gray-700">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {GROUPS.find(g => g.value === groupBy)?.label} report
                  <span className="ml-2 text-xs font-normal text-gray-400">{rows.length} row{rows.length !== 1 ? 's' : ''} · {periodLabel}</span>
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" icon={<FileSpreadsheet className="h-3.5 w-3.5" />} onClick={downloadCsv}>Excel (CSV)</Button>
                  <Button size="sm" variant="secondary" icon={<Download className="h-3.5 w-3.5" />} onClick={downloadPdf}>Summary PDF</Button>
                  <Button size="sm" icon={<FileText className="h-3.5 w-3.5" />} onClick={downloadRegister} title={`${REGISTER_TITLE[groupBy]} — every bill, grouped, with totals`}>
                    Register PDF
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] text-sm">
                  <thead className="bg-gray-50/80 dark:bg-gray-900/50">
                    <tr className="border-b border-gray-100 dark:border-gray-700">
                      <Th {...th} k="label" label={GROUP_COLUMN[groupBy]} right={false} />
                      <Th {...th} k="patients" label="Patients" />
                      <Th {...th} k="bills" label="Bills" />
                      <Th {...th} k="tests" label="Tests" />
                      <Th {...th} k="gross" label="Gross" />
                      <Th {...th} k="discount" label="Discount" />
                      <Th {...th} k="net" label="Net revenue" />
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Share</th>
                      <Th {...th} k="collected" label="Collected" />
                      <Th {...th} k="outstanding" label="Outstanding" />
                      <Th {...th} k="approved" label="Reports" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                    {rows.map(r => {
                      const share = totals.net ? (r.net / totals.net) * 100 : 0
                      return (
                        <tr key={r.key} className="hover:bg-gray-50/60 dark:hover:bg-gray-700/30">
                          <td className="max-w-[260px] truncate px-3 py-2.5 font-medium text-gray-900 dark:text-white" title={r.label}>{r.label}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-200">{r.patients}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-200">{r.bills}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-200">{r.tests}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{rupeesExact(r.gross)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{r.discount ? rupeesExact(r.discount) : '—'}</td>
                          <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-gray-900 dark:text-white">{rupeesExact(r.net)}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                                <div className="h-full rounded-full" style={{ width: `${share}%`, background: colors.series }} />
                              </div>
                              <span className="w-10 text-right text-xs tabular-nums text-gray-500 dark:text-gray-400">{share.toFixed(1)}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-200">{rupeesExact(r.collected)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-200">{r.outstanding ? rupeesExact(r.outstanding) : '—'}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-200">{r.approved}/{r.tests}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50/80 font-semibold dark:border-gray-600 dark:bg-gray-900/50">
                      <td className="px-3 py-2.5 text-gray-900 dark:text-white">Total</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 dark:text-white">{totals.patients}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 dark:text-white">{totals.bills}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 dark:text-white">{totals.tests}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 dark:text-white">{rupeesExact(totals.gross)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 dark:text-white">{rupeesExact(totals.discount)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 dark:text-white">{rupeesExact(totals.net)}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-500">100%</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 dark:text-white">{rupeesExact(totals.collected)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 dark:text-white">{rupeesExact(totals.outstanding)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 dark:text-white">{totals.approved}/{totals.tests}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="border-t border-gray-100 px-5 py-2.5 text-[11px] text-gray-400 dark:border-gray-700">
                Amounts add up exactly to the Total line. Patients and bills are counted within each row, so one patient or bill can appear
                in several rows (e.g. two tests on one bill, or visits in two months) — those columns can add up to more than the Total.
                Dates are when the test was billed; Outstanding includes partly paid bills in full.
              </p>
            </div>
          </>
        )}
      </PageContent>
    </div>
  )
}
