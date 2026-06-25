import { api } from '../lib/api'

export const reportShareService = {
  createToken: async (orderId: number): Promise<{ token: string; expiresAt: string }> => {
    const { data } = await api.post(`/report-shares/${orderId}`)
    return data
  },
}
