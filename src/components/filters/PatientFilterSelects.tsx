import { FilterSelect } from '../ui/FilterBar'
import type { PatientFilterValues } from './patientFilters'
import type { PatientFilterOptions } from './usePatientFilterOptions'

/** Branch · B2B · Doctor · Gender dropdowns, shared by the patient and test result pages. */
export function PatientFilterSelects({ value, onChange, options }: {
  value: PatientFilterValues
  onChange: (next: PatientFilterValues) => void
  options: PatientFilterOptions
}) {
  const set = (key: keyof PatientFilterValues) => (v: string) => onChange({ ...value, [key]: v })
  return (
    <>
      <FilterSelect value={value.branch} onChange={set('branch')}>
        <option value="ALL">All Branches</option>
        {options.branches.map(b => (
          <option key={b.id} value={String(b.id)}>{b.name}{b.active ? '' : ' (inactive)'}</option>
        ))}
      </FilterSelect>
      <FilterSelect value={value.b2b} onChange={set('b2b')} className="max-w-[200px]">
        <option value="ALL">All B2B / Individual</option>
        <option value="B2B">B2B only</option>
        <option value="INDIVIDUAL">Individual only</option>
        {options.b2bLabs.length > 0 && (
          <optgroup label="B2B Partners">
            {options.b2bLabs.map(l => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
          </optgroup>
        )}
      </FilterSelect>
      <FilterSelect value={value.doctor} onChange={set('doctor')} className="max-w-[200px]">
        <option value="ALL">All Doctors</option>
        <option value="SELF">Self (no doctor)</option>
        {options.doctorOptions.length > 0 && (
          <optgroup label="Doctors">
            {options.doctorOptions.map(n => <option key={n} value={n}>{n}</option>)}
          </optgroup>
        )}
      </FilterSelect>
      <FilterSelect value={value.gender} onChange={set('gender')}>
        <option value="">All Genders</option>
        <option value="Male">Male</option>
        <option value="Female">Female</option>
      </FilterSelect>
    </>
  )
}
