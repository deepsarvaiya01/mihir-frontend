import { api } from '../lib/api'
import type { LabSettings } from '../types'

export const labSettingsService = {
  getAll: async (): Promise<LabSettings> => {
    const { data } = await api.get('/lab-settings')
    return data
  },

  update: async (settings: Partial<LabSettings>): Promise<LabSettings> => {
    const { data } = await api.put('/lab-settings', settings)
    return data
  },
}
