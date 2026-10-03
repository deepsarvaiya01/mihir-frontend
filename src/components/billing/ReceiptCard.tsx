import type { ReactNode } from 'react'
import {
  Receipt, Barcode, Paperclip, Wallet, FileText, ChevronDown, Eye, Download, Printer, Share2, Loader2, Clock,
} from 'lucide-react'
import { Badge } from '../ui/Badge'
import { Menu } from '../ui/Menu'
import { printTubeLabels } from '../../utils/generateReport'
import type { Order, OrderStatus, PaymentStatus } from '../../types'
import type { ReceiptActions } from './useReceiptActions'
import { rupees, formatDateTime } from './format'

const PAYMENT_VARIANTS: Record<PaymentStatus, 'success' | 'warning' | 'info'> = {
  PAID: 'success',
  PENDING: 'warning',
  PARTIAL: 'info',
}

const STATUS_DOT: Record<OrderStatus, { dot: string; label: string }> = {
  PENDING:           { dot: 'bg-gray-300 dark:bg-gray-500', label: 'Pending' },
  IN_PROGRESS:       { dot: 'bg-blue-500', label: 'In progress' },
  AWAITING_APPROVAL: { dot: 'bg-amber-500', label: 'Awaiting approval' },
  APPROVED:          { dot: 'bg-emerald-500', label: 'Report ready' },
  REJECTED:          { dot: 'bg-red-500', label: 'Rejected' },
}

