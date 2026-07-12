import { api } from '../lib/api'
import type { Doctor } from '../types'

export interface CreateDoctorDto {
  name: string; degreeName?: string; active?: boolean
}

export const doctorService = {
  getAll: async (): Promise<Doctor[]> => {
    const { data } = await api.get('/doctors')
    return Array.isArray(data) ? data : []
  },
  create: async (dto: CreateDoctorDto): Promise<Doctor> => {
    const { data } = await api.post('/doctors', dto); return data
  },
  update: async (id: number, dto: Partial<CreateDoctorDto>): Promise<Doctor> => {
    const { data } = await api.patch(`/doctors/${id}`, dto); return data
  },
  delete: async (id: number): Promise<void> => { await api.delete(`/doctors/${id}`) },
  getArchived: async (): Promise<Doctor[]> => {
    const { data } = await api.get('/doctors/archived')
    return Array.isArray(data) ? data : []
  },
  restore: async (id: number): Promise<Doctor> => {
    const { data } = await api.patch(`/doctors/${id}/restore`)
    return data
  },
  permanentDelete: async (id: number): Promise<void> => { await api.delete(`/doctors/${id}/permanent`) },
}
