import { useState, useEffect } from 'react'
import {
  Shield,
  Key,
  Mail,
  Eye,
  EyeOff,
  CheckCircle2,
  Building2,
  MapPin,
  Phone,
  Clock,
  UserCheck,
  Save,
} from 'lucide-react'

import { Header } from '../components/layout/Header'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { useAuthStore } from '../store/authStore'
import { authService } from '../services/auth'
import { labSettingsService } from '../services/labSettings'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { LabSettings } from '../types'

export default function SettingsPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // ── Lab profile (SUPER_ADMIN only) ──────────────────────
  const { data: labSettings } = useQuery({
    queryKey: ['lab-settings'],
    queryFn: labSettingsService.getAll,
    enabled: user?.role === 'SUPER_ADMIN',
  })

  const [labForm, setLabForm] = useState<LabSettings>({})

  // Initialise form once when data first arrives — useEffect avoids setState-during-render
  useEffect(() => {
    if (labSettings) setLabForm(labSettings)
  }, [labSettings])

  const saveLabMutation = useMutation({
    mutationFn: () => labSettingsService.update(labForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lab-settings'] })
      toast.success('Lab profile saved')
    },
    onError: () => toast.error('Failed to save lab profile'),
  })

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      await authService.changePassword(currentPassword, newPassword)

      toast.success('Password changed successfully')

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      setSuccess(true)

      setTimeout(() => setSuccess(false), 4000)
    } catch (err: unknown) {
      const msg = (
        err as {
          response?: { data?: { message?: string } }
        }
      )?.response?.data?.message

      toast.error(msg || 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  const passwordStrength = (pwd: string) => {
    if (!pwd) return null

    if (pwd.length < 6) {
      return {
        level: 'Weak',
        color: 'text-red-500',
        bar: 'bg-red-500 w-1/4',
      }
    }

    if (pwd.length < 10) {
      return {
        level: 'Fair',
        color: 'text-amber-500',
        bar: 'bg-amber-500 w-2/4',
      }
    }

    if (pwd.length < 14) {
      return {
        level: 'Good',
        color: 'text-blue-500',
        bar: 'bg-blue-500 w-3/4',
      }
    }

    return {
      level: 'Strong',
      color: 'text-emerald-500',
      bar: 'bg-emerald-500 w-full',
    }
  }

  const strength = passwordStrength(newPassword)

  return (
    <div>
      <Header title="Settings" subtitle="Manage your account and security preferences" />

      <div className="mx-auto max-w-3xl space-y-6 p-6">

        {/* Profile card */}
        <Card>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-bold text-white">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{user?.name}</h2>
                <Badge variant={user?.role === 'SUPER_ADMIN' ? 'danger' : 'info'} dot>
                  {user?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Lab User'}
                </Badge>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                <Mail className="h-3.5 w-3.5" />
                {user?.email}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                <Shield className="h-3.5 w-3.5" />
                {user?.role === 'SUPER_ADMIN' ? 'Administrator — full system access' : 'Lab Operator — laboratory access'}
              </div>
            </div>
          </div>
        </Card>

        {/* LAB PROFILE — SUPER_ADMIN only */}
        {user?.role === 'SUPER_ADMIN' && (
          <Card>
            <div className="mb-6 flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-900/30">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">Lab Profile</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Appears in the header of every generated PDF report
                </p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {/* Lab name */}
              <div>
                <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <Building2 className="h-3.5 w-3.5" /> Lab Name
                </label>
                <input
                  type="text" placeholder="e.g. Rameshwar Diagnostic Laboratory"
                  value={labForm.lab_name ?? ''}
                  onChange={e => setLabForm(p => ({ ...p, lab_name: e.target.value }))}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none hover:border-blue-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500 dark:hover:border-blue-500 dark:focus:bg-gray-700 dark:focus:border-blue-500"
                />
              </div>

              {/* Email */}
              <div>
                <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <Mail className="h-3.5 w-3.5" /> Lab Email
                </label>
                <input
                  type="email" placeholder="e.g. lab@example.com"
                  value={labForm.lab_email ?? ''}
                  onChange={e => setLabForm(p => ({ ...p, lab_email: e.target.value }))}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none hover:border-blue-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500 dark:hover:border-blue-500 dark:focus:bg-gray-700 dark:focus:border-blue-500"
                />
              </div>

              {/* Address */}
              <div className="sm:col-span-2">
                <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <MapPin className="h-3.5 w-3.5" /> Address
                </label>
                <input
                  type="text" placeholder="e.g. Tirupati Street No.6, Raiya Road, Rajkot - 360007"
                  value={labForm.lab_address ?? ''}
                  onChange={e => setLabForm(p => ({ ...p, lab_address: e.target.value }))}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none hover:border-blue-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500 dark:hover:border-blue-500 dark:focus:bg-gray-700 dark:focus:border-blue-500"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <Phone className="h-3.5 w-3.5" /> Phone / Home Collection
                </label>
                <input
                  type="text" placeholder="e.g. 7046119183, 7046719183"
                  value={labForm.lab_phone ?? ''}
                  onChange={e => setLabForm(p => ({ ...p, lab_phone: e.target.value }))}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none hover:border-blue-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500 dark:hover:border-blue-500 dark:focus:bg-gray-700 dark:focus:border-blue-500"
                />
              </div>

              {/* Timing */}
              <div>
                <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <Clock className="h-3.5 w-3.5" /> Lab Timing
                </label>
                <input
                  type="text" placeholder="e.g. 8-00 am to 8-00 pm (24 Hours Emergency Service Available)"
                  value={labForm.lab_timing ?? ''}
                  onChange={e => setLabForm(p => ({ ...p, lab_timing: e.target.value }))}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none hover:border-blue-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500 dark:hover:border-blue-500 dark:focus:bg-gray-700 dark:focus:border-blue-500"
                />
              </div>

              {/* Doctor name */}
              <div>
                <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <UserCheck className="h-3.5 w-3.5" /> Doctor / Pathologist Name
                </label>
                <input
                  type="text" placeholder="e.g. Mihir Badeliya"
                  value={labForm.doctor_name ?? ''}
                  onChange={e => setLabForm(p => ({ ...p, doctor_name: e.target.value }))}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none hover:border-blue-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500 dark:hover:border-blue-500 dark:focus:bg-gray-700 dark:focus:border-blue-500"
                />
              </div>

              {/* Qualification */}
              <div>
                <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <UserCheck className="h-3.5 w-3.5" /> Qualification
                </label>
                <input
                  type="text" placeholder="e.g. PG DMLT"
                  value={labForm.doctor_qualification ?? ''}
                  onChange={e => setLabForm(p => ({ ...p, doctor_qualification: e.target.value }))}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none hover:border-blue-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500 dark:hover:border-blue-500 dark:focus:bg-gray-700 dark:focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mt-6 pt-2">
              <Button
                loading={saveLabMutation.isPending}
                icon={<Save className="h-4 w-4" />}
                onClick={() => saveLabMutation.mutate()}
              >
                Save Lab Profile
              </Button>
            </div>
          </Card>
        )}

        {/* CHANGE PASSWORD */}
        <Card>
          <div className="mb-6 flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/30">
              <Key className="h-5 w-5 text-amber-600" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                Change Password
              </h3>

              <p className="text-sm text-gray-500 dark:text-gray-400">
                Use a strong, unique password to protect your account
              </p>
            </div>
          </div>

          {success && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                Password changed successfully. Please use your
                new password next time you sign in.
              </p>
            </div>
          )}

          <form
            onSubmit={handleChangePassword}
            className="space-y-5"
          >
            {/* CURRENT PASSWORD */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Current Password
              </label>

              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) =>
                    setCurrentPassword(e.target.value)
                  }
                  placeholder="Enter your current password"
                  required
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 pr-12 text-sm outline-none transition-all hover:border-blue-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500 dark:hover:border-blue-500 dark:focus:bg-gray-700 dark:focus:border-blue-500"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowCurrent((p) => !p)
                  }
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                >
                  {showCurrent ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* NEW PASSWORD */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                New Password
              </label>

              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) =>
                    setNewPassword(e.target.value)
                  }
                  placeholder="Enter new password"
                  required
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 pr-12 text-sm outline-none transition-all hover:border-blue-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500 dark:hover:border-blue-500 dark:focus:bg-gray-700 dark:focus:border-blue-500"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowNew((p) => !p)
                  }
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                >
                  {showNew ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* PASSWORD STRENGTH */}
              {strength && (
                <div className="mt-3">
                  <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden dark:bg-gray-700">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${strength.bar}`}
                    />
                  </div>

                  <p
                    className={`mt-2 text-xs font-semibold ${strength.color}`}
                  >
                    Password strength: {strength.level}
                  </p>
                </div>
              )}
            </div>

            {/* CONFIRM PASSWORD */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Confirm New Password
              </label>

              <input
                type="password"
                value={confirmPassword}
                onChange={(e) =>
                  setConfirmPassword(e.target.value)
                }
                placeholder="Re-enter new password"
                required
                className={`w-full rounded-2xl border bg-gray-50 px-4 py-3 text-sm outline-none transition-all hover:border-blue-300 focus:bg-white focus:ring-4 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500 dark:hover:border-blue-500 dark:focus:bg-gray-700
                  ${
                    confirmPassword &&
                    newPassword !== confirmPassword
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 dark:border-red-500'
                      : 'border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 dark:border-gray-600 dark:focus:border-blue-500'
                  }`}
              />

              {confirmPassword &&
                newPassword !== confirmPassword && (
                  <p className="mt-2 text-xs font-medium text-red-600">
                    Passwords do not match
                  </p>
                )}
            </div>

            {/* BUTTON */}
            <div className="pt-2">
              <Button
                type="submit"
                loading={loading}
                icon={<Key className="h-4 w-4" />}
              >
                Update Password
              </Button>
            </div>
          </form>
        </Card>

        {/* SECURITY INFO */}
        <Card padding="sm">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />

            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Security Information
              </p>

              <ul className="mt-3 space-y-2 text-sm text-gray-500 dark:text-gray-400">
                <li>
                  • Sessions expire automatically after
                  15 minutes of inactivity
                </li>

                <li>
                  • Use a unique password not used on
                  other websites
                </li>

                <li>
                  • Avoid sharing your credentials with
                  others
                </li>

                <li>
                  • Contact your Super Admin to reset your
                  account if locked out
                </li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

