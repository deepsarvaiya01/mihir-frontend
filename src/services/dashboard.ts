import { api } from '../lib/api'
import type { DashboardSummary } from '../types'

export const dashboardService = {
  getSummary: async (): Promise<DashboardSummary> => {
    const { data } = await api.get('/dashboard/summary')
    return data
  },
  getTrends: async (): Promise<{ month: string; orders: number; revenue: number; approved: number }[]> => {
    const { data } = await api.get('/dashboard/trends')
    return Array.isArray(data) ? data : []
  },
}
