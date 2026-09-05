import { reconstructPdfLines, type PdfTextItem, type StructuredPdfText } from '../../driverPayrollPdfLayout';

const cell = (text: string, x: number, y: number, width = text.length * 4.8): PdfTextItem => ({
  text,
  page: 1,
  x,
  y,
  width,
  height: 6.5,
});

export const january2026SummaryAnonymizedFixture = (): StructuredPdfText => {
  const items: PdfTextItem[] = [
    cell('AZIENDA ANONIMA SRL', 20, 760),
    cell('VOCE', 20, 720),
    cell('DESCRIZIONE', 90, 720),
    cell('VALORE UNITARIO', 270, 720),
    cell('ORE/GG/MESI', 370, 720),
    cell('TRATTENUTE', 470, 720),
    cell('COMPETENZE', 570, 720),

    cell('TOTALE TRATTENUTE', 400, 430),
    cell('TOTALE COMPETENZE', 500, 430),
    cell('800,00', 462, 423),
    cell('2.500,00', 550, 423),
    cell('PERIODO DI PAGA GENNAIO 2026', 30, 360),
    cell('NETTO 1.700,00', 500, 360),

    cell('TOTALE TRATTENUTE', 400, 230),
    cell('TOTALE COMPETENZE', 500, 230),
    cell('986,93', 462, 223),
    cell('2.896,57', 550, 223),
    cell('PERIODO DI PAGA GENNAIO 2026', 30, 120),
    cell('DATA PAGAMENTO 13/02/2026', 260, 120),
    cell('NETTO 1.909,64', 500, 120),
  ];
  const reconstructedLines = reconstructPdfLines(items);
  return {
    pages: 1,
    items,
    reconstructedLines,
    plainText: reconstructedLines.map((line) => line.text).join('\n'),
  };
};
