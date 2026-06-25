import { api } from '../lib/api'

export interface AppNotification {
  id: number
  type: string
  title: string
  message: string
  orderId: number | null
  createdAt: string
  targetRole: string
}

export const notificationService = {
  getAll: async (limit = 25): Promise<AppNotification[]> => {
    const { data } = await api.get('/notifications', { params: { limit } })
    return Array.isArray(data) ? data : []
  },
}

export function getLastSeenId(): number {
  try { return Number(localStorage.getItem('lab_last_seen_notif_id') ?? '0') } catch { return 0 }
}

export function setLastSeenId(id: number): void {
  try { localStorage.setItem('lab_last_seen_notif_id', String(id)) } catch {}
}
