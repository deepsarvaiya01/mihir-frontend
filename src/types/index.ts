export type UserRole = 'SUPER_ADMIN' | 'LAB_USER'
export type FieldType = 'text' | 'number' | 'checkbox' | 'date' | 'select' | 'calculated'
export type OrderStatus = 'PENDING' | 'IN_PROGRESS' | 'AWAITING_APPROVAL' | 'APPROVED' | 'REJECTED'
export type PaymentStatus = 'PENDING' | 'PAID' | 'PARTIAL'
export type PaymentType = 'CASH' | 'CHEQUE' | 'ONLINE'
export type SummaryFormat = 'paragraph' | 'points'

export interface UserProfile { id: number; name: string; email: string; role: UserRole }
export interface DashboardSummary { superAdmins: number; labUsers: number; templates: number; activeTemplates: number; patients: number; orders: number; completedOrders: number; pendingOrders: number }
export interface TestTemplateField { id: number; fieldName: string; fieldType: FieldType; required: boolean; optionsJson: string | null; unit: string | null; displayOrder: number; referenceRange: string | null; referenceRangeMale: string | null; referenceRangeFemale: string | null; isSectionHeader: boolean; isMainHeader: boolean; isLineResult: boolean }
export interface TestTemplateB2bPrice { id: number; b2bLabId: number; amount: number }
export interface TestCategory { id: number; name: string; code: string; displayOrder: number; active: boolean; deletedAt?: string | null }
export interface TestTemplate { id: number; name: string; code: string; active: boolean; amount: number; summaryTitle: string | null; summary: string | null; summaryFormat: SummaryFormat; categoryId: number | null; category?: TestCategory | null; fields: TestTemplateField[]; b2bPrices: TestTemplateB2bPrice[] }
export interface TestProfile { id: number; name: string; code: string; active: boolean; amount: number; templates: TestTemplate[]; deletedAt?: string | null }

export interface B2bLab { id: number; name: string; contactPerson: string | null; phone: string | null; email: string | null; address: string | null; city: string | null; active: boolean; deletedAt?: string | null }
export interface PatientDocument { id: number; patientId: number; name: string; url: string; createdAt: string }
export interface LabBranch { id: number; name: string; address: string | null; phone: string | null; active: boolean; deletedAt?: string | null }
export interface Doctor { id: number; name: string; degreeName: string | null; active: boolean; deletedAt?: string | null }

export interface Patient {
  id: number; fullName: string; patientCode: string
  ageYears: number | null; ageMonths: number | null; ageDays: number | null; dateOfBirth: string | null
  gender: string | null; bloodGroup: string | null; email: string | null; phoneNumber: string | null
  addressLine: string | null; city: string | null; state: string | null; postalCode: string | null
  emergencyContactName: string | null; emergencyContactPhone: string | null
  isB2b: boolean; b2bLabId: number | null; labBranchId: number | null; doctorName: string | null; reportDate: string | null
  b2bLab?: B2bLab | null
  documents?: PatientDocument[]
  createdAt?: string
}

export interface Order {
  id: number; status: OrderStatus; patient?: Patient; template?: TestTemplate; createdAt?: string
  amount: number; discount: number; netAmount: number
  paymentStatus: PaymentStatus; paymentType: PaymentType | null
  receiptNumber: string | null
  attachmentUrl: string | null
  attachmentName: string | null
  revertRemark: string | null
}

export interface OrderFormData { order: Order; fields: TestTemplateField[] }
export interface HistoryResult { fieldId?: number; fieldName: string; fieldType: FieldType; value: string | number | boolean | null; unit?: string | null; referenceRange?: string | null; isSectionHeader?: boolean; isMainHeader?: boolean; isLineResult?: boolean }
export interface LabSettings {
  lab_name?: string; lab_address?: string; lab_email?: string; lab_phone?: string; lab_timing?: string
  lab_logo_base64?: string; doctor_name?: string; doctor_qualification?: string
  lab_gstin?: string; lab_hsn_code?: string
  barcode_x_mm?: string; barcode_y_mm?: string
}
export interface ActiveSignature { id: number; name: string; degreeName?: string | null; imageUrl: string; isActive: boolean }
export interface Logo { id: number; name: string; imageUrl: string; isActive: boolean; createdAt: string; deletedAt?: string | null }
export interface OrderResult { order: Order; results: HistoryResult[] }
export interface HistoryItem { orderId: number; testName: string; testCode: string; status: string; createdAt: string; results: HistoryResult[] }
export interface PatientHistory { patient: Patient; history: HistoryItem[] }
export interface LoginResponse { accessToken: string; user: UserProfile }
