import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight, Mail, Lock, Loader2 } from 'lucide-react'
import { authService } from '../services/auth'
import { useAuthStore } from '../store/authStore'
import { toast } from 'sonner'
import { toastError } from '../lib/errors'

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
    <div className="flex min-h-screen w-full bg-white">
      {/* ── Left — full-height brand panel ────────────────────── */}
      <div className="relative hidden w-1/2 shrink-0 flex-col overflow-hidden bg-gradient-to-br from-[#0a3d91] via-[#0e63c4] to-[#0a9e6e] lg:flex">
        {/* Fine grid-line texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.9) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        {/* Slow-drifting glow orbs for depth */}
        <div className="animate-aurora-1 pointer-events-none absolute -left-20 top-1/4 h-[26rem] w-[26rem] rounded-full bg-white/10 blur-[110px]" />
        <div className="animate-aurora-2 pointer-events-none absolute -right-16 bottom-0 h-[22rem] w-[22rem] rounded-full bg-emerald-300/20 blur-[110px]" />
        {/* Large soft ring for premium, editorial feel */}
        <div className="pointer-events-none absolute -bottom-40 -right-40 h-[34rem] w-[34rem] rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full border border-white/10" />

        {/* Centerpiece — lab illustration, logo, orbit rings + soft glow */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center">
          {/* Diagnostic-lab line-art illustration */}
          <svg
            viewBox="0 0 260 170"
            className="animate-logo-float mb-6 h-36 w-auto opacity-90"
            fill="none"
          >
            {/* DNA helix */}
            <g stroke="rgba(255,255,255,0.55)" strokeWidth="2.2" strokeLinecap="round">
              <path d="M22 8c20 18-20 34 0 52s-20 34 0 52s-20 34 0 52" />
              <path d="M50 8c-20 18 20 34 0 52s20 34 0 52s20 34 0 52" />
              <line x1="22" y1="18" x2="50" y2="18" strokeWidth="1.6" opacity="0.7" />
              <line x1="22" y1="60" x2="50" y2="60" strokeWidth="1.6" opacity="0.7" />
              <line x1="22" y1="102" x2="50" y2="102" strokeWidth="1.6" opacity="0.7" />
              <line x1="22" y1="144" x2="50" y2="144" strokeWidth="1.6" opacity="0.7" />
            </g>
            {/* Test tube with liquid + bubbles */}
            <g strokeLinejoin="round">
              <path
                d="M150 14h34v40l28 96c3 10-5 20-16 20h-58c-11 0-19-10-16-20l28-96z"
                stroke="rgba(255,255,255,0.7)"
                strokeWidth="2.4"
                fill="rgba(255,255,255,0.06)"
              />
              <path
                d="M139 118l-9 32c-3 10 5 20 16 20h58c11 0 19-10 16-20l-9-32z"
                fill="rgba(255,255,255,0.18)"
              />
              <line x1="143" y1="14" x2="217" y2="14" stroke="rgba(255,255,255,0.7)" strokeWidth="2.4" strokeLinecap="round" />
              <circle cx="163" cy="150" r="4.5" fill="rgba(255,255,255,0.55)" />
              <circle cx="180" cy="132" r="3" fill="rgba(255,255,255,0.4)" />
              <circle cx="196" cy="155" r="5.5" fill="rgba(255,255,255,0.35)" />
              <circle cx="178" cy="160" r="2.5" fill="rgba(255,255,255,0.45)" />
            </g>
          </svg>

          <div className="animate-fade-in-up relative flex items-center justify-center">
            {/* Orbit rings around the logo */}
            <div className="pointer-events-none absolute h-[20rem] w-[20rem] rounded-full border border-white/15" />
            <div className="pointer-events-none absolute h-[15.5rem] w-[15.5rem] rounded-full border border-white/20" />
            {/* Soft pulsing glow behind the card */}
            <div className="animate-glow-pulse pointer-events-none absolute h-52 w-52 rounded-full bg-white/30 blur-3xl" />

            <div className="relative rounded-[26px] bg-white px-10 py-8 shadow-2xl shadow-black/20">
              <img src="/Rameshwar.png" alt="Rameshwar Diagnostic Laboratory" className="h-14 w-auto" />
            </div>
          </div>

          <div className="animate-fade-in-up relative z-10 mt-8 flex items-center gap-3">
            <span className="h-px w-8 bg-white/40" />
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/70">LabOps Console</p>
            <span className="h-px w-8 bg-white/40" />
          </div>
        </div>
      </div>

      {/* ── Right — login form, full height, centered ─────────── */}
      <div className="flex w-full flex-col items-center justify-center bg-white px-6 py-12 lg:w-1/2">
        <div className="animate-fade-in-up w-full max-w-sm">
          {/* Mobile-only logo */}
          <img src="/Rameshwar.png" alt="Rameshwar Diagnostic Laboratory" className="mb-10 h-10 w-auto lg:hidden" />

          <h2 className="text-[28px] font-bold tracking-tight text-gray-900">Welcome back</h2>
          <p className="mt-2 text-sm text-gray-500">Login to your LabOps dashboard</p>

          <form onSubmit={handleLogin} className="mt-8 space-y-4">
            {/* Email or Username */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                Email or Username
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="you@laboratory.com or username"
                  required
                  autoComplete="username"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-11 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative mt-2 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700 hover:shadow-xl hover:shadow-emerald-600/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
                </>
              ) : (
                <>
                  Login
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
