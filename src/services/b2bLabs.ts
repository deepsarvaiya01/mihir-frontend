import { api } from '../lib/api'
import type { B2bLab } from '../types'

export interface CreateB2bLabDto {
  name: string; contactPerson?: string; phone?: string; email?: string; address?: string; city?: string; active?: boolean
}

export const b2bLabService = {
  getAll: async (): Promise<B2bLab[]> => {
    const { data } = await api.get('/b2b-labs')
    return Array.isArray(data) ? data : []
  },
  create: async (dto: CreateB2bLabDto): Promise<B2bLab> => {
    const { data } = await api.post('/b2b-labs', dto); return data
  },
  update: async (id: number, dto: Partial<CreateB2bLabDto>): Promise<B2bLab> => {
    const { data } = await api.patch(`/b2b-labs/${id}`, dto); return data
  },
  delete: async (id: number): Promise<void> => { await api.delete(`/b2b-labs/${id}`) },
  getArchived: async (): Promise<B2bLab[]> => {
    const { data } = await api.get('/b2b-labs/archived')
    return Array.isArray(data) ? data : []
  },
  restore: async (id: number): Promise<B2bLab> => {
    const { data } = await api.patch(`/b2b-labs/${id}/restore`)
    return data
  },
  permanentDelete: async (id: number): Promise<void> => { await api.delete(`/b2b-labs/${id}/permanent`) },
}
