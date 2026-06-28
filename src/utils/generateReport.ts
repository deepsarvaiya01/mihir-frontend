import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { PDFDocument } from 'pdf-lib'
import QRCode from 'qrcode'
import type { LabSettings, ActiveSignature, Logo, Order } from '../types'

/* ─── Types ─────────────────────────────────────────────── */
export interface ReportResult {
  fieldName: string
  fieldType: string
  value: string | number | boolean | null
  unit: string | null
  referenceRange: string | null
  isSectionHeader: boolean
}

export interface ReportOrder {
  id: number
  patient?: {
    fullName: string
    patientCode?: string
    age: number | null
    gender: string | null
    doctorName: string | null
    city?: string | null
  }
  template?: { name: string; code: string }
  createdAt?: string
}

export interface GenerateReportOptions {
  order: ReportOrder
  results: ReportResult[]
  labSettings: LabSettings
  signature: ActiveSignature | null
  /** Active logo from the Logo Manager — takes precedence over lab_logo_base64 in labSettings */
  activeLogo?: Logo | null
  shareUrl?: string
  attachmentUrl?: string | null
}

/* ─── Helpers ───────────────────────────────────────────── */
async function fetchImageAsDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function isOutOfRange(value: string | number | boolean | null, range: string | null): boolean {
  if (!range || value === null || value === undefined) return false
  const num = typeof value === 'number' ? value : parseFloat(String(value))
  if (isNaN(num)) return false
  const m = range.replace(/[\[\]\s]/g, '').match(/^([\d.]+)[-–]([\d.]+)$/)
  if (!m) return false
  return num < parseFloat(m[1]) || num > parseFloat(m[2])
}

