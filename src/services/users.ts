import { api } from '../lib/api'
import type { UserRole } from '../types'

export interface UserRecord {
  id: number
  name: string
  email: string
  role: UserRole
}

export interface CreateUserDto {
  name: string
  email: string
  password: string
  role: UserRole
}

export interface UpdateUserDto {
  name?: string
  email?: string
  password?: string
  role?: UserRole
}

export const userService = {
  getAll: async (): Promise<UserRecord[]> => {
    const { data } = await api.get('/users')
    return data
  },

  create: async (dto: CreateUserDto): Promise<UserRecord> => {
    const { data } = await api.post('/users', dto)
    return data
  },

  update: async (id: number, dto: UpdateUserDto): Promise<UserRecord> => {
    const { data } = await api.patch(`/users/${id}`, dto)
    return data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/users/${id}`)
  },
}
