import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FlaskConical, FileCheck, Clock, AlertCircle } from 'lucide-react'
import { api } from '../lib/api'

function fetchReportByToken(token: string) {
  return api.get(`/report-shares/${token}`).then(r => r.data) as Promise<{
    order: {
      id: number; status: string; createdAt: string;
      patient: { fullName: string; patientCode: string; age: number | null; gender: string | null; doctorName: string | null; city: string | null } | null;
      template: { name: string; code: string } | null;
    };
    expiresAt: string;
  }>
}

export default function PublicReportPage() {
  const { token } = useParams<{ token: string }>()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-report', token],
    queryFn: () => fetchReportByToken(token!),
    enabled: !!token,
    retry: false,
  })

  if (isLoading) return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
    </div>
  )

  if (isError) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100">
        <AlertCircle className="h-8 w-8 text-red-500" />
      </div>
      <h1 className="text-xl font-bold text-gray-900">Report Link Invalid or Expired</h1>
      <p className="max-w-sm text-sm text-gray-500">This report link may have expired or is no longer valid. Please contact the laboratory for a new link.</p>
    </div>
  )

  const { order, expiresAt } = data!

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="mx-auto max-w-2xl">
        {/* Lab header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
            <FlaskConical className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Laboratory Report</h1>
            <p className="text-xs text-gray-400">Secure shared report</p>
          </div>
        </div>

        {/* Status badge */}
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1">
          <FileCheck className="h-4 w-4 text-emerald-600" />
          <span className="text-xs font-semibold text-emerald-700">Report Approved</span>
        </div>

        {/* Patient info */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Patient Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400">Full Name</p>
              <p className="mt-0.5 font-semibold text-gray-900">{order.patient?.fullName ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Patient Code</p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-blue-600">{order.patient?.patientCode ?? '—'}</p>
            </div>
            {order.patient?.age && (
              <div>
                <p className="text-xs text-gray-400">Age / Gender</p>
                <p className="mt-0.5 text-gray-700">{order.patient.age} yrs {order.patient.gender ? `/ ${order.patient.gender}` : ''}</p>
              </div>
            )}
            {order.patient?.doctorName && (
              <div>
                <p className="text-xs text-gray-400">Referred By</p>
                <p className="mt-0.5 text-gray-700">{order.patient.doctorName}</p>
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Test Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400">Test Name</p>
                <p className="mt-0.5 font-semibold text-gray-900">{order.template?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Order #</p>
                <p className="mt-0.5 font-mono font-semibold text-gray-700">#{order.id}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Report Date</p>
                <p className="mt-0.5 text-gray-700">
                  {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
            <Clock className="h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-xs text-amber-700">
              This link expires on {new Date(expiresAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          This report was securely shared by the laboratory. For detailed test results, contact the lab directly.
        </p>
      </div>
    </div>
  )
}
