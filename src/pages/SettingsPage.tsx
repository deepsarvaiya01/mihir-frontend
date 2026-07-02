import { useState, useEffect } from 'react'
import {
  Key, Eye, EyeOff,
  Building2, Save, X,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { useAuthStore } from '../store/authStore'
import { authService } from '../services/auth'
import { labSettingsService } from '../services/labSettings'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { toastError } from '../lib/errors'
import { toTitleCase } from '../lib/utils'
import type { LabSettings } from '../types'

/* ── helpers ───────────────────────────────────────────────── */
function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-gray-800 dark:text-gray-200">{value || '—'}</p>
    </div>
  )
}

function Field({
  label, value, onChange, type = 'text', placeholder, span2 = false,
}: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; span2?: boolean
}) {
  return (
    <div className={span2 ? 'sm:col-span-2' : ''}>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
        {label}
      </label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition hover:border-blue-300 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
      />
    </div>
  )
}

function pwStrength(pwd: string) {
  if (!pwd) return null
  if (pwd.length < 6)  return { level: 'Weak',   color: 'text-red-500',    bar: 'bg-red-500 w-1/4' }
  if (pwd.length < 10) return { level: 'Fair',   color: 'text-amber-500',  bar: 'bg-amber-500 w-2/4' }
  if (pwd.length < 14) return { level: 'Good',   color: 'text-blue-500',   bar: 'bg-blue-500 w-3/4' }
  return                      { level: 'Strong', color: 'text-emerald-500', bar: 'bg-emerald-500 w-full' }
}

