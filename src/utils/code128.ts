import type { jsPDF } from 'jspdf'

/** CODE128 bar/space width patterns (index 0–106). Stop is 7 digits. */
const BARS = [
  212222, 222122, 222221, 121223, 121322, 131222, 122213, 122312, 132212, 221213,
  221312, 231212, 112232, 122132, 122231, 113222, 123122, 123221, 223211, 221132,
  221231, 213212, 223112, 312131, 311222, 321122, 321221, 312212, 322112, 322211,
  212123, 212321, 232121, 111323, 131123, 131321, 112313, 132113, 132311, 211313,
  231113, 231311, 112133, 112331, 132131, 113123, 113321, 133121, 313121, 211331,
  231131, 213113, 213311, 213131, 311123, 311321, 331121, 312113, 312311, 332111,
  314111, 221411, 431111, 111224, 111422, 121124, 121421, 141122, 141221, 112214,
  112412, 122114, 122411, 142112, 142211, 241211, 221114, 413111, 241112, 134111,
  111242, 121142, 121241, 114212, 124112, 124211, 411212, 421112, 421211, 212141,
  214121, 412121, 111143, 111341, 131141, 114113, 114311, 411113, 411311, 113141,
  114131, 311141, 411131, 211412, 211214, 211232, 2331112,
]

function sanitise(text: string): string {
  return [...text].filter(ch => {
    const v = ch.charCodeAt(0) - 32
    return v >= 0 && v <= 94
  }).join('')
}

function encodeCode128B(text: string): number[] {
  const codes = [104]
  for (const ch of text) codes.push(ch.charCodeAt(0) - 32)
  let sum = 104
  for (let i = 1; i < codes.length; i++) sum += codes[i] * i
  codes.push(sum % 103)
  codes.push(106)
  return codes
}

/** Draw a Code 128 barcode in millimetres. Quiet zones are included in `width`. */
export function drawCode128(
  doc: jsPDF,
  raw: string,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const text = sanitise(raw)
  if (!text) return

  const widths: number[] = []
  for (const code of encodeCode128B(text)) {
    for (const d of String(BARS[code])) widths.push(Number(d))
  }
  const quiet = 10
  const total = widths.reduce((s, n) => s + n, 0) + quiet * 2
  const unit = width / total

  doc.setFillColor(0, 0, 0)
  let cx = x + quiet * unit
  widths.forEach((w, i) => {
    const mw = w * unit
    if (i % 2 === 0) doc.rect(cx, y, mw, height, 'F')
    cx += mw
  })
}

export function barcodePosition(labSettings?: { barcode_x_mm?: string; barcode_y_mm?: string } | Record<string, string | undefined> | null): { x: number; y: number } | null {
  const x = Number(labSettings?.barcode_x_mm)
  const y = Number(labSettings?.barcode_y_mm)
  if (!Number.isFinite(x) || !Number.isFinite(y) || x <= 0 || y <= 0) return null
  return { x, y }
}

/** Barcode plus human-readable receipt number underneath. */
export function drawReceiptBarcode(
  doc: jsPDF,
  value: string,
  x: number,
  y: number,
  width = 42,
  barHeight = 10,
): void {
  const text = sanitise(value)
  if (!text) return
  drawCode128(doc, text, x, y, width, barHeight)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(20, 20, 20)
  doc.text(text, x + width / 2, y + barHeight + 3.2, { align: 'center' as const })
}
