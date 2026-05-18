import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const ACCESS_TOKEN_KEY = 'lab_access_token'
const REFRESH_TOKEN_KEY = 'lab_refresh_token'

type UserRole = 'SUPER_ADMIN' | 'LAB_USER'
type ViewKey = 'dashboard' | 'templates' | 'patients' | 'orders' | 'history'
type FieldType = 'text' | 'number' | 'checkbox' | 'date' | 'select'

type UserProfile = { id: number; name: string; email: string; role: UserRole }
type DashboardSummary = {
  superAdmins: number
  labUsers: number
  templates: number
  activeTemplates: number
  patients: number
  orders: number
  completedOrders: number
  pendingOrders: number
}
type TestTemplateField = {
  id: number
  fieldName: string
  fieldType: FieldType
  required: boolean
  optionsJson: string | null
  unit: string | null
}
type TestTemplate = { id: number; name: string; code: string; active: boolean; fields: TestTemplateField[] }
type Patient = {
  id: number
  fullName: string
  patientCode: string
  age: number | null
  dateOfBirth: string | null
  gender: string | null
  bloodGroup: string | null
  email: string | null
  phoneNumber: string | null
  addressLine: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
}
type Order = { id: number; status: string; patient?: Patient; template?: TestTemplate; createdAt?: string }
type HistoryResult = { fieldName: string; fieldType: FieldType; value: string | number | boolean; unit?: string }
type HistoryItem = {
  orderId: number
  testName: string
  testCode: string
  status: string
  createdAt: string
  results: HistoryResult[]
}

const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500'
const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500'
const cardClass = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'

