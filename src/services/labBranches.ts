import { api } from '../lib/api'
import type { LabBranch } from '../types'

export interface CreateLabBranchDto {
  name: string; address?: string; phone?: string; active?: boolean
}

export const labBranchService = {
  getAll: async (): Promise<LabBranch[]> => {
    const { data } = await api.get('/lab-branches')
    return Array.isArray(data) ? data : []
  },
  create: async (dto: CreateLabBranchDto): Promise<LabBranch> => {
    const { data } = await api.post('/lab-branches', dto); return data
  },
  update: async (id: number, dto: Partial<CreateLabBranchDto>): Promise<LabBranch> => {
    const { data } = await api.patch(`/lab-branches/${id}`, dto); return data
  },
  delete: async (id: number): Promise<void> => { await api.delete(`/lab-branches/${id}`) },
  getArchived: async (): Promise<LabBranch[]> => {
    const { data } = await api.get('/lab-branches/archived')
    return Array.isArray(data) ? data : []
  },
  restore: async (id: number): Promise<LabBranch> => {
    const { data } = await api.patch(`/lab-branches/${id}/restore`)
    return data
  },
  permanentDelete: async (id: number): Promise<void> => { await api.delete(`/lab-branches/${id}/permanent`) },
}
