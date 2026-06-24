import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { PDFDocument } from 'pdf-lib'
import type { LabSettings, ActiveSignature, Logo } from '../types'

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
}

/* ─── Helpers ───────────────────────────────────────────── */
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

  if (signature?.imageData) {
    try {
      doc.addImage(signature.imageData, 'PNG', sigX - 45, sigY, 40, 20)
      sigY += 22
    } catch { /* skip invalid signature */ }
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

    const mergedBytes = await mergedPdf.save()
    downloadBlob(mergedBytes, filename)
  } catch {
    // Fallback: download the jsPDF output directly if template fetch fails
    doc.save(filename)
  }
}
