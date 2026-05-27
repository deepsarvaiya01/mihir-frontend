export type UserRole = 'SUPER_ADMIN' | 'LAB_USER'
export type FieldType = 'text' | 'number' | 'checkbox' | 'date' | 'select' | 'calculated'
export type OrderStatus = 'PENDING' | 'IN_PROGRESS' | 'AWAITING_APPROVAL' | 'APPROVED' | 'REJECTED'
export type PaymentStatus = 'PENDING' | 'PAID' | 'PARTIAL'
export type PaymentType = 'CASH' | 'CHEQUE' | 'ONLINE'

export interface UserProfile { id: number; name: string; email: string; role: UserRole }
export interface DashboardSummary { superAdmins: number; labUsers: number; templates: number; activeTemplates: number; patients: number; orders: number; completedOrders: number; pendingOrders: number }
export interface TestTemplateField { id: number; fieldName: string; fieldType: FieldType; required: boolean; optionsJson: string | null; unit: string | null; displayOrder: number; referenceRange: string | null; isSectionHeader: boolean }
export interface TestTemplateB2bPrice { id: number; b2bLabId: number; amount: number }
export interface TestTemplate { id: number; name: string; code: string; active: boolean; amount: number; fields: TestTemplateField[]; b2bPrices: TestTemplateB2bPrice[] }

export interface B2bLab { id: number; name: string; contactPerson: string | null; phone: string | null; email: string | null; address: string | null; city: string | null; active: boolean }
export interface LabBranch { id: number; name: string; address: string | null; phone: string | null; active: boolean }

export interface Patient {
  id: number; fullName: string; patientCode: string; age: number | null; dateOfBirth: string | null
  gender: string | null; bloodGroup: string | null; email: string | null; phoneNumber: string | null
  addressLine: string | null; city: string | null; state: string | null; postalCode: string | null
  emergencyContactName: string | null; emergencyContactPhone: string | null
  isB2b: boolean; b2bLabId: number | null; labBranchId: number | null; doctorName: string | null; reportDate: string | null
}

export interface Order {
  id: number; status: OrderStatus; patient?: Patient; template?: TestTemplate; createdAt?: string
  amount: number; discount: number; netAmount: number
  paymentStatus: PaymentStatus; paymentType: PaymentType | null
  receiptNumber: string | null
  attachmentBase64: string | null
  attachmentName: string | null
}

export interface OrderFormData { order: Order; fields: TestTemplateField[] }
export interface HistoryResult { fieldName: string; fieldType: FieldType; value: string | number | boolean | null; unit?: string | null; referenceRange?: string | null; isSectionHeader?: boolean }
export interface LabSettings { lab_name?: string; lab_address?: string; lab_email?: string; lab_phone?: string; lab_timing?: string; lab_logo_base64?: string; doctor_name?: string; doctor_qualification?: string }
export interface ActiveSignature { id: number; name: string; imageData: string; isActive: boolean }
export interface OrderResult { order: Order; results: HistoryResult[] }
export interface HistoryItem { orderId: number; testName: string; testCode: string; status: string; createdAt: string; results: HistoryResult[] }
export interface PatientHistory { patient: Patient; history: HistoryItem[] }
export interface LoginResponse { accessToken: string; refreshToken: string; user: UserProfile }
