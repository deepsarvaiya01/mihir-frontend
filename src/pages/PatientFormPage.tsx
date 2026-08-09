import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Save, FlaskConical, Loader2, Upload, FileText, X,
  Search, UserCircle2, Image, Trash2, ExternalLink,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { Card, CardHeader } from '../components/ui/Card'
import { Input, Select } from '../components/ui/Input'
import { patientService, type CreatePatientDto } from '../services/patients'
import { b2bLabService } from '../services/b2bLabs'
import { labBranchService } from '../services/labBranches'
import { doctorService } from '../services/doctors'
import { templateService } from '../services/templates'
import { profileService } from '../services/profiles'
import { orderService } from '../services/orders'
import { PageLoader } from '../components/ui/Spinner'
import { toast } from 'sonner'
import { toastError } from '../lib/errors'
import { toTitleCase } from '../lib/utils'

const GENDERS = ['Male', 'Female']
const DISCOUNT_OPTIONS = [0, 5, 10, 15, 20, 25, 30, 50]

const PAYMENT_STATUS_STYLES = {
  PAID: { active: 'border-emerald-400 bg-emerald-50 text-emerald-700', idle: 'border-gray-200 bg-white text-gray-600 hover:border-emerald-200' },
  PENDING: { active: 'border-amber-400 bg-amber-50 text-amber-700', idle: 'border-gray-200 bg-white text-gray-600 hover:border-amber-200' },
  PARTIAL: { active: 'border-blue-400 bg-blue-50 text-blue-700', idle: 'border-gray-200 bg-white text-gray-600 hover:border-blue-200' },
} as const

interface PatientFormState extends Omit<CreatePatientDto, 'ageYears' | 'ageMonths' | 'ageDays' | 'dateOfBirth' | 'isB2b' | 'b2bLabId' | 'labBranchId' | 'patientCode'> {
  dateOfBirth: string
  ageYears: string
  ageMonths: string
  ageDays: string
  isB2b: boolean
  b2bLabId: string
  labBranchId: string
}

const emptyForm: PatientFormState = {
  fullName: '', dateOfBirth: '', ageYears: '', ageMonths: '', ageDays: '',
  gender: '', email: '', phoneNumber: '',
  addressLine: '', city: '', state: '', postalCode: '',
  emergencyContactName: '', emergencyContactPhone: '',
  isB2b: false, b2bLabId: '', labBranchId: '',
  doctorName: '', reportDate: new Date().toISOString().split('T')[0],
}

function patientToForm(p: import('../types').Patient): PatientFormState {
  return {
    fullName: p.fullName ?? '',
    dateOfBirth: p.dateOfBirth ? p.dateOfBirth.split('T')[0] : '',
    ageYears: p.ageYears != null ? String(p.ageYears) : '',
    ageMonths: p.ageMonths != null ? String(p.ageMonths) : '',
    ageDays: p.ageDays != null ? String(p.ageDays) : '',
    gender: p.gender ?? '',
    email: p.email ?? '', phoneNumber: p.phoneNumber ?? '',
    addressLine: p.addressLine ?? '', city: p.city ?? '',
    state: p.state ?? '', postalCode: p.postalCode ?? '',
    emergencyContactName: p.emergencyContactName ?? '',
    emergencyContactPhone: p.emergencyContactPhone ?? '',
    isB2b: p.isB2b ?? false,
    b2bLabId: p.b2bLabId != null ? String(p.b2bLabId) : '',
    labBranchId: p.labBranchId != null ? String(p.labBranchId) : '',
    doctorName: p.doctorName ?? '',
    reportDate: p.reportDate ?? new Date().toISOString().split('T')[0],
  }
}

function formToDto(form: PatientFormState): CreatePatientDto {
  return {
    fullName: form.fullName,
    ageYears: form.ageYears ? Number(form.ageYears) : undefined,
    ageMonths: form.ageMonths ? Number(form.ageMonths) : undefined,
    ageDays: form.ageDays ? Number(form.ageDays) : undefined,
    dateOfBirth: form.dateOfBirth || undefined,
    gender: form.gender || undefined,
    email: form.email || undefined,
    phoneNumber: form.phoneNumber || undefined,
    addressLine: form.addressLine || undefined,
    city: form.city || undefined,
    state: form.state || undefined,
    postalCode: form.postalCode || undefined,
    emergencyContactName: form.emergencyContactName || undefined,
    emergencyContactPhone: form.emergencyContactPhone || undefined,
    isB2b: form.isB2b,
    b2bLabId: form.b2bLabId ? Number(form.b2bLabId) : null,
    labBranchId: form.labBranchId ? Number(form.labBranchId) : null,
    doctorName: form.doctorName || undefined,
    reportDate: form.reportDate || undefined,
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext ?? '')) {
    return <Image className="h-5 w-5 text-violet-500" />
  }
  return <FileText className="h-5 w-5 text-blue-500" />
}

