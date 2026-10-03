export type RangeStatus = 'low' | 'high' | 'normal'

const NUM = String.raw`(\d+(?:\.\d+)?)`

/** Removes Indian/Western thousands separators inside numbers: "1,50,000" → "150000" */
const stripThousands = (s: string) => s.replace(/(\d),(?=\d)/g, '$1')

/**
 * Where a numeric result sits against its reference range, or null when it can't be judged
 * (non-numeric result, no range, or a range we can't read unambiguously).
 *
 * Understands: "12-16", "13.0 – 17.0 g/dL", "1,50,000 - 4,50,000", "[4.5 to 11]", "M: 13-17",
 * "< 200", "<= 5", "Up to 40", "Less than 1", "> 60", ">= 18", "More than 40".
 * Multi-line or multi-band ranges ("Desirable <200 / Borderline 200-239 / High ≥240") are left
 * unjudged on purpose — guessing there would flag normal results.
 */
export function rangeStatus(value: string | number | boolean | null | undefined, range: string | null | undefined): RangeStatus | null {
  if (!range || value === null || value === undefined || typeof value === 'boolean') return null

  const raw = typeof value === 'number' ? String(value) : stripThousands(value.trim())
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(raw)) return null
  const v = Number(raw)

  const text = stripThousands(range).replace(/[[\]()]/g, ' ').trim()
  if (/\n/.test(text)) return null

  const between = [...text.matchAll(new RegExp(`${NUM}\\s*(?:-|–|—|to)\\s*${NUM}`, 'gi'))]
  const upper = [...text.matchAll(new RegExp(`(?:<=?|≤|up\\s*to|less\\s+than|below)\\s*${NUM}`, 'gi'))]
  const lower = [...text.matchAll(new RegExp(`(?:>=?|≥|more\\s+than|greater\\s+than|above)\\s*${NUM}`, 'gi'))]
  if (between.length + upper.length + lower.length !== 1) return null

  if (between.length) {
    const lo = Number(between[0][1]), hi = Number(between[0][2])
    if (lo > hi) return null
    return v < lo ? 'low' : v > hi ? 'high' : 'normal'
  }
  if (upper.length) return v > Number(upper[0][1]) ? 'high' : 'normal'
  return v < Number(lower[0][1]) ? 'low' : 'normal'
}

export function isOutOfRange(value: string | number | boolean | null | undefined, range: string | null | undefined): boolean {
  const s = rangeStatus(value, range)
  return s === 'low' || s === 'high'
}
