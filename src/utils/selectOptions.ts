/**
 * Dropdown / multi-select options are stored as a JSON string array. A literal "Other"
 * entry turns on free text: picking it lets the user type any value instead.
 * Multi-select results are stored as one readable string, e.g. "Pus Cells, RBC, some typed note".
 */
export const OTHER_OPTION = 'Other'
const SEPARATOR = ', '

export const isOtherOption = (o: string) => o.trim().toLowerCase() === OTHER_OPTION.toLowerCase()

export function parseOptions(optionsJson: string | null): { options: string[]; allowOther: boolean } {
  let all: string[] = []
  try { all = optionsJson ? (JSON.parse(optionsJson) as string[]) : [] } catch { /* malformed JSON — no options */ }
  if (!Array.isArray(all)) all = []
  return { options: all.filter(o => !isOtherOption(o)), allowOther: all.some(isOtherOption) }
}

/** Splits a stored multi-select value into picked options and the free "Other" text. */
export function parseMultiValue(value: string, options: string[]): { selected: string[]; otherOn: boolean; otherText: string } {
  const parts = value ? value.split(SEPARATOR).map(p => p.trim()).filter(Boolean) : []
  const selected = parts.filter(p => options.includes(p))
  const rest = parts.filter(p => !options.includes(p))
  const otherOn = rest.length > 0
  const otherText = rest.filter(p => !isOtherOption(p)).join(SEPARATOR)
  return { selected, otherOn, otherText }
}

/** Joins picked options (in their defined order) plus the "Other" text back into the stored string. */
export function serializeMultiValue(selected: string[], options: string[], otherOn: boolean, otherText: string): string {
  const parts = options.filter(o => selected.includes(o))
  if (otherOn) parts.push(otherText.trim() || OTHER_OPTION)
  return parts.join(SEPARATOR)
}
