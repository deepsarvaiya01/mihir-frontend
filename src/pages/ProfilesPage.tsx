import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ListTree, Pencil, Trash2, ToggleLeft, ToggleRight, Archive, RotateCcw, Search } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { Modal, ConfirmModal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { PageLoader } from '../components/ui/Spinner'
import { PageContent } from '../components/ui/PageContent'
import { StatSummaryGrid } from '../components/ui/StatSummaryGrid'
import { DataTable, DataTableHead, DataTableTh, DataTableBody, DataTableRow, DataTableTd } from '../components/ui/DataTable'
import { profileService, type CreateProfileDto } from '../services/profiles'
import { templateService } from '../services/templates'
import type { TestProfile } from '../types'
import { toast } from 'sonner'
import { toastError } from '../lib/errors'
import { toTitleCase } from '../lib/utils'

const emptyForm: CreateProfileDto = { name: '', code: '', amount: 0, active: true, templateIds: [] }

function ProfileForm({
  form,
  setForm,
}: {
  form: CreateProfileDto
  setForm: React.Dispatch<React.SetStateAction<CreateProfileDto>>
}) {
  const [search, setSearch] = useState('')
  const { data: templates = [] } = useQuery({ queryKey: ['templates'], queryFn: templateService.getAll })
  const activeTemplates = templates.filter(t => t.active)
  const filtered = activeTemplates.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.code.toLowerCase().includes(search.toLowerCase()))

  const toggleTemplate = (id: number) =>
    setForm(p => ({
      ...p,
      templateIds: p.templateIds.includes(id) ? p.templateIds.filter(t => t !== id) : [...p.templateIds, id],
    }))

  const selectedTemplates = activeTemplates.filter(t => form.templateIds.includes(t.id))
  const listTotal = selectedTemplates.reduce((s, t) => s + Number(t.amount), 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Profile Name"
          placeholder="e.g. Full Body Checkup"
          value={form.name}
          onChange={e => setForm(p => ({ ...p, name: toTitleCase(e.target.value) }))}
          required
        />
        <Input
          label="Profile Code"
          placeholder="e.g. FBC-PKG"
          value={form.code}
          onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
          required
        />
      </div>

      <Input
        label="Package Price (₹)"
        type="number"
        placeholder="0.00"
        value={form.amount || ''}
        onChange={e => setForm(p => ({ ...p, amount: Number(e.target.value) || 0 }))}
        hint={listTotal > 0 ? `Sum of selected tests' own prices: ₹${listTotal.toLocaleString()}` : undefined}
        required
      />

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Tests in this Profile <span className="font-normal text-gray-400">({form.templateIds.length} selected)</span>
          </label>
        </div>
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tests…"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
        </div>
        <div className="max-h-60 space-y-1 overflow-y-auto rounded-xl border border-gray-200 p-2 dark:border-gray-700">
          {filtered.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">No tests found</p>
          ) : filtered.map(t => {
            const checked = form.templateIds.includes(t.id)
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTemplate(t.id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  checked ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${
                    checked ? 'border-blue-600 bg-blue-600' : 'border-gray-300 dark:border-gray-500'
                  }`}>
                    {checked && <span className="h-1.5 w-1.5 rounded-sm bg-white" />}
                  </span>
                  <span className="truncate font-medium text-gray-700 dark:text-gray-200">{t.name}</span>
                  <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-400 dark:bg-gray-700">{t.code}</span>
                </div>
                <span className="shrink-0 text-xs text-gray-400">₹{Number(t.amount).toLocaleString()}</span>
              </button>
            )
          })}
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-3">
        <button
          type="button"
          onClick={() => setForm(p => ({ ...p, active: !p.active }))}
          className="text-gray-400 dark:text-gray-500 hover:text-blue-600 transition-colors"
        >
          {form.active
            ? <ToggleRight className="h-6 w-6 text-blue-600" />
            : <ToggleLeft className="h-6 w-6" />
          }
        </button>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Active (selectable in patient/order creation)</span>
      </label>
    </div>
  )
}

export default function ProfilesPage() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editProfile, setEditProfile] = useState<TestProfile | null>(null)
  const [deleteProfile, setDeleteProfile] = useState<TestProfile | null>(null)
  const [createForm, setCreateForm] = useState<CreateProfileDto>(emptyForm)
  const [editForm, setEditForm] = useState<CreateProfileDto>(emptyForm)
  const [showArchived, setShowArchived] = useState(false)
  const [permDeleteProfile, setPermDeleteProfile] = useState<TestProfile | null>(null)

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: profileService.getAll,
  })

  const { data: archivedProfiles = [] } = useQuery({
    queryKey: ['profiles-archived'],
    queryFn: profileService.getArchived,
    enabled: showArchived,
  })

  const createMutation = useMutation({
    mutationFn: profileService.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profiles'] })
      setCreateForm(emptyForm)
      setCreateOpen(false)
      toast.success('Profile created successfully')
    },
    onError: (err) => toastError(err, 'Failed to create profile'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: Partial<CreateProfileDto> }) => profileService.update(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profiles'] })
      setEditProfile(null)
      toast.success('Profile updated successfully')
    },
    onError: (err) => toastError(err, 'Failed to update profile'),
  })

  const deleteMutation = useMutation({
    mutationFn: profileService.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profiles'] })
      qc.invalidateQueries({ queryKey: ['profiles-archived'] })
      setDeleteProfile(null)
      toast.success('Profile archived')
    },
    onError: (err) => toastError(err, 'Failed to archive profile'),
  })

  const restoreMutation = useMutation({
    mutationFn: profileService.restore,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profiles'] })
      qc.invalidateQueries({ queryKey: ['profiles-archived'] })
      toast.success('Profile restored')
    },
    onError: (err) => toastError(err, 'Failed to restore profile'),
  })

  const permanentDeleteMutation = useMutation({
    mutationFn: profileService.permanentDelete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profiles-archived'] })
      setPermDeleteProfile(null)
      toast.success('Profile permanently deleted')
    },
    onError: (err) => toastError(err, 'Failed to permanently delete profile'),
  })

  const openEdit = (profile: TestProfile) => {
    setEditProfile(profile)
    setEditForm({
      name: profile.name, code: profile.code, amount: Number(profile.amount),
      active: profile.active, templateIds: profile.templates.map(t => t.id),
    })
  }

  const validate = (form: CreateProfileDto) => {
    if (!form.name.trim()) { toast.error('Profile name is required'); return false }
    if (!form.code.trim()) { toast.error('Profile code is required'); return false }
    if (form.templateIds.length === 0) { toast.error('Select at least one test for this profile'); return false }
    return true
  }

  const handleCreate = () => {
    if (!validate(createForm)) return
    createMutation.mutate(createForm)
  }

  const handleUpdate = () => {
    if (!editProfile || !validate(editForm)) return
    updateMutation.mutate({ id: editProfile.id, dto: editForm })
  }

  const totalProfiles = profiles.length
  const activeProfiles = profiles.filter(p => p.active).length

  return (
    <div>
      <Header
        title="Profile Management"
        subtitle="Bundle multiple tests into a priced package, selectable at patient/order creation"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon={<Archive className="h-4 w-4" />} onClick={() => setShowArchived(v => !v)}>
              {showArchived ? 'Hide Archived' : 'Archived'}
            </Button>
            {profiles.length > 0 && (
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>New Profile</Button>
            )}
          </div>
        }
      />

      <PageContent className="space-y-6">
        <StatSummaryGrid
          columns={3}
          stats={[
            { title: 'Total Profiles', value: totalProfiles, icon: <ListTree className="h-5 w-5" />, color: 'blue' },
            { title: 'Active Profiles', value: activeProfiles, icon: <ListTree className="h-5 w-5" />, color: 'emerald' },
            { title: 'Inactive Profiles', value: totalProfiles - activeProfiles, icon: <ListTree className="h-5 w-5" />, color: 'gray' },
          ]}
        />

        {isLoading ? <PageLoader /> : profiles.length === 0 ? (
          <EmptyState
            icon={<ListTree className="h-12 w-12" />}
            title="No profiles yet"
            description="Create a test profile to bundle multiple tests under one priced package"
            action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>Create Profile</Button>}
          />
        ) : (
          <DataTable title="All Profiles" count={profiles.length} minWidth="720px">
            <DataTableHead>
              <DataTableTh>Profile</DataTableTh>
              <DataTableTh>Tests Included</DataTableTh>
              <DataTableTh>Price</DataTableTh>
              <DataTableTh>Status</DataTableTh>
              <DataTableTh align="right">Actions</DataTableTh>
            </DataTableHead>
            <DataTableBody>
              {profiles.map((profile) => (
                <DataTableRow key={profile.id}>
                  <DataTableTd>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600">
                        <ListTree className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 dark:text-gray-100">{profile.name}</p>
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-400 dark:bg-gray-700">{profile.code}</span>
                      </div>
                    </div>
                  </DataTableTd>
                  <DataTableTd className="text-gray-600 dark:text-gray-400">
                    <span className="text-xs">{profile.templates.length} test{profile.templates.length !== 1 ? 's' : ''}</span>
                    <p className="max-w-xs truncate text-xs text-gray-400">{profile.templates.map(t => t.name).join(', ')}</p>
                  </DataTableTd>
                  <DataTableTd className="font-semibold text-gray-700 dark:text-gray-300">₹{Number(profile.amount).toLocaleString()}</DataTableTd>
                  <DataTableTd>
                    <Badge variant={profile.active ? 'success' : 'default'} dot>
                      {profile.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </DataTableTd>
                  <DataTableTd align="right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openEdit(profile)}>Edit</Button>
                      <Button size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />}
                        className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => setDeleteProfile(profile)}>
                        Delete
                      </Button>
                    </div>
                  </DataTableTd>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}

        {showArchived && (
          <DataTable title="Archived Profiles" count={archivedProfiles.length} minWidth="560px">
            <DataTableHead>
              <DataTableTh>Profile</DataTableTh>
              <DataTableTh>Date Archived</DataTableTh>
              <DataTableTh align="right">Actions</DataTableTh>
            </DataTableHead>
            <DataTableBody>
              {archivedProfiles.length === 0 ? (
                <DataTableRow>
                  <DataTableTd colSpan={3} className="py-8 text-center text-sm text-gray-400">No archived profiles</DataTableTd>
                </DataTableRow>
              ) : archivedProfiles.map(profile => (
                <DataTableRow key={profile.id}>
                  <DataTableTd>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-400">
                        <Archive className="h-4 w-4" />
                      </div>
                      <p className="font-semibold text-gray-700 dark:text-gray-300">{profile.name}</p>
                    </div>
                  </DataTableTd>
                  <DataTableTd className="text-gray-500 dark:text-gray-400">
                    {profile.deletedAt ? new Date(profile.deletedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </DataTableTd>
                  <DataTableTd align="right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" icon={<RotateCcw className="h-3.5 w-3.5 text-blue-500" />}
                        className="text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        onClick={() => restoreMutation.mutate(profile.id)}>Restore</Button>
                      <Button size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />}
                        className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => setPermDeleteProfile(profile)}>
                        Delete Forever
                      </Button>
                    </div>
                  </DataTableTd>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </PageContent>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Profile"
        subtitle="Bundle multiple tests into one priced package"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button loading={createMutation.isPending} onClick={handleCreate}>Create Profile</Button>
          </>
        }
      >
        <ProfileForm form={createForm} setForm={setCreateForm} />
      </Modal>

      <Modal
        open={!!editProfile}
        onClose={() => setEditProfile(null)}
        title="Edit Profile"
        subtitle={`Editing ${editProfile?.name ?? ''}`}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditProfile(null)}>Cancel</Button>
            <Button loading={updateMutation.isPending} onClick={handleUpdate}>Save Changes</Button>
          </>
        }
      >
        <ProfileForm form={editForm} setForm={setEditForm} />
      </Modal>

      <ConfirmModal
        open={!!deleteProfile}
        onClose={() => setDeleteProfile(null)}
        onConfirm={() => deleteProfile && deleteMutation.mutate(deleteProfile.id)}
        title="Archive Profile"
        message={`Are you sure you want to archive "${deleteProfile?.name}"? You can restore it later from the archived view.`}
        confirmLabel="Archive Profile"
        variant="danger"
        loading={deleteMutation.isPending}
      />

      <ConfirmModal
        open={!!permDeleteProfile}
        onClose={() => setPermDeleteProfile(null)}
        onConfirm={() => permDeleteProfile && permanentDeleteMutation.mutate(permDeleteProfile.id)}
        title="Delete Forever"
        message={`Permanently delete "${permDeleteProfile?.name}"? This cannot be undone.`}
        confirmLabel="Delete Forever"
        variant="danger"
        loading={permanentDeleteMutation.isPending}
      />
    </div>
  )
}
