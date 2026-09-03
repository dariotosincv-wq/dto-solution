import { StandardFonts, rgb } from 'pdf-lib'

const COLORS = {
  black: rgb(0, 0, 0),
  blue: rgb(0.05, 0.25, 0.75),
  red: rgb(0.75, 0.08, 0.08),
}

export async function embedNacScanTextFonts(pdfDocument) {
  const [normal, bold, italic, boldItalic] = await Promise.all([
    pdfDocument.embedFont(StandardFonts.Helvetica),
    pdfDocument.embedFont(StandardFonts.HelveticaBold),
    pdfDocument.embedFont(StandardFonts.HelveticaOblique),
    pdfDocument.embedFont(StandardFonts.HelveticaBoldOblique),
  ])
  return { normal, bold, italic, boldItalic }
}

export function drawNacScanText(page, annotation, fonts) {
  const { width, height } = page.getSize()
  const isBold = annotation.fontWeight === 'bold'
  const isItalic = annotation.fontStyle === 'italic'
  const font = fonts[isBold && isItalic ? 'boldItalic' : isBold ? 'bold' : isItalic ? 'italic' : 'normal']
  const size = annotation.fontSize || 18
  const x = annotation.x * width
  const y = (1 - annotation.y) * height
  const color = COLORS[annotation.color] || COLORS.black

  page.drawText(annotation.text, { x, y, size, font, color })
  if (annotation.textDecoration === 'underline') {
    page.drawLine({
      start: { x, y: y - Math.max(1, size * 0.08) },
      end: { x: x + font.widthOfTextAtSize(annotation.text, size), y: y - Math.max(1, size * 0.08) },
      thickness: Math.max(0.7, size / 18),
      color,
    })
  }
}
