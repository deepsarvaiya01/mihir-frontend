export function toTitleCase(str: string): string {
  return str.replace(/\b\w/g, c => c.toUpperCase())
}

/** Shows the most significant age unit that's set — Years, else Months, else Days. */
export function formatAge(
  years?: number | null,
  months?: number | null,
  days?: number | null,
): string | null {
  if (years) return `${years} Year${years === 1 ? '' : 's'}`
  if (months) return `${months} Month${months === 1 ? '' : 's'}`
  if (days) return `${days} Day${days === 1 ? '' : 's'}`
  return null
}
