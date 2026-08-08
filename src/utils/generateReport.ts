import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'
import type { LabSettings, ActiveSignature, Logo, Order, SummaryFormat } from '../types'
import { isOutOfRange } from './rangeCheck'

/* ─── Types ─────────────────────────────────────────────── */
export interface ReportResult {
  fieldName: string
  fieldType: string
  value: string | number | boolean | null
  unit: string | null
  referenceRange: string | null
  isSectionHeader: boolean
  isMainHeader?: boolean
}

export interface ReportOrder {
  id: number
  receiptNumber?: string | null
  patient?: {
    fullName: string
    patientCode?: string
    age: number | null
    gender: string | null
    doctorName: string | null
    city?: string | null
    isB2b?: boolean
    b2bLab?: { name: string; contactPerson?: string | null; city?: string | null; address?: string | null; phone?: string | null } | null
  }
  template?: { name: string; code: string; summaryTitle?: string | null; summary?: string | null; summaryFormat?: SummaryFormat }
  createdAt?: string
}

export interface GenerateReportOptions {
  order: ReportOrder
  results: ReportResult[]
  labSettings: LabSettings
  /** Every currently-active signature — all are rendered side by side on the report */
  signatures: ActiveSignature[]
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

const SIG_IMG_H = 22   // signature image slot (20mm image + 2mm gap)
const SIG_LINE_H = 5.5 // name / qualification line slot
const SIG_AUTH_H = 4   // "Authorized Signatory" line slot (always the bottom-most line)

/**
 * Draws the standard bottom-right sign-off block used on reports and receipts:
 * signature image, doctor name line, degree/qualification line, then an
 * "Authorized Signatory" caption.
 *
 * Pass either `y` (draw downward starting there) or `bottomY` (stack the block
 * upward so "Authorized Signatory" lands exactly on `bottomY` — e.g. flush
 * with a page-number footer row). Returns the Y position after the block.
 */
async function drawSignatureBlock(
  doc: jsPDF,
  opts: {
    x: number
    y?: number
    bottomY?: number
    signatureUrl?: string | null
    doctorName?: string | null
    doctorQual?: string | null
    /** Set false to reserve the caption's slot without drawing it — used when multiple signatures share one caption. */
    showCaption?: boolean
  },
): Promise<number> {
  const { x, showCaption = true } = opts

  let imgData: string | null = null
  if (opts.signatureUrl) {
    try { imgData = await fetchImageAsDataUri(opts.signatureUrl) } catch { imgData = null }
  }

  const displayName = opts.doctorName?.trim() ?? ''
  const hasQual = !!opts.doctorQual

  let y: number
  if (opts.bottomY !== undefined) {
    const totalH = (imgData ? SIG_IMG_H : 0) + (displayName ? SIG_LINE_H : 0) + (hasQual ? SIG_LINE_H : 0) + SIG_AUTH_H
    y = opts.bottomY - totalH
  } else {
    y = opts.y ?? 0
  }

  if (imgData) {
    doc.addImage(imgData, 'PNG', x - 45, y, 40, 20)
    y += SIG_IMG_H
  }

  if (displayName) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(10, 10, 10)
    doc.text(displayName, x, y + 4, { align: 'right' })
    y += SIG_LINE_H
  }

  if (hasQual) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(90, 90, 90)
    doc.text(opts.doctorQual!, x, y + 4, { align: 'right' })
    y += SIG_LINE_H
  }

  if (showCaption) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7.5)
    doc.setTextColor(130, 130, 130)
    doc.text('Authorized Signatory', x, y + 4, { align: 'right' })
  }
  y += SIG_AUTH_H

  return y
}

/**
 * Draws every active signature side by side, packed tightly as a single
 * right-aligned group (not spread across the full page width), with ONE
 * shared "Authorized Signatory" caption centered underneath — never one per
 * signature. Pass either `y` (draw downward) or `bottomY` (bottom-anchor),
 * same convention as `drawSignatureBlock`. Falls back to a single text-only
 * block from `labSettings` when no signature is active.
 */
