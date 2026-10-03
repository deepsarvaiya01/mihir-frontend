import jsPDF from 'jspdf'
import autoTable, { type RowInput } from 'jspdf-autotable'
import type { Order } from '../types'
import { bucket, type GroupBy, type GroupContext } from './analysis'

/** One bill (receipt) inside a group — only the tests on it that belong to that group. */
export interface RegisterBill {
  date: string | null
  reference: string
  patientName: string
  investigations: string
  billAmt: number
  discount: number
  paid: number
  due: number
  /** PARTIAL payments aren't itemised, so these count as fully due */
  partial: boolean
}

export interface RegisterGroup {
  key: string
  label: string
  bills: RegisterBill[]
  totals: { billAmt: number; discount: number; paid: number; due: number }
}

export const REGISTER_TITLE: Record<GroupBy, string> = {
  doctor: 'Referring Doctor Wise Register',
  b2b: 'B2B Partner Wise Register',
  test: 'Test Wise Register',
  category: 'Category Wise Register',
  branch: 'Branch Wise Register',
  month: 'Monthly Register',
  year: 'Yearly Register',
  day: 'Daily Register',
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function buildRegister(orders: Order[], by: GroupBy, ctx: GroupContext): RegisterGroup[] {
  // group → bill (receipt) → that bill's orders falling in the group
  const groups = new Map<string, { label: string; sortKey: string; bills: Map<string, Order[]> }>()
  for (const o of orders) {
    const [key, label, sortKey] = bucket(o, by, ctx)
    let g = groups.get(key)
    if (!g) { g = { label, sortKey, bills: new Map() }; groups.set(key, g) }
    const billKey = o.receiptNumber ?? `order-${o.id}`
    const list = g.bills.get(billKey)
    if (list) list.push(o)
    else g.bills.set(billKey, [o])
  }

  return Array.from(groups, ([key, g]) => {
    const bills: RegisterBill[] = Array.from(g.bills.values()).map(list => {
      const first = list[0]
      const billAmt = round2(list.reduce((s, o) => s + Number(o.amount ?? 0), 0))
      const net = round2(list.reduce((s, o) => s + Number(o.netAmount ?? 0), 0))
      const paidInFull = first.paymentStatus === 'PAID'
      return {
        date: first.createdAt ?? null,
        reference: first.receiptNumber ?? `#${first.id}`,
        patientName: first.patient?.fullName ?? '—',
        investigations: list.map(o => o.template?.code || o.template?.name || 'Test').join(','),
        billAmt,
        discount: round2(billAmt - net),
        paid: paidInFull ? net : 0,
        due: paidInFull ? 0 : net,
        partial: first.paymentStatus === 'PARTIAL',
      }
    }).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.reference.localeCompare(b.reference))

    const totals = bills.reduce((t, b) => ({
      billAmt: t.billAmt + b.billAmt, discount: t.discount + b.discount, paid: t.paid + b.paid, due: t.due + b.due,
    }), { billAmt: 0, discount: 0, paid: 0, due: 0 })
    return {
      key, label: g.label, sortKey: g.sortKey, bills,
      totals: { billAmt: round2(totals.billAmt), discount: round2(totals.discount), paid: round2(totals.paid), due: round2(totals.due) },
    }
  })
    // sortKey is chronological for time groups, alphabetical otherwise; '~' keys (Self / Individual /
    // Uncategorised / No branch) go last — localeCompare alone would put punctuation first
    .sort((a, b) => (a.sortKey === '~' ? 1 : 0) - (b.sortKey === '~' ? 1 : 0) || a.sortKey.localeCompare(b.sortKey))
    .map(g => ({ key: g.key, label: g.label, bills: g.bills, totals: g.totals }))
}

