import type { Doctor, Patient } from '../../types'

/* ─── Gender ─────────────────────────────────────────────── */

export const GENDER_EMOJI = {
  male: { emoji: '👨', label: 'Male' },
  female: { emoji: '👩', label: 'Female' },
}

/** Older records store gender as "male", "M", etc. — match any spelling. */
export function genderInfo(gender: string | null | undefined): { emoji: string; label: string } | undefined {
  const g = gender?.trim().toLowerCase()
  if (g === 'male' || g === 'm') return GENDER_EMOJI.male
  if (g === 'female' || g === 'f') return GENDER_EMOJI.female
  return undefined
}

/* ─── Dates ──────────────────────────────────────────────── */

/** yyyy-mm-dd in local time (toISOString would shift the day for IST before 5:30 am) */
export function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const daysAgo = (n: number) => localDate(new Date(Date.now() - n * 86_400_000))

/** Quick ranges just fill in the From / To dates. */
export const DATE_SHORTCUTS: { label: string; range: () => [string, string] }[] = [
  { label: 'Today', range: () => [daysAgo(0), daysAgo(0)] },
  { label: '7 days', range: () => [daysAgo(6), daysAgo(0)] },
  { label: '30 days', range: () => [daysAgo(29), daysAgo(0)] },
  { label: 'All', range: () => ['', ''] },
]

/** Whether an ISO timestamp falls inside the inclusive From / To day range (empty = open-ended). */
export function inDateRange(iso: string | null | undefined, from: string, to: string): boolean {
  if (!from && !to) return true
  if (!iso) return false
  const d = new Date(iso)
  if (from && d < new Date(`${from}T00:00:00`)) return false
  if (to && d > new Date(`${to}T23:59:59.999`)) return false
  return true
}

/* ─── Branch / B2B / Doctor / Gender ─────────────────────── */

export interface PatientFilterValues {
  /** ALL · <branch id> */
  branch: string
  /** ALL · B2B (any lab) · INDIVIDUAL · <lab id> */
  b2b: string
  /** ALL · SELF (no doctor) · <doctor name> */
  doctor: string
  /** '' · Male · Female */
  gender: string
}

export const EMPTY_PATIENT_FILTERS: PatientFilterValues = { branch: 'ALL', b2b: 'ALL', doctor: 'ALL', gender: '' }

export const patientFiltersActive = (f: PatientFilterValues) =>
  f.branch !== 'ALL' || f.b2b !== 'ALL' || f.doctor !== 'ALL' || !!f.gender

const sameName = (a: string | null | undefined, b: string) => (a ?? '').trim().toLowerCase() === b.trim().toLowerCase()

export function matchesPatientFilters(p: Patient | null | undefined, f: PatientFilterValues): boolean {
  if (!patientFiltersActive(f)) return true
  if (!p) return false
  if (f.gender && genderInfo(p.gender)?.label !== f.gender) return false
  if (f.branch !== 'ALL' && String(p.labBranchId ?? '') !== f.branch) return false
  if (f.b2b === 'B2B' && !p.isB2b) return false
  if (f.b2b === 'INDIVIDUAL' && p.isB2b) return false
  if (f.b2b !== 'ALL' && f.b2b !== 'B2B' && f.b2b !== 'INDIVIDUAL' && String(p.b2bLabId ?? '') !== f.b2b) return false
  if (f.doctor === 'SELF' && p.doctorName?.trim()) return false
  if (f.doctor !== 'ALL' && f.doctor !== 'SELF' && !sameName(p.doctorName, f.doctor)) return false
  return true
}

/** Doctors list plus any older doctor names saved on patients that aren't in it */
export function buildDoctorOptions(doctors: Doctor[], patients: (Patient | null | undefined)[]): string[] {
  const names = new Map<string, string>()
  for (const d of doctors) names.set(d.name.trim().toLowerCase(), d.name)
  for (const p of patients) {
    const n = p?.doctorName?.trim()
    if (n && !names.has(n.toLowerCase())) names.set(n.toLowerCase(), n)
  }
  return Array.from(names.values()).sort((a, b) => a.localeCompare(b))
}