async function drawSignatureBlocks(
  doc: jsPDF,
  opts: {
    y?: number
    bottomY?: number
    ML: number
    MR: number
    PAGE_W: number
    signatures: ActiveSignature[]
    labSettings: LabSettings
  },
): Promise<void> {
  const { y, bottomY, ML, MR, PAGE_W, signatures, labSettings } = opts

  if (signatures.length === 0) {
    await drawSignatureBlock(doc, {
      x: PAGE_W - MR,
      y, bottomY,
      doctorName: labSettings.doctor_name,
      doctorQual: labSettings.doctor_qualification,
    })
    return
  }

  if (signatures.length === 1) {
    const sig = signatures[0]
    await drawSignatureBlock(doc, {
      x: PAGE_W - MR,
      y, bottomY,
      signatureUrl: sig.imageUrl,
      doctorName: sig.name,
      doctorQual: sig.degreeName,
    })
    return
  }

  // Multiple signatures: pack them close together as one group anchored to
  // the right margin (same edge the single-signature layout always used),
  // and suppress each block's own caption in favor of a single shared one
  // drawn at that same right-aligned spot.
  const CW = PAGE_W - ML - MR
  const slotW = Math.min(50, Math.max(20, (CW - 90) / (signatures.length - 1)))
  const anchors = signatures.map((_, i) => (PAGE_W - MR) - (signatures.length - 1 - i) * slotW)

  const endYs: number[] = []
  for (let i = 0; i < signatures.length; i++) {
    const sig = signatures[i]
    const endY = await drawSignatureBlock(doc, {
      x: anchors[i],
      y, bottomY,
      signatureUrl: sig.imageUrl,
      doctorName: sig.name,
      doctorQual: sig.degreeName,
      showCaption: false,
    })
    endYs.push(endY)
  }

  const captionBaselineY = Math.max(...endYs) - SIG_AUTH_H + 4

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.5)
  doc.setTextColor(130, 130, 130)
  doc.text('Authorized Signatory', PAGE_W - MR, captionBaselineY, { align: 'right' })
}

/** Draws a centered footer note on every page of the document at the given (x, y). */
function drawFooterNote(doc: jsPDF, note: string, x: number, y: number): void {
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text(note, x, y, { align: 'center' })
  }
}

/**
 * Draws the test's summary/interpretation block after the results table, as a
 * paragraph or a bulleted list depending on `format`. Whenever content would run
 * into the reserved footer/signature zone, `onPageBreak` is called to start a
 * fresh page (it should addPage() + redraw that page's own header) and return
 * the Y to resume drawing at. Returns the Y position after the block.
 */
function drawSummarySection(
  doc: jsPDF,
  opts: {
    startY: number
    ML: number
    MR: number
    PAGE_W: number
    safeBottomY: number
    title: string
    summary: string
    format: SummaryFormat
    onPageBreak: () => number
  },
): number {
  let y = opts.startY
  const CW = opts.PAGE_W - opts.ML - opts.MR

  const ensureSpace = (needed: number) => {
    if (y + needed > opts.safeBottomY) y = opts.onPageBreak()
  }

  ensureSpace(10)
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(opts.ML, y, opts.PAGE_W - opts.MR, y)
  y += 6

  ensureSpace(6)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(10, 10, 10)
  doc.text(opts.title, opts.ML, y)
  y += 5.5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(40, 40, 40)

  if (opts.format === 'points') {
    const points = opts.summary.split('\n').map(s => s.trim()).filter(Boolean)
    for (const point of points) {
      const lines = doc.splitTextToSize(point, CW - 6) as string[]
      lines.forEach((line, i) => {
        ensureSpace(4.5)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8.5)
        doc.setTextColor(40, 40, 40)
        if (i === 0) doc.text('•', opts.ML, y)
        doc.text(line, opts.ML + 5, y)
        y += 4.5
      })
    }
  } else {
    const lines = doc.splitTextToSize(opts.summary, CW) as string[]
    for (const line of lines) {
      ensureSpace(4.5)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(40, 40, 40)
      doc.text(line, opts.ML, y)
      y += 4.5
    }
  }

  return y
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

/** Opens a PDF in a new browser tab instead of downloading it. */
function openPdfInNewTab(bytes: Uint8Array) {
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
  // Give the new tab time to load the blob before revoking it
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Loads a PDF into a hidden iframe and triggers the browser's print dialog for it. */
function printPdfBytes(bytes: Uint8Array) {
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.src = url

  const cleanup = () => {
    document.body.removeChild(iframe)
    URL.revokeObjectURL(url)
  }

  iframe.onload = () => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
  }
  document.body.appendChild(iframe)
  // Give the print dialog time to open and be handled before tearing the iframe down
  setTimeout(cleanup, 60_000)
}

/* ─── Uint8Array → base64 (chunked to avoid call stack limits) ─────── */
function uint8ToBase64(bytes: Uint8Array): string {
  const chunks: string[] = []
  for (let i = 0; i < bytes.length; i += 8192) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)))
  }
  return btoa(chunks.join(''))
}

