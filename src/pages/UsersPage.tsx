import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, UserCog, Mail, Shield, Pencil, Trash2, Key } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { Modal, ConfirmModal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { PageLoader } from '../components/ui/Spinner'
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

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: userService.getAll,
  })

  const create = useMutation({
    mutationFn: userService.create,
    onSuccess: (user) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] })
      setCreateForm(emptyCreate)
      setCreateOpen(false)
      toast.success(`User "${user.name}" created successfully`)
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create user'),
  })

  const update = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: UpdateUserDto }) => userService.update(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setEditUser(null)
      toast.success('User updated successfully')
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update user'),
  })

  const remove = useMutation({
    mutationFn: (id: number) => userService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] })
      setDeleteUser(null)
      toast.success('User deleted')
    },
    onError: () => toast.error('Failed to delete user'),
  })

  const openEdit = (u: UserRecord) => {
    setEditUser(u)
    setEditForm({ name: u.name, email: u.email, password: '', role: u.role })
  }

  const handleUpdate = () => {
    if (!editUser) return
    const dto: UpdateUserDto = {
      name: editForm.name || undefined,
      email: editForm.email || undefined,
      role: editForm.role,
    }
    if (editForm.password) dto.password = editForm.password
    update.mutate({ id: editUser.id, dto })
  }

  const superAdmins = users.filter(u => u.role === 'SUPER_ADMIN')
  const labUsers = users.filter(u => u.role === 'LAB_USER')

  return (
    <div>
      <Header
        title="User Management"
        subtitle="Manage system users and their access roles"
        action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>New User</Button>}
      />

      <div className="p-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Total Users', value: users.length, bg: 'bg-indigo-50', text: 'text-indigo-600', icon: <UserCog className="h-5 w-5" /> },
            { label: 'Super Admins', value: superAdmins.length, bg: 'bg-rose-50', text: 'text-rose-600', icon: <Shield className="h-5 w-5" /> },
            { label: 'Lab Users', value: labUsers.length, bg: 'bg-emerald-50', text: 'text-emerald-600', icon: <UserCog className="h-5 w-5" /> },
            { label: 'Active', value: users.length, bg: 'bg-blue-50', text: 'text-blue-600', icon: <UserCog className="h-5 w-5" /> },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.bg} ${s.text} mb-3`}>{s.icon}</div>
              <p className="text-2xl font-bold text-slate-900">{s.value}</p>
              <p className="text-sm text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>

        {isLoading ? <PageLoader /> : users.length === 0 ? (
          <EmptyState icon={<UserCog className="h-12 w-12" />} title="No users yet" description="Create the first user to get started"
            action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>Create User</Button>} />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-700">All Users ({users.length})</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">User</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Email</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Role</th>
                  <th className="px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map((u) => (
                  <tr key={u.id} className={`hover:bg-slate-50/50 transition-colors ${u.id === currentUser?.id ? 'bg-indigo-50/30' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${u.role === 'SUPER_ADMIN' ? 'bg-rose-500' : 'bg-indigo-500'}`}>
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">
                            {u.name}
                            {u.id === currentUser?.id && <span className="ml-2 text-xs text-indigo-500">(you)</span>}
                          </p>
                          <p className="text-xs text-slate-400">ID #{u.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                        {u.email}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={u.role === 'SUPER_ADMIN' ? 'danger' : 'info'} dot>
                        {ROLE_LABELS[u.role]}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openEdit(u)}>Edit</Button>
                        {u.id !== currentUser?.id && (
                          <Button size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5 text-rose-500" />}
                            className="text-rose-500 hover:bg-rose-50"
                            onClick={() => setDeleteUser(u)}>
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
        )}
      </div>

      {/* Create User Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create New User"
        subtitle="Add a new user to the system" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button loading={create.isPending} onClick={() => create.mutate(createForm)}>Create User</Button>
          </>
        }>
        <div className="space-y-4">
          <Input label="Full Name" placeholder="Dr. John Smith" value={createForm.name}
            onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))} required />
          <Input label="Email Address" type="email" placeholder="user@lab.com" value={createForm.email}
            onChange={e => setCreateForm(p => ({ ...p, email: e.target.value }))} required />
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Password</label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="password" placeholder="Minimum 6 characters" value={createForm.password}
                onChange={e => setCreateForm(p => ({ ...p, password: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition-all hover:border-indigo-300 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100" />
            </div>
          </div>
          <Select label="Role" value={createForm.role} onChange={e => setCreateForm(p => ({ ...p, role: e.target.value as UserRole }))}>
            <option value="LAB_USER">Lab User</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </Select>
          <div className={`rounded-xl p-3 text-xs ${createForm.role === 'SUPER_ADMIN' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
            {createForm.role === 'SUPER_ADMIN'
              ? 'Super Admins can manage templates, review approvals, create users, and view all analytics.'
              : 'Lab Users can manage patients, create orders, enter results, and view patient history.'}
          </div>
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Edit User"
        subtitle={`Editing ${editUser?.name ?? ''}`} size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button loading={update.isPending} onClick={handleUpdate}>Save Changes</Button>
          </>
        }>
        <div className="space-y-4">
          <Input label="Full Name" value={editForm.name ?? ''} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
          <Input label="Email Address" type="email" value={editForm.email ?? ''} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} />
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">New Password <span className="normal-case text-slate-400">(leave blank to keep current)</span></label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="password" placeholder="Enter new password to change" value={editForm.password ?? ''}
                onChange={e => setEditForm(p => ({ ...p, password: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition-all hover:border-indigo-300 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100" />
            </div>
          </div>
          <Select label="Role" value={editForm.role ?? 'LAB_USER'} onChange={e => setEditForm(p => ({ ...p, role: e.target.value as UserRole }))}>
            <option value="LAB_USER">Lab User</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </Select>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal
        open={!!deleteUser} onClose={() => setDeleteUser(null)}
        onConfirm={() => deleteUser && remove.mutate(deleteUser.id)}
        title="Delete User"
        message={`Are you sure you want to delete "${deleteUser?.name}"? This action cannot be undone.`}
        confirmLabel="Delete User" variant="danger" loading={remove.isPending}
      />
    </div>
  )
}