function fmtDate(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function fmtAgeGender(age: number | null, gender: string | null): string {
  const parts: string[] = []
  if (age) parts.push(`${age} Years`)
  if (gender) {
    const g = gender.toLowerCase()
    parts.push(g === 'm' || g === 'male' ? 'Male' : 'Female')
  }
  return parts.join('/') || '—'
}

function downloadBlob(bytes: Uint8Array, filename: string) {
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/* ─── Main generator ────────────────────────────────────── */
export async function generateLabReport(options: GenerateReportOptions): Promise<void> {
  const { order, results, labSettings, signature } = options

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const PAGE_W = 210
  const PAGE_H = 297
  const ML = 15
  const MR = 15
  const CW = PAGE_W - ML - MR

  // Space reserved at the top of every page for the Rameshwar.pdf header template.
  // The header in report-template.pdf occupies approximately the top 48 mm.
  const TEMPLATE_HDR = 58

  /* ── Draw patient info block (first page only) ── */
  function drawPatientInfo(startY: number): number {
    const p = order.patient
    const col2X = PAGE_W - MR - 65

    doc.setFontSize(9)
    doc.setTextColor(10, 10, 10)

    doc.setFont('helvetica', 'bold');  doc.text("Patient's Name", ML, startY)
    doc.setFont('helvetica', 'normal'); doc.text(`: ${p?.fullName ?? '—'}`, ML + 35, startY)
    doc.setFont('helvetica', 'bold');  doc.text('Lab ID', col2X, startY)
    doc.setFont('helvetica', 'normal'); doc.text(`:${order.id}`, col2X + 14, startY)

    doc.setFont('helvetica', 'bold');  doc.text('Age / Gender', ML, startY + 7)
    doc.setFont('helvetica', 'normal'); doc.text(`: ${fmtAgeGender(p?.age ?? null, p?.gender ?? null)}`, ML + 35, startY + 7)
    doc.setFont('helvetica', 'bold');  doc.text('Date', col2X, startY + 7)
    doc.setFont('helvetica', 'normal'); doc.text(`:${fmtDate(order.createdAt)}`, col2X + 14, startY + 7)

    doc.setFont('helvetica', 'bold');  doc.text('Referred by', ML, startY + 14)
    doc.setFont('helvetica', 'normal'); doc.text(`: ${p?.doctorName ?? 'Self'}`, ML + 35, startY + 14)

    doc.setFont('helvetica', 'bold');  doc.text('Location', ML, startY + 21)
    doc.setFont('helvetica', 'normal'); doc.text(`: ${p?.city ?? ''}`, ML + 35, startY + 21)

    doc.setDrawColor(160, 160, 160)
    doc.setLineWidth(0.3)
    doc.line(ML, startY + 26, PAGE_W - MR, startY + 26)

    return startY + 26
  }

  /* ── Build table rows ── */
  interface RowMeta { isSectionHeader: boolean; isOutOfRange: boolean }
  const rowMetas: RowMeta[] = []
  type CellDef = { content: string; colSpan?: number; styles?: object }
  const tableBody: (string | CellDef)[][] = []

  for (const r of results) {
    if (r.isSectionHeader) {
      tableBody.push([{
        content: r.fieldName,
        colSpan: 4,
        styles: { fontStyle: 'bold', fillColor: [252, 252, 252] as [number, number, number] },
      }])
      rowMetas.push({ isSectionHeader: true, isOutOfRange: false })
    } else {
      const valStr = r.value !== null && r.value !== undefined ? String(r.value) : ''
      const oor = isOutOfRange(r.value, r.referenceRange)
      tableBody.push([r.fieldName, valStr, r.unit ?? '', r.referenceRange ?? ''])
      rowMetas.push({ isSectionHeader: false, isOutOfRange: oor })
    }
  }

  /* ── Draw page 1 content — top TEMPLATE_HDR mm is left empty for the template header ── */
  const patientBottomY = drawPatientInfo(TEMPLATE_HDR + 3)

  // Test name (centred, bold, underlined)
  const testNameY = patientBottomY + 9
  const testName = order.template?.name ?? 'Test Results'
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  doc.setTextColor(10, 10, 10)
  doc.text(testName, PAGE_W / 2, testNameY, { align: 'center' })
  const tw = doc.getTextWidth(testName)
  doc.setLineWidth(0.35)
  doc.setDrawColor(10, 10, 10)
  doc.line(PAGE_W / 2 - tw / 2, testNameY + 1.5, PAGE_W / 2 + tw / 2, testNameY + 1.5)

  doc.setDrawColor(160, 160, 160)
  doc.setLineWidth(0.3)
  doc.line(ML, testNameY + 5, PAGE_W - MR, testNameY + 5)

  const TABLE_START_Y = testNameY + 8

  /* ── Render table ── */
  autoTable(doc, {
    startY: TABLE_START_Y,
    // top margin keeps continuation pages clear of the template header
    margin: { top: TEMPLATE_HDR + 3, left: ML, right: MR, bottom: 20 },
    head: [['Test Name', 'Result', 'Units', 'Biological Reference Interval']],
    body: tableBody as Parameters<typeof autoTable>[1]['body'],
    theme: 'plain',
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 2.5, bottom: 2.5, left: 2.5, right: 2.5 },
      lineColor: [210, 210, 210],
      lineWidth: 0.15,
      textColor: [15, 15, 15],
      font: 'helvetica',
    },
    headStyles: {
      fontStyle: 'bold',
      fontSize: 8.5,
      fillColor: [255, 255, 255],
      textColor: [15, 15, 15],
      lineWidth: { bottom: 0.5 },
      lineColor: [100, 100, 100],
    },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 28 },
      2: { cellWidth: 28 },
      3: { cellWidth: CW - 70 - 28 - 28 },
    },
    willDrawCell(data) {
      if (data.section !== 'body') return
      const meta = rowMetas[data.row.index]
      if (!meta) return
      if (meta.isOutOfRange && data.column.index === 1) {
        data.cell.styles.fontStyle = 'bold'
      }
    },
    didDrawCell(data) {
      if (data.section !== 'body') return
      const meta = rowMetas[data.row.index]
      if (!meta) return

      if (meta.isSectionHeader && data.column.index === 0) {
        const row = tableBody[data.row.index]
        const text = typeof row[0] === 'object' ? (row[0] as CellDef).content : String(row[0])
        const tx = data.cell.x + data.cell.padding('left')
        const ty = data.cell.y + data.cell.height - data.cell.padding('bottom') - 0.5
        const tw2 = doc.getTextWidth(text)
        doc.setDrawColor(15, 15, 15)
        doc.setLineWidth(0.25)
        doc.line(tx, ty, tx + tw2, ty)
      }

      if (meta.isOutOfRange && data.column.index === 1) {
        const text = String(data.cell.text ?? '')
        const tx = data.cell.x + data.cell.padding('left')
        const ty = data.cell.y + data.cell.height - data.cell.padding('bottom') - 0.5
        const tw2 = doc.getTextWidth(text)
        doc.setDrawColor(15, 15, 15)
        doc.setLineWidth(0.25)
        doc.line(tx, ty, tx + tw2, ty)
      }
    },
  })

  /* ── Page numbers ── */
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(140, 140, 140)
    doc.text(`Page ${i} of ${totalPages}`, PAGE_W - MR, PAGE_H - 8, { align: 'right' })
  }

  /* ── Signature / authority section on last page (bottom-right) ── */
  doc.setPage(totalPages)
  const finalY: number = ((doc as unknown) as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 200

  let sigY = finalY + 14
  if (sigY > PAGE_H - 55) {
    doc.addPage()
    sigY = TEMPLATE_HDR + 10
  }

  const sigX = PAGE_W - MR

  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(ML, sigY, PAGE_W - MR, sigY)
  sigY += 8

  if (signature?.imageUrl) {
    try {
      const imgData = await fetchImageAsDataUri(signature.imageUrl)
      if (imgData) {
        doc.addImage(imgData, 'PNG', sigX - 45, sigY, 40, 20)
        sigY += 22
      }
    } catch { /* skip on CORS or fetch error */ }
  }

  const doctorName = labSettings.doctor_name ?? signature?.name ?? ''
  const doctorQual = labSettings.doctor_qualification ?? ''

  if (doctorName) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(10, 10, 10)
    doc.text(doctorName, sigX, sigY + 2, { align: 'right' })
  }
  if (doctorQual) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(60, 60, 60)
    doc.text(`( ${doctorQual} )`, sigX, sigY + 8, { align: 'right' })
  }
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.5)
  doc.setTextColor(130, 130, 130)
  doc.text('Authorized Signatory', sigX, sigY + (doctorQual ? 14 : 8), { align: 'right' })

  if (options.shareUrl) {
    try {
      const qrDataUrl = await QRCode.toDataURL(options.shareUrl, { width: 60, margin: 1 })
      doc.addImage(qrDataUrl, 'PNG', ML, sigY, 20, 20)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(130, 130, 130)
      doc.text('Scan to view report online', ML + 10, sigY + 22, { align: 'center' })
    } catch { /* skip */ }
  }

  /* ── Merge content PDF with Rameshwar.pdf template using pdf-lib ── */
  const patientSlug = order.patient?.fullName?.replace(/\s+/g, '-') ?? 'patient'
  const filename = `report-${order.id}-${patientSlug}.pdf`

  try {
    const templateRes = await fetch('/report-template.pdf')
    if (!templateRes.ok) throw new Error('template not found')

    const templateBytes = await templateRes.arrayBuffer()
    const contentBytes = doc.output('arraybuffer')

    const templatePdf = await PDFDocument.load(templateBytes)
    const contentPdf  = await PDFDocument.load(contentBytes)
    const mergedPdf   = await PDFDocument.create()

    // Embed the template's first page (the Rameshwar letterhead)
    const [embeddedTemplate] = await mergedPdf.embedPages([templatePdf.getPages()[0]])

    const contentPages = contentPdf.getPages()

    for (const contentPage of contentPages) {
      const [embeddedContent] = await mergedPdf.embedPages([contentPage])
      const { width, height } = contentPage.getSize()
      const newPage = mergedPdf.addPage([width, height])

      // 1. Draw the real Rameshwar.pdf header as background
      newPage.drawPage(embeddedTemplate, { x: 0, y: 0, width, height })

      // 2. Draw the jsPDF content on top (patient info, results, signature)
      //    The top TEMPLATE_HDR mm of the content page is empty, so the template header shows through
      newPage.drawPage(embeddedContent, { x: 0, y: 0, width, height })
    }

    // Merge attachment PDF if present
    if (options.attachmentUrl) {
      try {
        const attachmentRes = await fetch(options.attachmentUrl)
        if (attachmentRes.ok) {
          const attachmentBytes = await attachmentRes.arrayBuffer()
          const attachmentPdf = await PDFDocument.load(attachmentBytes)
          const copiedPages = await mergedPdf.copyPages(attachmentPdf, attachmentPdf.getPageIndices())
          copiedPages.forEach(p => mergedPdf.addPage(p))
        }
      } catch { /* skip attachment on error */ }
    }

    const mergedBytes = await mergedPdf.save()
    downloadBlob(mergedBytes, filename)
  } catch {
    // Fallback: download the jsPDF output directly if template fetch fails
    doc.save(filename)
  }
}

