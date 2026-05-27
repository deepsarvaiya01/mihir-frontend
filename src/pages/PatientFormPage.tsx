import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Save, User, Phone, MapPin, AlertCircle, Building2,
  FlaskConical, CreditCard, Loader2,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Input'
import { patientService, type CreatePatientDto } from '../services/patients'
import { b2bLabService } from '../services/b2bLabs'
import { labBranchService } from '../services/labBranches'
import { templateService } from '../services/templates'
import { orderService } from '../services/orders'
import { PageLoader } from '../components/ui/Spinner'
import { toast } from 'sonner'

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say']
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const DISCOUNT_OPTIONS = [0, 5, 10, 15, 20, 25, 30, 50]

interface PatientFormState extends Omit<CreatePatientDto, 'age' | 'isB2b' | 'b2bLabId' | 'labBranchId'> {
  age: string
  isB2b: boolean
  b2bLabId: string
  labBranchId: string
}

const emptyForm: PatientFormState = {
  fullName: '', patientCode: '', age: '', dateOfBirth: '',
  gender: '', bloodGroup: '', email: '', phoneNumber: '',
  addressLine: '', city: '', state: '', postalCode: '',
  emergencyContactName: '', emergencyContactPhone: '',
  isB2b: false, b2bLabId: '', labBranchId: '',
  doctorName: '', reportDate: new Date().toISOString().split('T')[0],
}

function patientToForm(p: import('../types').Patient): PatientFormState {
  return {
    fullName: p.fullName ?? '', patientCode: p.patientCode ?? '',
    age: p.age != null ? String(p.age) : '', dateOfBirth: p.dateOfBirth ?? '',
    gender: p.gender ?? '', bloodGroup: p.bloodGroup ?? '',
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
    patientCode: form.patientCode,
    age: form.age ? Number(form.age) : undefined,
    dateOfBirth: form.dateOfBirth || undefined,
    gender: form.gender || undefined,
    bloodGroup: form.bloodGroup || undefined,
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

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
        {icon}
      </div>
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600">{title}</h3>
    </div>
  )
}

function FormCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {children}
    </div>
  )
}

