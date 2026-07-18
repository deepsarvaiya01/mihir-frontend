import { api } from '../lib/api'

export interface Signature {
  id: number
  name: string
  degreeName?: string | null
  imageUrl: string
  isActive: boolean
  createdAt: string
  deletedAt?: string | null
}

export interface CreateSignatureDto {
  name: string
  degreeName?: string
  imageData: string
}

export interface UpdateSignatureDto {
  name?: string
  degreeName?: string
  imageData?: string
}

export const signatureService = {
  getAll: async (): Promise<Signature[]> => {
    const { data } = await api.get('/signatures')
    return Array.isArray(data) ? data : []
  },

  getActive: async (): Promise<Signature[]> => {
    const { data } = await api.get('/signatures/active')
    return Array.isArray(data) ? data : []
  },

  create: async (dto: CreateSignatureDto): Promise<Signature> => {
    const { data } = await api.post('/signatures', dto)
    return data
  },

  update: async (id: number, dto: UpdateSignatureDto): Promise<Signature> => {
    const { data } = await api.patch(`/signatures/${id}`, dto)
    return data
  },

  activate: async (id: number): Promise<Signature> => {
    const { data } = await api.patch(`/signatures/${id}/activate`)
    return data
  },

  deactivate: async (id: number): Promise<Signature> => {
    const { data } = await api.patch(`/signatures/${id}/deactivate`)
    return data
  },

  deactivateAll: async (): Promise<void> => {
    await api.patch('/signatures/deactivate-all')
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/signatures/${id}`)
  },
  getArchived: async (): Promise<Signature[]> => {
    const { data } = await api.get('/signatures/archived')
    return Array.isArray(data) ? data : []
  },
  restore: async (id: number): Promise<Signature> => {
    const { data } = await api.patch(`/signatures/${id}/restore`)
    return data
  },
  permanentDelete: async (id: number): Promise<void> => {
    await api.delete(`/signatures/${id}/permanent`)
  },
}
