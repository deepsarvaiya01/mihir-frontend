import type { Order } from '../types'

/**
 * Billing analysis, computed from orders (one row per test). Definitions:
 *  - date        = the order's created date (when the test was billed)
 *  - Patients    = distinct patients · Bills = distinct receipts · Tests = order rows
 *  - Gross       = list amount · Net = amount after discount · Discount = Gross − Net
 *  - Collected   = Net of fully PAID orders · Outstanding = Net of PENDING + PARTIAL orders
 *  - Reports     = tests whose result is APPROVED
 */

export type GroupBy = 'month' | 'year' | 'day' | 'doctor' | 'b2b' | 'test' | 'category' | 'branch'
export const TIME_GROUPS: GroupBy[] = ['month', 'year', 'day']

export interface Totals {
  patients: number
  bills: number
  tests: number
  gross: number
  net: number
  discount: number
  collected: number
  outstanding: number
  approved: number
}

export interface GroupRow extends Totals {
  key: string
  label: string
  /** Chronological sort key for time groups */
  sortKey: string
}

export interface GroupContext {
  /** templateId → category name */
  categoryByTemplate: Map<number, string>
  /** branch id → branch name */
  branchName: Map<number, string>
}

const round2 = (n: number) => Math.round(n * 100) / 100
const pad = (n: number) => String(n).padStart(2, '0')
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function totalsOf(orders: Order[]): Totals {
  const patients = new Set<number>()
  const bills = new Set<string>()
  let gross = 0, net = 0, collected = 0, outstanding = 0, approved = 0
  for (const o of orders) {
    if (o.patient?.id !== undefined) patients.add(o.patient.id)
    bills.add(o.receiptNumber ?? `order-${o.id}`)
    const amount = Number(o.amount ?? 0)
    const netAmount = Number(o.netAmount ?? 0)
    gross += amount
    net += netAmount
    if (o.paymentStatus === 'PAID') collected += netAmount
    else outstanding += netAmount
    if (o.status === 'APPROVED') approved++
  }
  return {
    patients: patients.size, bills: bills.size, tests: orders.length,
    gross: round2(gross), net: round2(net), discount: round2(gross - net),
    collected: round2(collected), outstanding: round2(outstanding), approved,
  }
}

export const summarize = totalsOf

/** Which bucket an order falls in for a grouping: [key, label, sortKey] */
export function bucket(o: Order, by: GroupBy, ctx: GroupContext): [string, string, string] {
  const d = o.createdAt ? new Date(o.createdAt) : null
  switch (by) {
    case 'month': {
      if (!d) return ['none', 'No date', '0']
      const k = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
      return [k, `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, k]
    }
    case 'year': {
      if (!d) return ['none', 'No date', '0']
      return [String(d.getFullYear()), String(d.getFullYear()), String(d.getFullYear())]
    }
    case 'day': {
      if (!d) return ['none', 'No date', '0']
      const k = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      return [k, `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`, k]
    }
    case 'doctor': {
      const name = o.patient?.doctorName?.trim()
      // Names are free text on the patient — group case-insensitively, show the first spelling seen
      return name ? [`doc:${name.toLowerCase()}`, name, name.toLowerCase()] : ['self', 'Self (no doctor)', '~']
    }
    case 'b2b': {
      const p = o.patient
      if (!p?.isB2b) return ['individual', 'Individual (non-B2B)', '~']
      const name = p.b2bLab?.name ?? 'B2B (lab removed)'
      return [`lab:${p.b2bLabId ?? name}`, name, name.toLowerCase()]
    }
    case 'test': {
      const name = o.template?.name ?? 'Unknown test'
      return [`t:${o.template?.id ?? name}`, name, name.toLowerCase()]
    }
    case 'category': {
      const name = (o.template?.id !== undefined && ctx.categoryByTemplate.get(o.template.id)) || 'Uncategorised'
      return [`c:${name}`, name, name === 'Uncategorised' ? '~' : name.toLowerCase()]
    }
    case 'branch': {
      const id = o.patient?.labBranchId
      const name = id != null ? ctx.branchName.get(id) ?? `Branch #${id}` : 'No branch'
      return [`b:${id ?? 'none'}`, name, id == null ? '~' : name.toLowerCase()]
    }
  }
}

export function groupOrders(orders: Order[], by: GroupBy, ctx: GroupContext): GroupRow[] {
  const groups = new Map<string, { label: string; sortKey: string; orders: Order[] }>()
  for (const o of orders) {
    const [key, label, sortKey] = bucket(o, by, ctx)
    const g = groups.get(key)
    if (g) g.orders.push(o)
    else groups.set(key, { label, sortKey, orders: [o] })
  }
  return Array.from(groups, ([key, g]) => ({ key, label: g.label, sortKey: g.sortKey, ...totalsOf(g.orders) }))
}

/** CSV with a BOM so Excel opens ₹/Unicode text correctly. */
export function toCsv(header: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + [header, ...rows].map(r => r.map(esc).join(',')).join('\r\n')
}
