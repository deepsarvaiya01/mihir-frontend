export function isOutOfRange(value: string | number | boolean | null | undefined, range: string | null | undefined): boolean {
  if (!range || value === null || value === undefined) return false
  const num = typeof value === 'number' ? value : parseFloat(String(value))
  if (isNaN(num)) return false
  const m = range.replace(/[\[\]\s]/g, '').match(/^([\d.]+)[-–]([\d.]+)$/)
  if (!m) return false
  return num < parseFloat(m[1]) || num > parseFloat(m[2])
}