/* ─── Receipt generator ─────────────────────────────────── */
export interface GenerateReceiptOptions {
  order: Order
  labSettings: LabSettings
  signature: ActiveSignature | null
  activeLogo?: Logo | null
}

export async function generateReceipt(options: GenerateReceiptOptions): Promise<void> {
  const { order, labSettings, signature } = options

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const PAGE_W = 210
  const PAGE_H = 297
  const ML = 15
  const MR = 15
  const CW = PAGE_W - ML - MR
  const TEMPLATE_HDR = 58

  const amount    = Number(order.amount    ?? 0)
  const discount  = Number(order.discount  ?? 0)
  const net       = Number(order.netAmount ?? 0)
  const discountAmt = amount - net

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

  let y = TEMPLATE_HDR + 6

  /* ── Title + receipt meta ─────────────────────────────── */
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(10, 10, 10)
  doc.text('TAX INVOICE', ML, y)

  const dateStr = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : '—'

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(80, 80, 80)
  doc.text(`Receipt #: ${order.receiptNumber ?? 'PENDING'}`, PAGE_W - MR, y - 5, { align: 'right' })
  doc.text(`Date: ${dateStr}`, PAGE_W - MR, y, { align: 'right' })

  y += 5

  doc.setDrawColor(30, 30, 30)
  doc.setLineWidth(0.5)
  doc.line(ML, y, PAGE_W - MR, y)
  y += 8

  /* ── Bill To / Payment Info columns ──────────────────── */
  const col2X = ML + CW / 2 + 10

  // Column labels
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(120, 120, 120)
  doc.text('BILL TO', ML, y)
  doc.text('PAYMENT', col2X, y)
  y += 5

  const p = order.patient

  // Patient name (large)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(10, 10, 10)
  doc.text(p?.fullName ?? '—', ML, y)

  // Payment status — coloured
  const statusRgb: Record<string, [number, number, number]> = {
    PAID:    [5,  150, 105],
    PENDING: [217, 119,  6],
    PARTIAL: [59,  130, 246],
  }
  const sRgb = statusRgb[order.paymentStatus] ?? [60, 60, 60]
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(sRgb[0], sRgb[1], sRgb[2])
  doc.text(order.paymentStatus, col2X, y)
  y += 5.5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(60, 60, 60)

  if (p?.patientCode) {
    doc.text(`Code: ${p.patientCode}`, ML, y)
  }
  if (order.paymentType) {
    doc.text(`Method: ${order.paymentType.charAt(0) + order.paymentType.slice(1).toLowerCase()}`, col2X, y)
  }
  y += 4.5

  if (p?.age || p?.gender) {
    doc.text(fmtAgeGender(p.age ?? null, p.gender ?? null), ML, y)
  }
  if (order.receiptNumber) {
    doc.text(`Receipt #: ${order.receiptNumber}`, col2X, y)
  }
  y += 4.5

  if (p?.doctorName) {
    doc.text(`Ref: Dr. ${p.doctorName}`, ML, y)
    y += 4.5
  }
  if (p?.phoneNumber) {
    doc.text(`Phone: ${p.phoneNumber}`, ML, y)
    y += 4.5
  }
  if (p?.city) {
    doc.text(`City: ${p.city}`, ML, y)
    y += 4.5
  }

  y += 4

  /* ── Service table ────────────────────────────────────── */
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(ML, y, PAGE_W - MR, y)
  y += 5

  const sacCode = labSettings.lab_hsn_code ?? '998319'
  const discLabel = discount > 0 ? `Disc (${discount}%)` : 'Disc'

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR, bottom: 20 },
    head: [['Description of Service', 'SAC', 'Gross Amt', discLabel, 'Taxable Amt', 'GST', 'Total']],
    body: [[
      order.template?.name ?? 'Diagnostic Test',
      sacCode,
      fmt(amount),
      discount > 0 ? `−${fmt(discountAmt)}` : '—',
      fmt(net),
      'Exempt',
      fmt(net),
    ]],
    theme: 'plain',
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
      lineColor: [210, 210, 210],
      lineWidth: 0.15,
      textColor: [15, 15, 15],
      font: 'helvetica',
    },
    headStyles: {
      fontStyle: 'bold',
      fontSize: 7.5,
      fillColor: [248, 250, 252] as [number, number, number],
      textColor: [80, 80, 80] as [number, number, number],
      lineWidth: { bottom: 0.5 },
      lineColor: [180, 180, 180],
    },
    columnStyles: {
      0: { cellWidth: 58 },
      1: { cellWidth: 18 },
      2: { cellWidth: 23, halign: 'right' },
      3: { cellWidth: 23, halign: 'right' },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 16, halign: 'center' },
      6: { cellWidth: CW - 58 - 18 - 23 - 23 - 25 - 16, halign: 'right', fontStyle: 'bold' },
    },
  })

  const afterTable: number = ((doc as unknown) as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 20

  y = afterTable + 6

  /* ── GST exempt note ──────────────────────────────────── */
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.5)
  doc.setTextColor(70, 130, 90)
  doc.text(
    `✓ Pathology & diagnostic services are GST-exempt under Notification 12/2017-CT(Rate) — SAC ${sacCode}`,
    ML, y,
  )
  y += 10

  /* ── Totals block ─────────────────────────────────────── */
  const totalsRightX = PAGE_W - MR
  const totalsLabelX = totalsRightX - 68

  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(totalsLabelX - 3, y - 3, totalsRightX, y - 3)

  const row = (
    label: string,
    value: string,
    bold = false,
    rgb: [number, number, number] = [60, 60, 60],
  ) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(bold ? 9.5 : 8.5)
    doc.setTextColor(rgb[0], rgb[1], rgb[2])
    doc.text(label, totalsLabelX, y)
    doc.text(value, totalsRightX, y, { align: 'right' })
    y += bold ? 6.5 : 5
  }

  if (discount > 0) {
    row('Gross Amount',          fmt(amount))
    row(`Discount (${discount}%)`, `−${fmt(discountAmt)}`, false, [5, 150, 105])
    row('Taxable Amount',        fmt(net))
  } else {
    row('Taxable Amount',        fmt(net))
  }
  row('GST Amount', '₹0.00')

  y += 1
  doc.setDrawColor(20, 20, 20)
  doc.setLineWidth(0.5)
  doc.line(totalsLabelX - 3, y - 2, totalsRightX, y - 2)
  y += 3

  row('TOTAL AMOUNT', fmt(net), true, [10, 10, 10])

  y += 10

  /* ── Signature block ──────────────────────────────────── */
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(ML, y, PAGE_W - MR, y)
  y += 8

  const sigX = PAGE_W - MR

  if (signature?.imageUrl) {
    try {
      const imgData = await fetchImageAsDataUri(signature.imageUrl)
      if (imgData) {
        doc.addImage(imgData, 'PNG', sigX - 45, y, 40, 20)
        y += 22
      }
    } catch { /* skip */ }
  }

  const doctorName = labSettings.doctor_name ?? signature?.name ?? ''
  const doctorQual = labSettings.doctor_qualification ?? ''

  if (doctorName) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(10, 10, 10)
    doc.text(doctorName, sigX, y + 2, { align: 'right' })
  }
  if (doctorQual) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(60, 60, 60)
    doc.text(`( ${doctorQual} )`, sigX, y + 8, { align: 'right' })
  }
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.5)
  doc.setTextColor(130, 130, 130)
  doc.text('Authorized Signatory', sigX, y + (doctorQual ? 14 : 8), { align: 'right' })

  /* ── Footer note ──────────────────────────────────────── */
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(160, 160, 160)
  doc.text(
    'This is a computer-generated Tax Invoice. For queries, contact the laboratory directly.',
    PAGE_W / 2, PAGE_H - 10, { align: 'center' },
  )

  /* ── Merge with lab letterhead template ───────────────── */
  const patientSlug = order.patient?.fullName?.replace(/\s+/g, '-') ?? 'patient'
  const filename = `receipt-${order.receiptNumber ?? order.id}-${patientSlug}.pdf`

  try {
    const templateRes = await fetch('/report-template.pdf')
    if (!templateRes.ok) throw new Error('template not found')

    const templateBytes = await templateRes.arrayBuffer()
    const contentBytes  = doc.output('arraybuffer')

    const templatePdf = await PDFDocument.load(templateBytes)
    const contentPdf  = await PDFDocument.load(contentBytes)
    const mergedPdf   = await PDFDocument.create()

    const [embeddedTemplate] = await mergedPdf.embedPages([templatePdf.getPages()[0]])

    for (const contentPage of contentPdf.getPages()) {
      const [embeddedContent] = await mergedPdf.embedPages([contentPage])
      const { width, height } = contentPage.getSize()
      const newPage = mergedPdf.addPage([width, height])
      newPage.drawPage(embeddedTemplate, { x: 0, y: 0, width, height })
      newPage.drawPage(embeddedContent,  { x: 0, y: 0, width, height })
    }

    const mergedBytes = await mergedPdf.save()
    downloadBlob(mergedBytes, filename)
  } catch {
    doc.save(filename)
  }
}

