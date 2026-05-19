import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { authService } from '../services/auth'
import { useAuthStore } from '../store/authStore'
import { toast } from 'sonner'

export default function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await authService.login(email, password)
      setAuth(data.user, data.accessToken, data.refreshToken)
      toast.success(`Welcome back, ${data.user.name}!`)
      navigate('/dashboard')
    } catch (err: unknown) {
      const axiosMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(axiosMsg || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = (role: 'admin' | 'lab') => {
    if (role === 'admin') { setEmail('admin@lab.com'); setPassword('admin123') }
    else { setEmail('lab@lab.com'); setPassword('lab12345') }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 flex items-center justify-center p-4">
      {/* Background gradient orbs */}
      <div className="pointer-events-none absolute inset-0 select-none">
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-16 h-[500px] w-[500px] rounded-full bg-violet-700/15 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-800/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-xl shadow-indigo-900/60 ring-1 ring-white/10">
            <Activity className="h-8 w-8 text-white" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">LabOps Console</h1>
          <p className="mt-1 text-sm text-slate-400">Mihir Laboratory Management System</p>
        </div>

        {/* Card */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-2xl backdrop-blur-2xl">
          {/* Top accent bar */}
          <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500" />

          <div className="p-8">
            <h2 className="text-lg font-bold text-white">Sign in to your workspace</h2>
            <p className="mb-7 mt-1 text-sm text-slate-400">Enter your credentials to access the system</p>

            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@lab.com"
                    required
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 outline-none transition-all hover:border-white/20 focus:border-indigo-500 focus:bg-white/8 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-12 text-sm text-white placeholder-slate-600 outline-none transition-all hover:border-white/20 focus:border-indigo-500 focus:bg-white/8 focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" loading={loading} className="w-full" size="lg">
                Sign In Securely
              </Button>
            </form>

            {/* Demo credentials */}
            <div className="mt-6 rounded-xl border border-indigo-500/20 bg-indigo-950/60 p-4">
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-indigo-400">
                Demo Credentials
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fillDemo('admin')}
                  className="flex-1 rounded-lg border border-indigo-500/30 bg-indigo-600/20 px-3 py-2 text-left transition-colors hover:bg-indigo-600/30"
                >
                  <p className="text-[11px] font-semibold text-indigo-300">Super Admin</p>
                  <p className="mt-0.5 font-mono text-[10px] text-slate-400">admin@lab.com</p>
                </button>
                <button
                  type="button"
                  onClick={() => fillDemo('lab')}
                  className="flex-1 rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 py-2 text-left transition-colors hover:bg-slate-700/50"
                >
                  <p className="text-[11px] font-semibold text-slate-300">Lab User</p>
                  <p className="mt-0.5 font-mono text-[10px] text-slate-400">lab@lab.com</p>
                </button>
              </div>
              <p className="mt-2 text-center text-[10px] text-slate-500">Click a card to auto-fill credentials</p>
            </div>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-slate-600">
          Protected by JWT authentication · Role-based access control
        </p>
      </div>
    </div>
  )
}
