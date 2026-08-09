import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react'
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
  const [logoFailed, setLogoFailed] = useState(false)

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
    <div className="login-root flex min-h-screen w-full">
      {/* ── Brand stage (full-bleed) ─────────────────────────── */}
      <aside className="relative hidden min-h-screen w-[54%] shrink-0 overflow-hidden lg:flex lg:flex-col">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 90% 70% at 20% 15%, #2563eb 0%, transparent 55%), radial-gradient(ellipse 70% 80% at 90% 90%, #1e3a8a 0%, transparent 50%), linear-gradient(155deg, #0c2340 0%, #13407a 42%, #1d4ed8 100%)',
          }}
        />

        {/* Soft specimen-grid texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'radial-gradient(ellipse 75% 70% at 40% 45%, black 20%, transparent 75%)',
          }}
        />

        {/* Assay waveform — visual anchor */}
        <svg
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] w-full opacity-40"
          viewBox="0 0 800 360"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <linearGradient id="waveFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
          </defs>
          <path
            className="login-wave"
            d="M0 220 C80 180 120 260 200 210 C280 160 320 280 400 200 C480 120 520 250 600 190 C680 130 720 240 800 180 L800 360 L0 360 Z"
            fill="url(#waveFill)"
          />
          <path
            className="login-wave-line"
            d="M0 220 C80 180 120 260 200 210 C280 160 320 280 400 200 C480 120 520 250 600 190 C680 130 720 240 800 180"
            fill="none"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          {/* Precision tick marks */}
          {[100, 200, 300, 400, 500, 600, 700].map((x) => (
            <line
              key={x}
              x1={x}
              y1="320"
              x2={x}
              y2="340"
              stroke="rgba(255,255,255,0.25)"
              strokeWidth="1.5"
            />
          ))}
        </svg>

        {/* Floating precision rings */}
        <div className="login-orbit pointer-events-none absolute right-[8%] top-[18%] h-48 w-48 rounded-full border border-white/15" />
        <div className="login-orbit-delay pointer-events-none absolute right-[12%] top-[22%] h-32 w-32 rounded-full border border-white/20" />

        <div className="relative z-10 flex flex-1 flex-col justify-between px-12 py-12 xl:px-16">
          <div className="login-enter flex items-center gap-3">
            {!logoFailed && (
              <img
                src="/Rameshwar.png"
                alt=""
                className="h-11 w-auto brightness-0 invert"
                onError={() => setLogoFailed(true)}
              />
            )}
            <span className="font-login-display text-[15px] font-semibold tracking-wide text-white/90">
              LabOps
            </span>
          </div>

          <div className="login-enter max-w-lg pb-6" style={{ animationDelay: '120ms' }}>
            <p className="mb-4 font-login-display text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-100/70">
              Diagnostic operations
            </p>
            <h1 className="font-login-display text-[2.75rem] font-semibold leading-[1.08] tracking-tight text-white xl:text-[3.25rem]">
              Rameshwar
              <span className="mt-1 block font-normal text-blue-100/85">
                Diagnostic Laboratory
              </span>
            </h1>
            <p className="mt-6 max-w-sm text-[15px] leading-relaxed text-blue-50/75">
              Secure access to orders, results, and reporting — built for precision lab workflows.
            </p>
          </div>

          <p className="login-enter text-xs text-white/40" style={{ animationDelay: '220ms' }}>
            Authorized staff only · Encrypted session
          </p>
        </div>
      </aside>

      {/* ── Sign-in panel ────────────────────────────────────── */}
      <main className="relative flex w-full flex-col justify-center px-6 py-12 sm:px-10 lg:w-[46%] lg:px-14 xl:px-20">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, #eef2f7 0%, #f6f8fb 48%, #e8eef6 100%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(37, 99, 235, 0.08) 1px, transparent 0)',
            backgroundSize: '22px 22px',
          }}
        />

        <div className="login-enter relative z-10 mx-auto w-full max-w-[380px]">
          {/* Mobile brand */}
          <div className="mb-10 flex flex-col items-start gap-3 lg:hidden">
            {!logoFailed && (
              <img
                src="/Rameshwar.png"
                alt="Rameshwar Diagnostic Laboratory"
                className="h-10 w-auto"
                onError={() => setLogoFailed(true)}
              />
            )}
            <div>
              <p className="font-login-display text-xl font-semibold tracking-tight text-[#1d4ed8]">
                Rameshwar Diagnostic
              </p>
              <p className="mt-0.5 text-xs font-medium uppercase tracking-[0.2em] text-[#1d4ed8]/60">
                LabOps Console
              </p>
            </div>
          </div>

          <h2 className="font-login-display text-[1.65rem] font-semibold tracking-tight text-[#0f172a]">
            Sign in
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-[#475569]">
            Enter your credentials to open the console.
          </p>

          <form onSubmit={handleLogin} className="mt-9 space-y-5">
            <div className="login-field group">
              <label htmlFor="login-identifier" className="mb-2 block text-[12px] font-semibold text-[#334155]">
                Email or username
              </label>
              <input
                id="login-identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@laboratory.com"
                required
                autoComplete="username"
                className="login-input w-full border-0 border-b-2 border-[#1d4ed8]/20 bg-transparent py-3 text-[15px] text-[#0f172a] outline-none transition placeholder:text-[#94a3b8] focus:border-[#1d4ed8]"
              />
            </div>

            <div className="login-field group">
              <label htmlFor="login-password" className="mb-2 block text-[12px] font-semibold text-[#334155]">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  className="login-input w-full border-0 border-b-2 border-[#1d4ed8]/20 bg-transparent py-3 pr-10 text-[15px] text-[#0f172a] outline-none transition placeholder:text-[#94a3b8] focus:border-[#1d4ed8]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-[#94a3b8] transition hover:text-[#1d4ed8]"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="login-submit group relative mt-3 flex w-full items-center justify-center gap-2 overflow-hidden bg-[#1d4ed8] px-5 py-3.5 text-[14px] font-semibold text-white transition hover:bg-[#1e40af] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          <p className="mt-10 text-center text-[12px] text-[#94a3b8] lg:text-left">
            Need access? Contact your lab administrator.
          </p>
        </div>
      </main>
    </div>
  )
}
