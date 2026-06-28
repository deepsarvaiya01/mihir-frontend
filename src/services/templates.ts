import { api } from '../lib/api'
import type { TestTemplate } from '../types'

export const templateService = {
  getAll: async (): Promise<TestTemplate[]> => {
    const { data } = await api.get('/tests/templates')
    if (Array.isArray(data)) return data
    if (Array.isArray(data.templates)) return data.templates
    return []
  },

  getById: async (id: number): Promise<TestTemplate> => {
    const { data } = await api.get(`/tests/templates/${id}`)
    return data
  },

  create: async (payload: {
    name: string
    code: string
    amount?: number
    summaryTitle?: string
    summary?: string
    b2bPrices?: Array<{ b2bLabId: number; amount: number }>
  }): Promise<TestTemplate> => {
    const { data } = await api.post('/tests/templates', payload)
    return data
  },

  update: async (id: number, payload: {
    name?: string
    code?: string
    active?: boolean
    amount?: number
    summaryTitle?: string
    summary?: string
    b2bPrices?: Array<{ b2bLabId: number; amount: number }>
  }): Promise<TestTemplate> => {
    const { data } = await api.patch(`/tests/templates/${id}`, payload)
    return data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/tests/templates/${id}`)
  },

  updateField: async (
    templateId: number,
    fieldId: number,
    payload: {
      fieldName: string
      fieldType: string
      required: boolean
      unit?: string
      options?: string[]
      formulaJson?: string
      referenceRange?: string
      isSectionHeader?: boolean
    }
  ): Promise<TestTemplate> => {
    const { data } = await api.patch(`/tests/templates/${templateId}/fields/${fieldId}`, payload)
    return data
  },

  deleteField: async (templateId: number, fieldId: number): Promise<void> => {
    await api.delete(`/tests/templates/${templateId}/fields/${fieldId}`)
  },

  addField: async (
    templateId: number,
    payload: {
      fieldName: string
      fieldType: string
      required: boolean
      unit?: string
      options?: string[]
      formulaJson?: string
      referenceRange?: string
      isSectionHeader?: boolean
    }
  ): Promise<TestTemplate> => {
    const { data } = await api.post(`/tests/templates/${templateId}/fields`, payload)
    return data
  },

  getArchived: async () => {
    const { data } = await api.get('/templates/archived')
    return Array.isArray(data) ? data : []
  },

  restore: async (id: number) => {
    const { data } = await api.patch(`/templates/${id}/restore`)
    return data
  },

  permanentDelete: async (id: number): Promise<void> => {
    await api.delete(`/templates/${id}/permanent`)
  },
}
