import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
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
  // Accepts formats: "13.0-18.0", "[13.0-18.0]", "4000-10000"
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

/* ─── Main generator ────────────────────────────────────── */
export function generateLabReport(options: GenerateReportOptions): void {
  const { order, results, labSettings, signature, activeLogo } = options

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const PAGE_W = 210
  const PAGE_H = 297
  const ML = 15          // margin left
  const MR = 15          // margin right
  const CW = PAGE_W - ML - MR  // content width

  /* ── Draw page header (logo · lab name · address · dividers) ── */
  function drawPageHeader() {
    // Top thick rule
    doc.setDrawColor(60, 60, 60)
    doc.setLineWidth(0.6)
    doc.line(ML, 8, PAGE_W - MR, 8)

    // Logo — prefer active logo from Logo Manager, fall back to lab_logo_base64 from settings
    const logoImageData = activeLogo?.imageData ?? labSettings.lab_logo_base64
    let nameX = ML
    if (logoImageData) {
      try {
        doc.addImage(logoImageData, 'PNG', ML, 10, 18, 18)
        nameX = ML + 21
      } catch { /* skip invalid logo */ }
    }

    // Lab name — prefer active logo's name, fall back to lab settings name
    const labDisplayName = activeLogo?.name ?? labSettings.lab_name ?? 'Diagnostic Laboratory'
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(17)
    doc.setTextColor(10, 10, 10)
    doc.text(labDisplayName, nameX, 18)

    // Sub-label
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(90, 90, 90)
    doc.text('Diagnostic Laboratory', nameX, 24)

    // Separator
    doc.setDrawColor(160, 160, 160)
    doc.setLineWidth(0.3)
    doc.line(ML, 27, PAGE_W - MR, 27)

    // Address | email
    doc.setFontSize(8)
    doc.setTextColor(30, 30, 30)
    const addrParts: string[] = []
    if (labSettings.lab_address) addrParts.push(labSettings.lab_address)
    if (labSettings.lab_email) addrParts.push(labSettings.lab_email)
    if (addrParts.length) doc.text(addrParts.join('   |   '), ML, 32)

    // Timing | phone
    const timeParts: string[] = []
    if (labSettings.lab_timing) timeParts.push(`Time: ${labSettings.lab_timing}`)
    if (labSettings.lab_phone)  timeParts.push(`For Home Collection - ${labSettings.lab_phone}`)
    if (timeParts.length) doc.text(timeParts.join('   '), ML, 37)

    // Bottom separator
    doc.setLineWidth(0.3)
    doc.line(ML, 40, PAGE_W - MR, 40)
  }

  /* ── Draw patient info block (first page only) ── */
  function drawPatientInfo(startY: number): number {
    const p = order.patient
    const col2X = PAGE_W - MR - 65  // right-column X

    doc.setFontSize(9)
    doc.setTextColor(10, 10, 10)

    // Row 1 – Patient name  |  Lab ID
    doc.setFont('helvetica', 'bold');  doc.text("Patient's Name", ML, startY)
    doc.setFont('helvetica', 'normal'); doc.text(`: ${p?.fullName ?? '—'}`, ML + 35, startY)
    doc.setFont('helvetica', 'bold');  doc.text('Lab ID', col2X, startY)
    doc.setFont('helvetica', 'normal'); doc.text(`:${order.id}`, col2X + 14, startY)

    // Row 2 – Age/Gender  |  Date
    doc.setFont('helvetica', 'bold');  doc.text('Age / Gender', ML, startY + 7)
    doc.setFont('helvetica', 'normal'); doc.text(`: ${fmtAgeGender(p?.age ?? null, p?.gender ?? null)}`, ML + 35, startY + 7)
    doc.setFont('helvetica', 'bold');  doc.text('Date', col2X, startY + 7)
    doc.setFont('helvetica', 'normal'); doc.text(`:${fmtDate(order.createdAt)}`, col2X + 14, startY + 7)

    // Row 3 – Referred by
    doc.setFont('helvetica', 'bold');  doc.text('Referred by', ML, startY + 14)
    doc.setFont('helvetica', 'normal'); doc.text(`: ${p?.doctorName ?? 'Self'}`, ML + 35, startY + 14)

    // Row 4 – Location
    doc.setFont('helvetica', 'bold');  doc.text('Location', ML, startY + 21)
    doc.setFont('helvetica', 'normal'); doc.text(`: ${p?.city ?? ''}`, ML + 35, startY + 21)

    // Divider
    doc.setDrawColor(160, 160, 160)
    doc.setLineWidth(0.3)
    doc.line(ML, startY + 26, PAGE_W - MR, startY + 26)

    return startY + 26  // returns bottom Y of patient section
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

  /* ── Draw page 1 ── */
  drawPageHeader()
  const patientBottomY = drawPatientInfo(44)

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

  // Divider after test name
  doc.setDrawColor(160, 160, 160)
  doc.setLineWidth(0.3)
  doc.line(ML, testNameY + 5, PAGE_W - MR, testNameY + 5)

  const TABLE_START_Y = testNameY + 8
  const HEADER_MARGIN_TOP = 45  // continuation pages: table starts below page header

  /* ── Render table ── */
  autoTable(doc, {
    startY: TABLE_START_Y,
    margin: { top: HEADER_MARGIN_TOP, left: ML, right: MR, bottom: 20 },
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
      // Bold out-of-range values
      if (meta.isOutOfRange && data.column.index === 1) {
        data.cell.styles.fontStyle = 'bold'
      }
    },
    didDrawCell(data) {
      if (data.section !== 'body') return
      const meta = rowMetas[data.row.index]
      if (!meta) return

      // Underline section-header text (column 0 spans all)
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

      // Underline out-of-range result value (column 1)
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
    didDrawPage(data) {
      // Draw page header on continuation pages (page 1 already drawn)
      if (data.pageNumber > 1) {
        drawPageHeader()
      }
    },
  })

  /* ── Add page numbers ── */
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(140, 140, 140)
    doc.text(`Page ${i} of ${totalPages}`, PAGE_W - MR, PAGE_H - 8, { align: 'right' })
  }

  /* ── Signature section on last page ── */
  // Navigate to last page and get final table Y
  doc.setPage(totalPages)
  const finalY: number = ((doc as unknown) as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 200

  let sigY = finalY + 20
  // If too close to bottom, push to a new page
  if (sigY > PAGE_H - 50) {
    doc.addPage()
    drawPageHeader()
    sigY = 65
  }

  const sigX = PAGE_W - MR

  // Signature image (right-aligned)
  if (signature?.imageData) {
    try {
      doc.addImage(signature.imageData, 'PNG', sigX - 42, sigY - 22, 38, 18)
    } catch { /* skip if image data invalid */ }
  }

  // Doctor name
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
    doc.setFontSize(9)
    doc.text(`( ${doctorQual} )`, sigX, sigY + 8, { align: 'right' })
  }

  /* ── Save ── */
  const patientSlug = order.patient?.fullName?.replace(/\s+/g, '-') ?? 'patient'
  doc.save(`report-${order.id}-${patientSlug}.pdf`)
}
