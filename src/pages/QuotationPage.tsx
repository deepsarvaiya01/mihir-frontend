import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Copy, Download, Layers, Search, Trash2, X, Calculator } from 'lucide-react'
import { toast } from 'sonner'
import { Header } from '../components/layout/Header'
import { PageContent } from '../components/ui/PageContent'
import { PageLoader } from '../components/ui/Spinner'
import { Button } from '../components/ui/Button'
import { FilterSelect } from '../components/ui/FilterBar'
import { templateService } from '../services/templates'
import { profileService } from '../services/profiles'
import { b2bLabService } from '../services/b2bLabs'
import { testCategoryService } from '../services/testCategories'
import { labSettingsService } from '../services/labSettings'
import { generateQuotation, quotationText, quotationTotals, type QuotationItem } from '../utils/generateQuotation'

type Kind = 'template' | 'profile'
type Selected = { kind: Kind; id: number }

const DISCOUNTS = [0, 5, 10, 15, 20, 25]
const rupees = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

export default function QuotationPage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('ALL') // ALL · PROFILES · <category id>
  const [pricing, setPricing] = useState('STD')   // STD · <b2b lab id>
  const [selected, setSelected] = useState<Selected[]>([])
  const [discount, setDiscount] = useState('')
  const [patientName, setPatientName] = useState('')
  const [downloading, setDownloading] = useState(false)

  const { data: templates = [], isLoading: loadingTemplates } = useQuery({ queryKey: ['templates'], queryFn: templateService.getAll })
  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({ queryKey: ['profiles'], queryFn: profileService.getAll })
  const { data: b2bLabs = [] } = useQuery({ queryKey: ['b2b-labs'], queryFn: b2bLabService.getAll })
  const { data: categories = [] } = useQuery({ queryKey: ['test-categories'], queryFn: testCategoryService.getAll })
  const { data: labSettings = {} } = useQuery({ queryKey: ['lab-settings'], queryFn: labSettingsService.getAll })

  const activeLabs = b2bLabs.filter(l => l.active)
  const pricingLab = pricing === 'STD' ? null : activeLabs.find(l => String(l.id) === pricing) ?? null
  const activeCategories = categories.filter(c => c.active).sort((a, b) => a.displayOrder - b.displayOrder)

  /** Every pickable row — profiles first, then tests — priced for the chosen pricing (B2B price when the lab has one). */
  const rows = [
    ...profiles.filter(p => p.active).map(p => ({
      kind: 'profile' as const, id: p.id, name: p.name, code: p.code,
      price: Number(p.amount), categoryId: null as number | null, categoryName: 'Profile',
      memberIds: p.templates.map(t => t.id), memberNames: p.templates.map(t => t.name), b2bPriced: false,
    })),
    ...templates.filter(t => t.active).map(t => {
      const b2b = pricingLab ? t.b2bPrices?.find(bp => bp.b2bLabId === pricingLab.id) : undefined
      return {
        kind: 'template' as const, id: t.id, name: t.name, code: t.code,
        price: Number(b2b?.amount ?? t.amount ?? 0), categoryId: t.categoryId, categoryName: t.category?.name ?? '',
        memberIds: [] as number[], memberNames: [] as string[], b2bPriced: !!b2b,
      }
    }),
  ]

  const isSelected = (kind: Kind, id: number) => selected.some(s => s.kind === kind && s.id === id)

  // Tests already inside a selected profile can't also be picked on their own (no double counting)
  const coveredBy = new Map<number, string>()
  for (const s of selected) {
    if (s.kind !== 'profile') continue
    const p = rows.find(r => r.kind === 'profile' && r.id === s.id)
    p?.memberIds.forEach(tid => { if (!coveredBy.has(tid)) coveredBy.set(tid, p.name) })
  }

  const toggle = (kind: Kind, id: number) => {
    if (kind === 'template' && coveredBy.has(id)) return
    setSelected(prev => {
      if (prev.some(s => s.kind === kind && s.id === id)) return prev.filter(s => !(s.kind === kind && s.id === id))
      if (kind === 'profile') {
        // A profile replaces any of its member tests picked individually
        const members = new Set(rows.find(r => r.kind === 'profile' && r.id === id)?.memberIds ?? [])
        return [...prev.filter(s => !(s.kind === 'template' && members.has(s.id))), { kind, id }]
      }
      return [...prev, { kind, id }]
    })
  }

  const q = search.trim().toLowerCase()
  const visible = rows.filter(r => {
    if (category === 'PROFILES' && r.kind !== 'profile') return false
    if (category !== 'ALL' && category !== 'PROFILES' && String(r.categoryId ?? '') !== category) return false
    return !q || r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q)
  })

  /** Each selection with its priced line (selections whose test was since deactivated drop out) */
  const lines = selected.flatMap(s => {
    const r = rows.find(row => row.kind === s.kind && row.id === s.id)
    if (!r) return []
    const item: QuotationItem = {
      name: r.name,
      code: r.code,
      note: r.kind === 'profile' ? `Profile · ${r.memberIds.length} tests` : undefined,
      amount: r.price,
    }
    return [{ sel: s, item }]
  })
  const items = lines.map(l => l.item)
  const discountPct = Math.min(100, Math.max(0, parseFloat(discount) || 0))
  const totals = quotationTotals(items, discountPct)
  const quote = { items, discountPct, patientName, pricingLabel: pricingLab ? `B2B — ${pricingLab.name}` : 'Standard', labSettings }

  const download = async () => {
    setDownloading(true)
    try { await generateQuotation(quote); toast.success('Quotation downloaded') }
    catch { toast.error('Failed to create quotation PDF') }
    finally { setDownloading(false) }
  }
  const copy = () => navigator.clipboard.writeText(quotationText(quote))
    .then(() => toast.success('Quotation copied — paste it in WhatsApp or SMS'))
    .catch(() => toast.error('Could not copy to clipboard'))

  if (loadingTemplates || loadingProfiles) return <PageLoader />

  return (
    <div>
      <Header title="Quotation" subtitle="Pick tests and profiles to see the total price, then share or download it" />

      <PageContent>
        <div className="grid gap-5 lg:grid-cols-3">
          {/* ── Test picker ── */}
          <div className="space-y-3 lg:col-span-2">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search test or profile…"
                  className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
              </div>
              <FilterSelect value={category} onChange={setCategory}>
                <option value="ALL">All Categories</option>
                <option value="PROFILES">Profiles only</option>
                {activeCategories.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
              </FilterSelect>
              <FilterSelect value={pricing} onChange={setPricing} className="max-w-[220px]">
                <option value="STD">Standard prices</option>
                {activeLabs.length > 0 && (
                  <optgroup label="B2B partner prices">
                    {activeLabs.map(l => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
                  </optgroup>
                )}
              </FilterSelect>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
              {visible.length === 0 ? (
                <p className="py-12 text-center text-sm text-gray-400">No tests match your search</p>
              ) : (
                <ul className="max-h-[68vh] divide-y divide-gray-100 overflow-y-auto dark:divide-gray-700/60">
                  {visible.map(r => {
                    const on = isSelected(r.kind, r.id)
                    const covered = r.kind === 'template' ? coveredBy.get(r.id) : undefined
                    return (
                      <li key={`${r.kind}-${r.id}`}>
                        <button type="button" onClick={() => toggle(r.kind, r.id)} disabled={!!covered}
                          title={r.kind === 'profile' ? `Includes: ${r.memberNames.join(', ')}` : covered ? `Included in ${covered}` : undefined}
                          className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors disabled:cursor-not-allowed ${
                            on ? 'bg-blue-50/70 dark:bg-blue-900/20' : covered ? 'opacity-50' : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'
                          }`}>
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                            on ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700'
                          }`}>
                            {on && <Check className="h-3.5 w-3.5" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{r.name}</p>
                              {r.kind === 'profile' && (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:ring-violet-800">
                                  <Layers className="h-3 w-3" /> {r.memberIds.length} tests
                                </span>
                              )}
                            </div>
                            <p className="truncate text-xs text-gray-400">
                              <span className="font-mono">{r.code}</span>
                              {r.kind === 'template' && r.categoryName && <> · {r.categoryName}</>}
                              {covered && <> · included in {covered}</>}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{rupees(r.price)}</p>
                            {r.b2bPriced && <p className="text-[10px] font-medium text-violet-600 dark:text-violet-400">B2B price</p>}
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* ── Quotation summary ── */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-blue-600" />
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Quotation</h2>
                  {items.length > 0 && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">{items.length}</span>
                  )}
                </div>
                {items.length > 0 && (
                  <button type="button" onClick={() => setSelected([])}
                    className="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" /> Clear
                  </button>
                )}
              </div>

              <div className="space-y-4 px-5 py-4">
                <input value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="Patient name (optional)"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />

                {items.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400 dark:border-gray-700">
                    Tick tests on the left to add them
                  </p>
                ) : (
                  <ul className="max-h-[32vh] space-y-1.5 overflow-y-auto pr-1">
                    {lines.map(({ sel: s, item: it }) => {
                      return (
                        <li key={`${s.kind}-${s.id}`} className="group flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/40">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-gray-800 dark:text-gray-100">{it.name}</p>
                            {it.note && <p className="text-[11px] text-violet-600 dark:text-violet-400">{it.note}</p>}
                          </div>
                          <span className="shrink-0 text-sm font-medium tabular-nums text-gray-700 dark:text-gray-200">{rupees(it.amount)}</span>
                          <button type="button" onClick={() => toggle(s.kind, s.id)} title="Remove"
                            className="shrink-0 rounded p-0.5 text-gray-300 hover:text-red-500 dark:text-gray-600">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}

                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Discount</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {DISCOUNTS.map(d => (
                      <button key={d} type="button" onClick={() => setDiscount(d ? String(d) : '')}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                          discountPct === d ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                        {d}%
                      </button>
                    ))}
                    <input type="number" min={0} max={100} value={discount} onChange={e => setDiscount(e.target.value)} placeholder="Custom %"
                      className="w-20 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
                  </div>
                </div>

                <div className="space-y-1.5 border-t border-gray-100 pt-3 text-sm dark:border-gray-700">
                  <div className="flex justify-between text-gray-500 dark:text-gray-400">
                    <span>Subtotal</span><span className="tabular-nums">{rupees(totals.subtotal)}</span>
                  </div>
                  {totals.discount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount ({discountPct}%)</span><span className="tabular-nums">−{rupees(totals.discount)}</span>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between pt-1">
                    <span className="font-semibold text-gray-900 dark:text-white">Total</span>
                    <span className="text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-400">{rupees(totals.total)}</span>
                  </div>
                  {pricingLab && <p className="text-[11px] text-violet-600 dark:text-violet-400">Using {pricingLab.name} B2B prices</p>}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" icon={<Copy className="h-4 w-4" />} disabled={items.length === 0} onClick={copy}>
                    Copy
                  </Button>
                  <Button icon={<Download className="h-4 w-4" />} disabled={items.length === 0} loading={downloading} onClick={download}>
                    PDF
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageContent>
    </div>
  )
}
