import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, FlaskConical, ShieldCheck, BarChart3, Users, ArrowRight } from 'lucide-react'
import { authService } from '../services/auth'
import { useAuthStore } from '../store/authStore'
import { toast } from 'sonner'
import { toastError } from '../lib/errors'

const features = [
  { icon: <FlaskConical className="h-3.5 w-3.5" />, text: 'Test result management' },
  { icon: <BarChart3 className="h-3.5 w-3.5" />,   text: 'Real-time billing' },
  { icon: <ShieldCheck className="h-3.5 w-3.5" />,  text: 'Role-based access' },
  { icon: <Users className="h-3.5 w-3.5" />,        text: 'Multi-branch & B2B' },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await authService.login(identifier, password)
      setAuth(data.user, data.accessToken)
      toast.success(`Welcome back, ${data.user.name}!`)
      navigate('/dashboard')
    } catch (err: unknown) {
      toastError(err, 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070B18] px-4 py-10">
      {/* ── Aurora background blobs ─────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-aurora-1 absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-blue-600/30 blur-[110px]" />
        <div className="animate-aurora-2 absolute -right-32 top-1/4 h-[30rem] w-[30rem] rounded-full bg-violet-600/25 blur-[110px]" />
        <div className="animate-aurora-3 absolute -bottom-32 left-1/3 h-[28rem] w-[28rem] rounded-full bg-teal-500/20 blur-[110px]" />
      </div>

      {/* ── Dot-grid texture overlay ─────────────────────────── */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '32px 32px' }}
      />

      {/* ── Content ──────────────────────────────────────────── */}
      <div className="animate-fade-in-up relative z-10 flex w-full max-w-md flex-col items-center">
        {/* Brand mark */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/30">
            <FlaskConical className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Mihir Laboratory</h1>
          <p className="mt-1 text-sm text-white/50">Laboratory Management, Simplified.</p>
        </div>

        {/* Glass card */}
        <div className="w-full rounded-3xl border border-white/10 bg-white/[0.06] p-8 shadow-2xl shadow-black/40 backdrop-blur-2xl">
          <h2 className="text-lg font-semibold text-white">Welcome back</h2>
          <p className="mt-1 text-sm text-white/50">Sign in to continue to your dashboard</p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            {/* Email or Username */}
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">
                Email or Username
              </label>
              <input
                type="text"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder="you@laboratory.com or username"
                required
                autoComplete="username"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-blue-400/60 focus:bg-white/10 focus:ring-2 focus:ring-blue-400/20"
              />
            </div>

            {/* Password */}
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-11 text-sm text-white placeholder-white/25 outline-none transition focus:border-blue-400/60 focus:bg-white/10 focus:ring-2 focus:ring-blue-400/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 transition-colors hover:text-white/70"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:shadow-xl hover:shadow-blue-500/40 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Signing in…' : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-white/30">
            <ShieldCheck className="h-3.5 w-3.5" /> Protected by JWT · Role-based access control
          </p>
        </div>

        {/* Feature pills */}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
          {features.map((f, i) => (
            <span key={i} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60">
              {f.icon} {f.text}
            </span>
          ))}
        </div>

        {/* Demo credentials — dev builds only */}
        {import.meta.env.DEV && (
          <div className="mt-6 w-full rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-white/30">
              Demo credentials
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => { setIdentifier('admin@lab.com'); setPassword('admin123') }}
                className="group flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-left transition hover:border-blue-400/40 hover:bg-white/10"
              >
                <div>
                  <p className="text-xs font-semibold text-white/80 group-hover:text-white">Super Admin</p>
                  <p className="mt-0.5 font-mono text-[11px] text-white/35">admin@lab.com · admin123</p>
                </div>
                <span className="text-[10px] font-medium text-blue-300 opacity-0 transition-opacity group-hover:opacity-100">
                  Fill →
                </span>
              </button>
              <button
                type="button"
                onClick={() => { setIdentifier('lab@lab.com'); setPassword('lab12345') }}
                className="group flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-left transition hover:border-blue-400/40 hover:bg-white/10"
              >
                <div>
                  <p className="text-xs font-semibold text-white/80 group-hover:text-white">Lab User</p>
                  <p className="mt-0.5 font-mono text-[11px] text-white/35">lab@lab.com · lab12345</p>
                </div>
                <span className="text-[10px] font-medium text-blue-300 opacity-0 transition-opacity group-hover:opacity-100">
                  Fill →
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="mt-8 text-xs text-white/25">
          © {new Date().getFullYear()} Mihir Laboratory · All rights reserved
        </p>
      </div>
    </div>
  )
}
