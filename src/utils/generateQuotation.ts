import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { PDFDocument } from 'pdf-lib'
import type { LabSettings } from '../types'

export interface QuotationItem {
  name: string
  code: string
  /** e.g. "Profile · 5 tests" */
  note?: string
  amount: number
}

export interface QuotationOptions {
  items: QuotationItem[]
  discountPct: number
  patientName?: string
  /** "Standard" or the B2B partner whose prices were used */
  pricingLabel: string
  labSettings: LabSettings
}

const inr = (n: number) => `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function quotationTotals(items: QuotationItem[], discountPct: number) {
  const subtotal = Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100
  const discount = Math.round(subtotal * (discountPct / 100) * 100) / 100
  return { subtotal, discount, total: Math.round((subtotal - discount) * 100) / 100 }
}

/** ₹1,000 or ₹499.50 — paise only when there are any */
const money = (n: number) => `₹${n.toLocaleString('en-IN', Number.isInteger(n) ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Plain-text version for pasting into WhatsApp / SMS. */
export function quotationText(o: QuotationOptions): string {
  const { subtotal, discount, total } = quotationTotals(o.items, o.discountPct)
  const header = [
    `*${o.labSettings.lab_name || 'Laboratory'} — Quotation*`,
    ...(o.patientName?.trim() ? [`Patient: ${o.patientName.trim()}`] : []),
    `Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
  ]
  const lines = o.items.map((i, idx) => `${idx + 1}. ${i.name} — ${money(i.amount)}`)
  const footer = [
    ...(discount > 0 ? [`Subtotal: ${money(subtotal)}`, `Discount (${o.discountPct}%): −${money(discount)}`] : []),
    `*Total: ${money(total)}*`,
  ]
  return [header.join('\n'), lines.join('\n'), footer.join('\n')].join('\n\n')
}

/** Downloads the quotation as a PDF on the lab letterhead (plain header if the letterhead can't be loaded). */
export async function generateQuotation(o: QuotationOptions): Promise<void> {
  const { subtotal, discount, total } = quotationTotals(o.items, o.discountPct)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const PAGE_W = 210
  const ML = 15
  const MR = 15

  // Letterhead template occupies the top ~36 mm; fetch it first so the layout knows whether to draw its own header
  let template: ArrayBuffer | null = null
  try {
    const res = await fetch('/Rameshwar.pdf')
    if (res.ok) template = await res.arrayBuffer()
  } catch { /* fall back to a plain header */ }

  let y = template ? 46 : 18
  if (!template) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(20, 20, 20)
    doc.text(o.labSettings.lab_name || 'Laboratory', PAGE_W / 2, y, { align: 'center' })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(110, 110, 110)
    const contact = [o.labSettings.lab_address, [o.labSettings.lab_phone, o.labSettings.lab_email].filter(Boolean).join('  |  ')]
      .filter(Boolean)
    contact.forEach((line, i) => doc.text(line as string, PAGE_W / 2, y + 5 + i * 4, { align: 'center' }))
    y += 8 + contact.length * 4
    doc.setDrawColor(200, 200, 200); doc.line(ML, y, PAGE_W - MR, y)
    y += 9
  }

  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(29, 78, 216)
  doc.text('QUOTATION', PAGE_W / 2, y, { align: 'center' })
  y += 8

  doc.setFontSize(9); doc.setTextColor(20, 20, 20)
  const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  doc.setFont('helvetica', 'bold'); doc.text('Patient', ML, y)
  doc.setFont('helvetica', 'normal'); doc.text(`: ${o.patientName?.trim() || '—'}`, ML + 18, y)
  doc.setFont('helvetica', 'bold'); doc.text('Date', PAGE_W - MR - 50, y)
  doc.setFont('helvetica', 'normal'); doc.text(`: ${dateStr}`, PAGE_W - MR - 38, y)
  y += 6
  doc.setFont('helvetica', 'bold'); doc.text('Pricing', ML, y)
  doc.setFont('helvetica', 'normal'); doc.text(`: ${o.pricingLabel}`, ML + 18, y)
  y += 5

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    head: [['#', 'Test / Profile', 'Code', 'Amount']],
    body: o.items.map((i, idx) => [
      String(idx + 1),
      i.note ? `${i.name}\n${i.note}` : i.name,
      i.code,
      inr(i.amount),
    ]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.4, textColor: [30, 30, 30], lineColor: [215, 215, 215] },
    headStyles: { fillColor: [29, 78, 216], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { cellWidth: 30 }, 3: { cellWidth: 34, halign: 'right' } },
  })

  // Totals block, right-aligned under the table
  let ty = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  const labelX = PAGE_W - MR - 70
  const valueX = PAGE_W - MR
  const row = (label: string, value: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(bold ? 11 : 9.5)
    doc.text(label, labelX, ty); doc.text(value, valueX, ty, { align: 'right' })
    ty += bold ? 7 : 5.5
  }
  doc.setTextColor(30, 30, 30)
  if (discount > 0) {
    row('Subtotal', inr(subtotal))
    row(`Discount (${o.discountPct}%)`, `- ${inr(discount)}`)
    doc.setDrawColor(200, 200, 200); doc.line(labelX, ty - 3, valueX, ty - 3); ty += 1.5
  }
  row('Total Payable', inr(total), true)

  doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(130, 130, 130)
  doc.text('This is an estimate only. Prices are as on the date above and may change. Not a bill or receipt.', ML, ty + 8)

  const contentBytes = doc.output('arraybuffer')
  let bytes: Uint8Array
  if (template) {
    try {
      const templatePdf = await PDFDocument.load(template)
      const contentPdf = await PDFDocument.load(contentBytes)
      const merged = await PDFDocument.create()
      const [embeddedTemplate] = await merged.embedPages([templatePdf.getPages()[0]])
      for (const page of contentPdf.getPages()) {
        const [embedded] = await merged.embedPages([page])
        const { width, height } = page.getSize()
        const p = merged.addPage([width, height])
        p.drawPage(embeddedTemplate, { x: 0, y: 0, width, height })
        p.drawPage(embedded, { x: 0, y: 0, width, height })
      }
      bytes = await merged.save()
    } catch {
      bytes = new Uint8Array(contentBytes)
    }
  } else {
    bytes = new Uint8Array(contentBytes)
  }

  const slug = (o.patientName?.trim() || 'quotation').replace(/\s+/g, '-')
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `quotation-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
