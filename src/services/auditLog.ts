import { api } from '../lib/api'

export interface AuditLog {
  id: number
  userId: number | null
  userName: string
  action: string
  entityType: string | null
  entityId: number | null
  details: string | null
  createdAt: string
}

export interface AuditLogsResponse {
  data: AuditLog[]
  total: number
}

export const auditLogService = {
  getAll: async (params: {
    page?: number
    limit?: number
    action?: string
    entityType?: string
  }): Promise<AuditLogsResponse> => {
    const { data } = await api.get('/audit-logs', { params })
    return data
  },
}