/* ─── Main generator ────────────────────────────────────── */
async function buildLabReportBytes(options: GenerateReportOptions): Promise<Uint8Array> {
  const { order, results, labSettings, signatures } = options

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const PAGE_W = 210
  const PAGE_H = 297
  const ML = 15
  const MR = 15
  const CW = PAGE_W - ML - MR

  // Space reserved at the top of every page for the Rameshwar.pdf header template.
  const TEMPLATE_HDR = 36

  /* ── Draw patient info block (first page only) ── */
  function drawPatientInfo(startY: number): number {
    const p = order.patient
    const col2X = PAGE_W - MR - 75

    doc.setFontSize(9)
    doc.setTextColor(10, 10, 10)

    doc.setFont('helvetica', 'bold');  doc.text("Patient's Name", ML, startY)
    doc.setFont('helvetica', 'normal'); doc.text(`: ${p?.fullName ?? '—'}`, ML + 35, startY)
    doc.setFont('helvetica', 'bold');  doc.text('Receipt No.', col2X, startY)
    doc.setFont('helvetica', 'normal'); doc.text(`: ${order.receiptNumber ?? '—'}`, col2X + 24, startY)

    doc.setFont('helvetica', 'bold');  doc.text('Age / Gender', ML, startY + 7)
    doc.setFont('helvetica', 'normal'); doc.text(`: ${fmtAgeGender(p?.age ?? null, p?.gender ?? null)}`, ML + 35, startY + 7)
    doc.setFont('helvetica', 'bold');  doc.text('Date', col2X, startY + 7)
    doc.setFont('helvetica', 'normal'); doc.text(`: ${fmtDate(order.createdAt)}`, col2X + 24, startY + 7)

    doc.setFont('helvetica', 'bold');  doc.text('Referred by', ML, startY + 14)
    doc.setFont('helvetica', 'normal'); doc.text(`: ${p?.doctorName ?? 'Self'}`, ML + 35, startY + 14)

    // Location is only meaningful for B2B referrals (shows the referring lab) — omitted otherwise
    let bottomOffset = 19
    if (p?.isB2b && p?.b2bLab) {
      const locationValue = `${p.b2bLab.name}${p.city ? ` @${p.city}` : ''}${p.b2bLab.contactPerson ? ` (${p.b2bLab.contactPerson})` : ''}`
      doc.setFont('helvetica', 'bold');  doc.text('Location', ML, startY + 21)
      doc.setFont('helvetica', 'normal'); doc.text(`: ${locationValue}`, ML + 35, startY + 21)
      bottomOffset = 26
    }

    doc.setDrawColor(160, 160, 160)
    doc.setLineWidth(0.3)
    doc.line(ML, startY + bottomOffset, PAGE_W - MR, startY + bottomOffset)

    return startY + bottomOffset
  }

  /* ── Build table rows ── */
  interface RowMeta { isSectionHeader: boolean; isMainHeader: boolean; isOutOfRange: boolean }
  const rowMetas: RowMeta[] = []
  type CellDef = { content: string; colSpan?: number; styles?: object }
  const tableBody: (string | CellDef)[][] = []

  for (const r of results) {
    if (r.isSectionHeader) {
      tableBody.push([{
        content: r.fieldName,
        colSpan: 4,
        styles: { fontStyle: 'bold', halign: r.isMainHeader ? 'center' : 'left' },
      }])
      rowMetas.push({ isSectionHeader: true, isMainHeader: !!r.isMainHeader, isOutOfRange: false })
    } else {
      const valStr = r.value !== null && r.value !== undefined ? String(r.value) : ''
      const oor = isOutOfRange(r.value, r.referenceRange)
      tableBody.push([r.fieldName, valStr, r.unit ?? '', r.referenceRange ?? ''])
      rowMetas.push({ isSectionHeader: false, isMainHeader: false, isOutOfRange: oor })
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
      lineWidth: 0,
      textColor: [15, 15, 15],
      font: 'helvetica',
    },
    headStyles: {
      fontStyle: 'bold',
      fontSize: 8.5,
      fillColor: [255, 255, 255],
      textColor: [15, 15, 15],
      lineWidth: { top: 0.5, bottom: 0.5 },
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
        const tw2 = doc.getTextWidth(text)
        const tx = meta.isMainHeader
          ? data.cell.x + (data.cell.width - tw2) / 2
          : data.cell.x + data.cell.padding('left')
        const ty = data.cell.y + data.cell.height - data.cell.padding('bottom') - 0.5
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

  /* ── Bottom border after last table row ── */
  const tableBottom = ((doc as unknown) as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY
  if (tableBottom) {
    doc.setDrawColor(100, 100, 100)
    doc.setLineWidth(0.5)
    doc.line(ML, tableBottom, PAGE_W - MR, tableBottom)
  }

  /* ── Signature / authority section, bottom-anchored on the last page ──
     "Authorized Signatory" sits flush with the page-number row (FOOTER_Y),
     raised clear of the Rameshwar.pdf template's bottom address bar, with
     the degree/name/image stacked upward above it on the right. ── */
  const FOOTER_Y = PAGE_H - 24
  const SIG_RESERVED_H = 40
  const safeBottomY = FOOTER_Y - SIG_RESERVED_H

  doc.setPage(doc.getNumberOfPages())
  let contentEndY = tableBottom ?? 200

  /* ── Summary section (after the results table) ── */
  const summaryText = order.template?.summary?.trim()
  if (summaryText) {
    contentEndY = drawSummarySection(doc, {
      startY: contentEndY + 6,
      ML, MR, PAGE_W,
      safeBottomY,
      title: order.template?.summaryTitle?.trim() || 'Summary',
      summary: summaryText,
      format: order.template?.summaryFormat ?? 'paragraph',
      onPageBreak: () => { doc.addPage(); return TEMPLATE_HDR + 3 },
    })
  }

  if (contentEndY + 6 > safeBottomY) {
    doc.addPage()
  }

  await drawSignatureBlocks(doc, { bottomY: FOOTER_Y, ML, MR, PAGE_W, signatures, labSettings })

  if (options.shareUrl) {
    try {
      const qrDataUrl = await QRCode.toDataURL(options.shareUrl, { width: 60, margin: 1 })
      doc.addImage(qrDataUrl, 'PNG', ML, safeBottomY + 4, 20, 20)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(130, 130, 130)
      doc.text('Scan to view report online', ML + 10, safeBottomY + 26, { align: 'center' })
    } catch { /* skip */ }
  }

  /* ── Page numbers + footer note (drawn last so they land on every page, incl. any added for the signature) ── */
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(140, 140, 140)
    doc.text(`Page ${i} of ${totalPages}`, ML, FOOTER_Y, { align: 'left' })
  }
  drawFooterNote(doc, 'This is a computer-generated report and does not require a physical signature.', PAGE_W / 2, FOOTER_Y)

  /* ── Merge content PDF with Rameshwar.pdf template using pdf-lib ── */
  try {
    const templateRes = await fetch('/Rameshwar.pdf')
    if (!templateRes.ok) throw new Error('template not found')

    const templateBytes = await templateRes.arrayBuffer()
    const contentBytes = doc.output('arraybuffer')

    const templatePdf = await PDFDocument.load(templateBytes)
    const contentPdf  = await PDFDocument.load(contentBytes)
    const mergedPdf   = await PDFDocument.create()

    const [embeddedTemplate] = await mergedPdf.embedPages([templatePdf.getPages()[0]])

    for (const contentPage of contentPdf.getPages()) {
      const [embeddedContent] = await mergedPdf.embedPages([contentPage])
      const { width, height } = contentPage.getSize()
      const newPage = mergedPdf.addPage([width, height])
      newPage.drawPage(embeddedTemplate, { x: 0, y: 0, width, height })
      newPage.drawPage(embeddedContent, { x: 0, y: 0, width, height })
    }

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

    return await mergedPdf.save()
  } catch {
    return new Uint8Array(doc.output('arraybuffer') as ArrayBuffer)
  }
}

export async function generateLabReport(options: GenerateReportOptions): Promise<void> {
  const bytes = await buildLabReportBytes(options)
  const patientSlug = options.order.patient?.fullName?.replace(/\s+/g, '-') ?? 'patient'
  downloadBlob(bytes, `report-${options.order.id}-${patientSlug}.pdf`)
}

/** Generate letterhead report and return it as a base64 string (no download). */
export async function generateLabReportBase64(options: GenerateReportOptions): Promise<string> {
  return uint8ToBase64(await buildLabReportBytes(options))
}

/* ─── Receipt generator ─────────────────────────────────── */
export interface GenerateReceiptOptions {
  /** All orders sharing one receipt (a single-element array for a lone test). */
  orders: Order[]
  labSettings: LabSettings
  /** Every currently-active signature — all are rendered side by side on the receipt */
  signatures: ActiveSignature[]
  activeLogo?: Logo | null
}

export async function generateReceipt(options: GenerateReceiptOptions): Promise<void> {
  const { orders } = options
  const order = orders[0]
  // All tests on one receipt share a single receipt number — resolve it from
  // whichever order actually has it set, rather than assuming orders[0] does.
  const receiptNumber = orders.find(o => o.receiptNumber)?.receiptNumber ?? null

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const PAGE_W = 210
  const ML = 15
  const MR = 15
  const CW = PAGE_W - ML - MR
  const TEMPLATE_HDR = 58

  const lineItems = orders.map(o => ({
    label: [o.template?.code, o.template?.name].filter(Boolean).join(' - ') || 'Diagnostic Test',
    amount: Number(o.netAmount ?? o.amount ?? 0),
  }))
  const grossTotal = orders.reduce((s, o) => s + Number(o.amount ?? 0), 0)
  const netTotal = lineItems.reduce((s, l) => s + l.amount, 0)
  const discountAmt = grossTotal - netTotal

  const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const fmtGenderAge = (gender: string | null, age: number | null): string => {
    const g = gender ? (gender.toLowerCase().startsWith('m') ? 'Male' : 'Female') : null
    const parts = [g, age ? `${age} Yrs` : null].filter(Boolean)
    return parts.length > 0 ? parts.join('/') : '—'
  }

  const fmtBillDate = (iso?: string): string => {
    if (!iso) return '—'
    const d = new Date(iso)
    const datePart = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')
    const timePart = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
    return `${datePart} ${timePart}`
  }

  const p = order.patient
  let y = TEMPLATE_HDR + 4

  /* ── Title ─────────────────────────────────────────────── */
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(10, 10, 10)
  doc.text('BILL', PAGE_W / 2, y, { align: 'center' })
  y += 3
  doc.setDrawColor(10, 10, 10)
  doc.setLineWidth(0.5)
  doc.line(ML, y, PAGE_W - MR, y)
  y += 7

  /* ── Two-column info grid ──────────────────────────────── */
  const col2X = ML + CW / 2 + 5
  const labelW = 28

  doc.setFontSize(9)
  const infoRow = (x: number, label: string, value: string, rowY: number) => {
    doc.setFont('helvetica', 'bold'); doc.setTextColor(10, 10, 10)
    doc.text(label, x, rowY)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 30)
    doc.text(`: ${value}`, x + labelW, rowY)
  }

  infoRow(ML, 'Name', p?.fullName ?? '—', y)
  infoRow(col2X, 'Bill No.', receiptNumber ?? '—', y)
  y += 6
  infoRow(ML, 'Gender/Age', fmtGenderAge(p?.gender ?? null, p?.age ?? null), y)
  infoRow(col2X, 'Bill Date', fmtBillDate(order.createdAt), y)
  y += 6
  infoRow(ML, 'Mobile', p?.phoneNumber ?? '—', y)
  infoRow(col2X, 'Patient ID', p?.patientCode ?? '—', y)
  y += 6
  infoRow(ML, 'Ref By', p?.doctorName ?? 'Self', y)
  y += 10

  /* ── Test table — one row per test on this receipt ─────── */
  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR, bottom: 20 },
    head: [['Test Name', 'Remarks', 'MRP Amount']],
    body: lineItems.map(l => [l.label, '', fmt(l.amount)]),
    theme: 'plain',
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
      lineWidth: 0,
      textColor: [15, 15, 15],
      font: 'helvetica',
    },
    headStyles: {
      fontStyle: 'bold',
      fontSize: 8,
      fillColor: [255, 255, 255] as [number, number, number],
      textColor: [10, 10, 10] as [number, number, number],
      lineWidth: { top: 0.4, bottom: 0.4 },
      lineColor: [10, 10, 10],
    },
    columnStyles: {
      0: { cellWidth: CW - 30 - 40 },
      1: { cellWidth: 30 },
      2: { cellWidth: 40, halign: 'right' },
    },
  })

  const afterTable: number = ((doc as unknown) as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 20
  y = afterTable + 3

  doc.setDrawColor(10, 10, 10)
  doc.setLineWidth(0.4)
  doc.line(ML, y, PAGE_W - MR, y)
  y += 6

  /* ── Total ─────────────────────────────────────────────── */
  const totalsRightX = PAGE_W - MR
  const totalsLabelX = totalsRightX - 55

  if (discountAmt > 0) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(60, 60, 60)
    doc.text('Gross Amount', totalsLabelX, y)
    doc.text(fmt(grossTotal), totalsRightX, y, { align: 'right' })
    y += 5
    doc.setTextColor(5, 150, 105)
    doc.text('Discount', totalsLabelX, y)
    doc.text(`-${fmt(discountAmt)}`, totalsRightX, y, { align: 'right' })
    y += 6
  }

  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(10, 10, 10)
  doc.text('Bill Amount', totalsLabelX, y)
  doc.text(fmt(netTotal), totalsRightX, y, { align: 'right' })
  y += 10

  /* ── Footer note — no signature required on this format ── */
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(140, 140, 140)
  doc.text('This is a computer-generated bill and does not require a signature.', ML, y)

  /* ── Merge with payment template ─────────────────────── */
  const patientSlug = order.patient?.fullName?.replace(/\s+/g, '-') ?? 'patient'
  const filename = `receipt-${receiptNumber ?? order.id}-${patientSlug}.pdf`

  try {
    const templateRes = await fetch('/Payment.pdf')
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
async function buildPlainReportDoc(options: GenerateReportOptions): Promise<jsPDF> {
  const { order, results, labSettings, signatures } = options

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const PAGE_W = 210
  const PAGE_H = 297
  const ML = 15
  const MR = 15
  const CW = PAGE_W - ML - MR
  // Same top gap as the letterhead report's reserved template-header zone, for a consistent look across both.
  const TEMPLATE_HDR = 36

  function drawFullHeader(): number {
    let y = TEMPLATE_HDR

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

    y += 3
    doc.setDrawColor(10, 10, 10); doc.setLineWidth(0.4)
    doc.line(ML, y, PAGE_W - MR, y)
    y += 8

    const p = order.patient
    const col2X = PAGE_W - MR - 75

    doc.setFontSize(9)

    doc.setFont('helvetica', 'bold');   doc.setTextColor(10, 10, 10); doc.text("Patient's Name", ML, y)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 20); doc.text(`: ${p?.fullName ?? '—'}`, ML + 35, y)
    doc.setFont('helvetica', 'bold');   doc.setTextColor(10, 10, 10); doc.text('Receipt No.', col2X, y)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 20); doc.text(`: ${order.receiptNumber ?? '—'}`, col2X + 24, y)

    doc.setFont('helvetica', 'bold');   doc.setTextColor(10, 10, 10); doc.text('Age / Gender', ML, y + 7)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 20); doc.text(`: ${fmtAgeGender(p?.age ?? null, p?.gender ?? null)}`, ML + 35, y + 7)
    doc.setFont('helvetica', 'bold');   doc.setTextColor(10, 10, 10); doc.text('Date', col2X, y + 7)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 20); doc.text(`: ${fmtDate(order.createdAt)}`, col2X + 24, y + 7)

    doc.setFont('helvetica', 'bold');   doc.setTextColor(10, 10, 10); doc.text('Referred by', ML, y + 14)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 20); doc.text(`: ${p?.doctorName ?? 'Self'}`, ML + 35, y + 14)

    // Location is only meaningful for B2B referrals (shows the referring lab) — omitted otherwise
    let bottomOffset = 19
    if (p?.isB2b && p?.b2bLab) {
      const locationValue = `${p.b2bLab.name}${p.city ? ` @${p.city}` : ''}${p.b2bLab.contactPerson ? ` (${p.b2bLab.contactPerson})` : ''}`
      doc.setFont('helvetica', 'bold');   doc.setTextColor(10, 10, 10); doc.text('Location', ML, y + 21)
      doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 20); doc.text(`: ${locationValue}`, ML + 35, y + 21)
      bottomOffset = 26
    }

    y += bottomOffset
    doc.setDrawColor(10, 10, 10); doc.setLineWidth(0.4)
    doc.line(ML, y, PAGE_W - MR, y)
    y += 5

    return y
  }

  /* ── Draw page 1 header + test title ── */
  const headerBottom = drawFullHeader()
  const testName = order.template?.name ?? 'Test Results'

  doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.setTextColor(10, 10, 10)
  doc.text(testName, PAGE_W / 2, headerBottom, { align: 'center' })
  const testTw = doc.getTextWidth(testName)
  doc.setLineWidth(0.35); doc.setDrawColor(10, 10, 10)
  doc.line(PAGE_W / 2 - testTw / 2, headerBottom + 1.5, PAGE_W / 2 + testTw / 2, headerBottom + 1.5)

  /* ── Build table rows — headers and fields flow together on one continuous
     table, same as the letterhead report, instead of a forced page break
     per section header. ── */
  interface RowMeta { isSectionHeader: boolean; isMainHeader: boolean; isOutOfRange: boolean }
  type CellDef = { content: string; colSpan?: number; styles?: object }
  const tableBody: (string | CellDef)[][] = []
  const rowMetas: RowMeta[] = []

  for (const r of results) {
    if (r.isSectionHeader) {
      tableBody.push([{
        content: r.fieldName,
        colSpan: 4,
        styles: { fontStyle: 'bold', halign: r.isMainHeader ? 'center' : 'left' },
      }])
      rowMetas.push({ isSectionHeader: true, isMainHeader: !!r.isMainHeader, isOutOfRange: false })
    } else {
      const valStr = r.value !== null && r.value !== undefined ? String(r.value) : ''
      const oor = isOutOfRange(r.value, r.referenceRange)
      tableBody.push([r.fieldName, valStr, r.unit ?? '', r.referenceRange ?? ''])
      rowMetas.push({ isSectionHeader: false, isMainHeader: false, isOutOfRange: oor })
    }
  }

  autoTable(doc, {
    startY: headerBottom + 8,
    // Continuation pages within this same test stay blank up top — patient details
    // are shown once per test, not repeated on every overflow page.
    margin: { top: TEMPLATE_HDR + 3, left: ML, right: MR, bottom: 20 },
    head: [['Parameter', 'Result', 'Unit', 'Biological Ref. Interval']],
    body: tableBody as Parameters<typeof autoTable>[1]['body'],
    showHead: 'firstPage',
    theme: 'plain',
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 2.5, bottom: 2.5, left: 2.5, right: 2.5 },
      lineWidth: 0,
      textColor: [15, 15, 15],
      font: 'helvetica',
    },
    headStyles: {
      fontStyle: 'bold',
      fontSize: 8.5,
      fillColor: [255, 255, 255],
      textColor: [15, 15, 15],
      lineWidth: { top: 0.5, bottom: 0.5 },
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
      if (meta.isOutOfRange && data.column.index === 1) data.cell.styles.fontStyle = 'bold'
    },
    didDrawCell(data) {
      if (data.section !== 'body') return
      const meta = rowMetas[data.row.index]
      if (!meta) return
      if (meta.isSectionHeader && data.column.index === 0) {
        const row = tableBody[data.row.index]
        const text = typeof row[0] === 'object' ? (row[0] as CellDef).content : String(row[0])
        const tw2 = doc.getTextWidth(text)
        const tx = meta.isMainHeader
          ? data.cell.x + (data.cell.width - tw2) / 2
          : data.cell.x + data.cell.padding('left')
        const ty = data.cell.y + data.cell.height - data.cell.padding('bottom') - 0.5
        doc.setDrawColor(15, 15, 15); doc.setLineWidth(0.25)
        doc.line(tx, ty, tx + tw2, ty)
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

  /* ── Bottom border after the last table row ── */
  {
    const tableBottom = ((doc as unknown) as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY
    if (tableBottom) {
      doc.setDrawColor(100, 100, 100)
      doc.setLineWidth(0.5)
      doc.line(ML, tableBottom, PAGE_W - MR, tableBottom)
    }
  }

  /* ── Signature / authority section, bottom-anchored on the last page ──
     Same FOOTER_Y / SIG_RESERVED_H as the letterhead report, so both report
     types share an identical bottom margin and signature placement. ── */
  const FOOTER_Y = PAGE_H - 24
  const SIG_RESERVED_H = 40
  const safeBottomY = FOOTER_Y - SIG_RESERVED_H

  doc.setPage(doc.getNumberOfPages())
  let contentEndY: number = ((doc as unknown) as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 200

  /* ── Summary section (after the results table) ── */
  const summaryText = order.template?.summary?.trim()
  if (summaryText) {
    contentEndY = drawSummarySection(doc, {
      startY: contentEndY + 6,
      ML, MR, PAGE_W,
      safeBottomY,
      title: order.template?.summaryTitle?.trim() || 'Summary',
      summary: summaryText,
      format: order.template?.summaryFormat ?? 'paragraph',
      onPageBreak: () => { doc.addPage(); return TEMPLATE_HDR + 3 },
    })
  }

  if (contentEndY + 6 > safeBottomY) {
    doc.addPage()
  }

  await drawSignatureBlocks(doc, { bottomY: FOOTER_Y, ML, MR, PAGE_W, signatures, labSettings })

  if (options.shareUrl) {
    try {
      const qrDataUrl = await QRCode.toDataURL(options.shareUrl, { width: 60, margin: 1 })
      doc.addImage(qrDataUrl, 'PNG', ML, safeBottomY + 4, 20, 20)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(130, 130, 130)
      doc.text('Scan to view report online', ML + 10, safeBottomY + 26, { align: 'center' })
    } catch { /* skip */ }
  }

  /* ── Page numbers + footer note (drawn last so any page added for the signature is included) ── */
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120, 120, 120)
    doc.text(`Page ${i} of ${totalPages}`, ML, FOOTER_Y, { align: 'left' })
  }
  drawFooterNote(doc, 'This is an Electronically Authenticated Report.', PAGE_W / 2, FOOTER_Y)

  return doc
}

export async function generatePlainReport(options: GenerateReportOptions): Promise<void> {
  const doc = await buildPlainReportDoc(options)
  const { order } = options
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

/** Generate report and return it as a base64 string (no download). */
export async function generateReportBase64(options: GenerateReportOptions): Promise<string> {
  const doc = await buildPlainReportDoc(options)
  return (doc.output('datauristring') as string).split(',')[1]
}

const MM_TO_PT = 72 / 25.4
const FOOTER_Y_MM = 297 - 24 // matches FOOTER_Y in both single-report builders
const FOOTER_ML_MM = 15

/**
 * Each per-test builder stamps its OWN "Page X of Y" — correct only for that
 * single test's document. Once multiple tests are merged into one combined
 * report those numbers are wrong for the whole document (every page reads
 * "Page 1 of 1", etc.) — this whites out that footer strip on every merged
 * page and restamps correct, combined-wide numbering + footer note directly
 * on the final PDF.
 */
async function restampCombinedFooters(pdf: PDFDocument, footerNote: string): Promise<void> {
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const italicFont = await pdf.embedFont(StandardFonts.HelveticaOblique)
  const pages = pdf.getPages()
  const total = pages.length

  pages.forEach((page, idx) => {
    const { width, height } = page.getSize()
    const baselineY = height - FOOTER_Y_MM * MM_TO_PT

    // White out the old (wrong) per-test footer row before restamping
    page.drawRectangle({
      x: 0,
      y: baselineY - 3 * MM_TO_PT,
      width,
      height: 7 * MM_TO_PT,
      color: rgb(1, 1, 1),
    })

    page.drawText(`Page ${idx + 1} of ${total}`, {
      x: FOOTER_ML_MM * MM_TO_PT,
      y: baselineY,
      size: 8,
      font,
      color: rgb(140 / 255, 140 / 255, 140 / 255),
    })

    const noteSize = 7
    const noteWidth = italicFont.widthOfTextAtSize(footerNote, noteSize)
    page.drawText(footerNote, {
      x: (width - noteWidth) / 2,
      y: baselineY,
      size: noteSize,
      font: italicFont,
      color: rgb(150 / 255, 150 / 255, 150 / 255),
    })
  })
}

/** Builds the merged PDF bytes for multiple tests — each test starts on its own page. */
async function buildCombinedReportBytes(
  optionsList: GenerateReportOptions[],
  type: 'letterhead' | 'plain',
): Promise<Uint8Array> {
  // Every test in a combined report belongs to the same receipt — resolve one
  // shared receipt number up front so every section shows the identical value,
  // even if an individual order's own record is missing it.
  const sharedReceiptNumber = optionsList.find(o => o.order.receiptNumber)?.order.receiptNumber ?? null
  const normalizedList = optionsList.map(opt => ({
    ...opt,
    order: { ...opt.order, receiptNumber: sharedReceiptNumber },
  }))

  if (normalizedList.length === 1) {
    return type === 'letterhead' ? buildLabReportBytes(normalizedList[0]) : buildPlainReportDoc(normalizedList[0]).then(d => new Uint8Array(d.output('arraybuffer') as ArrayBuffer))
  }

  const pdfBytesArray = await Promise.all(
    normalizedList.map(opt =>
      type === 'letterhead'
        ? buildLabReportBytes(opt)
        : buildPlainReportDoc(opt).then(d => new Uint8Array(d.output('arraybuffer') as ArrayBuffer))
    )
  )

  const merged = await PDFDocument.create()
  for (const bytes of pdfBytesArray) {
    const pdf = await PDFDocument.load(bytes)
    const pages = await merged.copyPages(pdf, pdf.getPageIndices())
    pages.forEach(p => merged.addPage(p))
  }

  const footerNote = type === 'letterhead'
    ? 'This is a computer-generated report and does not require a physical signature.'
    : 'This is an Electronically Authenticated Report.'
  await restampCombinedFooters(merged, footerNote)

  return merged.save()
}

/**
 * Generate a combined PDF for multiple tests — each test starts on its own page.
 * Falls back to individual downloads if merging fails.
 */
export async function generateCombinedReport(
  optionsList: GenerateReportOptions[],
  type: 'letterhead' | 'plain' = 'plain',
): Promise<void> {
  if (optionsList.length === 0) return
  const bytes = await buildCombinedReportBytes(optionsList, type)
  const first = optionsList[0]
  const patientSlug = first.order.patient?.fullName?.replace(/\s+/g, '-') ?? 'patient'
  downloadBlob(bytes, `report-combined-${patientSlug}.pdf`)
}

/** Opens the combined report PDF in a new browser tab instead of downloading it. */
export async function viewCombinedReport(
  optionsList: GenerateReportOptions[],
  type: 'letterhead' | 'plain' = 'plain',
): Promise<void> {
  if (optionsList.length === 0) return
  const bytes = await buildCombinedReportBytes(optionsList, type)
  openPdfInNewTab(bytes)
}

/** Sends the combined report PDF straight to the browser's print dialog. */
export async function printCombinedReport(
  optionsList: GenerateReportOptions[],
  type: 'letterhead' | 'plain' = 'plain',
): Promise<void> {
  if (optionsList.length === 0) return
  const bytes = await buildCombinedReportBytes(optionsList, type)
  printPdfBytes(bytes)
}

/** Fetches PDFs from the given URLs and merges them into one document, opened in a new tab. */
export async function viewMergedAttachments(urls: string[]): Promise<void> {
  const valid = urls.filter(Boolean)
  if (valid.length === 0) return

  if (valid.length === 1) {
    window.open(valid[0], '_blank')
    return
  }

  const merged = await PDFDocument.create()
  for (const url of valid) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const bytes = await res.arrayBuffer()
      const pdf = await PDFDocument.load(bytes)
      const pages = await merged.copyPages(pdf, pdf.getPageIndices())
      pages.forEach(p => merged.addPage(p))
    } catch { /* skip a document that fails to fetch/parse */ }
  }

  if (merged.getPageCount() === 0) return
  openPdfInNewTab(await merged.save())
}
