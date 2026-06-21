import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  UserCog,
  Mail,
  Shield,
  Pencil,
  Trash2,
} from 'lucide-react'

import { Header } from '../components/layout/Header'

import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { Modal, ConfirmModal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { PageLoader } from '../components/ui/Spinner'

import {
  userService,
  type UserRecord,
  type CreateUserDto,
  type UpdateUserDto,
} from '../services/users'

import { useAuthStore } from '../store/authStore'
import { toast } from 'sonner'
import type { UserRole } from '../types'

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  LAB_USER: 'Lab User',
}

const emptyCreate: CreateUserDto = {
  name: '',
  email: '',
  password: '',
  role: 'LAB_USER',
}

export default function UsersPage() {
  const qc = useQueryClient()

  const { user: currentUser } = useAuthStore()

  const [createOpen, setCreateOpen] =
    useState(false)

  const [editUser, setEditUser] =
    useState<UserRecord | null>(null)

  const [deleteUser, setDeleteUser] =
    useState<UserRecord | null>(null)

  const [createForm, setCreateForm] =
    useState<CreateUserDto>(emptyCreate)

  const [editForm, setEditForm] =
    useState<
      UpdateUserDto & { password: string }
    >({
      name: '',
      email: '',
      password: '',
      role: 'LAB_USER',
    })

  const { data: users = [], isLoading } =
    useQuery({
      queryKey: ['users'],
      queryFn: userService.getAll,
    })

  const create = useMutation({
    mutationFn: userService.create,

    onSuccess: (user) => {
      qc.invalidateQueries({
        queryKey: ['users'],
      })

      setCreateForm(emptyCreate)
      setCreateOpen(false)

      toast.success(
        `User "${user.name}" created successfully`
      )
    },

    onError: () =>
      toast.error('Failed to create user'),
  })

  const update = useMutation({
    mutationFn: ({
      id,
      dto,
    }: {
      id: number
      dto: UpdateUserDto
    }) => userService.update(id, dto),

    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['users'],
      })

      setEditUser(null)

      toast.success(
        'User updated successfully'
      )
    },
  })

  const remove = useMutation({
    mutationFn: (id: number) =>
      userService.delete(id),

    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['users'],
      })

      setDeleteUser(null)

      toast.success('User deleted')
    },
  })

  const openEdit = (u: UserRecord) => {
    setEditUser(u)

    setEditForm({
      name: u.name,
      email: u.email,
      password: '',
      role: u.role,
    })
  }

  const handleUpdate = () => {
    if (!editUser) return

    const dto: UpdateUserDto = {
      name: editForm.name,
      email: editForm.email,
      role: editForm.role,
    }

    if (editForm.password) {
      dto.password = editForm.password
    }

    update.mutate({
      id: editUser.id,
      dto,
    })
  }

  return (
    <div className="w-full overflow-x-hidden">
      {/* HEADER */}
      <Header
  title="User Management"
  subtitle="Manage system users and roles"
  action={
    <Button
      icon={<Plus className="h-4 w-4" />}
      onClick={() => setCreateOpen(true)}
      className="w-auto sm:w-auto"
    >
      New User
    </Button>
  }
/>

      <div className="space-y-6 p-4 sm:p-6">
        {/* SUMMARY */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            {
              label: 'Total Users',
              value: users.length,
              icon: (
                <UserCog className="h-5 w-5" />
              ),
              bg: 'bg-blue-50',
              text: 'text-blue-600',
            },

            {
              label: 'Admins',
              value: users.filter(
                (u) =>
                  u.role === 'SUPER_ADMIN'
              ).length,
              icon: (
                <Shield className="h-5 w-5" />
              ),
              bg: 'bg-red-50',
              text: 'text-red-600',
            },

            {
              label: 'Lab Users',
              value: users.filter(
                (u) =>
                  u.role === 'LAB_USER'
              ).length,
              icon: (
                <UserCog className="h-5 w-5" />
              ),
              bg: 'bg-emerald-50',
              text: 'text-emerald-600',
            },

            {
              label: 'Active',
              value: users.length,
              icon: (
                <UserCog className="h-5 w-5" />
              ),
              bg: 'bg-blue-50',
              text: 'text-blue-600',
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4"
            >
              <div
                className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${card.bg} ${card.text}`}
              >
                {card.icon}
              </div>

              <p className="text-xl font-bold text-gray-900 sm:text-2xl">
                {card.value}
              </p>

              <p className="text-sm text-gray-500">
                {card.label}
              </p>
            </div>
          ))}
        </div>

        {/* CONTENT */}
        {isLoading ? (
          <PageLoader />
        ) : users.length === 0 ? (
          <EmptyState
            icon={<UserCog className="h-12 w-12" />}
            title="No users found"
            description="Create your first user"
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 bg-gray-50 px-4 py-4 sm:px-6">
              <h3 className="text-sm font-semibold text-gray-700">
                All Users ({users.length})
              </h3>
            </div>

            {/* DESKTOP TABLE */}
            <div className="hidden w-full overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-6 py-4 text-left">
                      User
                    </th>

                    <th className="px-6 py-4 text-left">
                      Email
                    </th>

                    <th className="px-6 py-4 text-left">
                      Role
                    </th>

                    <th className="px-6 py-4 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-gray-100"
                    >
                      <td className="px-6 py-4 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 font-bold text-white">
                            {u.name
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <p className="font-semibold">
                              {u.name}
                            </p>

                            <p className="text-xs text-gray-400">
                              ID #{u.id}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 align-middle">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Mail className="h-4 w-4" />
                          {u.email}
                        </div>
                      </td>

                      <td className="px-6 py-4 align-middle">
                        <Badge
                          variant={
                            u.role ===
                            'SUPER_ADMIN'
                              ? 'danger'
                              : 'info'
                          }
                          dot
                        >
                          {
                            ROLE_LABELS[
                              u.role
                            ]
                          }
                        </Badge>
                      </td>

                      <td className="px-6 py-4 align-middle">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={
                              <Pencil className="h-4 w-4" />
                            }
                            onClick={() =>
                              openEdit(u)
                            }
                          >
                            Edit
                          </Button>

                          {u.id !==
                            currentUser?.id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={
                                <Trash2 className="h-4 w-4" />
                              }
                              className="text-red-500"
                              onClick={() =>
                                setDeleteUser(
                                  u
                                )
                              }
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARDS */}
            <div className="space-y-4 p-4 md:hidden w-full">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="rounded-2xl border border-gray-200 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 font-bold text-white">
                      {u.name
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-gray-900">
                        {u.name}
                      </h4>

                      <p className="text-xs text-gray-400">
                        ID #{u.id}
                      </p>

                      <div className="mt-2 flex items-center gap-2 break-all text-sm text-gray-600">
                        <Mail className="h-4 w-4 shrink-0" />
                        {u.email}
                      </div>

                      <div className="mt-3">
                        <Badge
                          variant={
                            u.role ===
                            'SUPER_ADMIN'
                              ? 'danger'
                              : 'info'
                          }
                          dot
                        >
                          {
                            ROLE_LABELS[
                              u.role
                            ]
                          }
                        </Badge>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="flex-1"
                          onClick={() =>
                            openEdit(u)
                          }
                        >
                          Edit
                        </Button>

                        {u.id !==
                          currentUser?.id && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="flex-1 text-red-500"
                            onClick={() =>
                              setDeleteUser(
                                u
                              )
                            }
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      <Modal
        open={createOpen}
        onClose={() =>
          setCreateOpen(false)
        }
        title="Create User"
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={createForm.name}
            onChange={(e) =>
              setCreateForm((p) => ({
                ...p,
                name: e.target.value,
              }))
            }
          />

          <Input
            label="Email"
            type="email"
            value={createForm.email}
            onChange={(e) =>
              setCreateForm((p) => ({
                ...p,
                email: e.target.value,
              }))
            }
          />

          <Input
            label="Password"
            type="password"
            value={createForm.password}
            onChange={(e) =>
              setCreateForm((p) => ({
                ...p,
                password:
                  e.target.value,
              }))
            }
          />

          <Select
            label="Role"
            value={createForm.role}
            onChange={(e) =>
              setCreateForm((p) => ({
                ...p,
                role:
                  e.target
                    .value as UserRole,
              }))
            }
          >
            <option value="LAB_USER">
              Lab User
            </option>

            <option value="SUPER_ADMIN">
              Super Admin
            </option>
          </Select>

          <Button
            className="w-full"
            loading={create.isPending}
            onClick={() =>
              create.mutate(createForm)
            }
          >
            Create User
          </Button>
        </div>
      </Modal>

      {/* EDIT MODAL */}
      <Modal
        open={!!editUser}
        onClose={() =>
          setEditUser(null)
        }
        title="Edit User"
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={editForm.name || ''}
            onChange={(e) =>
              setEditForm((p) => ({
                ...p,
                name: e.target.value,
              }))
            }
          />

          <Input
            label="Email"
            value={editForm.email || ''}
            onChange={(e) =>
              setEditForm((p) => ({
                ...p,
                email: e.target.value,
              }))
            }
          />

          <Button
            className="w-full"
            loading={update.isPending}
            onClick={handleUpdate}
          >
            Save Changes
          </Button>
        </div>
      </Modal>

      {/* DELETE */}
      <ConfirmModal
        open={!!deleteUser}
        onClose={() =>
          setDeleteUser(null)
        }
        onConfirm={() =>
          deleteUser &&
          remove.mutate(deleteUser.id)
        }
        title="Delete User"
        message={`Delete "${deleteUser?.name}"?`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  )
}
