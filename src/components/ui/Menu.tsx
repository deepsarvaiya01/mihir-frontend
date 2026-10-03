import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

export interface MenuItem {
  label: string
  icon: ReactNode
  onClick: () => void
  loading?: boolean
  hint?: string
  /** Draws a separator above this item */
  divider?: boolean
}

interface MenuProps {
  /** Renders the trigger button — clicking anywhere on it toggles the menu */
  trigger: (open: boolean) => ReactNode
  items: MenuItem[]
  title?: string
}

const MENU_W = 232

/** Small dropdown menu. Positioned `fixed` so it is never clipped by scrolling table containers. */
export function Menu({ trigger, items, title }: MenuProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const anchorRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const toggle = () => {
    if (!open && anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect()
      const left = Math.max(8, Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8))
      const estimatedH = items.length * 38 + (title ? 34 : 0) + 12
      const top = r.bottom + 6 + estimatedH > window.innerHeight ? Math.max(8, r.top - 6 - estimatedH) : r.bottom + 6
      setPos({ top, left })
    }
    setOpen(o => !o)
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!menuRef.current?.contains(t) && !anchorRef.current?.contains(t)) setOpen(false)
    }
    const close = () => setOpen(false)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  return (
    <div ref={anchorRef} className="relative inline-flex" onClick={toggle}>
      {trigger(open)}
      {open && (
        <div
          ref={menuRef}
          onClick={e => e.stopPropagation()}
          style={{ top: pos.top, left: pos.left, width: MENU_W }}
          className="fixed z-[60] overflow-hidden rounded-xl border border-gray-200 bg-white py-1.5 shadow-xl shadow-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:shadow-black/40"
        >
          {title && (
            <p className="px-3.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{title}</p>
          )}
          {items.map(item => (
            <div key={item.label}>
              {item.divider && <div className="my-1.5 h-px bg-gray-100 dark:bg-gray-700" />}
              <button
                type="button"
                disabled={item.loading}
                onClick={() => { item.onClick(); setOpen(false) }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-700/60"
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center text-gray-400">
                  {item.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                {item.hint && <span className="text-[11px] text-gray-400">{item.hint}</span>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
