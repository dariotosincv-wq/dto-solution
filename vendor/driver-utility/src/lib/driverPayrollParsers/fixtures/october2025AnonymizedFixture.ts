import { reconstructPdfLines, type PdfTextItem, type StructuredPdfText } from '../../driverPayrollPdfLayout';

const cell = (text: string, x: number, y: number, width = text.length * 4.8): PdfTextItem => ({
  text,
  page: 1,
  x,
  y,
  width,
  height: 6.5,
});

/**
 * Fixture anonimizzata del layout reale di ottobre 2025.
 * Dati personali, IBAN e matricola sono omessi; struttura, coordinate relative
 * ed importi necessari alla regressione restano invariati.
 */
export const october2025AnonymizedItems: PdfTextItem[] = [
  cell('VECTUM SRL', 20, 790),
  cell('LIVELLO G1', 250, 790),
  cell('CENTRO DI COSTO 03 DL05 - AMAZON', 350, 790),
  cell('PERIODO DI PAGA OTTOBRE 2025', 20, 765),

  // L'intestazione reale usa "COD. VOCE": la precedente regexp ^VOCE$ non la riconosceva.
  cell('COD. VOCE', 20, 730, 45),
  cell('DESCRIZIONE', 80, 730, 65),
  cell('VALORE UNITARIO', 340, 730, 72),
  cell('ORE/GG/MESI', 420, 730, 62),
  cell('TRATTENUTE', 485, 730, 55),
  cell('COMPETENZE', 550, 730, 58),

  cell('0169', 20, 710), cell('ORE LAVORATE MESE', 80, 710), cell('151,20', 430, 710),
  cell('0170', 20, 690), cell('GG LAVORATI', 80, 690), cell('18,00', 430, 690),
  cell('0779', 20, 670), cell('MONTE ORE TEORICO FT/PT', 80, 670), cell('193,20', 430, 670),
  cell('0785', 20, 650), cell('MONTE ORE EFFETTIVO', 80, 650), cell('159,60', 430, 650),
  cell('1000', 20, 630), cell('RETRIBUZIONE/STIPENDIO', 80, 630), cell('85,68', 350, 630), cell('22,00', 430, 630), cell('1.885,06', 560, 630),
  cell('1052', 20, 610), cell('E.D.R. EX ACCORDO 18.05.2021', 80, 610), cell('9,32', 560, 610),
  cell('1989', 20, 590), cell('ORE INFORTUNIO', 80, 590), cell('31,20', 430, 590),
  cell('2310', 20, 570), cell('TRASFERTA', 80, 570), cell('20,50', 350, 570), cell('18,00', 430, 570), cell('369,00', 560, 570),
  cell('2700', 20, 550), cell('INF:GG CARENZA 100%', 80, 550), cell('258,32', 560, 550),
  cell('2850', 20, 530), cell('INF:TRATTENUTA ASSENZA', 80, 530), cell('258,32', 495, 530),
  cell('6633', 20, 510), cell('CTR. C/DIP. EBILOG', 80, 510), cell('0,50', 495, 510),
  cell('7033', 20, 490), cell('CTR. C/AZ. EBILOG', 80, 490), cell('0,50', 350, 490),
  cell('8128', 20, 470), cell('ULT. DETRAZIONE', 80, 470), cell('84,93', 560, 470),
  cell('8146', 20, 450), cell('CREDITO D.L.3/20', 80, 450), cell('2.097,33', 430, 450),
  cell('8320', 20, 430), cell('ADDIZIONALE REGIONALE', 80, 430), cell('26,70', 495, 430),
  cell('8420', 20, 410), cell('ADDIZIONALE COMUNALE SALDO', 80, 410), cell('6,60', 495, 410),
  cell('8460', 20, 390), cell('ADDIZIONALE COMUNALE ACCONTO', 80, 390), cell('2,42', 495, 390),
  cell('8580', 20, 370), cell('M730 IRPEF', 80, 370), cell('334,50', 495, 370),
  cell('8582', 20, 350), cell('M730 ADDIZIONALE REGIONALE', 80, 350), cell('21,50', 495, 350),
  cell('9300', 20, 330), cell('TRATTENUTA SINDACALE', 80, 330), cell('9,00', 495, 330),
  cell('9531', 20, 310), cell('ONERI DEDUCIBILI', 80, 310), cell('75,00', 430, 310),

  cell('DATI PREVIDENZIALI E FISCALI', 20, 280),
  cell('IMPONIBILE INPS', 35, 260), cell('CONTRIBUTI DIPENDENTE', 270, 260),
  cell('1.894,00', 170, 250), cell('179,74', 430, 250),
  cell('IMPONIBILE FISCALE', 35, 235), cell('IRPEF TRATTENUTA', 270, 235),
  cell('1.718,14', 170, 225), cell('132,21', 430, 225),
  cell('RETRIBUZIONE UTILE TFR', 35, 210), cell('TFR MATURATO MESE', 270, 210), cell('TFR PROGRESSIVO', 450, 210),
  cell('1.894,38', 170, 200), cell('130,85', 390, 200), cell('1.428,28', 545, 200),

  cell('PROGRESSIVI', 20, 175),
  cell('GG. DETRAZIONE', 15, 155, 52),
  cell('ALTRE DETRAZIONI', 80, 155, 64),
  cell('IMPONIBILE SOCIALE', 165, 155, 70),
  cell('TRATTENUTE SOCIALI', 250, 155, 72),
  cell('IMP.LE FISCALE', 330, 155, 54),
  cell('IMPOSTA VERSATA', 352.6445, 155, 38.0105286),
  cell('TOTALE TRATTENUTE', 400.8804, 155, 42.3315),
  cell('TOTALE COMPETENZE', 484.1595, 155, 44.1321),
  cell('304', 55, 145, 12),
  cell('2.554,66', 120, 145, 28),
  cell('22.908,00', 205, 145, 31),
  cell('2.173,98', 290, 145, 28),
  cell('20.740,48', 345, 145, 31),
  cell('2.215,66', 374.51, 145, 23.352),
  cell('971,49', 462.32, 145, 18.348),
  cell('2.521,70', 538.58, 145, 23.352),

  cell('ACCANT. T.F.R. AL 31/12/2000', 80, 125),
  cell('PAGAMENTO IN', 20, 100),
  cell('PERIODO DI PAGA', 165, 100),
  cell('DATA VALUTA', 315, 100),
  cell('ARROTONDAMENTO', 415, 100),
  cell('NETTO', 520, 100),
  cell('C/C', 20, 90),
  cell('OTTOBRE 2025', 190, 90),
  cell('14/11/2025', 330, 90),
  cell('1.550,21', 545, 90),
];

export const october2025AnonymizedFixture = (): StructuredPdfText => {
  const reconstructedLines = reconstructPdfLines(october2025AnonymizedItems);
  return {
    pages: 1,
    items: october2025AnonymizedItems,
    reconstructedLines,
    plainText: reconstructedLines.map((line) => line.text).join('\n'),
  };
};
