import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, UserCog, Mail, Shield, Pencil, Trash2, Users } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { Modal, ConfirmModal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { PageLoader } from '../components/ui/Spinner'
import { PageContent } from '../components/ui/PageContent'
import { StatSummaryGrid } from '../components/ui/StatSummaryGrid'
import { DataTable, DataTableHead, DataTableTh, DataTableBody, DataTableRow, DataTableTd } from '../components/ui/DataTable'
import { userService, type UserRecord, type CreateUserDto, type UpdateUserDto } from '../services/users'
import { useAuthStore } from '../store/authStore'
import { toast } from 'sonner'
import type { UserRole } from '../types'

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  LAB_USER: 'Lab User',
}

const emptyCreate: CreateUserDto = { name: '', email: '', password: '', role: 'LAB_USER' }

export default function UsersPage() {
  const qc = useQueryClient()
  const { user: currentUser } = useAuthStore()

  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<UserRecord | null>(null)
  const [deleteUser, setDeleteUser] = useState<UserRecord | null>(null)
  const [createForm, setCreateForm] = useState<CreateUserDto>(emptyCreate)
  const [editForm, setEditForm] = useState<UpdateUserDto & { password: string }>({ name: '', email: '', password: '', role: 'LAB_USER' })

  const { data: users = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: userService.getAll })

  const create = useMutation({
    mutationFn: userService.create,
    onSuccess: (user) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setCreateForm(emptyCreate)
      setCreateOpen(false)
      toast.success(`User "${user.name}" created`)
    },
    onError: () => toast.error('Failed to create user'),
  })

  const update = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: UpdateUserDto }) => userService.update(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setEditUser(null)
      toast.success('User updated')
    },
  })

  const remove = useMutation({
    mutationFn: (id: number) => userService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setDeleteUser(null)
      toast.success('User deleted')
    },
  })

  const openEdit = (u: UserRecord) => {
    setEditUser(u)
    setEditForm({ name: u.name, email: u.email, password: '', role: u.role })
  }

  const handleUpdate = () => {
    if (!editUser) return
    const dto: UpdateUserDto = { name: editForm.name, email: editForm.email, role: editForm.role }
    if (editForm.password) dto.password = editForm.password
    update.mutate({ id: editUser.id, dto })
  }

  const admins   = users.filter(u => u.role === 'SUPER_ADMIN').length
  const labUsers = users.filter(u => u.role === 'LAB_USER').length

  return (
    <div>
      <Header
        title="User Management"
        subtitle="Manage system users and access roles"
        action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>New User</Button>}
      />

      <PageContent className="space-y-6">
        <StatSummaryGrid
          columns={3}
          stats={[
            { title: 'Total Users', value: users.length, icon: <Users className="h-5 w-5" />, color: 'blue' },
            { title: 'Super Admins', value: admins, icon: <Shield className="h-5 w-5" />, color: 'violet' },
            { title: 'Lab Users', value: labUsers, icon: <UserCog className="h-5 w-5" />, color: 'emerald' },
          ]}
        />

        {isLoading ? (
          <PageLoader />
        ) : users.length === 0 ? (
          <EmptyState icon={<UserCog className="h-12 w-12" />} title="No users found" description="Create your first user to get started" />
        ) : (
          <DataTable title="All Users" count={users.length}>
            <DataTableHead>
              <DataTableTh>User</DataTableTh>
              <DataTableTh>Email</DataTableTh>
              <DataTableTh>Role</DataTableTh>
              <DataTableTh align="right">Actions</DataTableTh>
            </DataTableHead>
            <DataTableBody>
              {users.map(u => (
                <DataTableRow key={u.id}>
                  <DataTableTd>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{u.name}</p>
                        <p className="text-xs text-gray-400">ID #{u.id}</p>
                      </div>
                    </div>
                  </DataTableTd>
                  <DataTableTd>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      {u.email}
                    </div>
                  </DataTableTd>
                  <DataTableTd>
                    <Badge variant={u.role === 'SUPER_ADMIN' ? 'danger' : 'info'} dot>
                      {ROLE_LABELS[u.role]}
                    </Badge>
                  </DataTableTd>
                  <DataTableTd align="right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openEdit(u)}>Edit</Button>
                      {u.id !== currentUser?.id && (
                        <Button size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />}
                          className="text-red-500 hover:bg-red-50" onClick={() => setDeleteUser(u)}>
                          Delete
                        </Button>
                      )}
                    </div>
                  </DataTableTd>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </PageContent>

      {/* Create Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create User" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button loading={create.isPending} onClick={() => create.mutate(createForm)}>Create User</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Full Name" value={createForm.name} onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))} />
          <Input label="Email" type="email" value={createForm.email} onChange={e => setCreateForm(p => ({ ...p, email: e.target.value }))} />
          <Input label="Password" type="password" value={createForm.password} onChange={e => setCreateForm(p => ({ ...p, password: e.target.value }))} />
          <Select label="Role" value={createForm.role} onChange={e => setCreateForm(p => ({ ...p, role: e.target.value as UserRole }))}>
            <option value="LAB_USER">Lab User</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </Select>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Edit User" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button loading={update.isPending} onClick={handleUpdate}>Save Changes</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Full Name" value={editForm.name ?? ''} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
          <Input label="Email" value={editForm.email ?? ''} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} />
          <Input label="New Password" type="password" value={editForm.password} placeholder="Leave blank to keep current"
            onChange={e => setEditForm(p => ({ ...p, password: e.target.value }))} />
          <Select label="Role" value={editForm.role ?? 'LAB_USER'} onChange={e => setEditForm(p => ({ ...p, role: e.target.value as UserRole }))}>
            <option value="LAB_USER">Lab User</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </Select>
        </div>
      </Modal>

      <ConfirmModal open={!!deleteUser} onClose={() => setDeleteUser(null)}
        onConfirm={() => deleteUser && remove.mutate(deleteUser.id)}
        title="Delete User" message={`Delete "${deleteUser?.name}"? This cannot be undone.`}
        confirmLabel="Delete" variant="danger" loading={remove.isPending}
      />
    </div>
  )
}
