import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { History, Printer, ChevronDown, ChevronUp, Calendar, FileCheck } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Input'
import { EmptyState } from '../components/ui/EmptyState'
import { PageLoader } from '../components/ui/Spinner'
import { Badge } from '../components/ui/Badge'
import { patientService } from '../services/patients'
import type { PatientHistory } from '../types'
import { toast } from 'sonner'

export default function HistoryPage() {
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null)
  const [history, setHistory] = useState<PatientHistory | null>(null)

  const { data: patients = [], isLoading: patientsLoading } = useQuery({
    queryKey: ['patients'],
    queryFn: () => patientService.getAll(),
  })

  const loadHistory = useMutation({
    mutationFn: (patientId: number) => patientService.getHistory(patientId),
    onSuccess: (data) => {
      setHistory(data)
      setExpandedOrderId(null)
    },
    onError: () => toast.error('Failed to load patient history'),
  })

  const handleLoad = () => {
    if (!selectedPatientId) {
      toast.error('Please select a patient')
      return
    }
    loadHistory.mutate(Number(selectedPatientId))
  }

  const printReport = () => {
    if (!history?.patient) return
    const html = `
      <html><head><title>${history.patient.fullName} — Full Report</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:32px;color:#111;max-width:750px;margin:0 auto}
        h1{font-size:22px;font-weight:700;margin-bottom:4px}
        .patient-meta{color:#555;font-size:13px;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #e5e7eb}
        .test-card{border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:16px 0;page-break-inside:avoid}
        .test-header{display:flex;justify-content:space-between;margin-bottom:12px}
        .test-name{font-size:16px;font-weight:600}
        .test-meta{font-size:12px;color:#6b7280;margin-top:2px}
        .badge{display:inline-block;padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:600;background:#dcfce7;color:#166534}
        table{width:100%;border-collapse:collapse}
        th{font-size:11px;text-transform:uppercase;color:#9ca3af;padding:8px 10px;text-align:left;border-bottom:1px solid #f3f4f6}
        td{padding:8px 10px;font-size:13px;border-bottom:1px solid #f9fafb}
        @media print{body{padding:16px}}
      </style></head><body>
      <h1>${history.patient.fullName}</h1>
      <div class="patient-meta">
        <span>Patient Code: <strong>${history.patient.patientCode}</strong></span>
        ${history.patient.phoneNumber ? ` &bull; Phone: <strong>${history.patient.phoneNumber}</strong>` : ''}
        ${history.patient.gender ? ` &bull; Gender: <strong>${history.patient.gender}</strong>` : ''}
        ${history.patient.bloodGroup ? ` &bull; Blood Group: <strong>${history.patient.bloodGroup}</strong>` : ''}
        <br><em>${history.history.length} test report${history.history.length !== 1 ? 's' : ''} found</em>
      </div>
      ${history.history.map(item => `
        <div class="test-card">
          <div class="test-header">
            <div>
              <div class="test-name">${item.testName} (${item.testCode})</div>
              <div class="test-meta">Order #${item.orderId} &bull; ${new Date(item.createdAt).toLocaleString()}</div>
            </div>
            <span class="badge">${item.status}</span>
          </div>
          <table>
            <thead><tr><th>Parameter</th><th>Result</th><th>Unit</th></tr></thead>
            <tbody>
              ${item.results.map(r => `<tr><td>${r.fieldName}</td><td><strong>${String(r.value)}</strong></td><td>${r.unit ?? '—'}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>`).join('')}
      </body></html>`
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
    w.print()
  }

  return (
    <div>
      <Header
        title="Result History & Reports"
        subtitle="View complete diagnostic history and generate patient reports"
      />

      <div className="space-y-6 p-4 sm:p-6">
        {/* Patient selector */}
        <Card>
          <h3 className="mb-4 text-sm font-bold text-slate-700">Select Patient</h3>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              {patientsLoading ? (
                <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
              ) : (
                <Select
                  label="Patient"
                  value={selectedPatientId}
                  onChange={e => setSelectedPatientId(e.target.value)}
                >
                  <option value="">Select a patient</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.fullName} ({p.patientCode})</option>
                  ))}
                </Select>
              )}
            </div>
            <Button
              loading={loadHistory.isPending}
              onClick={handleLoad}
              className="sm:self-end"
            >
              Load History
            </Button>
            {history?.patient && (
              <Button
                variant="secondary"
                icon={<Printer className="h-4 w-4" />}
                onClick={printReport}
                className="sm:self-end"
              >
                Export PDF / Print
              </Button>
            )}
          </div>
        </Card>

        {/* Results */}
        {loadHistory.isPending ? (
          <PageLoader />
        ) : history ? (
          <div className="space-y-4">
            {/* Patient header */}
            <Card className="border-indigo-200 bg-indigo-50/30">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-lg font-bold text-white">
                    {history.patient.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">{history.patient.fullName}</h3>
                    <div className="flex flex-wrap gap-3 mt-1 text-sm text-slate-500">
                      <span className="font-mono">{history.patient.patientCode}</span>
                      {history.patient.gender && <span>{history.patient.gender}</span>}
                      {history.patient.bloodGroup && <span>Blood: {history.patient.bloodGroup}</span>}
                      {history.patient.phoneNumber && <span>{history.patient.phoneNumber}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100">
                  <span className="text-sm font-bold text-indigo-600">{history.history.length}</span>
                </div>
              </div>
            </Card>

            {history.history.length === 0 ? (
              <EmptyState
                icon={<FileCheck className="h-12 w-12" />}
                title="No test history"
                description="This patient has no completed test reports yet."
              />
            ) : (
              history.history.map(item => (
                <Card key={item.orderId} hover>
                  <div
                    className="flex cursor-pointer items-start justify-between gap-4"
                    onClick={() => setExpandedOrderId(expandedOrderId === item.orderId ? null : item.orderId)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                        <FileCheck className="h-5 w-5 text-slate-500" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">
                          {item.testName}
                          <span className="ml-2 font-mono text-xs text-slate-400">({item.testCode})</span>
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{new Date(item.createdAt).toLocaleString()}</span>
                          <span className="text-slate-300">·</span>
                          <span>Order #{item.orderId}</span>
                          <span className="text-slate-300">·</span>
                          <span>{item.results.length} parameter{item.results.length !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant={item.status === 'APPROVED' ? 'success' : item.status === 'REJECTED' ? 'danger' : 'warning'} dot>
                        {item.status}
                      </Badge>
                      {expandedOrderId === item.orderId
                        ? <ChevronUp className="h-4 w-4 text-slate-400" />
                        : <ChevronDown className="h-4 w-4 text-slate-400" />}
                    </div>
                  </div>

                  {expandedOrderId === item.orderId && item.results.length > 0 && (
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {item.results.map((result, idx) => (
                          <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 hover:border-indigo-200 hover:bg-white transition-colors">
                            <p className="text-xs text-slate-400 uppercase tracking-wide">{result.fieldName}</p>
                            <p className="mt-1 text-base font-bold text-slate-900">
                              {String(result.value)}
                              {result.unit && <span className="ml-1.5 text-sm font-normal text-slate-400">{result.unit}</span>}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>
        ) : (
          <EmptyState
            icon={<History className="h-12 w-12" />}
            title="No history loaded"
            description="Select a patient above and click 'Load History' to view their diagnostic reports."
          />
        )}
      </div>
    </div>
  )
}