/* ─── Plain B&W report generator ───────────────────────── */
export async function generatePlainReport(options: GenerateReportOptions): Promise<void> {
  const { order, results, labSettings, signature } = options

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const PAGE_W = 210
  const PAGE_H = 297
  const ML = 15
  const MR = 15
  const CW = PAGE_W - ML - MR
  const COMPACT_HDR = 18

  function drawFullHeader(): number {
    let y = 10
    const labName = labSettings.lab_name ?? 'Diagnostic Laboratory'

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.setTextColor(10, 10, 10)
    doc.text(labName, PAGE_W / 2, y, { align: 'center' })
    y += 7

    if (labSettings.lab_address) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(50, 50, 50)
      doc.text(labSettings.lab_address, PAGE_W / 2, y, { align: 'center' })
      y += 4.5
    }

    const contact = [labSettings.lab_phone, labSettings.lab_email].filter(Boolean).join('   |   ')
    if (contact) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(60, 60, 60)
      doc.text(contact, PAGE_W / 2, y, { align: 'center' })
      y += 4.5
    }

    if (labSettings.lab_timing) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(80, 80, 80)
      doc.text(`Timing: ${labSettings.lab_timing}`, PAGE_W / 2, y, { align: 'center' })
      y += 4.5
    }

    y += 1
    doc.setDrawColor(10, 10, 10); doc.setLineWidth(0.8)
    doc.line(ML, y, PAGE_W - MR, y)
    y += 1.5
    doc.setLineWidth(0.2)
    doc.line(ML, y, PAGE_W - MR, y)
    y += 5

    const p = order.patient
    const col2X = PAGE_W - MR - 78
    const infoRows: [string, string, string, string][] = [
      ['Pt. Name',   `: ${p?.fullName ?? '—'}`,   'PID',        `: ${order.id}`],
      ['Age/Gender', `: ${fmtAgeGender(p?.age ?? null, p?.gender ?? null)}`, 'Lab ID', `: ${order.id}`],
      ['Ref. By',    `: ${p?.doctorName ?? 'Self'}`, 'Reg. On',  `: ${fmtDate(order.createdAt)}`],
      ['Location',   `: ${p?.city ?? ''}`,            'Report On', `: ${order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}`],
    ]

    doc.setFontSize(9)
    for (const [l1, v1, l2, v2] of infoRows) {
      doc.setFont('helvetica', 'bold');   doc.setTextColor(10, 10, 10); doc.text(l1, ML, y)
      doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 20); doc.text(v1, ML + 26, y)
      doc.setFont('helvetica', 'bold');   doc.setTextColor(10, 10, 10); doc.text(l2, col2X, y)
      doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 20); doc.text(v2, col2X + 26, y)
      y += 5.5
    }

    doc.setLineWidth(0.2); doc.setDrawColor(10, 10, 10)
    doc.line(ML, y, PAGE_W - MR, y)
    y += 1.5
    doc.setLineWidth(0.8)
    doc.line(ML, y, PAGE_W - MR, y)
    y += 5

    return y
  }

  function drawCompactHeader(): void {
    const labName = labSettings.lab_name ?? 'Diagnostic Laboratory'
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(10, 10, 10)
    doc.text(labName, ML, 10)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(50, 50, 50)
    doc.text(`${order.patient?.fullName ?? ''}   |   Lab ID: ${order.id}`, PAGE_W - MR, 10, { align: 'right' })
    doc.setDrawColor(20, 20, 20); doc.setLineWidth(0.6)
    doc.line(ML, 13.5, PAGE_W - MR, 13.5)
  }

  /* ── Split results into section groups ── */
  type SectionGroup = { title: string | null; rows: ReportResult[] }
  const groups: SectionGroup[] = []
  let curr: SectionGroup = { title: null, rows: [] }

  for (const r of results) {
    if (r.isSectionHeader) {
      if (curr.rows.length > 0 || curr.title !== null) groups.push(curr)
      curr = { title: r.fieldName, rows: [] }
    } else {
      curr.rows.push(r)
    }
  }
  if (curr.rows.length > 0 || curr.title !== null) groups.push(curr)
  if (groups.length === 0) groups.push({ title: null, rows: results })

  /* ── Draw page 1 header + test title ── */
  const headerBottom = drawFullHeader()
  const testName = order.template?.name ?? 'Test Results'

  doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.setTextColor(10, 10, 10)
  doc.text(testName, PAGE_W / 2, headerBottom, { align: 'center' })
  const testTw = doc.getTextWidth(testName)
  doc.setLineWidth(0.35); doc.setDrawColor(10, 10, 10)
  doc.line(PAGE_W / 2 - testTw / 2, headerBottom + 1.5, PAGE_W / 2 + testTw / 2, headerBottom + 1.5)

  /* ── Render each section group ── */
  type RowMeta = { isSectionHeader: boolean; isOutOfRange: boolean }
  type CellDef = { content: string; colSpan?: number; styles?: object }

  let isFirstGroup = true

  for (const group of groups) {
    const startY = isFirstGroup ? headerBottom + 8 : COMPACT_HDR + 3

    if (!isFirstGroup) {
      doc.addPage()
      drawCompactHeader()
    }

    const body: (string | CellDef)[][] = []
    const metas: RowMeta[] = []

    if (group.title) {
      body.push([{ content: group.title, colSpan: 4, styles: { fontStyle: 'bold', fillColor: [248, 248, 248] as [number, number, number] } }])
      metas.push({ isSectionHeader: true, isOutOfRange: false })
    }

    for (const r of group.rows) {
      const valStr = r.value !== null && r.value !== undefined ? String(r.value) : ''
      const oor = isOutOfRange(r.value, r.referenceRange)
      body.push([r.fieldName, valStr, r.unit ?? '', r.referenceRange ?? ''])
      metas.push({ isSectionHeader: false, isOutOfRange: oor })
    }

    const rowMetas = metas

    autoTable(doc, {
      startY,
      margin: { top: COMPACT_HDR + 3, left: ML, right: MR, bottom: 20 },
      head: [['Parameter', 'Result', 'Unit', 'Biological Ref. Interval']],
      body,
      showHead: 'firstPage',
      theme: 'plain',
      styles: {
        fontSize: 8.5,
        cellPadding: { top: 2.5, bottom: 2.5, left: 2.5, right: 2.5 },
        lineColor: [210, 210, 210],
        lineWidth: 0.15,
        textColor: [15, 15, 15],
        font: 'helvetica',
      },
      headStyles: {
        fontStyle: 'bold',
        fontSize: 8.5,
        fillColor: [255, 255, 255],
        textColor: [15, 15, 15],
        lineWidth: { bottom: 0.5 },
        lineColor: [100, 100, 100],
      },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 28 },
        2: { cellWidth: 28 },
        3: { cellWidth: CW - 70 - 28 - 28 },
      },
      didDrawPage(data) {
        if (data.pageCount > 1) drawCompactHeader()
      },
      willDrawCell(data) {
        if (data.section !== 'body') return
        const meta = rowMetas[data.row.index]
        if (!meta) return
        if (meta.isOutOfRange && data.column.index === 1) data.cell.styles.fontStyle = 'bold'
      },
      didDrawCell(data) {
        if (data.section !== 'body') return
        const meta = rowMetas[data.row.index]
        if (!meta) return
        if (meta.isSectionHeader && data.column.index === 0) {
          const row = body[data.row.index]
          const text = typeof row[0] === 'object' ? (row[0] as CellDef).content : String(row[0])
          const tx = data.cell.x + data.cell.padding('left')
          const ty = data.cell.y + data.cell.height - data.cell.padding('bottom') - 0.5
          doc.setDrawColor(15, 15, 15); doc.setLineWidth(0.25)
          doc.line(tx, ty, tx + doc.getTextWidth(text), ty)
        }
        if (meta.isOutOfRange && data.column.index === 1) {
          const text = String(data.cell.text ?? '')
          const tx = data.cell.x + data.cell.padding('left')
          const ty = data.cell.y + data.cell.height - data.cell.padding('bottom') - 0.5
          doc.setDrawColor(15, 15, 15); doc.setLineWidth(0.25)
          doc.line(tx, ty, tx + doc.getTextWidth(text), ty)
        }
      },
    })

    isFirstGroup = false
  }

  /* ── Page numbers ── */
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120, 120, 120)
    doc.text(`Page ${i} of ${totalPages}`, PAGE_W - MR, PAGE_H - 10, { align: 'right' })
    doc.text('This is an Electronically Authenticated Report.', PAGE_W / 2, PAGE_H - 10, { align: 'center' })
  }

  /* ── Signature on last page ── */
  doc.setPage(totalPages)
  const finalY: number = ((doc as unknown) as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 200

  let sigY = finalY + 14
  if (sigY > PAGE_H - 55) {
    doc.addPage()
    drawCompactHeader()
    sigY = COMPACT_HDR + 10
  }

  const sigX = PAGE_W - MR
  doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3)
  doc.line(ML, sigY, PAGE_W - MR, sigY)
  sigY += 8

  if (signature?.imageUrl) {
    try {
      const imgData = await fetchImageAsDataUri(signature.imageUrl)
      if (imgData) { doc.addImage(imgData, 'PNG', sigX - 45, sigY, 40, 20); sigY += 22 }
    } catch { /* skip */ }
  }

  const doctorName = labSettings.doctor_name ?? signature?.name ?? ''
  const doctorQual = labSettings.doctor_qualification ?? ''

  if (doctorName) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(10, 10, 10)
    doc.text(doctorName, sigX, sigY + 2, { align: 'right' })
  }
  if (doctorQual) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(60, 60, 60)
    doc.text(`( ${doctorQual} )`, sigX, sigY + 8, { align: 'right' })
  }
  doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(130, 130, 130)
  doc.text('Authorized Signatory', sigX, sigY + (doctorQual ? 14 : 8), { align: 'right' })

  if (options.shareUrl) {
    try {
      const qrDataUrl = await QRCode.toDataURL(options.shareUrl, { width: 60, margin: 1 })
      doc.addImage(qrDataUrl, 'PNG', ML, sigY, 20, 20)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(130, 130, 130)
      doc.text('Scan to view report online', ML + 10, sigY + 22, { align: 'center' })
    } catch { /* skip */ }
  }

  /* ── Save (with optional attachment merge) ── */
  const patientSlug = order.patient?.fullName?.replace(/\s+/g, '-') ?? 'patient'
  const filename = `report-plain-${order.id}-${patientSlug}.pdf`

  if (options.attachmentUrl) {
    try {
      const attachmentRes = await fetch(options.attachmentUrl)
      if (attachmentRes.ok) {
        const attachmentBytes = await attachmentRes.arrayBuffer()
        const contentBytes   = doc.output('arraybuffer')
        const mainPdf   = await PDFDocument.load(contentBytes)
        const attachPdf = await PDFDocument.load(attachmentBytes)
        const copied = await mainPdf.copyPages(attachPdf, attachPdf.getPageIndices())
        copied.forEach(p => mainPdf.addPage(p))
        downloadBlob(await mainPdf.save(), filename)
        return
      }
    } catch { /* skip */ }
  }

  doc.save(filename)
}
