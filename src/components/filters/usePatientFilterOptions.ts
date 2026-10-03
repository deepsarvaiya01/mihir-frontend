import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { doctorService } from '../../services/doctors'
import { labBranchService } from '../../services/labBranches'
import { b2bLabService } from '../../services/b2bLabs'
import type { Patient } from '../../types'
import { buildDoctorOptions } from './patientFilters'

/** Branches, B2B labs and doctor names for the patient filter dropdowns. */
export function usePatientFilterOptions(patients: (Patient | null | undefined)[]) {
  const { data: doctors = [] } = useQuery({ queryKey: ['doctors'], queryFn: doctorService.getAll })
  const { data: branches = [] } = useQuery({ queryKey: ['lab-branches'], queryFn: labBranchService.getAll })
  const { data: b2bLabs = [] } = useQuery({ queryKey: ['b2b-labs'], queryFn: b2bLabService.getAll })

  const doctorOptions = useMemo(() => buildDoctorOptions(doctors, patients), [doctors, patients])
  /** Degree for the doctor names stored on patients (patients keep the name only) */
  const doctorDegree = useMemo(() => new Map(doctors.map(d => [d.name, d.degreeName])), [doctors])

  return { branches, b2bLabs, doctorOptions, doctorDegree }
}

export type PatientFilterOptions = ReturnType<typeof usePatientFilterOptions>
