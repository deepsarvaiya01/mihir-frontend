import { CalendarDays } from 'lucide-react'
import { DATE_SHORTCUTS } from './patientFilters'

const inputCls = 'rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200'

/** From / To date inputs with Today · 7 days · 30 days · All shortcuts that fill them in. */
export function DateRangeFilter({ label, from, to, onChange }: {
  label: string
  from: string
  to: string
  onChange: (from: string, to: string) => void
}) {
  return (
    <>
      <CalendarDays className="h-4 w-4 text-gray-400" />
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
      <div className="flex items-center gap-1.5">
        <label className="flex items-center gap-1.5 text-xs text-gray-400">
          From
          <input type="date" value={from} max={to || undefined} onChange={e => onChange(e.target.value, to)} className={inputCls} />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-400">
          To
          <input type="date" value={to} min={from || undefined} onChange={e => onChange(from, e.target.value)} className={inputCls} />
        </label>
      </div>
      <div className="flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-900/60">
        {DATE_SHORTCUTS.map(d => {
          const [f, t] = d.range()
          const active = from === f && to === t
          return (
            <button key={d.label} type="button" onClick={() => onChange(f, t)}
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
    </>
  )
}
