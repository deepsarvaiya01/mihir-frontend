/** Keeps what's being typed as a number: digits, one decimal point (comma → point), optional leading minus. */
export function sanitizeNumberInput(raw: string): string {
  let s = raw.replace(',', '.').replace(/[^\d.-]/g, '')
  const negative = s.startsWith('-')
  s = s.replace(/-/g, '')
  const dot = s.indexOf('.')
  if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '')
  return (negative ? '-' : '') + s
}

/** "0", "0.5", ".5", "5." → numbers; "", "-", "." → undefined (nothing entered). */
export function toNumber(v: string | boolean | undefined): number | undefined {
  if (v === undefined || typeof v === 'boolean' || !/\d/.test(v)) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}
