export type UserRole = 'SUPER_ADMIN' | 'LAB_USER'
export type FieldType = 'text' | 'number' | 'checkbox' | 'date' | 'select' | 'calculated'
export type OrderStatus = 'PENDING' | 'IN_PROGRESS' | 'AWAITING_APPROVAL' | 'APPROVED' | 'REJECTED'

export interface UserProfile {
  id: number
  name: string
  email: string
  role: UserRole
}

export interface DashboardSummary {
  superAdmins: number
  labUsers: number
  templates: number
  activeTemplates: number
  patients: number
  orders: number
  completedOrders: number
  pendingOrders: number
}

export interface TestTemplateField {
  id: number
  fieldName: string
  fieldType: FieldType
  required: boolean
  optionsJson: string | null
  unit: string | null
  displayOrder: number
}

export interface TestTemplate {
  id: number
  name: string
  code: string
  active: boolean
  fields: TestTemplateField[]
}

export interface Patient {
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

export interface Order {
  id: number
  status: OrderStatus
  patient?: Patient
  template?: TestTemplate
  createdAt?: string
}

export interface OrderFormData {
  order: Order
  fields: TestTemplateField[]
}

export interface HistoryResult {
  fieldName: string
  fieldType: FieldType
  value: string | number | boolean
  unit?: string
}

export interface OrderResult {
  order: Order
  results: HistoryResult[]
}

export interface HistoryItem {
  orderId: number
  testName: string
  testCode: string
  status: string
  createdAt: string
  results: HistoryResult[]
}

export interface PatientHistory {
  patient: Patient
  history: HistoryItem[]
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: UserProfile
}
