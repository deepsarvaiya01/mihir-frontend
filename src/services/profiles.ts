import { api } from '../lib/api'
import type { TestProfile } from '../types'

export interface CreateProfileDto {
  name: string
  code: string
  amount: number
  active?: boolean
  templateIds: number[]
}

export const profileService = {
  getAll: async (): Promise<TestProfile[]> => {
    const { data } = await api.get('/profiles')
    return Array.isArray(data) ? data : []
  },

  getById: async (id: number): Promise<TestProfile> => {
    const { data } = await api.get(`/profiles/${id}`)
    return data
  },

  create: async (dto: CreateProfileDto): Promise<TestProfile> => {
    const { data } = await api.post('/profiles', dto)
    return data
  },

  update: async (id: number, dto: Partial<CreateProfileDto>): Promise<TestProfile> => {
    const { data } = await api.patch(`/profiles/${id}`, dto)
    return data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/profiles/${id}`)
  },

  getArchived: async (): Promise<TestProfile[]> => {
    const { data } = await api.get('/profiles/archived')
    return Array.isArray(data) ? data : []
  },

  restore: async (id: number): Promise<TestProfile> => {
    const { data } = await api.patch(`/profiles/${id}/restore`)
    return data
  },

  permanentDelete: async (id: number): Promise<void> => {
    await api.delete(`/profiles/${id}/permanent`)
  },
}
