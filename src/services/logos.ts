import { api } from '../lib/api'
import type { Logo } from '../types'

export const logoService = {
  getAll: async (): Promise<Logo[]> => {
    const { data } = await api.get('/logos')
    return Array.isArray(data) ? data : []
  },

  getActive: async (): Promise<Logo | null> => {
    const { data } = await api.get('/logos/active')
    return data ?? null
  },

  create: async (payload: { name: string; imageData: string }): Promise<Logo> => {
    const { data } = await api.post('/logos', payload)
    return data
  },

  activate: async (id: number): Promise<Logo> => {
    const { data } = await api.patch(`/logos/${id}/activate`)
    return data
  },

  deactivateAll: async (): Promise<{ message: string }> => {
    const { data } = await api.patch('/logos/deactivate-all')
    return data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/logos/${id}`)
  },
  getArchived: async (): Promise<Logo[]> => {
    const { data } = await api.get('/logos/archived')
    return Array.isArray(data) ? data : []
  },
  restore: async (id: number): Promise<Logo> => {
    const { data } = await api.patch(`/logos/${id}/restore`)
    return data
  },
  permanentDelete: async (id: number): Promise<void> => {
    await api.delete(`/logos/${id}/permanent`)
  },
}
