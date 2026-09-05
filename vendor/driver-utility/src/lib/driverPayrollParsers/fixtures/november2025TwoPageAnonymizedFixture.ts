import { reconstructPdfLines, type PdfTextItem, type StructuredPdfText } from '../../driverPayrollPdfLayout';

const cell = (
  text: string,
  page: number,
  x: number,
  y: number,
  width = text.length * 4.8
): PdfTextItem => ({ text, page, x, y, width, height: 6.5 });

const tableHeader = (page: number) => [
  cell('COD. VOCE', page, 20, 730, 45),
  cell('DESCRIZIONE', page, 80, 730, 65),
  cell('VALORE UNITARIO', page, 340, 730, 72),
  cell('ORE/GG/MESI', page, 420, 730, 62),
  cell('TRATTENUTE', page, 485, 730, 55),
  cell('COMPETENZE', page, 550, 730, 58),
];

export const november2025TwoPageAnonymizedItems: PdfTextItem[] = [
  cell('AZIENDA ANONIMA SRL', 1, 20, 810),
  cell('LIVELLO', 1, 250, 800, 42),
  cell('C/COSTO', 1, 450, 800, 42),
  cell('G1', 1, 255, 785),
  cell('03', 1, 455, 785),
  cell('DL05 - AMAZON', 1, 485, 785),
  cell('PERIODO DI PAGA NOVEMBRE 2025', 1, 20, 760),
  ...tableHeader(1),
  cell('1000', 1, 20, 700), cell('RETRIBUZIONE/STIPENDIO', 1, 80, 700), cell('1.000,00', 1, 560, 700),
  cell('1052', 1, 20, 680), cell('E.D.R. EX ACCORDO', 1, 80, 680), cell('9,32', 1, 560, 680),

  cell('AZIENDA ANONIMA SRL', 2, 20, 810),
  cell('PERIODO DI PAGA NOVEMBRE 2025', 2, 20, 760),
  ...tableHeader(2),
  cell('0169', 2, 20, 700), cell('ORE LAVORATE MESE', 2, 80, 700), cell('160,00', 2, 430, 700),

  cell('SOCIALI I.N.P.S.', 2, 20, 640, 90),
  cell('FISCALI IRPEF M.O.', 2, 220, 640, 105),
  cell('FISCALI IRPEF M.S.', 2, 410, 640, 105),
  cell('IMPONIBILE', 2, 25, 620), cell('TRATTENUTE', 2, 110, 620),
  cell('IMPONIBILE', 2, 225, 620), cell('TRATTENUTE', 2, 310, 620),
  cell('IMPONIBILE', 2, 415, 620), cell('TRATTENUTE', 2, 500, 620),
  cell('2.000,00', 2, 45, 610), cell('90,00', 2, 145, 610),
  cell('1.800,00', 2, 245, 610), cell('40,00', 2, 345, 610),
  cell('500,00', 2, 435, 610), cell('20,00', 2, 535, 610),

  cell('RETR. UTILE TFR', 2, 20, 570),
  cell('MAT. MESE AL NETTO DELLO 0,5 %', 2, 170, 570),
  cell('2.000,00', 2, 90, 560), cell('138,20', 2, 275, 560),

  cell('TOTALE TRATTENUTE', 2, 400.88, 170, 42.33),
  cell('TOTALE COMPETENZE', 2, 484.16, 170, 44.13),
  cell('150,00', 2, 462.32, 160, 18.35),
  cell('1.009,32', 2, 538.58, 160, 23.35),
  cell('PAGAMENTO IN', 2, 20, 115),
  cell('PERIODO DI PAGA', 2, 165, 115),
  cell('DATA VALUTA', 2, 315, 115),
  cell('ARROTONDAMENTO', 2, 415, 115),
  cell('NETTO', 2, 520, 115),
  cell('C/C', 2, 20, 105),
  cell('NOVEMBRE 2025', 2, 190, 105),
  cell('15/12/2025', 2, 330, 105),
  cell('859,32', 2, 545, 105),
];

export const november2025TwoPageAnonymizedFixture = (): StructuredPdfText => {
  const reconstructedLines = reconstructPdfLines(november2025TwoPageAnonymizedItems);
  return {
    pages: 2,
    items: november2025TwoPageAnonymizedItems,
    reconstructedLines,
    plainText: reconstructedLines.map((line) => line.text).join('\n'),
  };
};
