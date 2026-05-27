import { api } from '../lib/api'
import type { Patient, PatientHistory } from '../types'

export interface CreatePatientDto {
  fullName: string
  patientCode: string
  age?: number
  dateOfBirth?: string
  gender?: string
  bloodGroup?: string
  email?: string
  phoneNumber?: string
  addressLine?: string
  city?: string
  state?: string
  postalCode?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  isB2b?: boolean
  b2bLabId?: number | null
  labBranchId?: number | null
  doctorName?: string
  reportDate?: string
}

export const patientService = {
  getAll: async (search?: string): Promise<Patient[]> => {
    const { data } = await api.get('/patients', { params: search ? { search } : undefined })
    if (Array.isArray(data)) return data
    if (Array.isArray(data.patients)) return data.patients
    return []
  },

  create: async (payload: CreatePatientDto): Promise<Patient> => {
    const { data } = await api.post('/patients', payload)
    return data
  },

  update: async (id: number, payload: Partial<CreatePatientDto>): Promise<Patient> => {
    const { data } = await api.patch(`/patients/${id}`, payload)
    return data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/patients/${id}`)
  },

  getById: async (id: number): Promise<Patient> => {
    const { data } = await api.get(`/patients/${id}`)
    return data
  },

  getHistory: async (patientId: number): Promise<PatientHistory> => {
    const { data } = await api.get(`/patients/${patientId}/results-history`)
    return data
  },
}
