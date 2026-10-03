import { useState } from 'react'
import { CheckCircle, Clock, X, Banknote, Landmark, Smartphone, CircleDot } from 'lucide-react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import type { Order, PaymentStatus, PaymentType } from '../../types'

/* ─── Payment edit modal ─────────────────────────────────── */
interface PaymentForm {
  paymentStatus: PaymentStatus
  paymentType: PaymentType | ''
  amount: string
  discount: string
}

export interface PaymentUpdate {
  id: number
  amount: number
  discount: number
  paymentStatus: PaymentStatus
  paymentType: PaymentType | ''
}

interface PaymentModalProps {
  orders: Order[]
  onClose: () => void
  onSave: (updates: PaymentUpdate[]) => void
  saving: boolean
}

/** Split a receipt total across tests using original amounts, last row takes rounding. */
function splitReceiptAmounts(orders: Order[], newGross: number): Map<number, number> {
  const origTotal = orders.reduce((s, o) => s + Number(o.amount ?? 0), 0)
  const result = new Map<number, number>()
  let allocated = 0
  orders.forEach((o, i) => {
    if (i === orders.length - 1) {
      result.set(o.id, Math.round((newGross - allocated) * 100) / 100)
      return
    }
    const share = origTotal > 0
      ? Math.round(newGross * (Number(o.amount ?? 0) / origTotal) * 100) / 100
      : Math.round((newGross / orders.length) * 100) / 100
    result.set(o.id, share)
    allocated += share
  })
  return result
}

export function PaymentModal({ orders, onClose, onSave, saving }: PaymentModalProps) {
  const order = orders[0]
  const isSingle = orders.length === 1
  const originalGross = orders.reduce((s, o) => s + Number(o.amount ?? 0), 0)

  const [form, setForm] = useState<PaymentForm>({
    paymentStatus: order.paymentStatus ?? 'PENDING',
    paymentType: order.paymentType ?? '',
    amount: String(originalGross),
    discount: String(order.discount ?? 0),
  })

  const amount = parseFloat(form.amount) || 0
  const discount = parseFloat(form.discount) || 0
  const netAmount = Math.round(amount * (1 - discount / 100) * 100) / 100
  const allocations = splitReceiptAmounts(orders, amount)

  const set = (key: keyof PaymentForm, val: string) =>
    setForm(prev => ({ ...prev, [key]: val }))

  const handleSave = () => {
    onSave(
      orders.map(o => ({
        id: o.id,
        amount: allocations.get(o.id) ?? 0,
        discount,
        paymentStatus: form.paymentStatus,
        paymentType: form.paymentType,
      })),
    )
  }

  const statusOpts: { value: PaymentStatus; label: string; hint: string; icon: React.ReactNode; active: string }[] = [
    { value: 'PENDING', label: 'Pending', hint: 'Not collected', icon: <Clock className="h-4 w-4" />, active: 'border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-300' },
    { value: 'PARTIAL', label: 'Partial', hint: 'Part paid', icon: <CircleDot className="h-4 w-4" />, active: 'border-blue-400 bg-blue-50 text-blue-800 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-300' },
    { value: 'PAID', label: 'Paid', hint: 'Fully collected', icon: <CheckCircle className="h-4 w-4" />, active: 'border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300' },
  ]

  const methodOpts: { value: PaymentType | ''; label: string; icon: React.ReactNode }[] = [
    { value: '', label: 'None', icon: <X className="h-4 w-4" /> },
    { value: 'CASH', label: 'Cash', icon: <Banknote className="h-4 w-4" /> },
    { value: 'CHEQUE', label: 'Cheque', icon: <Landmark className="h-4 w-4" /> },
    { value: 'ONLINE', label: 'Online', icon: <Smartphone className="h-4 w-4" /> },
  ]

  return (
    <Modal
      open
      onClose={onClose}
      title="Update Payment"
      subtitle={`${order.patient?.fullName ?? 'Patient'} · ${isSingle ? (order.template?.name ?? 'Test') : `${orders.length} tests`}`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={handleSave}>Save Payment</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/40">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Receipt</p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-gray-800 dark:text-gray-100">
                {order.receiptNumber ?? <span className="italic font-sans font-normal text-gray-400">Generated on save</span>}
              </p>
              {!isSingle && (
                <p className="mt-1 text-xs text-gray-500">{orders.length} tests on this receipt</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Payable</p>
              <p className="mt-0.5 text-2xl font-bold tracking-tight text-[#1d4ed8]">
                ₹{netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {!isSingle && (
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
            {orders.map(o => {
              const share = allocations.get(o.id) ?? 0
              const shareNet = Math.round(share * (1 - discount / 100) * 100) / 100
              return (
                <div key={o.id} className="flex items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 last:border-0 text-sm dark:border-gray-700">
                  <span className="truncate text-gray-700 dark:text-gray-200">{o.template?.name ?? 'Test'}</span>
                  <span className="shrink-0 tabular-nums text-gray-500">
                    ₹{shareNet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Input label={isSingle ? 'Amount (₹)' : 'Total amount (₹)'} type="number" min={0} step="0.01"
            value={form.amount} onChange={e => set('amount', e.target.value)} />
          <Input label="Discount (%)" type="number" min={0} max={100} step="0.5"
            value={form.discount} onChange={e => set('discount', e.target.value)} />
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Payment status</p>
          <div className="grid grid-cols-3 gap-2">
            {statusOpts.map(s => (
              <button
                key={s.value}
                type="button"
                onClick={() => set('paymentStatus', s.value)}
                className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-center transition-all ${
                  form.paymentStatus === s.value
                    ? s.active
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'
                }`}
              >
                {s.icon}
                <span className="text-sm font-semibold">{s.label}</span>
                <span className="text-[10px] opacity-70">{s.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Payment method</p>
          <div className="grid grid-cols-4 gap-2">
            {methodOpts.map(m => (
              <button
                key={m.value || 'none'}
                type="button"
                onClick={() => set('paymentType', m.value)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 text-xs font-semibold transition-all ${
                  form.paymentType === m.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'
                }`}
              >
                {m.icon}
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