function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [activeView, setActiveView] = useState<ViewKey>('dashboard')
  const [templates, setTemplates] = useState<TestTemplate[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null)
  const [historyPatientId, setHistoryPatientId] = useState('')
  const [patientHistory, setPatientHistory] = useState<{ patient: Patient | null; history: HistoryItem[] } | null>(null)

  const [templateForm, setTemplateForm] = useState({ name: '', code: '' })
  const [fieldForm, setFieldForm] = useState({
    templateId: '',
    fieldName: '',
    fieldType: 'text' as FieldType,
    required: false,
    options: '',
    unit: '',
  })

  const [patientForm, setPatientForm] = useState({
    fullName: '',
    patientCode: '',
    age: '',
    dateOfBirth: '',
    gender: '',
    bloodGroup: '',
    email: '',
    phoneNumber: '',
    addressLine: '',
    city: '',
    state: '',
    postalCode: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
  })
  const [orderForm, setOrderForm] = useState({ patientId: '', templateId: '' })
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [selectedOrderForm, setSelectedOrderForm] = useState<{ order: Order; fields: TestTemplateField[] } | null>(null)
  const [resultValues, setResultValues] = useState<Record<number, string | boolean>>({})
  const [highlightCol, setHighlightCol] = useState<number | null>(null)

  const visibleNavItems = useMemo(() => {
    if (profile?.role === 'SUPER_ADMIN') {
      return [
        { key: 'dashboard' as ViewKey, label: 'Executive Dashboard' },
        { key: 'templates' as ViewKey, label: 'Test Catalogue' },
      ]
    }
    return [
      { key: 'dashboard' as ViewKey, label: 'Lab Dashboard' },
      { key: 'patients' as ViewKey, label: 'Patient Intake' },
      { key: 'orders' as ViewKey, label: 'Orders & Result Entry' },
      { key: 'history' as ViewKey, label: 'Result History & Reports' },
    ]
  }, [profile?.role])

  const refreshAccessToken = useCallback(async () => {
    const refreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY)
    if (!refreshToken) throw new Error('Session expired')
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'Refresh failed')
    sessionStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken)
    sessionStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken)
    return data.accessToken as string
  }, [])

  const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers)
    const accessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY)
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
    let response = await fetch(url, { ...options, headers })
    if (response.status !== 401) return response
    const newToken = await refreshAccessToken()
    headers.set('Authorization', `Bearer ${newToken}`)
    response = await fetch(url, { ...options, headers })
    return response
  }, [refreshAccessToken])

  const readResponse = async (response: Response) => {
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'Request failed')
    return data
  }

  const loadProfile = useCallback(async () => {
    const data = await readResponse(await authFetch(`${API_URL}/auth/profile`))
    setProfile(data)
    return data as UserProfile
  }, [authFetch])

  const loadTemplates = useCallback(async () => {
    const data = await readResponse(await authFetch(`${API_URL}/tests/templates`))
    setTemplates(data)
  }, [authFetch])

  const loadPatients = useCallback(async () => {
    if (profile?.role !== 'LAB_USER') return
    const data = await readResponse(await authFetch(`${API_URL}/patients`))
    setPatients(data)
  }, [authFetch, profile?.role])

  const loadOrders = useCallback(async () => {
    if (profile?.role !== 'LAB_USER') return
    const data = await readResponse(await authFetch(`${API_URL}/orders`))
    setOrders(data)
  }, [authFetch, profile?.role])

  const loadDashboardSummary = useCallback(async () => {
    const data = await readResponse(await authFetch(`${API_URL}/dashboard/summary`))
    setDashboard(data)
  }, [authFetch])

  const initialLoad = useCallback(async () => {
    const user = await loadProfile()
    await loadTemplates()
    if (user.role === 'SUPER_ADMIN') {
      await loadDashboardSummary()
    }
  }, [loadProfile, loadTemplates, loadDashboardSummary])

  useEffect(() => {
    if (!sessionStorage.getItem(ACCESS_TOKEN_KEY)) return
    ;(async () => {
      try {
        await initialLoad()
      } catch {
        sessionStorage.removeItem(ACCESS_TOKEN_KEY)
        sessionStorage.removeItem(REFRESH_TOKEN_KEY)
      }
    })()
  }, [initialLoad])

  useEffect(() => {
    if (!profile) return
    ;(async () => {
      await loadPatients()
      await loadOrders()
    })()
  }, [profile, loadPatients, loadOrders])

  useEffect(() => {
    if (!profile) return
    if (profile.role !== 'SUPER_ADMIN' && activeView === 'templates') {
      setActiveView('dashboard')
    }
  }, [profile, activeView])

  const labDashboard = useMemo(
    () => ({
      templates: templates.length,
      patients: patients.length,
      orders: orders.length,
      completedOrders: orders.filter((item) => item.status === 'COMPLETED').length,
    }),
    [templates, patients, orders],
  )

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await readResponse(response)
      sessionStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken)
      sessionStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken)
      await initialLoad()
      setActiveView('dashboard')
      setMessage(`Welcome back, ${data.user.name}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY)
    sessionStorage.removeItem(REFRESH_TOKEN_KEY)
    setProfile(null)
    setActiveView('dashboard')
    setMessage('')
    setError('')
    setPatientHistory(null)
    setSelectedOrderForm(null)
    setSelectedOrderId('')
  }

  const createTemplate = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      await readResponse(await authFetch(`${API_URL}/tests/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateForm),
      }))
      setTemplateForm({ name: '', code: '' })
      await loadTemplates()
      if (profile?.role === 'SUPER_ADMIN') await loadDashboardSummary()
      setMessage('Test template created successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template')
    }
  }

  const addTemplateField = async (event: FormEvent) => {
    event.preventDefault()
    if (!fieldForm.templateId) return
    setError('')
    try {
      await readResponse(await authFetch(`${API_URL}/tests/templates/${fieldForm.templateId}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldName: fieldForm.fieldName,
          fieldType: fieldForm.fieldType,
          required: fieldForm.required,
          unit: fieldForm.unit || undefined,
          options: fieldForm.fieldType === 'select'
            ? fieldForm.options.split(',').map((item) => item.trim()).filter(Boolean)
            : undefined,
        }),
      }))
      setFieldForm((prev) => ({ ...prev, fieldName: '', fieldType: 'text', required: false, options: '', unit: '' }))
      await loadTemplates()
      if (profile?.role === 'SUPER_ADMIN') await loadDashboardSummary()
      setMessage('Field added to template')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add field')
    }
  }

  const createPatient = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      await readResponse(await authFetch(`${API_URL}/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...patientForm,
          age: patientForm.age ? Number(patientForm.age) : undefined,
          dateOfBirth: patientForm.dateOfBirth || undefined,
          gender: patientForm.gender || undefined,
          bloodGroup: patientForm.bloodGroup || undefined,
          email: patientForm.email || undefined,
          phoneNumber: patientForm.phoneNumber || undefined,
          addressLine: patientForm.addressLine || undefined,
          city: patientForm.city || undefined,
          state: patientForm.state || undefined,
          postalCode: patientForm.postalCode || undefined,
          emergencyContactName: patientForm.emergencyContactName || undefined,
          emergencyContactPhone: patientForm.emergencyContactPhone || undefined,
        }),
      }))
      setPatientForm({
        fullName: '', patientCode: '', age: '', dateOfBirth: '', gender: '', bloodGroup: '', email: '', phoneNumber: '',
        addressLine: '', city: '', state: '', postalCode: '', emergencyContactName: '', emergencyContactPhone: '',
      })
      await loadPatients()
      setMessage('Patient profile created')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create patient')
    }
  }

  const createOrder = async (event: FormEvent) => {
    event.preventDefault()
    if (!orderForm.patientId || !orderForm.templateId) return
    setError('')
    try {
      await readResponse(await authFetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: Number(orderForm.patientId), templateId: Number(orderForm.templateId) }),
      }))
      setOrderForm({ patientId: '', templateId: '' })
      await loadOrders()
      setMessage('Diagnostic order created')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order')
    }
  }

  const loadOrderForm = async () => {
    if (!selectedOrderId) return
    setError('')
    try {
      const data = await readResponse(await authFetch(`${API_URL}/orders/${selectedOrderId}/form`))
      setSelectedOrderForm(data)
      setResultValues({})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load order form')
    }
  }

  const submitResults = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedOrderForm) return
    setError('')
    try {
      await readResponse(await authFetch(`${API_URL}/orders/${selectedOrderForm.order.id}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          values: selectedOrderForm.fields.map((field) => ({
            fieldId: field.id,
            textValue: field.fieldType === 'text' || field.fieldType === 'select' ? String(resultValues[field.id] ?? '') : undefined,
            numberValue: field.fieldType === 'number' && resultValues[field.id] !== undefined ? Number(resultValues[field.id]) : undefined,
            booleanValue: field.fieldType === 'checkbox' ? Boolean(resultValues[field.id]) : undefined,
            dateValue: field.fieldType === 'date' ? String(resultValues[field.id] ?? '') : undefined,
          })),
        }),
      }))
      await loadOrders()
      setMessage('Results submitted successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit results')
    }
  }

  const loadPatientHistory = async () => {
    if (!historyPatientId) return
    setError('')
    try {
      const data = await readResponse(await authFetch(`${API_URL}/patients/${historyPatientId}/results-history`))
      setPatientHistory(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load patient history')
    }
  }

  const printReport = () => {
    if (!patientHistory?.patient) return
    const content = `
      <html><head><title>Patient Report</title><style>
      body{font-family:Arial;padding:24px;color:#111} h1{margin:0 0 8px} .card{border:1px solid #ddd;padding:12px;margin:12px 0;border-radius:8px}
      table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;padding:8px;text-align:left}
      </style></head><body>
      <h1>${patientHistory.patient.fullName} - Report</h1>
      <p>Code: ${patientHistory.patient.patientCode} | Phone: ${patientHistory.patient.phoneNumber ?? '-'}</p>
      ${patientHistory.history.map((item) => `
        <div class="card">
          <h3>${item.testName} (${item.testCode}) - ${item.status}</h3>
          <p>Date: ${new Date(item.createdAt).toLocaleString()}</p>
          <table><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>
            ${item.results.map((result) => `<tr><td>${result.fieldName}</td><td>${String(result.value)} ${result.unit ?? ''}</td></tr>`).join('')}
          </tbody></table>
        </div>`).join('')}
      </body></html>
    `
    const reportWindow = window.open('', '_blank')
    if (!reportWindow) return
    reportWindow.document.write(content)
    reportWindow.document.close()
    reportWindow.focus()
    reportWindow.print()
  }

  const renderFieldInput = (field: TestTemplateField) => {
    const value = resultValues[field.id]
    if (field.fieldType === 'checkbox') {
      return <input type="checkbox" checked={Boolean(value)} onChange={(e) => setResultValues((prev) => ({ ...prev, [field.id]: e.target.checked }))} />
    }
    if (field.fieldType === 'select') {
      const options = field.optionsJson ? (JSON.parse(field.optionsJson) as string[]) : []
      return (
        <select className={inputClass} value={String(value ?? '')} onChange={(e) => setResultValues((prev) => ({ ...prev, [field.id]: e.target.value }))}>
          <option value="">Select option</option>
          {options.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      )
    }
    return (
      <input
        type={field.fieldType === 'number' ? 'number' : field.fieldType === 'date' ? 'date' : 'text'}
        className={inputClass}
        value={String(value ?? '')}
        onChange={(e) => setResultValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
      />
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-900 to-violet-900 px-4 py-8 text-white">
        <div className="mx-auto mt-8 w-full max-w-5xl overflow-hidden rounded-3xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-xl md:grid md:grid-cols-2">
          <div className="hidden border-r border-white/15 p-10 md:block">
            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-indigo-100">Laboratory Intelligence</p>
            <h1 className="text-4xl font-bold leading-tight">Diagnostic Management Platform</h1>
            <p className="mt-6 text-indigo-100/90">
              Manage dynamic test definitions, patient records, result entry, and printable
              clinical reports with secure role-based access.
            </p>
            <div className="mt-8 space-y-3 text-sm text-indigo-100/90">
              <p className="rounded-lg bg-white/10 px-3 py-2">- Super admin: templates and dashboard analytics</p>
              <p className="rounded-lg bg-white/10 px-3 py-2">- Lab user: patient intake, orders, and reports</p>
              <p className="rounded-lg bg-white/10 px-3 py-2">- JWT access + refresh token session flow</p>
            </div>
          </div>
          <form className="bg-white p-8 text-slate-900 md:p-10" onSubmit={login}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Secure Login</p>
            <h2 className="mt-2 text-3xl font-bold">Welcome back</h2>
            <p className="mt-1 text-sm text-slate-500">Sign in to continue to your workspace.</p>
            <div className="mt-6 space-y-4">
              <div>
                <label className={labelClass}>Email</label>
                <input
                  className={`${inputClass} h-11`}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@lab.com"
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Password</label>
                <div className="relative">
                  <input
                    className={`${inputClass} h-11 pr-20`}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            </div>
            <button
              className="mt-6 h-11 w-full rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign in securely'}
            </button>
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Demo users: `admin@lab.com` / `admin123`, `lab@lab.com` / `lab12345`
            </div>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            {message && <p className="mt-3 text-sm text-green-700">{message}</p>}
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex">
        <aside className="min-h-screen w-72 bg-slate-950 p-5 text-slate-200">
          <h1 className="text-xl font-semibold">LabOps Console</h1>
          <p className="mt-1 text-xs text-slate-400">{profile.role === 'SUPER_ADMIN' ? 'Super Admin Workspace' : 'Laboratory Workspace'}</p>
          <div className="mt-8 space-y-1">
            {visibleNavItems.map((item) => (
              <button key={item.key} onClick={() => setActiveView(item.key)} className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${activeView === item.key ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}>
                {item.label}
              </button>
            ))}
          </div>
          <button className="mt-10 w-full rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white" onClick={logout}>Logout</button>
        </aside>
        <main className="flex-1 p-6">
          <div className={`${cardClass} mb-6`}>
            <p className="text-xs uppercase tracking-widest text-slate-500">Signed in</p>
            <p className="font-semibold">{profile.name} ({profile.email})</p>
            {message && <p className="mt-2 text-sm text-emerald-700">{message}</p>}
            {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
          </div>

          {activeView === 'dashboard' && (
            <div className="grid gap-4 md:grid-cols-4">
              <div className={cardClass}><p className="text-sm text-slate-500">Templates</p><p className="text-3xl font-bold">{dashboard?.templates ?? templates.length}</p></div>
              <div className={cardClass}><p className="text-sm text-slate-500">Patients</p><p className="text-3xl font-bold">{profile.role === 'SUPER_ADMIN' ? (dashboard?.patients ?? 0) : labDashboard.patients}</p></div>
              <div className={cardClass}><p className="text-sm text-slate-500">Orders</p><p className="text-3xl font-bold">{profile.role === 'SUPER_ADMIN' ? (dashboard?.orders ?? 0) : labDashboard.orders}</p></div>
              <div className={cardClass}><p className="text-sm text-slate-500">Completed</p><p className="text-3xl font-bold">{profile.role === 'SUPER_ADMIN' ? (dashboard?.completedOrders ?? 0) : labDashboard.completedOrders}</p></div>
            </div>
          )}

          {activeView === 'templates' && profile.role === 'SUPER_ADMIN' && (
            <div className="grid gap-6 xl:grid-cols-2">
              <form onSubmit={createTemplate} className="group rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-xl" >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">  Create Test Template </h3>
                    <p className="mt-1 text-sm text-slate-500"> Create and manage laboratory test templates </p>
                  </div>
                  <div className="rounded-xl bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700"> Template </div>
                </div>
                <div className="mt-5 space-y-4">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500"> Template Name </label>
                    <input
                      className="
                        w-full rounded-xl border border-slate-200 bg-slate-50
                        px-4 py-3 text-sm text-slate-700
                        transition-all duration-300 outline-none
                       focus:border-indigo-400
                       focus:bg-white
                        focus:ring-4 focus:ring-indigo-100
                       hover:border-indigo-300
                                                  "
                        value={templateForm.name} onChange={(e) => setTemplateForm((p) => ({
                          ...p,
                          name: e.target.value,
                     })) }
                      placeholder="Enter template name" required  />
                  </div>
                  <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500"> Template Code </label>
                      <input
                        className="
                          w-full rounded-xl border border-slate-200 bg-slate-50
                          px-4 py-3 text-sm text-slate-700
                          transition-all duration-300 outline-none
                          focus:border-indigo-400
                          focus:bg-white
                          focus:ring-4 focus:ring-indigo-100
                          hover:border-indigo-300 "
                        value={templateForm.code} onChange={(e) => setTemplateForm((p) => ({
                         ...p,
                         code: e.target.value,
                       })) }
                        placeholder="Enter template code" required />
                  </div>
                  <button
                    className="
                      rounded-xl border border-indigo-200
                      bg-gradient-to-r from-indigo-500 to-indigo-600
                      px-4 py-3 text-sm font-semibold text-white
                      transition-all duration-300
                      hover:from-indigo-600 hover:to-indigo-700
                      hover:shadow-xl hover:shadow-indigo-200
                      hover:-translate-y-0.5
                      active:scale-[0.98] " >
                          Save Template
                  </button>
                  </div>
              </form>
              <form onSubmit={addTemplateField}
                className="
                    rounded-2xl border border-slate-200 bg-white p-6
                    transition-all duration-300
                    hover:-translate-y-1
                    hover:border-indigo-300
                    hover:shadow-xl " >

                <div className="mb-6 flex items-start justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-800">
                      Add Dynamic Field
                    </h3>

                    <p className="mt-2 text-sm text-slate-500">
                      Configure fields for laboratory templates
                    </p>
                  </div>
                  <div
                    className="
                      rounded-full bg-emerald-50 px-4 py-1.5
                      text-xs font-semibold text-emerald-700
                      transition-all duration-300
                      hover:bg-emerald-100
                      hover:scale-105 " >
                    Dynamic Field
                  </div>
                </div>

                <div className="space-y-5">
            {/* Template */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Template
              </label>

              <select
                value={fieldForm.templateId}
                onChange={(e) =>
                  setFieldForm((p) => ({
                    ...p,
                    templateId: e.target.value,
                  }))
                }
                required
                className="
                  w-full rounded-xl border border-slate-200
                  bg-slate-50
                  px-4 py-3 text-sm text-slate-700
                  shadow-sm outline-none
                  transition-all duration-300

                  hover:border-indigo-300
                  hover:bg-white
                  hover:shadow-md

                  focus:border-indigo-400
                  focus:bg-white
                  focus:ring-4 focus:ring-indigo-100
                "
              >
                <option value="">Select Template</option>

                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Field Name
              </label>

              <input
                type="text"
                placeholder="Enter field name"
                value={fieldForm.fieldName}
                onChange={(e) =>
                  setFieldForm((p) => ({
                    ...p,
                    fieldName: e.target.value,
                  }))
                }
                required
                className="
                  w-full rounded-xl border border-slate-200
                  bg-slate-50
                  px-4 py-3 text-sm text-slate-700
                  shadow-sm outline-none
                  transition-all duration-300

                  hover:border-indigo-300
                  hover:bg-white
                  hover:shadow-md

                  focus:border-indigo-400
                  focus:bg-white
                  focus:ring-4 focus:ring-indigo-100
                "
              />
            </div>

            {/* Field Type */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Field Type
              </label>

              <select
                value={fieldForm.fieldType}
                onChange={(e) =>
                  setFieldForm((p) => ({
                    ...p,
                    fieldType: e.target.value as FieldType,
                  }))
                }
                className="
                  w-full rounded-xl border border-slate-200
                  bg-slate-50
                  px-4 py-3 text-sm text-slate-700
                  shadow-sm outline-none
                  transition-all duration-300

                  hover:border-indigo-300
                  hover:bg-white
                  hover:shadow-md

                  focus:border-indigo-400
                  focus:bg-white
                  focus:ring-4 focus:ring-indigo-100
                "
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="checkbox">Checkbox</option>
                <option value="date">Date</option>
                <option value="select">Dropdown Select</option>
              </select>
            </div>

            {/* Dropdown Options */}
            {fieldForm.fieldType === 'select' && (
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Dropdown Options
                </label>

                <input
                  type="text"
                  placeholder="Option1, Option2, Option3"
                  value={fieldForm.options}
                  onChange={(e) =>
                    setFieldForm((p) => ({
                      ...p,
                      options: e.target.value,
                    }))
                  }
                  className="
                    w-full rounded-xl border border-slate-200
                    bg-slate-50
                    px-4 py-3 text-sm text-slate-700
                    shadow-sm outline-none
                    transition-all duration-300

                    hover:border-indigo-300
                    hover:bg-white
                    hover:shadow-md

                    focus:border-indigo-400
                    focus:bg-white
                    focus:ring-4 focus:ring-indigo-100
                  "
                />
              </div>
            )}

            {/* Unit */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Unit (Optional)
              </label>

              <input
                type="text"
                placeholder="mg/dL"
                value={fieldForm.unit}
                onChange={(e) =>
                  setFieldForm((p) => ({
                    ...p,
                    unit: e.target.value,
                  }))
                }
                className="
                  w-full rounded-xl border border-slate-200
                  bg-slate-50
                  px-4 py-3 text-sm text-slate-700
                  shadow-sm outline-none
                  transition-all duration-300

                  hover:border-indigo-300
                  hover:bg-white
                  hover:shadow-md

                  focus:border-indigo-400
                  focus:bg-white
                  focus:ring-4 focus:ring-indigo-100
                "
              />
            </div>

            {/* Required Checkbox */}
            <label className="flex items-center gap-3 text-sm font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={fieldForm.required}
                onChange={(e) =>
                  setFieldForm((p) => ({
                    ...p,
                    required: e.target.checked,
                  }))
                }
                className="
                  h-5 w-5 rounded-md
                  border-slate-300
                  text-indigo-600
                  transition-all duration-200

                  hover:scale-110
                  focus:ring-2 focus:ring-indigo-200
                "
              />
              Required Field
            </label>

            {/* Button */}
            <button
              type="submit"
              className="
                w-full rounded-xl
                bg-gradient-to-r from-emerald-500 to-emerald-600
                px-4 py-3.5 text-sm font-semibold text-white
                shadow-lg shadow-emerald-200
                transition-all duration-300

                hover:-translate-y-1
                hover:from-emerald-600 hover:to-emerald-700
                hover:shadow-2xl hover:shadow-emerald-300

                active:scale-[0.98]
              "
            >
              Add Field
            </button>
          </div>
        </form>
              <div className={`${cardClass} xl:col-span-2`}>
                <h3 className="mb-3 text-lg font-semibold">Catalogue</h3>
                <div className="space-y-3">
                  {templates.map((template) => (
                    <div key={template.id} className="group rounded-2xl border border-slate-200 bg-white p-4 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-xl">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold">{template.name} <span className="text-sm text-slate-400">({template.code})</span></p>
                          <p className="mt-1 text-xs text-slate-500">{template.active ? 'Active' : 'Inactive'}</p>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 text-sm">
                        {template.fields && template.fields.length > 0 ? (
                          template.fields.map((field, idx) => (
                            <div
                              key={field.id}
                              onMouseEnter={() => setHighlightCol(idx)}
                              onMouseLeave={() => setHighlightCol(null)}
                              className={
                                 `relative overflow-hidden flex items-center justify-between w-full rounded-xl px-3 py-3 text-slate-700 border transition-all duration-300 cursor-pointer transform ` +
                                (highlightCol === idx
                                    ? 'border-indigo-400 bg-indigo-50 shadow-md scale-[1.02]'
                                    : 'border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-white hover:shadow-lg hover:scale-[1.01]')
                              }
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-medium">{field.fieldName}</span>
                                <span className="rounded bg-indigo-50 px-2 py-0.5 text-indigo-700 text-[11px]">{field.fieldType}</span>
                              </div>
                              {field.required && <span className="rounded bg-red-50 px-2 py-0.5 text-red-700 text-[11px]">required</span>}
                            </div>
                          ))
                        ) : (
                          <span className="text-sm text-slate-500">No fields configured.</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

         {activeView === 'patients' && profile.role === 'LAB_USER' && (
  <div className="grid gap-6 xl:grid-cols-3">

    {/* Create Patient Form */}
    <form
      onSubmit={createPatient}
      className="
        xl:col-span-2 rounded-2xl border border-slate-200
        bg-white p-6 transition-all duration-300
        hover:-translate-y-1
        hover:border-indigo-300
        hover:shadow-2xl
      "
    >

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">

        <div>
          <h3 className="text-2xl font-bold text-slate-800">
            Comprehensive Patient Intake
          </h3>

          <p className="mt-2 text-sm text-slate-500">
            Create and manage patient profiles
          </p>
        </div>

        <div
          className="
            rounded-full bg-indigo-50 px-4 py-1.5
            text-xs font-semibold text-indigo-700
            transition-all duration-300
            hover:bg-indigo-100
            hover:scale-105
          "
        >
          Patient
        </div>

      </div>

      {/* Inputs */}
      <div className="grid gap-5 md:grid-cols-2">

        {Object.entries(patientForm).map(([key, value]) => (
          <div
            key={key}
            className={key === 'addressLine' ? 'md:col-span-2' : ''}
          >

            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              {key.replace(/([A-Z])/g, ' $1')}
            </label>

            <input
              type={
                key === 'dateOfBirth'
                  ? 'date'
                  : key === 'age'
                  ? 'number'
                  : 'text'
              }
              value={value}
              onChange={(e) =>
                setPatientForm((prev) => ({
                  ...prev,
                  [key]: e.target.value,
                }))
              }
              required={
                key === 'fullName' || key === 'patientCode'
              }
              className="
                w-full rounded-xl border border-slate-200
                bg-slate-50
                px-4 py-3 text-sm text-slate-700
                shadow-sm outline-none
                transition-all duration-300

                hover:border-indigo-300
                hover:bg-white
                hover:shadow-md

                focus:border-indigo-400
                focus:bg-white
                focus:ring-4 focus:ring-indigo-100
              "
            />

          </div>
        ))}

      </div>

      {/* Button */}
      <button
        type="submit"
        className="
          mt-6 w-full rounded-xl
          bg-gradient-to-r from-indigo-500 to-indigo-600
          px-4 py-3.5 text-sm font-semibold text-white
          shadow-lg shadow-indigo-200
          transition-all duration-300

          hover:-translate-y-1
          hover:from-indigo-600 hover:to-indigo-700
          hover:shadow-2xl hover:shadow-indigo-300

          active:scale-[0.98]
        "
      >
        Create Patient Profile
      </button>

    </form>

    {/* Recent Patients */}
    <div
      className="
        rounded-2xl border border-slate-200
        bg-white p-6 transition-all duration-300
        hover:border-indigo-300
        hover:shadow-2xl
      "
    >

      {/* Header */}
      <div className="mb-5 flex items-center justify-between">

        <div>
          <h3 className="text-xl font-bold text-slate-800">
            Recent Patients
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Recently added profiles
          </p>
        </div>

        <div
          className="
            rounded-full bg-slate-100 px-3 py-1
            text-xs font-semibold text-slate-600
          "
        >
          {patients.length} Patients
        </div>

      </div>

      {/* Patient List */}
      <div className="space-y-3">

        {patients.map((patient) => (
          <div
            key={patient.id}
            className="
              rounded-xl border border-slate-200
              bg-slate-50 p-4
              transition-all duration-300

              hover:-translate-y-0.5
              hover:border-indigo-300
              hover:bg-white
              hover:shadow-lg
            "
          >

            <p className="font-semibold text-slate-800">
              {patient.fullName}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              {patient.patientCode}
            </p>

          </div>
        ))}

      </div>

    </div>

  </div>
)}

          {activeView === 'orders' && profile.role === 'LAB_USER' && (
  <div className="grid gap-6 xl:grid-cols-2">

    {/* Create Order */}
    <form
      onSubmit={createOrder}
      className="
        rounded-2xl border border-slate-200 bg-white p-6
        transition-all duration-300
        hover:-translate-y-1
        hover:border-indigo-300
        hover:shadow-2xl
      "
    >

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">

        <div>
          <h3 className="text-2xl font-bold text-slate-800">
            Create Diagnostic Order
          </h3>

          <p className="mt-2 text-sm text-slate-500">
            Create laboratory diagnostic requests
          </p>
        </div>

        <div
          className="
            rounded-full bg-indigo-50 px-4 py-1.5
            text-xs font-semibold text-indigo-700
            transition-all duration-300
            hover:bg-indigo-100
            hover:scale-105
          "
        >
          Orders
        </div>

      </div>

      {/* Form Fields */}
      <div className="space-y-5">

        {/* Patient */}
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Patient
          </label>

          <select
            value={orderForm.patientId}
            onChange={(e) =>
              setOrderForm((p) => ({
                ...p,
                patientId: e.target.value,
              }))
            }
            required
            className="
              w-full rounded-xl border border-slate-200
              bg-slate-50
              px-4 py-3 text-sm text-slate-700
              shadow-sm outline-none
              transition-all duration-300

              hover:border-indigo-300
              hover:bg-white
              hover:shadow-md

              focus:border-indigo-400
              focus:bg-white
              focus:ring-4 focus:ring-indigo-100
            "
          >
            <option value="">Select patient</option>

            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.fullName} ({patient.patientCode})
              </option>
            ))}
          </select>
        </div>

        {/* Test Template */}
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Test Template
          </label>

          <select
            value={orderForm.templateId}
            onChange={(e) =>
              setOrderForm((p) => ({
                ...p,
                templateId: e.target.value,
              }))
            }
            required
            className="
              w-full rounded-xl border border-slate-200
              bg-slate-50
              px-4 py-3 text-sm text-slate-700
              shadow-sm outline-none
              transition-all duration-300

              hover:border-indigo-300
              hover:bg-white
              hover:shadow-md

              focus:border-indigo-400
              focus:bg-white
              focus:ring-4 focus:ring-indigo-100
            "
          >
            <option value="">Select test</option>

            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>

        {/* Button */}
        <button
          type="submit"
          className="
            w-full rounded-xl
            bg-gradient-to-r from-indigo-500 to-indigo-600
            px-4 py-3.5 text-sm font-semibold text-white
            shadow-lg shadow-indigo-200
            transition-all duration-300

            hover:-translate-y-1
            hover:from-indigo-600 hover:to-indigo-700
            hover:shadow-2xl hover:shadow-indigo-300

            active:scale-[0.98]
          "
        >
          Create Order
        </button>

      </div>
    </form>

    {/* Dynamic Result Entry */}
    <div
      className="
        rounded-2xl border border-slate-200 bg-white p-6
        transition-all duration-300
        hover:-translate-y-1
        hover:border-indigo-300
        hover:shadow-2xl
      "
    >

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">

        <div>
          <h3 className="text-2xl font-bold text-slate-800">
            Dynamic Result Entry
          </h3>

          <p className="mt-2 text-sm text-slate-500">
            Load and submit patient test results
          </p>
        </div>

        <div
          className="
            rounded-full bg-emerald-50 px-4 py-1.5
            text-xs font-semibold text-emerald-700
            transition-all duration-300
            hover:bg-emerald-100
            hover:scale-105
          "
        >
          Results
        </div>

      </div>

      {/* Load Order */}
      <div className="mb-5 flex gap-3">

        <input
          placeholder="Enter Order ID"
          value={selectedOrderId}
          onChange={(e) => setSelectedOrderId(e.target.value)}
          className="
            flex-1 rounded-xl border border-slate-200
            bg-slate-50
            px-4 py-3 text-sm text-slate-700
            shadow-sm outline-none
            transition-all duration-300

            hover:border-indigo-300
            hover:bg-white
            hover:shadow-md

            focus:border-indigo-400
            focus:bg-white
            focus:ring-4 focus:ring-indigo-100
          "
        />

        <button
          type="button"
          onClick={loadOrderForm}
          className="
            rounded-xl bg-slate-800 px-5 py-3
            text-sm font-semibold text-white
            transition-all duration-300

            hover:-translate-y-1
            hover:bg-slate-900
            hover:shadow-xl

            active:scale-[0.98]
          "
        >
          Load
        </button>

      </div>

      {/* Result Form */}
      {selectedOrderForm && (
        <form onSubmit={submitResults} className="space-y-5">

          {selectedOrderForm.fields.map((field) => (
            <div key={field.id}>

              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                {field.fieldName}
                {field.unit ? ` (${field.unit})` : ''}
              </label>

              {renderFieldInput(field)}

            </div>
          ))}

          <button
            type="submit"
            className="
              w-full rounded-xl
              bg-gradient-to-r from-emerald-500 to-emerald-600
              px-4 py-3.5 text-sm font-semibold text-white
              shadow-lg shadow-emerald-200
              transition-all duration-300

              hover:-translate-y-1
              hover:from-emerald-600 hover:to-emerald-700
              hover:shadow-2xl hover:shadow-emerald-300

              active:scale-[0.98]
            "
          >
            Submit Results
          </button>

        </form>
      )}

    </div>

    {/* Recent Orders */}
    <div
      className="
        xl:col-span-2 rounded-2xl border border-slate-200
        bg-white p-6 transition-all duration-300
        hover:border-indigo-300
        hover:shadow-2xl
      "
    >

      {/* Header */}
      <div className="mb-5 flex items-center justify-between">

        <div>
          <h3 className="text-2xl font-bold text-slate-800">
            Recent Orders
          </h3>

          <p className="mt-2 text-sm text-slate-500">
            Recently created laboratory orders
          </p>
        </div>

        <div
          className="
            rounded-full bg-slate-100 px-4 py-1.5
            text-xs font-semibold text-slate-600
          "
        >
          {orders.length} Orders
        </div>

      </div>

      {/* Orders Grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">

        {orders.map((order) => (
          <div
            key={order.id}
            className="
              rounded-xl border border-slate-200
              bg-slate-50 p-4
              transition-all duration-300

              hover:-translate-y-1
              hover:border-indigo-300
              hover:bg-white
              hover:shadow-xl
            "
          >

            <p className="font-semibold text-slate-800">
              Order #{order.id}
            </p>

            <p className="mt-2 text-sm text-slate-700">
              {order.patient?.fullName ?? '-'}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              {order.template?.name ?? '-'}
            </p>

            <span
              className="
                mt-3 inline-block rounded-full
                bg-slate-100 px-3 py-1
                text-xs font-semibold text-slate-600
              "
            >
              {order.status}
            </span>

          </div>
        ))}

      </div>

    </div>

  </div>
)}

          {activeView === 'history' && profile.role === 'LAB_USER' && (
  <div className="space-y-6">

    {/* Top Actions */}
    <div
      className="
        rounded-2xl border border-slate-200 bg-white p-6
        transition-all duration-300
        hover:border-indigo-300
        hover:shadow-2xl
      "
    >

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">

        <div>
          <h3 className="text-2xl font-bold text-slate-800">
            Patient Result History
          </h3>

          <p className="mt-2 text-sm text-slate-500">
            View and export patient diagnostic reports
          </p>
        </div>

        <div
          className="
            rounded-full bg-indigo-50 px-4 py-1.5
            text-xs font-semibold text-indigo-700
            transition-all duration-300
            hover:bg-indigo-100
            hover:scale-105
          "
        >
          History
        </div>

      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">

        {/* Patient Select */}
        <div className="flex-1">

          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Patient
          </label>

          <select
            value={historyPatientId}
            onChange={(e) => setHistoryPatientId(e.target.value)}
            className="
              w-full rounded-xl border border-slate-200
              bg-slate-50
              px-4 py-3 text-sm text-slate-700
              shadow-sm outline-none
              transition-all duration-300

              hover:border-indigo-300
              hover:bg-white
              hover:shadow-md

              focus:border-indigo-400
              focus:bg-white
              focus:ring-4 focus:ring-indigo-100
            "
          >
            <option value="">Select patient</option>

            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.fullName} ({patient.patientCode})
              </option>
            ))}
          </select>

        </div>

        {/* Load Button */}
        <button
          onClick={loadPatientHistory}
          className="
            rounded-xl
            bg-gradient-to-r from-indigo-500 to-indigo-600
            px-5 py-3 text-sm font-semibold text-white
            shadow-lg shadow-indigo-200
            transition-all duration-300

            hover:-translate-y-1
            hover:from-indigo-600 hover:to-indigo-700
            hover:shadow-2xl hover:shadow-indigo-300

            active:scale-[0.98]
          "
        >
          Load History
        </button>

        {/* Print Button */}
        <button
          onClick={printReport}
          className="
            rounded-xl
            bg-gradient-to-r from-slate-700 to-slate-800
            px-5 py-3 text-sm font-semibold text-white
            shadow-lg shadow-slate-200
            transition-all duration-300

            hover:-translate-y-1
            hover:from-slate-800 hover:to-slate-900
            hover:shadow-2xl hover:shadow-slate-300

            active:scale-[0.98]
          "
        >
          Export PDF / Print
        </button>

      </div>

    </div>

    {/* History Results */}
    {patientHistory?.patient && (
      <div
        className="
          rounded-2xl border border-slate-200 bg-white p-6
          transition-all duration-300
          hover:border-indigo-300
          hover:shadow-2xl
        "
      >

        {/* Patient Header */}
        <div className="mb-6 flex items-center justify-between">

          <div>
            <h3 className="text-2xl font-bold text-slate-800">
              {patientHistory.patient.fullName}
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              Diagnostic Result History
            </p>
          </div>

          <div
            className="
              rounded-full bg-emerald-50 px-4 py-1.5
              text-xs font-semibold text-emerald-700
            "
          >
            {patientHistory.history.length} Reports
          </div>

        </div>

        {/* Reports */}
        <div className="space-y-4">

          {patientHistory.history.map((item) => (
            <div
              key={item.orderId}
              className="
                rounded-2xl border border-slate-200
                bg-slate-50 p-5
                transition-all duration-300

                hover:-translate-y-1
                hover:border-indigo-300
                hover:bg-white
                hover:shadow-xl
              "
            >

              {/* Report Header */}
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">

                <div>

                  <h4 className="text-lg font-bold text-slate-800">
                    {item.testName} ({item.testCode})
                  </h4>

                  <p className="mt-1 text-sm text-slate-500">
                    Order #{item.orderId} •{" "}
                    {new Date(item.createdAt).toLocaleString()}
                  </p>

                </div>

                <span
                  className="
                    inline-flex w-fit rounded-full
                    bg-indigo-100 px-3 py-1
                    text-xs font-semibold text-indigo-700
                  "
                >
                  {item.status}
                </span>

              </div>

              {/* Results */}
              <div className="mt-5 grid gap-3 md:grid-cols-2">

                {item.results.map((result, idx) => (
                  <div
                    key={idx}
                    className="
                      rounded-xl border border-slate-200
                      bg-white px-4 py-3
                      transition-all duration-300

                      hover:border-indigo-300
                      hover:shadow-md
                    "
                  >

                    <p className="text-sm text-slate-500">
                      {result.fieldName}
                    </p>

                    <p className="mt-1 font-semibold text-slate-800">
                      {String(result.value)} {result.unit ?? ''}
                    </p>

                  </div>
                ))}

              </div>

            </div>
          ))}

          {/* Empty State */}
          {patientHistory.history.length === 0 && (
            <div
              className="
                rounded-2xl border border-dashed border-slate-300
                bg-slate-50 p-10 text-center
              "
            >

              <p className="text-sm text-slate-500">
                No reports available for this patient.
              </p>

            </div>
          )}
        </div>

      </div>
    )}

  </div>
)}
        </main>
      </div>
    </div>
  )
}

export default App