/* ── Change Password Modal ─────────────────────────────────── */
function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [cur,  setCur]  = useState('')
  const [nw,   setNw]   = useState('')
  const [conf, setConf] = useState('')
  const [showCur, setShowCur] = useState(false)
  const [showNw,  setShowNw]  = useState(false)
  const [loading, setLoading] = useState(false)
  const strength = pwStrength(nw)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (nw !== conf)     { toast.error('Passwords do not match'); return }
    if (nw.length < 6)  { toast.error('Min 6 characters'); return }
    setLoading(true)
    try {
      await authService.changePassword(cur, nw)
      toast.success('Password changed successfully')
      onClose()
    } catch (err) { toastError(err, 'Failed to change password') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-gray-800">
        {/* header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-700">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
              <Key className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">Change Password</h3>
          </div>
          <button onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {/* Current */}
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-400">Current Password</label>
            <div className="relative">
              <input type={showCur ? 'text' : 'password'} value={cur} onChange={e => setCur(e.target.value)}
                placeholder="Enter current password" required
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 pr-10 text-sm outline-none transition hover:border-blue-300 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" />
              <button type="button" onClick={() => setShowCur(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showCur ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* New */}
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-400">New Password</label>
            <div className="relative">
              <input type={showNw ? 'text' : 'password'} value={nw} onChange={e => setNw(e.target.value)}
                placeholder="Enter new password" required
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 pr-10 text-sm outline-none transition hover:border-blue-300 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" />
              <button type="button" onClick={() => setShowNw(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showNw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {strength && (
              <div className="mt-2">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                  <div className={`h-full rounded-full transition-all ${strength.bar}`} />
                </div>
                <p className={`mt-1 text-xs font-semibold ${strength.color}`}>{strength.level}</p>
              </div>
            )}
          </div>

          {/* Confirm */}
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-400">Confirm New Password</label>
            <input type="password" value={conf} onChange={e => setConf(e.target.value)}
              placeholder="Re-enter new password" required
              className={`w-full rounded-xl border bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:bg-white focus:ring-2 dark:bg-gray-700 dark:text-gray-100
                ${conf && nw !== conf
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                  : 'border-gray-200 hover:border-blue-300 focus:border-blue-500 focus:ring-blue-500/20 dark:border-gray-600'}`} />
            {conf && nw !== conf && (
              <p className="mt-1 text-xs font-medium text-red-500">Passwords do not match</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={loading} icon={<Key className="h-4 w-4" />}>Update Password</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Page ──────────────────────────────────────────────────── */
export default function SettingsPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const isAdmin = user?.role === 'SUPER_ADMIN'
  const [pwdModalOpen, setPwdModalOpen] = useState(false)

  const { data: labSettings } = useQuery({
    queryKey: ['lab-settings'],
    queryFn: labSettingsService.getAll,
    enabled: isAdmin,
  })
  const [labForm, setLabForm] = useState<LabSettings>({})
  useEffect(() => { if (labSettings) setLabForm(labSettings) }, [labSettings])

  const saveLabMutation = useMutation({
    mutationFn: () => labSettingsService.update(labForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lab-settings'] }); toast.success('Lab profile saved') },
    onError: (err) => toastError(err, 'Failed to save lab profile'),
  })

  const roleLabel = isAdmin ? 'Super Admin' : 'Lab User'
  const roleColor = isAdmin
    ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400'
    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'

  return (
    <div className="flex h-full flex-col">
      <Header title="Profile" subtitle="Manage your personal information and account settings" />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <div className="grid gap-5 lg:grid-cols-[300px_1fr]">

            {/* ── LEFT SIDEBAR ── */}
            <aside>
              <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="flex flex-col items-center px-6 py-7 text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-600 text-3xl font-bold text-white shadow">
                    {user?.name?.charAt(0).toUpperCase() ?? '?'}
                  </div>
                  <h2 className="mt-3 text-sm font-bold text-gray-900 dark:text-white">{user?.name}</h2>
                  <p className="mt-0.5 max-w-full truncate text-xs text-gray-400">{user?.email}</p>
                  <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${roleColor}`}>
                      {roleLabel}
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                      Active
                    </span>
                  </div>
                </div>
                <div className="border-t border-gray-100 px-5 py-3.5 dark:border-gray-700">
                  <button
                    onClick={() => setPwdModalOpen(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-400"
                  >
                    <Key className="h-3.5 w-3.5" />
                    Change Password
                  </button>
                </div>
              </div>
            </aside>

            {/* ── RIGHT CONTENT ── */}
            <div className="space-y-4">

              {/* Personal Information */}
              <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-700">
                  <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">Personal Information</h3>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3.5 p-5 sm:grid-cols-4">
                  <InfoRow label="Full Name"      value={user?.name} />
                  <InfoRow label="Email"          value={user?.email} />
                  <InfoRow label="Role"           value={roleLabel} />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Account Status</p>
                    <span className="mt-0.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />ACTIVE
                    </span>
                  </div>
                </div>
              </div>

              {/* Lab Profile — SUPER_ADMIN only */}
              {isAdmin && (
                <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                  <div className="flex items-center gap-2.5 border-b border-gray-100 px-5 py-3 dark:border-gray-700">
                    <Building2 className="h-4 w-4 text-blue-500" />
                    <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">Lab Profile</h3>
                    <span className="ml-auto text-xs text-gray-400">Appears in every generated PDF report</span>
                  </div>
                  <div className="p-5">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <Field label="Lab Name" value={labForm.lab_name ?? ''} placeholder="Rameshwar Diagnostic Laboratory"
                        onChange={v => setLabForm(p => ({ ...p, lab_name: toTitleCase(v) }))} />
                      <Field label="Lab Email" type="email" value={labForm.lab_email ?? ''} placeholder="lab@example.com"
                        onChange={v => setLabForm(p => ({ ...p, lab_email: v }))} />
                      <Field label="Phone" value={labForm.lab_phone ?? ''} placeholder="7046119183"
                        onChange={v => setLabForm(p => ({ ...p, lab_phone: v }))} />
                      <Field label="Doctor / Pathologist" value={labForm.doctor_name ?? ''} placeholder="Dr. Name"
                        onChange={v => setLabForm(p => ({ ...p, doctor_name: toTitleCase(v) }))} />
                      <Field label="Qualification" value={labForm.doctor_qualification ?? ''} placeholder="PG DMLT"
                        onChange={v => setLabForm(p => ({ ...p, doctor_qualification: v }))} />
                      <Field label="Lab Timing" value={labForm.lab_timing ?? ''} placeholder="8am – 8pm"
                        onChange={v => setLabForm(p => ({ ...p, lab_timing: v }))} />
                      <Field label="Address" value={labForm.lab_address ?? ''} placeholder="Street, City, PIN"
                        onChange={v => setLabForm(p => ({ ...p, lab_address: v }))} span2 />
                    </div>
                    <div className="mt-4">
                      <Button size="sm" loading={saveLabMutation.isPending} icon={<Save className="h-3.5 w-3.5" />}
                        onClick={() => saveLabMutation.mutate()}>
                        Save Lab Profile
                      </Button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      {pwdModalOpen && <ChangePasswordModal onClose={() => setPwdModalOpen(false)} />}
    </div>
  )
}
