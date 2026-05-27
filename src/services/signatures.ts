import { api } from '../lib/api'

export interface Signature {
  id: number
  name: string
  imageData: string
  isActive: boolean
  createdAt: string
}

export interface CreateSignatureDto {
  name: string
  imageData: string
}

export const signatureService = {
  getAll: async (): Promise<Signature[]> => {
    const { data } = await api.get('/signatures')
    return Array.isArray(data) ? data : []
  },

  getActive: async (): Promise<Signature | null> => {
    const { data } = await api.get('/signatures/active')
    return data ?? null
  },

  create: async (dto: CreateSignatureDto): Promise<Signature> => {
    const { data } = await api.post('/signatures', dto)
    return data
  },

  activate: async (id: number): Promise<Signature> => {
    const { data } = await api.patch(`/signatures/${id}/activate`)
    return data
  },

  deactivateAll: async (): Promise<void> => {
    await api.patch('/signatures/deactivate-all')
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/signatures/${id}`)
  },
}
