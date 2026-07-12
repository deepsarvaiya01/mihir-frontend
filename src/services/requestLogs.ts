import { api } from '../lib/api'

export interface RequestLog {
  id: number
  method: string
  path: string
  statusCode: number
  durationMs: number | null
  userId: number | null
  errorMessage: string | null
  createdAt: string
}

export interface RequestLogsResponse {
  data: RequestLog[]
  total: number
}

export const requestLogService = {
  getAll: async (params: {
    page?: number
    limit?: number
    method?: string
    status?: 'success' | 'error'
    search?: string
  }): Promise<RequestLogsResponse> => {
    const { data } = await api.get('/request-logs', { params })
    return data
  },
}