export default function PatientFormPage() {
  const { id } = useParams<{ id?: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [form, setForm] = useState<PatientFormState>(emptyForm)
  const [selectedTests, setSelectedTests] = useState<Array<{ templateId: number }>>([])
  const [discount, setDiscount] = useState(0)
  const [paymentStatus, setPaymentStatus] = useState<'PENDING' | 'PAID' | 'PARTIAL'>('PENDING')
  const [paymentType, setPaymentType] = useState<'CASH' | 'CHEQUE' | 'ONLINE'>('CASH')

  // Lookups
  const { data: b2bLabs = [] } = useQuery({ queryKey: ['b2b-labs'], queryFn: b2bLabService.getAll })
  const { data: labBranches = [] } = useQuery({ queryKey: ['lab-branches'], queryFn: labBranchService.getAll })
  const { data: allTemplates = [] } = useQuery({ queryKey: ['templates'], queryFn: templateService.getAll })
  const activeTemplates = allTemplates.filter(t => t.active)

  // Load existing patient when editing
  const { data: existingPatient, isLoading: loadingPatient } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => patientService.getById(Number(id)),
    enabled: isEdit,
  })

  useEffect(() => {
    if (existingPatient) setForm(patientToForm(existingPatient))
  }, [existingPatient])

  const setField = (key: keyof PatientFormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [key]: e.target.value }))

  const toggleTest = (templateId: number) =>
    setSelectedTests(prev => {
      const exists = prev.find(t => t.templateId === templateId)
      if (exists) return prev.filter(t => t.templateId !== templateId)
      return [...prev, { templateId }]
    })

  const getTestPrice = (tmpl: typeof activeTemplates[0]): number => {
    if (form.isB2b && form.b2bLabId) {
      const b2bPrice = tmpl.b2bPrices?.find(p => p.b2bLabId === Number(form.b2bLabId))
      if (b2bPrice) return Number(b2bPrice.amount)
    }
    return Number(tmpl.amount)
  }

  const subtotal = selectedTests.reduce((sum, sel) => {
    const tmpl = activeTemplates.find(t => t.id === sel.templateId)
    if (!tmpl) return sum
    return sum + getTestPrice(tmpl)
  }, 0)
  const discountAmt = Math.round(subtotal * discount / 100)
  const netAmount = subtotal - discountAmt

  const createMutation = useMutation({
    mutationFn: async () => {
      const patient = await patientService.create(formToDto(form))
      if (selectedTests.length > 0) {
        const result = await orderService.createBatch({
          patientId: patient.id,
          orders: selectedTests.map(s => ({ templateId: s.templateId })),
          discount,
          paymentStatus,
          paymentType,
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
    onError: (err: unknown) =>
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save patient'),
  })

  const updateMutation = useMutation({
    mutationFn: () => patientService.update(Number(id), formToDto(form)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patients'] })
      qc.invalidateQueries({ queryKey: ['patient', id] })
      toast.success('Patient updated')
      navigate('/patients')
    },
    onError: (err: unknown) =>
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update patient'),
  })

  const handleSave = () => {
    if (!form.fullName.trim() || !form.patientCode.trim()) {
      toast.error('Full name and patient code are required')
      return
    }
    isEdit ? updateMutation.mutate() : createMutation.mutate()
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  if (isEdit && loadingPatient) return <PageLoader />

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/patients')}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              {isEdit ? `Edit Patient — ${existingPatient?.fullName ?? ''}` : 'Register New Patient'}
            </h1>
            <p className="text-xs text-slate-400">
              {isEdit ? 'Update patient information' : 'Create a comprehensive patient profile'}
            </p>
          </div>
        </div>
        <Button icon={isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} loading={isPending} onClick={handleSave}>
          {isEdit ? 'Save Changes' : 'Register Patient'}
        </Button>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        {/* Basic Information */}
        <FormCard>
          <SectionTitle icon={<User className="h-4 w-4" />} title="Basic Information" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input label="Full Name" placeholder="John Doe" value={form.fullName} onChange={setField('fullName')} required />
            <Input label="Patient Code" placeholder="P001" value={form.patientCode} onChange={setField('patientCode')} required />
            <Input label="Age" type="number" placeholder="25" value={form.age} onChange={setField('age')} />
            <Input label="Date of Birth" type="date" value={form.dateOfBirth} onChange={setField('dateOfBirth')} />
            <Select label="Gender" value={form.gender} onChange={setField('gender')}>
              <option value="">Select gender</option>
              {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
            </Select>
            <Select label="Blood Group" value={form.bloodGroup} onChange={setField('bloodGroup')}>
              <option value="">Select blood group</option>
              {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
            </Select>
          </div>
        </FormCard>

        {/* Contact */}
        <FormCard>
          <SectionTitle icon={<Phone className="h-4 w-4" />} title="Contact Information" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Email" type="email" placeholder="patient@email.com" value={form.email} onChange={setField('email')} />
            <Input label="Phone Number" placeholder="+91 98765 43210" value={form.phoneNumber} onChange={setField('phoneNumber')} />
          </div>
        </FormCard>

        {/* Address */}
        <FormCard>
          <SectionTitle icon={<MapPin className="h-4 w-4" />} title="Address" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Input label="Address Line" placeholder="123 Main Street" value={form.addressLine} onChange={setField('addressLine')} />
            </div>
            <Input label="City" placeholder="Mumbai" value={form.city} onChange={setField('city')} />
            <Input label="State" placeholder="Maharashtra" value={form.state} onChange={setField('state')} />
            <Input label="Postal Code" placeholder="400001" value={form.postalCode} onChange={setField('postalCode')} />
          </div>
        </FormCard>

        {/* Emergency Contact */}
        <FormCard>
          <SectionTitle icon={<AlertCircle className="h-4 w-4" />} title="Emergency Contact" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Contact Name" placeholder="Jane Doe" value={form.emergencyContactName} onChange={setField('emergencyContactName')} />
            <Input label="Contact Phone" placeholder="+91 98765 43210" value={form.emergencyContactPhone} onChange={setField('emergencyContactPhone')} />
          </div>
        </FormCard>

        {/* Referral & Visit */}
        <FormCard>
          <SectionTitle icon={<Building2 className="h-4 w-4" />} title="Referral & Visit Details" />
          <div className="space-y-5">
            {/* B2B toggle */}
            <div className="flex gap-6">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="radio" checked={!form.isB2b}
                  onChange={() => setForm(p => ({ ...p, isB2b: false, b2bLabId: '' }))}
                  className="h-4 w-4 accent-indigo-600"
                />
                <span className="text-sm font-medium text-slate-700">Individual Patient</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="radio" checked={form.isB2b}
                  onChange={() => setForm(p => ({ ...p, isB2b: true }))}
                  className="h-4 w-4 accent-indigo-600"
                />
                <span className="text-sm font-medium text-slate-700">B2B Referral</span>
              </label>
            </div>

            {form.isB2b && (
              <Select label="B2B Lab Partner" value={form.b2bLabId}
                onChange={e => setForm(p => ({ ...p, b2bLabId: e.target.value }))}>
                <option value="">Select B2B lab</option>
                {b2bLabs.filter(l => l.active).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </Select>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <Select label="Our Branch (Optional)" value={form.labBranchId}
                onChange={e => setForm(p => ({ ...p, labBranchId: e.target.value }))}>
                <option value="">Select branch</option>
                {labBranches.filter(b => b.active).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
              <Input label="Referring Doctor" placeholder="Dr. Name"
                value={form.doctorName ?? ''} onChange={setField('doctorName')} />
              <Input label="Report Date" type="date"
                value={form.reportDate ?? ''} onChange={setField('reportDate')} />
            </div>
          </div>
        </FormCard>

        {/* Test Selection — only on create */}
        {!isEdit && activeTemplates.length > 0 && (
          <FormCard>
            <SectionTitle icon={<FlaskConical className="h-4 w-4" />} title="Test Selection" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activeTemplates.map(tmpl => {
                const isSelected = !!selectedTests.find(t => t.templateId === tmpl.id)
                const price = getTestPrice(tmpl)
                return (
                  <div
                    key={tmpl.id}
                    onClick={() => toggleTest(tmpl.id)}
                    className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                      isSelected ? 'border-indigo-400 bg-indigo-50 shadow-sm' : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox" checked={isSelected}
                        onChange={() => toggleTest(tmpl.id)}
                        onClick={e => e.stopPropagation()}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-indigo-600"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-slate-800">{tmpl.name}</p>
                        <p className="text-xs font-mono text-slate-400">{tmpl.code}</p>
                        <p className="text-xs text-indigo-600 mt-1 font-medium">
                          ₹{price > 0 ? price.toLocaleString() : '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            {selectedTests.length > 0 && (
              <div className="mt-4 flex items-center gap-4 rounded-xl bg-indigo-50 px-4 py-3 text-sm">
                <span className="text-indigo-600">
                  <span className="font-bold">{selectedTests.length}</span> test{selectedTests.length !== 1 ? 's' : ''} selected
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-700">Subtotal: <span className="font-bold">₹{subtotal.toLocaleString()}</span></span>
              </div>
            )}
          </FormCard>
        )}

        {/* Payment — only on create with tests selected */}
        {!isEdit && selectedTests.length > 0 && (
          <FormCard>
            <SectionTitle icon={<CreditCard className="h-4 w-4" />} title="Payment" />
            <div className="space-y-5">
              {/* Discount */}
              <div className="flex items-center gap-4">
                <label className="text-sm font-semibold text-slate-700 shrink-0">Discount:</label>
                <div className="flex gap-2 flex-wrap">
                  {DISCOUNT_OPTIONS.map(d => (
                    <button
                      key={d}
                      onClick={() => setDiscount(d)}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ${
                        discount === d
                          ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                      }`}
                    >
                      {d}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount breakdown */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2.5 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>₹{subtotal.toLocaleString()}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount ({discount}%)</span>
                    <span>− ₹{discountAmt.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2.5 text-base">
                  <span>Net Amount</span>
                  <span>₹{netAmount.toLocaleString()}</span>
                </div>
              </div>

              {/* Payment type & status */}
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Payment Method</p>
                  <div className="flex gap-3 flex-wrap">
                    {(['CASH', 'CHEQUE', 'ONLINE'] as const).map(pt => (
                      <label key={pt} className={`flex items-center gap-2 cursor-pointer rounded-xl border px-3 py-2 transition-all ${
                        paymentType === pt ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200'
                      }`}>
                        <input
                          type="radio" checked={paymentType === pt}
                          onChange={() => setPaymentType(pt)}
                          className="h-4 w-4 accent-indigo-600"
                        />
                        <span className="text-sm font-medium capitalize">{pt.toLowerCase()}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Payment Status</p>
                  <div className="flex gap-3 flex-wrap">
                    {([
                      { value: 'PAID', color: 'emerald' },
                      { value: 'PENDING', color: 'amber' },
                      { value: 'PARTIAL', color: 'blue' },
                    ] as const).map(({ value: ps, color }) => (
                      <label key={ps} className={`flex items-center gap-2 cursor-pointer rounded-xl border px-3 py-2 transition-all ${
                        paymentStatus === ps
                          ? `border-${color}-400 bg-${color}-50 text-${color}-700`
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}>
                        <input
                          type="radio" checked={paymentStatus === ps}
                          onChange={() => setPaymentStatus(ps)}
                          className="h-4 w-4 accent-indigo-600"
                        />
                        <span className="text-sm font-medium capitalize">{ps.toLowerCase()}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </FormCard>
        )}

        {/* Bottom save button */}
        <div className="flex justify-end gap-3 pb-8">
          <button
            onClick={() => navigate('/patients')}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <Button
            icon={isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            loading={isPending}
            onClick={handleSave}
          >
            {isEdit ? 'Save Changes' : 'Register Patient'}
          </Button>
        </div>
      </div>
    </div>
  )
}
