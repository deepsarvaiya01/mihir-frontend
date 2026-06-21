import { api } from '../lib/api'
import type { Order, OrderFormData, OrderResult } from '../types'

export interface SubmitResultsDto {
  values: {
    fieldId: number
    textValue?: string
    numberValue?: number
    booleanValue?: boolean
    dateValue?: string
  }[]
  /** Base64 data URI of an attached PDF (optional) */
  attachmentBase64?: string
  attachmentName?: string
  /** When true: save as draft (IN_PROGRESS), skip required-field validation */
  isDraft?: boolean
}

export const orderService = {
  getAll: async (): Promise<Order[]> => {
    const { data } = await api.get('/orders')
    if (Array.isArray(data)) return data
    if (Array.isArray(data.orders)) return data.orders
    return []
  },

  create: async (payload: { patientId: number; templateId: number }): Promise<Order> => {
    const { data } = await api.post('/orders', payload)
    return data
  },

  getForm: async (orderId: number): Promise<OrderFormData> => {
    const { data } = await api.get(`/orders/${orderId}/form`)
    return data
  },

  getResults: async (orderId: number): Promise<OrderResult> => {
    const { data } = await api.get(`/orders/${orderId}/results`)
    return data
  },

  submitResults: async (orderId: number, payload: SubmitResultsDto): Promise<Order> => {
    const { data } = await api.post(`/orders/${orderId}/results`, payload)
    return data
  },

  approve: async (orderId: number): Promise<Order> => {
    const { data } = await api.post(`/orders/${orderId}/approve`)
    return data
  },

  reject: async (orderId: number): Promise<Order> => {
    const { data } = await api.post(`/orders/${orderId}/reject`)
    return data
  },

  reopen: async (orderId: number): Promise<Order> => {
    const { data } = await api.patch(`/orders/${orderId}/reopen`)
    return data
  },

  createBatch: async (payload: {
    patientId: number
    orders: Array<{ templateId: number; isEmergency?: boolean }>
    discount?: number
    paymentStatus?: 'PENDING' | 'PAID' | 'PARTIAL'
    paymentType?: 'CASH' | 'CHEQUE' | 'ONLINE'
  }): Promise<{ receiptNumber: string; orders: Order[] }> => {
    const { data } = await api.post('/orders/batch', payload)
    return data
  },

  updatePayment: async (orderId: number, payload: {
    paymentStatus?: 'PENDING' | 'PAID' | 'PARTIAL'
    paymentType?: 'CASH' | 'CHEQUE' | 'ONLINE' | null
    amount?: number
    discount?: number
    netAmount?: number
  }): Promise<Order> => {
    const { data } = await api.patch(`/orders/${orderId}/payment`, payload)
    return data
  },

  revert: async (orderId: number, remark: string): Promise<Order> => {
    const { data } = await api.patch(`/orders/revert/${orderId}`, { remark })
    return data
  },

  batchSubmit: async (receiptNumber: string): Promise<{ count: number; receiptNumber: string }> => {
    const { data } = await api.post('/orders/batch-submit', { receiptNumber })
    return data
  },

  delete: async (orderId: number): Promise<void> => {
    await api.delete(`/orders/${orderId}`)
  },
}
