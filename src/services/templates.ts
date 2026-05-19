import { api } from '../lib/api'
import type { TestTemplate } from '../types'

export const templateService = {
  getAll: async (): Promise<TestTemplate[]> => {
    const { data } = await api.get('/tests/templates')
    if (Array.isArray(data)) return data
    if (Array.isArray(data.templates)) return data.templates
    return []
  },

  create: async (payload: { name: string; code: string }): Promise<TestTemplate> => {
    const { data } = await api.post('/tests/templates', payload)
    return data
  },

  update: async (id: number, payload: { name?: string; active?: boolean }): Promise<TestTemplate> => {
    const { data } = await api.patch(`/tests/templates/${id}`, payload)
    return data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/tests/templates/${id}`)
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
    }
  ): Promise<TestTemplate> => {
    const { data } = await api.post(`/tests/templates/${templateId}/fields`, payload)
    return data
  },
}