function IconAction({ title, onClick, loading, children }: { title: string; onClick: () => void; loading?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={loading}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-800 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:text-gray-100"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  )
}

/** One bill (all tests on a receipt) with its payment and report actions. */
export function ReceiptCard({ group, actions, onEditPayment }: {
  group: Order[]
  actions: ReceiptActions
  onEditPayment: (group: Order[]) => void
}) {
  const primary = group[0]
  const gross = group.reduce((s, o) => s + Number(o.amount ?? 0), 0)
  const net = group.reduce((s, o) => s + Number(o.netAmount ?? 0), 0)
  const savings = Math.round((gross - net) * 100) / 100
  const approvedCount = group.filter(o => o.status === 'APPROVED').length
  const dt = formatDateTime(primary.createdAt)

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm lg:flex-row lg:items-center dark:border-gray-700 dark:bg-gray-800">
      {/* Date + receipt + tests */}
      <div className="flex min-w-0 flex-1 gap-4">
        <div className="flex w-[88px] shrink-0 flex-col">
          <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">{dt.date}</span>
          <span className="text-[11px] text-gray-400">{dt.time}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold text-gray-700 dark:text-gray-200">
              {primary.receiptNumber ?? `Order #${primary.id}`}
            </span>
            <span className="text-[11px] text-gray-400">
              · {group.length} test{group.length !== 1 ? 's' : ''} · {approvedCount}/{group.length} ready
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {group.map(o => {
              const st = STATUS_DOT[o.status] ?? STATUS_DOT.PENDING
              return (
                <span key={o.id} title={st.label}
                  className="inline-flex max-w-[220px] items-center gap-1.5 rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-600 ring-1 ring-gray-200/70 dark:bg-gray-700/50 dark:text-gray-300 dark:ring-gray-600/60">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${st.dot}`} />
                  <span className="truncate">{o.template?.name ?? o.template?.code ?? 'Test'}</span>
                </span>
              )
            })}
          </div>
        </div>
      </div>

      {/* Amount + payment */}
      <div className="flex items-center gap-6 lg:w-[250px] lg:justify-end">
        <div className="text-right">
          <p className="text-base font-bold tabular-nums text-gray-900 dark:text-white">{rupees(net)}</p>
          {savings > 0 && (
            <p className="text-[11px] tabular-nums text-gray-400">
              <span className="line-through">{rupees(gross)}</span>
              <span className="ml-1 font-semibold text-emerald-600">−{rupees(savings)}</span>
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={PAYMENT_VARIANTS[primary.paymentStatus] ?? 'default'} dot>
            {primary.paymentStatus.charAt(0) + primary.paymentStatus.slice(1).toLowerCase()}
          </Badge>
          {primary.paymentStatus !== 'PENDING' && primary.paymentType && (
            <span className="text-[11px] capitalize text-gray-400">{primary.paymentType.toLowerCase()}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <BillActions group={group} actions={actions} onEditPayment={onEditPayment} className="flex-wrap lg:justify-end" />
    </div>
  )
}

/** Payment, receipt, labels, documents and report actions for one bill. */
export function BillActions({ group, actions, onEditPayment, reportScope, className = '' }: {
  group: Order[]
  actions: ReceiptActions
  onEditPayment: (group: Order[]) => void
  /** When given, the Report menu covers these orders (e.g. every bill of the patient) instead of just this bill */
  reportScope?: Order[]
  className?: string
}) {
  const primary = group[0]
  const reportOrders = reportScope ?? group
  const approvedCount = reportOrders.filter(o => o.status === 'APPROVED').length
  const reportTarget: Order | Order[] = reportScope ?? primary
  const reportVisits = new Set(reportOrders.map(o => o.receiptNumber ?? `order-${o.id}`)).size
  /** Whether a pending mutation was started for this same report target */
  const isForTarget = (v: Order | Order[] | undefined) => Array.isArray(v)
    ? Array.isArray(reportTarget) && v.length === reportTarget.length && v[0]?.id === reportTarget[0]?.id
    : !Array.isArray(reportTarget) && v?.id === primary.id
  const attachmentUrls = group.map(o => o.attachmentUrl).filter((u): u is string => !!u)
  const isPending = primary.paymentStatus === 'PENDING'

  const {
    viewReport, downloadReport, printReport, plainReport, printPlainReport, shareReport, printReceipt, viewAttachments,
  } = actions
  const reportBusy = [viewReport, downloadReport, printReport, plainReport, printPlainReport]
    .some(m => m.isPending && isForTarget(m.variables)) || (shareReport.isPending && shareReport.variables === primary.id)
  const menuTitle = reportScope && reportVisits > 1
    ? `All ${reportVisits} visits · ${approvedCount} test${approvedCount !== 1 ? 's' : ''} ready`
    : approvedCount < reportOrders.length ? `Report · ${approvedCount} of ${reportOrders.length} tests ready` : 'Report'

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={() => onEditPayment(group)}
        className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors ${
          isPending
            ? 'bg-amber-500 text-white shadow-sm hover:bg-amber-600'
            : 'border border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200'
        }`}
      >
        <Wallet className="h-3.5 w-3.5" />
        {isPending ? 'Collect' : 'Payment'}
      </button>

      <IconAction title="Download receipt" onClick={() => printReceipt.mutate(group)}
        loading={printReceipt.isPending && printReceipt.variables?.[0]?.id === primary.id}>
        <Receipt className="h-4 w-4" />
      </IconAction>
      {primary.receiptNumber && (
        <IconAction title="Print tube labels" onClick={() => printTubeLabels(group)}>
          <Barcode className="h-4 w-4" />
        </IconAction>
      )}
      {attachmentUrls.length > 0 && (
        <IconAction
          title={attachmentUrls.length > 1 ? `View uploaded documents (${attachmentUrls.length}, merged)` : 'View uploaded document'}
          onClick={() => viewAttachments.mutate(group)}
          loading={viewAttachments.isPending && viewAttachments.variables === group}>
          <Paperclip className="h-4 w-4" />
        </IconAction>
      )}

      {approvedCount > 0 ? (
        <Menu
          title={menuTitle}
          trigger={open => (
            <button type="button"
              className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-white shadow-sm transition-colors ${open ? 'bg-emerald-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
              {reportBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              Report
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
          )}
          items={[
            { label: 'View report', icon: <Eye className="h-4 w-4" />, onClick: () => viewReport.mutate(reportTarget) },
            { label: 'Download report', icon: <Download className="h-4 w-4" />, hint: 'Letterhead', onClick: () => downloadReport.mutate(reportTarget) },
            { label: 'Print report', icon: <Printer className="h-4 w-4" />, hint: 'Letterhead', onClick: () => printReport.mutate(reportTarget) },
            { label: 'Download plain', icon: <FileText className="h-4 w-4" />, hint: 'No letterhead', onClick: () => plainReport.mutate(reportTarget), divider: true },
            { label: 'Print plain', icon: <Printer className="h-4 w-4" />, hint: 'No letterhead', onClick: () => printPlainReport.mutate(reportTarget) },
            // Share links open a single receipt's report, so the row-level menu shares the latest bill
            { label: 'Copy share link', icon: <Share2 className="h-4 w-4" />, hint: reportScope && reportVisits > 1 ? 'Latest bill' : '7 days', onClick: () => shareReport.mutate(primary.id), divider: true },
          ]}
        />
      ) : (
        <span className="flex h-8 items-center gap-1.5 rounded-lg bg-gray-50 px-3 text-xs font-medium text-gray-400 dark:bg-gray-700/40">
          <Clock className="h-3.5 w-3.5" /> Report pending
        </span>
      )}
    </div>
  )
}
