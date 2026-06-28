import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, FlaskConical, ShieldCheck, BarChart3, Users } from 'lucide-react'
import { authService } from '../services/auth'
import { useAuthStore } from '../store/authStore'
import { toast } from 'sonner'

const features = [
  { icon: <FlaskConical className="h-4 w-4" />, text: 'End-to-end test result management' },
  { icon: <BarChart3 className="h-4 w-4" />,   text: 'Real-time billing & reports' },
  { icon: <ShieldCheck className="h-4 w-4" />,  text: 'Role-based approval workflows' },
  { icon: <Users className="h-4 w-4" />,        text: 'Multi-branch & B2B support' },
]

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
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* ── Left brand panel ─────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] flex-col justify-between bg-[#0F2544] px-14 py-12">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
            <FlaskConical className="h-5 w-5 text-white" />
          </div>
          <span className="text-[15px] font-semibold text-white tracking-tight">Mihir Laboratory</span>
        </div>

        {/* Center content */}
        <div>
          <h1 className="text-4xl font-bold text-white leading-tight">
            Laboratory<br />Management,<br />Simplified.
          </h1>
          <p className="mt-4 text-base text-blue-200/70 leading-relaxed max-w-sm">
            A complete platform for diagnostic labs — from patient registration to report approval.
          </p>

          <ul className="mt-10 space-y-4">
            {features.map((f, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-blue-200">
                  {f.icon}
                </span>
                <span className="text-sm text-blue-100/80">{f.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <p className="text-xs text-blue-200/40">
          © {new Date().getFullYear()} Mihir Laboratory · All rights reserved
        </p>
      </div>

      {/* ── Right form panel ─────────────────────────────── */}
      <div className="flex flex-1 flex-col bg-gray-50 dark:bg-gray-900">
        {/* Mobile brand bar */}
        <div className="flex lg:hidden items-center gap-2 px-6 py-5 border-b border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700">
          <FlaskConical className="h-5 w-5 text-blue-600" />
          <span className="text-sm font-semibold text-gray-900 dark:text-white">Mihir Laboratory</span>
        </div>

        {/* Form area — vertically centered but pushed up slightly */}
        <div className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Sign in</h2>
              <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">Enter your credentials to continue</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@laboratory.com"
                  required
                  autoComplete="email"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
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
                    className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 pr-10 text-sm text-gray-900 placeholder-gray-400 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            {/* Security note */}
            <p className="mt-5 text-center text-xs text-gray-400 dark:text-gray-500">
              Protected by JWT · Role-based access control
            </p>
          </div>
        </div>

        {/* ── Demo credentials — bottom right ────────────── */}
        <div className="flex justify-end px-6 pb-6">
          <div className="w-72 rounded-xl border border-gray-200 bg-white shadow-sm p-4 dark:bg-gray-800 dark:border-gray-700">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
              Demo credentials
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => { setEmail('admin@lab.com'); setPassword('admin123') }}
                className="w-full flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5 text-left transition hover:border-blue-300 hover:bg-blue-50 group dark:border-gray-600 dark:hover:border-blue-500 dark:hover:bg-blue-900/20"
              >
                <div>
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 group-hover:text-blue-700 dark:group-hover:text-blue-400">Super Admin</p>
                  <p className="mt-0.5 font-mono text-[11px] text-gray-400 dark:text-gray-500">admin@lab.com · admin123</p>
                </div>
                <span className="text-[10px] font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  Fill →
                </span>
              </button>
              <button
                type="button"
                onClick={() => { setEmail('lab@lab.com'); setPassword('lab12345') }}
                className="w-full flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5 text-left transition hover:border-blue-300 hover:bg-blue-50 group dark:border-gray-600 dark:hover:border-blue-500 dark:hover:bg-blue-900/20"
              >
                <div>
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 group-hover:text-blue-700 dark:group-hover:text-blue-400">Lab User</p>
                  <p className="mt-0.5 font-mono text-[11px] text-gray-400 dark:text-gray-500">lab@lab.com · lab12345</p>
                </div>
                <span className="text-[10px] font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  Fill →
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