const ddmmyy = (iso: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`
}
const ddmmyyyy = (ymd: string) => ymd.split('-').reverse().join('/')
/** 18,400 or 1,650.50 — Indian grouping, paise only when present; blank for zero paid (as on the paper register) */
const amt = (n: number) => n.toLocaleString('en-IN', Number.isInteger(n) ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function downloadRegisterPdf(opts: {
  groups: RegisterGroup[]
  by: GroupBy
  labName: string
  dateFrom: string
  dateTo: string
  filtersNote?: string
}) {
  const { groups, by } = opts
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const PAGE_W = 210
  const ML = 10

  // Header: lab name (underlined), register title, period
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(0)
  const lab = opts.labName || 'Laboratory'
  doc.text(lab, PAGE_W / 2, 14, { align: 'center' })
  const labW = doc.getTextWidth(lab)
  doc.setLineWidth(0.4); doc.line(PAGE_W / 2 - labW / 2, 15.2, PAGE_W / 2 + labW / 2, 15.2)
  doc.setFontSize(12.5)
  doc.text(REGISTER_TITLE[by], PAGE_W / 2, 22, { align: 'center' })
  doc.setFontSize(10)
  const period = opts.dateFrom || opts.dateTo
    ? `${opts.dateFrom ? ddmmyyyy(opts.dateFrom) : 'Start'} - ${opts.dateTo ? ddmmyyyy(opts.dateTo) : ddmmyyyy(new Date().toISOString().slice(0, 10))}`
    : 'All dates'
  doc.text(`Date: ${period}`, ML, 30)
  if (opts.filtersNote) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(90)
    doc.text(opts.filtersNote, PAGE_W - ML, 30, { align: 'right' })
    doc.setTextColor(0)
  }

  const body: RowInput[] = []
  const anyPartial = groups.some(g => g.bills.some(b => b.partial))
  const grand = { billAmt: 0, discount: 0, paid: 0, due: 0 }
  for (const g of groups) {
    body.push([{ content: g.label, colSpan: 9, styles: { fontStyle: 'bold', fontSize: 9.5, halign: 'left', cellPadding: { top: 3.5, bottom: 1.2, left: 1, right: 1 } } }])
    g.bills.forEach((b, i) => body.push([
      String(i + 1), ddmmyy(b.date), b.reference, b.patientName, b.investigations,
      amt(b.billAmt), amt(b.discount), b.paid ? amt(b.paid) : '', b.due ? `${amt(b.due)}${b.partial ? '*' : ''}` : '',
    ]))
    body.push([
      { content: `Total for ${g.label}:`, colSpan: 5, styles: { fontStyle: 'bold', halign: 'right' } },
      { content: amt(g.totals.billAmt), styles: { fontStyle: 'bold' } },
      { content: amt(g.totals.discount), styles: { fontStyle: 'bold' } },
      { content: g.totals.paid ? amt(g.totals.paid) : '', styles: { fontStyle: 'bold' } },
      { content: amt(g.totals.due), styles: { fontStyle: 'bold' } },
    ])
    grand.billAmt += g.totals.billAmt; grand.discount += g.totals.discount; grand.paid += g.totals.paid; grand.due += g.totals.due
  }
  if (groups.length > 1) {
    body.push([
      { content: 'Grand Total:', colSpan: 5, styles: { fontStyle: 'bold', halign: 'right', fontSize: 10 } },
      { content: amt(round2(grand.billAmt)), styles: { fontStyle: 'bold', fontSize: 10 } },
      { content: amt(round2(grand.discount)), styles: { fontStyle: 'bold', fontSize: 10 } },
      { content: amt(round2(grand.paid)), styles: { fontStyle: 'bold', fontSize: 10 } },
      { content: amt(round2(grand.due)), styles: { fontStyle: 'bold', fontSize: 10 } },
    ])
  }

  // Group-name rows are underlined (like the paper register); total rows get a rule above
  const isGroupRow = (row: { raw: unknown }) => Array.isArray(row.raw) && row.raw.length === 1
  const isTotalRow = (row: { raw: unknown }) => Array.isArray(row.raw) && row.raw.length === 5

  autoTable(doc, {
    startY: 34,
    margin: { left: ML, right: ML, bottom: 14 },
    head: [['Sr. No', 'Date', 'Reference No.', 'Patient Name', 'Investigations', 'Bill Amt', 'Discount', 'Total Paid', 'Due']],
    // Long patient names / test lists wrap inside their cell rather than squeezing the amount columns
    tableWidth: PAGE_W - 2 * ML,
    body,
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.3, textColor: 0, overflow: 'linebreak' },
    headStyles: { fontStyle: 'bold', fontSize: 8.5, valign: 'bottom' },
    columnStyles: {
      0: { cellWidth: 11, halign: 'center' },
      1: { cellWidth: 16 },
      2: { cellWidth: 25 },
      3: { cellWidth: 40 },
      4: { cellWidth: 'auto' },
      5: { cellWidth: 17, halign: 'right' },
      6: { cellWidth: 18, halign: 'right' },
      7: { cellWidth: 18, halign: 'right' },
      8: { cellWidth: 17, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index >= 5) data.cell.styles.halign = 'right'
    },
    didDrawCell: (data) => {
      const { doc: d, cell, row, section } = data
      d.setLineWidth(0.3)
      if (section === 'head') {
        d.line(cell.x, cell.y + cell.height, cell.x + cell.width, cell.y + cell.height)
        if (row.index === 0) d.line(cell.x, cell.y, cell.x + cell.width, cell.y)
      } else if (isGroupRow(row)) {
        d.setFont('helvetica', 'bold'); d.setFontSize(9.5)
        const w = d.getTextWidth(String(cell.raw && typeof cell.raw === 'object' && 'content' in cell.raw ? cell.raw.content : ''))
        const ty = cell.y + cell.height - 0.6
        d.line(cell.x + 1, ty, cell.x + 1 + w, ty)
      } else if (isTotalRow(row) && data.column.index === 0) {
        d.line(ML, cell.y, PAGE_W - ML, cell.y)
      }
    },
    didDrawPage: () => {
      const pageH = doc.internal.pageSize.getHeight()
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(120)
      doc.text(`Page ${doc.getNumberOfPages()}`, PAGE_W - ML, pageH - 6, { align: 'right' })
      doc.text(`Generated ${new Date().toLocaleString('en-IN')}`, ML, pageH - 6)
      doc.setTextColor(0)
    },
  })

  if (anyPartial) {
    const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
    doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(90)
    doc.text('* Partly paid bill — part payments are not recorded, so the full amount is shown as due.', ML, y)
  }

  const slug = REGISTER_TITLE[by].toLowerCase().replace(/\s+/g, '-')
  doc.save(`${slug}-${opts.dateFrom || 'all'}${opts.dateTo ? `-to-${opts.dateTo}` : ''}.pdf`)
}
