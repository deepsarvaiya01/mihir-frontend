import { useState } from 'react'
import { Shield, Key, User, Mail, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { useAuthStore } from '../store/authStore'
import { authService } from '../services/auth'
import { toast } from 'sonner'

export default function SettingsPage() {
  const { user } = useAuthStore()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

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
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  const passwordStrength = (pwd: string) => {
    if (!pwd) return null
    if (pwd.length < 6) return { level: 'Weak', color: 'text-rose-500', bar: 'bg-rose-500 w-1/4' }
    if (pwd.length < 10) return { level: 'Fair', color: 'text-amber-500', bar: 'bg-amber-500 w-2/4' }
    if (pwd.length < 14) return { level: 'Good', color: 'text-blue-500', bar: 'bg-blue-500 w-3/4' }
    return { level: 'Strong', color: 'text-emerald-500', bar: 'bg-emerald-500 w-full' }
  }

  const strength = passwordStrength(newPassword)

  return (
    <div>
      <Header title="Settings" subtitle="Manage your account and security preferences" />

      <div className="p-6 max-w-3xl space-y-6">
        {/* Profile Card */}
        <Card>
          <div className="flex items-start gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-2xl font-bold text-white shadow-lg">
              {user?.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{user?.name}</h2>
                  <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                    <Mail className="h-3.5 w-3.5" />
                    {user?.email}
                  </div>
                </div>
                <Badge variant={user?.role === 'SUPER_ADMIN' ? 'danger' : 'info'} dot>
                  {user?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Lab User'}
                </Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  { icon: <User className="h-4 w-4 text-slate-400" />, label: 'Name', value: user?.name ?? '—' },
                  { icon: <Mail className="h-4 w-4 text-slate-400" />, label: 'Email', value: user?.email ?? '—' },
                  { icon: <Shield className="h-4 w-4 text-slate-400" />, label: 'Access Level', value: user?.role === 'SUPER_ADMIN' ? 'Administrator' : 'Lab Operator' },
                ].map(item => (
                  <div key={item.label} className="rounded-xl bg-slate-50 px-3 py-2.5">
                    <div className="flex items-center gap-1.5 mb-0.5">{item.icon}<span className="text-xs text-slate-400">{item.label}</span></div>
                    <p className="text-sm font-medium text-slate-700 truncate">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Change Password */}
        <Card>
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
              <Key className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Change Password</h3>
              <p className="text-sm text-slate-500">Use a strong, unique password to protect your account</p>
            </div>
          </div>

          {success && (
            <div className="mb-5 flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 p-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <p className="text-sm font-medium text-emerald-700">Password changed successfully. Please use your new password next time you sign in.</p>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 pr-11 text-sm outline-none transition-all hover:border-indigo-300 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                />
                <button type="button" onClick={() => setShowCurrent(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">New Password</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min. 6 characters)"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 pr-11 text-sm outline-none transition-all hover:border-indigo-300 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                />
                <button type="button" onClick={() => setShowNew(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {strength && (
                <div className="mt-2">
                  <div className="h-1.5 w-full rounded-full bg-slate-100">
                    <div className={`h-1.5 rounded-full transition-all ${strength.bar}`} />
                  </div>
                  <p className={`mt-1 text-xs font-medium ${strength.color}`}>Password strength: {strength.level}</p>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                required
                className={`w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm outline-none transition-all hover:border-indigo-300 focus:bg-white focus:ring-2
                  ${confirmPassword && newPassword !== confirmPassword
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100'
                    : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-100'}`}
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="mt-1 text-xs text-rose-600">Passwords do not match</p>
              )}
            </div>

            <div className="pt-2">
              <Button type="submit" loading={loading} icon={<Key className="h-4 w-4" />}>
                Update Password
              </Button>
            </div>
          </form>
        </Card>

        {/* Security Info */}
        <Card padding="sm">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-700">Security Information</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-500">
                <li>• Sessions expire automatically after 15 minutes of inactivity</li>
                <li>• Use a unique password not used on other websites</li>
                <li>• Avoid sharing your credentials with others</li>
                <li>• Contact your Super Admin to reset your account if locked out</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