interface LocalDocEntry {
  localId: string; name: string; file: File; previewUrl: string; uploading?: boolean
}

function FormDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <p className="shrink-0 text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <div className="h-px flex-1 bg-gray-100" />
    </div>
  )
}

export default function PatientFormPage() {
  const { id } = useParams<{ id?: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [form, setForm] = useState<PatientFormState>(emptyForm)
  const [selectedTests, setSelectedTests] = useState<Array<{ kind: 'template' | 'profile'; id: number }>>([])
  const [discount, setDiscount] = useState(0)
  const [paymentStatus, setPaymentStatus] = useState<'PENDING' | 'PAID' | 'PARTIAL'>('PENDING')
  const [paymentType, setPaymentType] = useState<'CASH' | 'CHEQUE' | 'ONLINE'>('CASH')

  const [testSearch, setTestSearch] = useState('')

  const [localDocs, setLocalDocs] = useState<LocalDocEntry[]>([])
  const [pendingFile, setPendingFile] = useState<{ file: File; name: string } | null>(null)
  const [deletingDocId, setDeletingDocId] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: b2bLabs = [] } = useQuery({ queryKey: ['b2b-labs'], queryFn: b2bLabService.getAll })
  const { data: labBranches = [] } = useQuery({ queryKey: ['lab-branches'], queryFn: labBranchService.getAll })
  const { data: doctors = [] } = useQuery({ queryKey: ['doctors'], queryFn: doctorService.getAll })
  const activeDoctors = doctors.filter(d => d.active)
  const { data: allTemplates = [] } = useQuery({ queryKey: ['templates'], queryFn: templateService.getAll })
  const activeTemplates = allTemplates.filter(t => t.active)
  const { data: allProfiles = [] } = useQuery({ queryKey: ['profiles'], queryFn: profileService.getAll })
  const activeProfiles = allProfiles.filter(p => p.active)

  const { data: existingPatient, isLoading: loadingPatient } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => patientService.getById(Number(id)),
    enabled: isEdit,
  })

  useEffect(() => {
    if (existingPatient) setForm(patientToForm(existingPatient))
  }, [existingPatient])

  useEffect(() => {
    return () => { localDocs.forEach(d => URL.revokeObjectURL(d.previewUrl)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setField = (key: keyof PatientFormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [key]: e.target.value }))

  // Tests that belong to a currently-selected profile — disabled individually to avoid double-booking the same test.
  const disabledTemplateInfo = new Map<number, string>()
  for (const sel of selectedTests) {
    if (sel.kind !== 'profile') continue
    const profile = activeProfiles.find(p => p.id === sel.id)
    if (!profile) continue
    for (const t of profile.templates) {
      if (!disabledTemplateInfo.has(t.id)) disabledTemplateInfo.set(t.id, profile.name)
    }
  }

  const toggleTest = (kind: 'template' | 'profile', id: number) => {
    if (kind === 'template' && disabledTemplateInfo.has(id)) return
    setSelectedTests(prev => {
      if (prev.find(t => t.kind === kind && t.id === id)) {
        return prev.filter(t => !(t.kind === kind && t.id === id))
      }
      if (kind === 'profile') {
        // Selecting a profile supersedes any of its member tests already picked individually
        const memberIds = new Set(activeProfiles.find(p => p.id === id)?.templates.map(t => t.id) ?? [])
        const withoutMembers = prev.filter(t => !(t.kind === 'template' && memberIds.has(t.id)))
        return [...withoutMembers, { kind, id }]
      }
      return [...prev, { kind, id }]
    })
  }

  const getItemPrice = (kind: 'template' | 'profile', id: number): number => {
    if (kind === 'profile') {
      const profile = activeProfiles.find(p => p.id === id)
      return profile ? Number(profile.amount) : 0
    }
    const tmpl = activeTemplates.find(t => t.id === id)
    if (!tmpl) return 0
    if (form.isB2b && form.b2bLabId) {
      const b2bPrice = tmpl.b2bPrices?.find(p => p.b2bLabId === Number(form.b2bLabId))
      if (b2bPrice) return Number(b2bPrice.amount)
    }
    return Number(tmpl.amount)
  }

  // Profiles (packages) are listed first, then individual tests — one combined, searchable list.
  const pickableItems = [
    ...activeProfiles.map(p => ({ kind: 'profile' as const, id: p.id, name: p.name, code: p.code, testCount: p.templates.length })),
    ...activeTemplates.map(t => ({ kind: 'template' as const, id: t.id, name: t.name, code: t.code, testCount: null as number | null })),
  ]

  const filteredTemplatesForDropdown = pickableItems.filter(it =>
    it.name.toLowerCase().includes(testSearch.toLowerCase()) ||
    it.code.toLowerCase().includes(testSearch.toLowerCase())
  )

  const subtotal = selectedTests.reduce((sum, sel) => sum + getItemPrice(sel.kind, sel.id), 0)
  const discountAmt = Math.round(subtotal * discount / 100)
  const netAmount = subtotal - discountAmt

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingFile({ file, name: file.name.replace(/\.[^/.]+$/, '') })
    e.target.value = ''
  }

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((res, rej) => {
      const reader = new FileReader()
      reader.onload = () => res(reader.result as string)
      reader.onerror = rej
      reader.readAsDataURL(file)
    })

  const uploadDocMutation = useMutation({
    mutationFn: async ({ patientId, name, file }: { patientId: number; name: string; file: File; localId: string }) => {
      const fileBase64 = await fileToBase64(file)
      return patientService.uploadDocument(patientId, name, fileBase64)
    },
    onSuccess: (_, vars) => {
      setLocalDocs(prev => prev.filter(d => d.localId !== vars.localId))
      qc.invalidateQueries({ queryKey: ['patient', id] })
    },
    onError: (err, vars) => {
      setLocalDocs(prev => prev.map(d => d.localId === vars.localId ? { ...d, uploading: false } : d))
      toastError(err, 'Failed to upload document')
    },
  })

  const deleteDocMutation = useMutation({
    mutationFn: (docId: number) => patientService.deleteDocument(Number(id), docId),
    onSuccess: () => {
      setDeletingDocId(null)
      qc.invalidateQueries({ queryKey: ['patient', id] })
    },
    onError: (err) => { setDeletingDocId(null); toastError(err, 'Failed to delete document') },
  })

  const confirmAddDocument = () => {
    if (!pendingFile) return
    const localId = `${Date.now()}-${Math.random()}`
    const previewUrl = URL.createObjectURL(pendingFile.file)
    const name = pendingFile.name.trim() || pendingFile.file.name
    setPendingFile(null)

    if (isEdit && id) {
      setLocalDocs(prev => [...prev, { localId, name, file: pendingFile.file, previewUrl, uploading: true }])
      uploadDocMutation.mutate({ patientId: Number(id), name, file: pendingFile.file, localId })
    } else {
      setLocalDocs(prev => [...prev, { localId, name, file: pendingFile.file, previewUrl }])
    }
  }

  const removeLocalDoc = (localId: string) => {
    setLocalDocs(prev => {
      const doc = prev.find(d => d.localId === localId)
      if (doc) URL.revokeObjectURL(doc.previewUrl)
      return prev.filter(d => d.localId !== localId)
    })
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const patient = await patientService.create(formToDto(form))
      if (localDocs.length > 0) {
        await Promise.allSettled(localDocs.map(async d => {
          const fileBase64 = await fileToBase64(d.file)
          return patientService.uploadDocument(patient.id, d.name, fileBase64)
        }))
      }
      if (selectedTests.length > 0) {
        const result = await orderService.createBatch({
          patientId: patient.id,
          orders: selectedTests.map(s => s.kind === 'profile' ? { profileId: s.id } : { templateId: s.id }),
          discount, paymentStatus, paymentType,
        })
        toast.success(`Patient registered · ${selectedTests.length} test(s) · Receipt: ${result.receiptNumber}`)
      } else {
        toast.success('Patient profile created')
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patients'] })
      qc.invalidateQueries({ queryKey: ['orders'] })
      navigate('/patients')
    },
    onError: (err) => toastError(err, 'Failed to save patient'),
  })

  const updateMutation = useMutation({
    mutationFn: () => patientService.update(Number(id), formToDto(form)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patients'] })
      qc.invalidateQueries({ queryKey: ['patient', id] })
      toast.success('Patient updated')
      navigate('/patients')
    },
    onError: (err) => toastError(err, 'Failed to update patient'),
  })

  const handleSave = () => {
    if (!form.fullName.trim()) {
      toast.error('Full name is required')
      return
    }
    isEdit ? updateMutation.mutate() : createMutation.mutate()
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  if (isEdit && loadingPatient) return <PageLoader />

  const pageTitle = isEdit ? `Edit Patient` : 'New Patient'
  const pageSubtitle = isEdit
    ? `Update profile for ${existingPatient?.fullName ?? 'patient'}`
    : 'Register a patient and optionally assign diagnostic tests'

  const headerActions = (
    <div className="flex items-center gap-2">
      <Button variant="secondary" size="sm" onClick={() => navigate('/patients')} icon={<ArrowLeft className="h-4 w-4" />}>
        Back
      </Button>
      <Button
        size="sm"
        icon={isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        loading={isPending}
        onClick={handleSave}
      >
        {isEdit ? 'Save Changes' : 'Register Patient'}
      </Button>
    </div>
  )

  return (
    <div>
      <Header title={pageTitle} subtitle={pageSubtitle} action={headerActions} />

      <div className="p-6">
        <div className={`mx-auto grid max-w-7xl gap-6 ${!isEdit ? 'lg:grid-cols-3' : 'max-w-4xl'}`}>

          {/* ── Main form column ── */}
          <div className={`space-y-6 ${!isEdit ? 'lg:col-span-2' : ''}`}>

            {/* Visit & referral */}
            <Card padding="lg">
              <CardHeader
                title="Visit & Referral"
                subtitle="Patient type, branch, and referring doctor"
              />
              <div className="space-y-5">
                <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, isB2b: false, b2bLabId: '' }))}
                    className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${
                      !form.isB2b ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Individual
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, isB2b: true }))}
                    className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${
                      form.isB2b ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    B2B Referral
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {form.isB2b && (
                    <Select label="B2B Lab Partner" value={form.b2bLabId}
                      onChange={e => setForm(p => ({ ...p, b2bLabId: e.target.value }))}>
                      <option value="">Select B2B lab</option>
                      {b2bLabs.filter(l => l.active).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </Select>
                  )}
                  <Select label="Lab Branch" value={form.labBranchId}
                    onChange={e => setForm(p => ({ ...p, labBranchId: e.target.value }))}>
                    <option value="">Select branch (optional)</option>
                    {labBranches.filter(b => b.active).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </Select>
                  <Input label="Report Date" type="date"
                    value={form.reportDate ?? ''} onChange={setField('reportDate')} />
                  <Select label="Referring Doctor" value={form.doctorName ?? ''}
                    onChange={e => setForm(p => ({ ...p, doctorName: e.target.value }))}>
                    <option value="">Self</option>
                    {form.doctorName && !activeDoctors.some(d => d.name === form.doctorName) && (
                      <option value={form.doctorName}>{form.doctorName}</option>
                    )}
                    {activeDoctors.map(d => (
                      <option key={d.id} value={d.name}>{d.name}{d.degreeName ? ` (${d.degreeName})` : ''}</option>
                    ))}
                  </Select>
                </div>
              </div>
            </Card>

            {/* Patient information */}
            <Card padding="lg">
              <CardHeader
                title="Patient Information"
                subtitle="Personal, contact, and address details"
                badge={isEdit && existingPatient?.patientCode ? (
                  <span className="rounded-full bg-blue-50 px-3 py-1 font-mono text-xs font-semibold text-blue-700">
                    {existingPatient.patientCode}
                  </span>
                ) : undefined}
              />

              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Input label="Full Name" placeholder="Enter patient's full name"
                      value={form.fullName}
                      onChange={e => setForm(p => ({ ...p, fullName: toTitleCase(e.target.value) }))}
                      required />
                  </div>
                  <Input label="Date of Birth" type="date"
                    value={form.dateOfBirth} onChange={setField('dateOfBirth')} />
                  <Select label="Gender" value={form.gender} onChange={setField('gender')}>
                    <option value="">Select gender</option>
                    {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                  </Select>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Age</label>
                    <div className="grid grid-cols-3 gap-3">
                      <Input type="number" min={0} max={130} placeholder="Years"
                        value={form.ageYears} onChange={setField('ageYears')} />
                      <Input type="number" min={0} max={11} placeholder="Months"
                        value={form.ageMonths} onChange={setField('ageMonths')} />
                      <Input type="number" min={0} max={30} placeholder="Days"
                        value={form.ageDays} onChange={setField('ageDays')} />
                    </div>
                  </div>
                </div>

                <FormDivider label="Contact" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Phone Number" placeholder="+91 98765 43210"
                    value={form.phoneNumber} onChange={setField('phoneNumber')} />
                  <Input label="Email Address" type="email" placeholder="patient@email.com"
                    value={form.email} onChange={setField('email')} />
                </div>

                <FormDivider label="Address" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Input label="Street Address" placeholder="House no., street, area"
                      value={form.addressLine} onChange={setField('addressLine')} />
                  </div>
                  <Input label="City" placeholder="City" value={form.city} onChange={setField('city')} />
                  <Input label="State" placeholder="State" value={form.state} onChange={setField('state')} />
                  <Input label="Postal Code" placeholder="PIN / ZIP"
                    value={form.postalCode} onChange={setField('postalCode')} />
                </div>

                <FormDivider label="Emergency Contact" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Contact Name" placeholder="Emergency contact name"
                    value={form.emergencyContactName}
                    onChange={e => setForm(p => ({ ...p, emergencyContactName: toTitleCase(e.target.value) }))} />
                  <Input label="Contact Phone" placeholder="+91 98765 43210"
                    value={form.emergencyContactPhone} onChange={setField('emergencyContactPhone')} />
                </div>
              </div>
            </Card>

            {/* Documents */}
            <Card padding="lg">
              <CardHeader
                title="Supporting Documents"
                subtitle="Prescriptions, reports, or ID proofs"
              />

              <input ref={fileInputRef} type="file" className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.gif,.webp"
                onChange={handleFileSelect} />

              {/* Saved documents (edit mode) */}
              {isEdit && (existingPatient?.documents ?? []).length > 0 && (
                <div className="mb-3 space-y-2">
                  {(existingPatient?.documents ?? []).map(doc => (
                    <div key={doc.id}
                      className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-100 bg-white">
                        {getFileIcon(doc.name)}
                      </div>
                      <a href={doc.url} target="_blank" rel="noopener noreferrer"
                        className="group min-w-0 flex-1" title="Open document">
                        <p className="truncate text-sm font-medium text-gray-800 group-hover:text-blue-600">{doc.name}</p>
                        <p className="truncate text-xs text-gray-400">
                          {new Date(doc.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </a>
                      <a href={doc.url} target="_blank" rel="noopener noreferrer"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-500 transition-colors"
                        title="Open">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <button
                        onClick={() => { setDeletingDocId(doc.id); deleteDocMutation.mutate(doc.id) }}
                        disabled={deleteDocMutation.isPending && deletingDocId === doc.id}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50"
                        title="Delete">
                        {deleteDocMutation.isPending && deletingDocId === doc.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Local (queued/uploading) documents */}
              {localDocs.length > 0 && (
                <div className="mb-3 space-y-2">
                  {localDocs.map(doc => (
                    <div key={doc.localId}
                      className="flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50/40 px-4 py-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-white">
                        {doc.uploading
                          ? <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                          : getFileIcon(doc.file.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-800">{doc.name}</p>
                        <p className="text-xs text-gray-400">
                          {doc.uploading ? 'Uploading…' : formatBytes(doc.file.size)}
                        </p>
                      </div>
                      {!doc.uploading && (
                        <button onClick={() => removeLocalDoc(doc.localId)}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                          title="Remove">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {pendingFile ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
                  <p className="mb-3 text-sm font-medium text-gray-700">Name this document</p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input autoFocus type="text" value={pendingFile.name}
                      onChange={e => setPendingFile(p => p ? { ...p, name: e.target.value } : null)}
                      onKeyDown={e => { if (e.key === 'Enter') confirmAddDocument(); if (e.key === 'Escape') setPendingFile(null) }}
                      placeholder="Document name"
                      className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={confirmAddDocument}>Add</Button>
                      <Button size="sm" variant="secondary" onClick={() => setPendingFile(null)}>Cancel</Button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">{pendingFile.file.name} · {formatBytes(pendingFile.file.size)}</p>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50/50 py-8 text-sm text-gray-500 transition-all hover:border-blue-300 hover:bg-blue-50/30 hover:text-blue-600">
                  <Upload className="h-5 w-5" />
                  <span className="font-medium">Click to upload a document</span>
                  <span className="text-xs text-gray-400">PDF, JPG, PNG, or Word · Max 10 MB</span>
                </button>
              )}
            </Card>
          </div>

          {/* ── Order sidebar (create only) ── */}
          {!isEdit && (
            <div className="space-y-6">
              <div className="lg:sticky lg:top-6 space-y-6">

                {/* Patient preview */}
                <Card padding="lg" className="border-blue-100 bg-gradient-to-br from-blue-50/80 to-white">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
                      {form.fullName.trim() ? form.fullName.charAt(0).toUpperCase() : <UserCircle2 className="h-6 w-6" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900">
                        {form.fullName.trim() || 'New Patient'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {form.isB2b ? 'B2B Referral' : 'Individual'} · Code assigned on save
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Test selection */}
                <Card padding="lg">
                  <div className="mb-4 flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Diagnostic Tests</h3>
                      <p className="mt-0.5 text-xs text-gray-400">Select tests to order with this registration</p>
                    </div>
                    {selectedTests.length > 0 && (
                      <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        {selectedTests.length} selected
                      </span>
                    )}
                  </div>

                  {pickableItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-10 text-center dark:border-gray-700">
                      <FlaskConical className="mb-2 h-7 w-7 text-gray-200 dark:text-gray-600" />
                      <p className="text-sm font-medium text-gray-400">No active templates</p>
                      <p className="mt-0.5 text-xs text-gray-300 dark:text-gray-600">Add templates from Test Catalogue first</p>
                    </div>
                  ) : (
                    <>
                      {/* Search */}
                      <div className="relative mb-2">
                        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={testSearch}
                          onChange={e => setTestSearch(e.target.value)}
                          placeholder="Search by name or code…"
                          className="w-full rounded-lg border border-gray-200 bg-gray-50/80 py-2 pl-9 pr-3 text-sm outline-none transition-all focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-500/15 dark:border-gray-600 dark:bg-gray-700/40 dark:text-gray-100 dark:focus:bg-gray-700"
                        />
                      </div>

                      {/* Template list */}
                      <div className="max-h-60 overflow-y-auto rounded-xl border border-gray-100 dark:border-gray-700">
                        {filteredTemplatesForDropdown.length === 0 ? (
                          <div className="px-4 py-8 text-center text-sm text-gray-400">
                            No tests match "{testSearch}"
                          </div>
                        ) : filteredTemplatesForDropdown.map((item, idx) => {
                          const isSelected = !!selectedTests.find(t => t.kind === item.kind && t.id === item.id)
                          const coveredByProfile = item.kind === 'template' ? disabledTemplateInfo.get(item.id) : undefined
                          const price = getItemPrice(item.kind, item.id)
                          return (
                            <button
                              key={`${item.kind}-${item.id}`}
                              type="button"
                              disabled={!!coveredByProfile}
                              title={coveredByProfile ? `Already included in the "${coveredByProfile}" package` : undefined}
                              onClick={() => toggleTest(item.kind, item.id)}
                              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                                idx > 0 ? 'border-t border-gray-50 dark:border-gray-700/60' : ''
                              } ${
                                coveredByProfile
                                  ? 'cursor-not-allowed bg-gray-50 opacity-50 dark:bg-gray-800/40'
                                  : isSelected
                                    ? 'bg-blue-50/80 hover:bg-blue-100/80 dark:bg-blue-900/20 dark:hover:bg-blue-900/30'
                                    : 'bg-white hover:bg-gray-50/80 dark:bg-transparent dark:hover:bg-gray-700/20'
                              }`}
                            >
                              <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-all ${
                                isSelected
                                  ? 'border-blue-600 bg-blue-600'
                                  : 'border-gray-300 dark:border-gray-500'
                              }`}>
                                {isSelected && (
                                  <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 12 12">
                                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  {item.kind === 'profile' && (
                                    <span className="shrink-0 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                                      Package · {item.testCount}
                                    </span>
                                  )}
                                  <p className={`truncate text-sm font-medium leading-tight ${
                                    isSelected ? 'text-blue-800 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200'
                                  }`}>
                                    {item.name}
                                  </p>
                                  {coveredByProfile && (
                                    <span className="shrink-0 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                                      In {coveredByProfile}
                                    </span>
                                  )}
                                </div>
                                <p className="mt-0.5 font-mono text-xs text-gray-400">{item.code}</p>
                              </div>
                              <span className={`shrink-0 text-sm font-semibold ${
                                isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
                              }`}>
                                {price > 0 ? `₹${price.toLocaleString()}` : 'Free'}
                              </span>
                            </button>
                          )
                        })}
                      </div>

                      {/* Selection summary */}
                      {selectedTests.length > 0 ? (
                        <div className="mt-3 flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2 dark:bg-blue-900/20">
                          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                            {selectedTests.length} test{selectedTests.length !== 1 ? 's' : ''} selected
                          </span>
                          <span className="text-sm font-bold text-blue-800 dark:text-blue-200">
                            ₹{subtotal.toLocaleString()}
                          </span>
                        </div>
                      ) : (
                        <p className="mt-2.5 text-center text-xs text-gray-400">
                          Click a test to select it
                        </p>
                      )}
                    </>
                  )}
                </Card>

                {/* Payment summary */}
                {selectedTests.length > 0 && (
                  <Card padding="lg">
                    <CardHeader title="Payment" subtitle="Discount and billing details" />

                    <div className="space-y-4">
                      <div>
                        <p className="mb-2 text-xs font-medium text-gray-500">Discount</p>
                        <div className="flex flex-wrap gap-1.5">
                          {DISCOUNT_OPTIONS.map(d => (
                            <button key={d} type="button" onClick={() => setDiscount(d)}
                              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-all ${
                                discount === d
                                  ? 'border-blue-500 bg-blue-600 text-white'
                                  : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200'
                              }`}>
                              {d}%
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-2 text-sm">
                        <div className="flex justify-between text-gray-600">
                          <span>Subtotal</span><span>₹{subtotal.toLocaleString()}</span>
                        </div>
                        {discount > 0 && (
                          <div className="flex justify-between text-emerald-600">
                            <span>Discount ({discount}%)</span><span>− ₹{discountAmt.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold text-gray-900">
                          <span>Net Amount</span><span>₹{netAmount.toLocaleString()}</span>
                        </div>
                      </div>

                      <div>
                        <p className="mb-2 text-xs font-medium text-gray-500">Payment Method</p>
                        <div className="grid grid-cols-3 gap-2">
                          {(['CASH', 'CHEQUE', 'ONLINE'] as const).map(pt => (
                            <button key={pt} type="button" onClick={() => setPaymentType(pt)}
                              className={`rounded-lg border py-2 text-xs font-medium capitalize transition-all ${
                                paymentType === pt
                                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                              }`}>
                              {pt.toLowerCase()}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="mb-2 text-xs font-medium text-gray-500">Payment Status</p>
                        <div className="grid grid-cols-3 gap-2">
                          {(['PAID', 'PENDING', 'PARTIAL'] as const).map(ps => (
                            <button key={ps} type="button" onClick={() => setPaymentStatus(ps)}
                              className={`rounded-lg border py-2 text-xs font-medium capitalize transition-all ${
                                paymentStatus === ps
                                  ? PAYMENT_STATUS_STYLES[ps].active
                                  : PAYMENT_STATUS_STYLES[ps].idle
                              }`}>
                              {ps.toLowerCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Register CTA */}
                <Card padding="lg" className="border-gray-200">
                  <Button
                    className="w-full"
                    size="lg"
                    icon={isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    loading={isPending}
                    onClick={handleSave}
                  >
                    {selectedTests.length > 0
                      ? `Register & Create ${selectedTests.length} Order${selectedTests.length !== 1 ? 's' : ''}`
                      : 'Register Patient'}
                  </Button>
                  <p className="mt-3 text-center text-xs text-gray-400">
                    Patient code will be generated automatically
                  </p>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
