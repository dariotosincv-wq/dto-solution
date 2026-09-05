import { describe, expect, it } from 'vitest';
import { reconstructPdfLines, type PdfTextItem, type StructuredPdfText } from '../driverPayrollPdfLayout';
import { detectPayslipFormat, parsePayslip } from './payslipParserRegistry';
import { january2026SummaryAnonymizedFixture } from './fixtures/january2026SummaryAnonymizedFixture';

const structuredFromLines = (lines: string[]): StructuredPdfText => ({
  pages: 1,
  items: lines.map((text, index) => ({
    text,
    page: 1,
    x: 10,
    y: 700 - index * 20,
  })),
  reconstructedLines: lines.map((text, index) => ({
    page: 1,
    y: 700 - index * 20,
    text,
    items: [{ text, page: 1, x: 10, y: 700 - index * 20 }],
  })),
  plainText: lines.join('\n'),
});

const structuredFromItems = (items: PdfTextItem[]): StructuredPdfText => {
  const reconstructedLines = reconstructPdfLines(items);
  return {
    pages: 1,
    items,
    reconstructedLines,
    plainText: reconstructedLines.map((line) => line.text).join('\n'),
  };
};

const cell = (text: string, x: number, y: number): PdfTextItem => ({
  text,
  page: 1,
  x,
  y,
  width: text.length * 6,
  height: 10,
});

const logisticsLayoutV1Structured = structuredFromLines([
  'AZIENDA DEMO',
  'PERIODO DI PAGA GENNAIO 2026',
  'VOCE ORE/GG/MESI IMPORTO',
  '1000 RETRIBUZIONE/STIPENDIO 87,38 22,00 1.922,36',
  '2310 TRASFERTA 22,50 17,00 382,50',
  '2315 INDENNITA LAVORO DOMENICALE 7,00 2,00 14,00',
  'TOTALE COMPETENZE 2.318,86',
  'TOTALE TRATTENUTE 512,34',
  'NETTO 1.806,52',
]);

const aprilRealLikeStructured = structuredFromLines([
  'AZIENDA DEMO',
  'PERIODO DI PAGA APRILE 2026',
  'DATA VALUTA 14/05/2026',
  'VOCE ORE/GG/MESI IMPORTO',
  '0169 ORE LAVORATE MESE 142,80',
  '0170 GIORNI LAVORATI 17,00',
  '0779 MONTE ORE TEORICO 176,40',
  '0785 MONTE ORE EFFETTIVO 142,80',
  '1981 ORE MALATTIA 31,20',
  '2310 TRASFERTA 22,50 17,00 382,50',
  '3900 FESTIVITA 90,00 1,00 90,00',
  'TRATTENUTE INPS 214,00',
  'TOTALE COMPETENZE 3.025,79',
  'TOTALE TRATTENUTE 841,11',
  'ARROTONDAMENTO 0,01',
  'NETTO 2.184,68',
]);

const marchRealLikeStructured = structuredFromItems([
  cell('AZIENDA DEMO', 10, 760),
  cell('VOCE ORE/GG/MESI IMPORTO', 10, 720),
  cell('0169', 10, 700),
  cell('ORE LAVORATE MESE', 70, 700),
  cell('107,10', 410, 700),
  cell('0170', 10, 680),
  cell('GIORNI LAVORATI', 70, 680),
  cell('13,00', 410, 680),
  cell('5000', 10, 660),
  cell('FERIE GODUTE', 70, 660),
  cell('7,00', 410, 660),
  cell('2310', 10, 640),
  cell('TRASFERTA', 70, 640),
  cell('22,50', 260, 640),
  cell('13,00', 330, 640),
  cell('292,50', 410, 640),
  cell('1000 RETRIBUZIONE/STIPENDIO 87,38 22,00 1.922,36', 10, 620),
  cell('IMPONIBILE INPS 1.932,00', 10, 600),
  cell('TRATTENUTE INPS 183,35', 10, 580),
  cell('TRATTENUTE FISCALI 133,35', 10, 560),
  cell('TRATTENUTA SINDACALE 9,00', 10, 540),
  cell('PERIODO DI PAGA', 30, 160),
  cell('MARZO', 230, 160),
  cell('2026', 300, 160),
  cell('DATA VALUTA', 30, 135),
  cell('14/04/2026', 230, 135),
  cell('TOTALE COMPETENZE', 30, 110),
  cell('2.224,18', 300, 110),
  cell('TOTALE TRATTENUTE', 30, 85),
  cell('367,86', 300, 85),
  cell('NETTO', 30, 60),
  cell('1.856,32', 300, 60),
]);

const unknownCompanyCodesStructured = structuredFromItems([
  cell('AZIENDA DEMO', 10, 760),
  cell('PERIODO DI PAGA', 10, 740),
  cell('GENNAIO 2026', 180, 740),
  cell('VOCE', 10, 720),
  cell('DESCRIZIONE', 70, 720),
  cell('VALORE UNITARIO', 250, 720),
  cell('ORE/GG/MESI', 330, 720),
  cell('TRATTENUTE', 400, 720),
  cell('COMPETENZE', 500, 720),
  cell('9901', 10, 700),
  cell('PREMIO AZIENDALE FUTURO', 70, 700),
  cell('12,55', 250, 700),
  cell('10,00', 330, 700),
  cell('125,50', 500, 700),
  cell('9902', 10, 680),
  cell('TRATTENUTA AZIENDALE FUTURA', 70, 680),
  cell('45,25', 400, 680),
  cell('9903', 10, 660),
  cell('INDICATORE AZIENDALE', 70, 660),
  cell('8,00', 330, 660),
  cell('2310', 10, 640),
  cell('TRASFERTA', 70, 640),
  cell('22,50', 250, 640),
  cell('10,00', 330, 640),
  cell('225,00', 500, 640),
  cell('2030', 10, 620),
  cell('STRAORDINARIO 30%', 70, 620),
  cell('14,88', 250, 620),
  cell('8,40', 330, 620),
  cell('124,95', 500, 620),
]);

describe('payslipParserRegistry', () => {
  it('riconosce Layout Logistica 1 con piu indicatori', () => {
    const detection = detectPayslipFormat(logisticsLayoutV1Structured);

    expect(detection.format).toBe('logisticsLayoutV1');
    expect(detection.indicators.length).toBeGreaterThanOrEqual(2);
  });

  it('parsa trasferta 22,50 x 17 = 382,50', () => {
    const payslip = parsePayslip(logisticsLayoutV1Structured);
    const line = payslip.parsedLines.find((item) => item.code === '2310');

    expect(line).toMatchObject({ unitValue: 22.5, quantity: 17, amount: 382.5 });
  });

  it('parsa indennita domenicale 7,00 x 2 = 14,00', () => {
    const payslip = parsePayslip(logisticsLayoutV1Structured);
    const line = payslip.parsedLines.find((item) => item.code === '2315');

    expect(line).toMatchObject({ unitValue: 7, quantity: 2, amount: 14 });
  });

  it('conserva un nuovo codice aziendale in competenze senza inventarne la categoria', () => {
    const payslip = parsePayslip(unknownCompanyCodesStructured);
    const line = payslip.parsedLines.find((item) => item.code === '9901');

    expect(line).toMatchObject({
      originalCode: '9901',
      originalDescription: 'PREMIO AZIENDALE FUTURO',
      normalizedDescription: 'premio aziendale futuro',
      classification: 'unknown',
      category: 'unknown',
      type: 'earning',
      economicType: 'earning',
      quantityUnit: 'unknown',
      amount: 125.5,
      unitValue: 12.55,
      quantity: 10,
      earningAmount: 125.5,
      sourcePage: 1,
      interpretationMethod: 'logisticsLayoutV1_geometric_columns',
    });
    expect(line?.rawLine).toContain('125,50');
    expect(line?.sourceGeometry?.cells.length).toBeGreaterThan(0);
  });

  it('conserva un codice sconosciuto in trattenute come deduction', () => {
    const payslip = parsePayslip(unknownCompanyCodesStructured);
    const line = payslip.parsedLines.find((item) => item.code === '9902');

    expect(line).toMatchObject({
      classification: 'unknown',
      category: 'unknown',
      type: 'deduction',
      economicType: 'deduction',
      amount: 45.25,
      deductionAmount: 45.25,
    });
    expect(line?.earningAmount).toBeUndefined();
  });

  it('conserva una riga sconosciuta solo informativa senza alterare i totali economici delle righe', () => {
    const payslip = parsePayslip(unknownCompanyCodesStructured);
    const line = payslip.parsedLines.find((item) => item.code === '9903');

    expect(line).toMatchObject({
      classification: 'unknown',
      type: 'informational',
      economicType: 'informational',
      quantity: 8,
    });
    expect(line?.amount).toBeUndefined();
    expect(line?.earningAmount).toBeUndefined();
    expect(line?.deductionAmount).toBeUndefined();
  });

  it('continua a normalizzare un codice conosciuto nella stessa tabella', () => {
    const payslip = parsePayslip(unknownCompanyCodesStructured);
    const line = payslip.parsedLines.find((item) => item.code === '2310');

    expect(line).toMatchObject({
      label: 'TRASFERTA',
      section: 'travel_allowance',
      category: 'travel_allowance',
      canonicalKey: 'payroll.travel_allowance',
      type: 'earning',
      linkedPayrollCode: '2310',
      unitValue: 22.5,
      quantity: 10,
      amount: 225,
      earningAmount: 225,
      quantityUnit: 'days',
    });
  });

  it('separa tariffa ore e competenza dello straordinario', () => {
    const payslip = parsePayslip(unknownCompanyCodesStructured);
    const line = payslip.parsedLines.find((item) => item.code === '2030');

    expect(line).toMatchObject({
      unitValue: 14.88,
      quantity: 8.4,
      quantityUnit: 'hours',
      earningAmount: 124.95,
    });
    expect(line?.deductionAmount).toBeUndefined();
  });

  it('parsa netto dal blocco finale', () => {
    const payslip = parsePayslip(logisticsLayoutV1Structured);

    expect(payslip.summary.netAmount).toBe(1806.52);
    expect(payslip.summary.grossAmount).toBe(2318.86);
    expect(payslip.summary.totalDeductions).toBe(512.34);
  });

  it('dà priorita al periodo paga rispetto alla data valuta', () => {
    const payslip = parsePayslip(aprilRealLikeStructured);

    expect(payslip.month).toBe(4);
    expect(payslip.year).toBe(2026);
    expect(payslip.payrollPeriodLabel).toBe('APRILE 2026');
    expect(payslip.fieldConfidence?.payrollPeriodLabel?.confidence).toBe('confirmed');
  });

  it('riconosce netto e riepilogo finale senza usare bonifico o arrotondamento', () => {
    const payslip = parsePayslip(aprilRealLikeStructured);

    expect(payslip.summary.netAmount).toBe(2184.68);
    expect(payslip.summary.grossAmount).toBe(3025.79);
    expect(payslip.summary.totalDeductions).toBe(841.11);
    expect(payslip.confidence).toBe(100);
    expect(payslip.fieldConfidence?.netAmount?.confidence).toBe('confirmed');
  });

  it('riconosce aprile 2026 dal blocco finale geometrico Layout Logistica 1', () => {
    const payslip = parsePayslip(
      structuredFromItems([
        cell('AZIENDA DEMO', 10, 760),
        cell('VOCE', 10, 720),
        cell('DESCRIZIONE', 70, 720),
        cell('VALORE UNITARIO', 250, 720),
        cell('ORE-GG-MESI', 350, 720),
        cell('TRATTENUTE', 460, 720),
        cell('COMPETENZE', 560, 720),
        cell('0169', 10, 700),
        cell('ORE LAVORATE MESE', 70, 700),
        cell('142,80', 410, 700),
        cell('0170', 10, 680),
        cell('GIORNI LAVORATI', 70, 680),
        cell('17,00', 410, 680),
        cell('2310', 10, 660),
        cell('TRASFERTA', 70, 660),
        cell('22,50', 260, 660),
        cell('17,00', 330, 660),
        cell('382,50', 410, 660),
        cell('ALTRE DETRAZIONI', 30, 220),
        cell('768,91', 300, 220),
        cell('TFR', 30, 200),
        cell('399,39', 300, 200),
        cell('PERIODO DI PAGA', 40, 150),
        cell('APRILE', 230, 150),
        cell('2026', 300, 150),
        cell('DATA VALUTA', 40, 128),
        cell('14/05/2026', 230, 128),
        cell('TOTALE TRATTENUTE', 40, 106),
        cell('841,11', 230, 106),
        cell('TOTALE COMPETENZE', 350, 106),
        cell('3.025,79', 570, 106),
        cell('NETTO', 350, 82),
        cell('2.184,68', 570, 82),
      ])
    );

    expect(payslip.month).toBe(4);
    expect(payslip.year).toBe(2026);
    expect(payslip.summary.grossAmount).toBe(3025.79);
    expect(payslip.summary.totalDeductions).toBe(841.11);
    expect(payslip.summary.netAmount).toBe(2184.68);
    expect(payslip.summary.grossAmount).not.toBe(768.91);
    expect(payslip.summary.totalDeductions).not.toBe(768.91);
    expect(payslip.summary.netAmount).not.toBe(399.39);
    expect(payslip.fieldConfidence?.grossAmount?.parserUsed).toBe('logisticsLayoutV1FinalTable');
    expect(payslip.fieldConfidence?.totalDeductions?.parserUsed).toBe('logisticsLayoutV1FinalTable');
    expect(payslip.fieldConfidence?.netAmount?.parserUsed).toBe('logisticsLayoutV1FinalTable');
  });

  it('non usa trattenute INPS parziali come totale trattenute', () => {
    const payslip = parsePayslip(aprilRealLikeStructured);

    expect(payslip.summary.totalDeductions).toBe(841.11);
    expect(payslip.summary.totalDeductions).not.toBe(214);
  });

  it('riconosce ore, giorni, trasferte, festivita e malattia del layout reale', () => {
    const payslip = parsePayslip(aprilRealLikeStructured);

    expect(payslip.parsedLines.find((line) => line.code === '0169')).toMatchObject({
      informationalValue: 142.8,
      quantityUnit: 'hours',
      earningAmount: undefined,
      deductionAmount: undefined,
    });
    expect(payslip.parsedLines.find((line) => line.code === '0169')?.amount).toBeUndefined();
    expect(payslip.parsedLines.find((line) => line.code === '0779')).toMatchObject({
      informationalValue: 176.4,
      quantityUnit: 'hours',
    });
    expect(payslip.parsedLines.find((line) => line.code === '0785')).toMatchObject({
      informationalValue: 142.8,
      quantityUnit: 'hours',
    });
    expect(payslip.parsedLines.find((line) => line.code === '0170')).toMatchObject({
      informationalValue: 17,
      quantityUnit: 'days',
      earningAmount: undefined,
      deductionAmount: undefined,
    });
    expect(payslip.parsedLines.find((line) => line.code === '2310')?.quantity).toBe(17);
    expect(payslip.parsedLines.find((line) => line.code === '3900')?.quantity).toBe(1);
    expect(payslip.parsedLines.find((line) => line.code === '1981')).toMatchObject({
      informationalValue: 31.2,
      quantityUnit: 'hours',
    });
  });

  it('riconosce il riepilogo finale reale marzo 2026 da celle separate', () => {
    const payslip = parsePayslip(marchRealLikeStructured);

    expect(payslip.month).toBe(3);
    expect(payslip.year).toBe(2026);
    expect(payslip.payrollPeriodLabel).toBe('MARZO 2026');
    expect(payslip.summary.netAmount).toBe(1856.32);
    expect(payslip.summary.totalDeductions).toBe(367.86);
    expect(payslip.summary.grossAmount).toBe(2224.18);
    expect(payslip.summary.totalEarnings).toBe(2224.18);
    expect(payslip.summary.paymentDate).toBe('2026-04-14');
    expect(payslip.confidence).toBe(100);
    expect(payslip.fieldConfidence?.payrollPeriodLabel?.parserUsed).toBe('logisticsLayoutV1FinalTable');
    expect(payslip.fieldConfidence?.grossAmount?.parserUsed).toBe('logisticsLayoutV1FinalTable');
    expect(payslip.fieldConfidence?.totalDeductions?.parserUsed).toBe('logisticsLayoutV1FinalTable');
    expect(payslip.fieldConfidence?.netAmount?.parserUsed).toBe('logisticsLayoutV1FinalTable');
    expect(payslip.fieldConfidence?.grossAmount?.confidence).toBe('confirmed');
    expect(payslip.fieldConfidence?.totalDeductions?.confidence).toBe('confirmed');
    expect(payslip.fieldConfidence?.netAmount?.confidence).toBe('confirmed');
  });

  it('ricostruisce la tabella reale marzo 2026 per colonne senza mischiare righe adiacenti', () => {
    const payslip = parsePayslip(
      structuredFromItems([
        cell('AZIENDA DEMO', 10, 780),
        cell('VOCE', 20, 730),
        cell('DESCRIZIONE', 80, 730),
        cell('VALORE UNITARIO', 280, 730),
        cell('ORE/GG/MESI', 360, 730),
        cell('TRATTENUTE', 470, 730),
        cell('COMPETENZE', 580, 730),
        cell('0169', 20, 708),
        cell('ORE LAVORATE MESE', 80, 708),
        cell('107,10', 360, 708),
        cell('0170', 20, 686),
        cell('GG LAVORATI', 80, 686),
        cell('13,00', 360, 686),
        cell('0779', 20, 664),
        cell('MONTE ORE TEORICO FT/PT', 80, 664),
        cell('184,80', 360, 664),
        cell('0785', 20, 642),
        cell('MONTE ORE EFFETTIVO', 80, 642),
        cell('117,60', 360, 642),
        cell('1000', 20, 620),
        cell('RETRIBUZIONE/STIPENDIO', 80, 620),
        cell('87,38', 280, 620),
        cell('22,00', 360, 620),
        cell('1.922,36', 580, 620),
        cell('1052', 20, 598),
        cell('E.D.R. EX ACCORDO 18.05.2021', 80, 598),
        cell('9,32', 580, 598),
        cell('2310', 20, 576),
        cell('TRASFERTA', 80, 576),
        cell('22,50', 280, 576),
        cell('13,00', 360, 576),
        cell('292,50', 580, 576),
        cell('5000', 20, 554),
        cell('FERIE GODUTE', 80, 554),
        cell('7,00', 360, 554),
        cell('8001', 20, 532),
        cell('TRATTENUTE INPS', 80, 532),
        cell('183,35', 470, 532),
        cell('8002', 20, 510),
        cell('TRATTENUTE FISCALI', 80, 510),
        cell('133,35', 470, 510),
        cell('6633', 20, 488),
        cell('CTR. C/DIP. ENTI BIL. EBILOG', 80, 488),
        cell('0,50', 470, 488),
        cell('8320', 20, 466),
        cell('ADD.REG.: RATA A.P.', 80, 466),
        cell('32,39', 470, 466),
        cell('8420', 20, 444),
        cell('ADD.COM.: RATA A.P.', 80, 444),
        cell('6,25', 470, 444),
        cell('8460', 20, 422),
        cell('ADD.COM.: RATA ACCONTO A.C.', 80, 422),
        cell('3,02', 470, 422),
        cell('9300', 20, 400),
        cell('TRATTENUTA SINDACALE', 80, 400),
        cell('9,00', 470, 400),
        cell('ALTRE DETRAZIONI', 40, 260),
        cell('768,91', 300, 260),
        cell('IMPONIBILE FISCALE', 40, 238),
        cell('2.214,86', 300, 238),
        cell('IMPOSTA VERSATA', 40, 216),
        cell('133,43', 300, 216),
        cell('PERIODO DI PAGA', 40, 150),
        cell('MARZO', 230, 150),
        cell('2026', 300, 150),
        cell('DATA VALUTA', 40, 128),
        cell('14/04/2026', 230, 128),
        cell('TOTALE TRATTENUTE', 40, 106),
        cell('367,86', 230, 106),
        cell('TOTALE COMPETENZE', 350, 106),
        cell('2.224,18', 580, 106),
        cell('NETTO', 350, 82),
        cell('1.856,32', 580, 82),
      ])
    );

    const line0169 = payslip.parsedLines.find((line) => line.code === '0169');
    const line0170 = payslip.parsedLines.find((line) => line.code === '0170');
    const line0779 = payslip.parsedLines.find((line) => line.code === '0779');
    const line0785 = payslip.parsedLines.find((line) => line.code === '0785');
    const salary = payslip.parsedLines.find((line) => line.code === '1000');
    const edr = payslip.parsedLines.find((line) => line.code === '1052');
    const travel = payslip.parsedLines.find((line) => line.code === '2310');
    const vacation = payslip.parsedLines.find((line) => line.code === '5000');
    const deductionTotal = payslip.parsedLines
      .filter((line) => ['8001', '8002', '6633', '8320', '8420', '8460', '9300'].includes(line.code ?? ''))
      .reduce((total, line) => Math.round((total + (line.amount ?? 0) + Number.EPSILON) * 100) / 100, 0);

    expect(line0169?.informationalValue).toBe(107.1);
    expect(line0169?.quantityUnit).toBe('hours');
    expect(line0170?.informationalValue).toBe(13);
    expect(line0170?.quantityUnit).toBe('days');
    expect(line0779?.informationalValue).toBe(184.8);
    expect(line0785?.informationalValue).toBe(117.6);
    expect(salary).toMatchObject({ unitValue: 87.38, quantity: 22, amount: 1922.36, confidence: 100 });
    expect(edr?.amount).toBe(9.32);
    expect(travel).toMatchObject({ unitValue: 22.5, quantity: 13, amount: 292.5, confidence: 100 });
    expect(vacation?.quantity).toBe(7);
    expect(payslip.parsedLines.find((line) => line.code === '8002')?.amount).toBe(133.35);
    expect(payslip.parsedLines.find((line) => line.code === '8002')?.amount).not.toBe(payslip.summary.netAmount);
    expect(deductionTotal).toBe(367.86);
    expect(payslip.month).toBe(3);
    expect(payslip.year).toBe(2026);
    expect(payslip.summary.grossAmount).toBe(2224.18);
    expect(payslip.summary.totalDeductions).toBe(367.86);
    expect(payslip.summary.netAmount).toBe(1856.32);
    expect(Math.round(((payslip.summary.grossAmount ?? 0) - (payslip.summary.totalDeductions ?? 0) + Number.EPSILON) * 100) / 100).toBe(payslip.summary.netAmount);
    expect(payslip.summary.netAmount).not.toBe(133.43);
    expect(payslip.summary.grossAmount).not.toBe(2214.86);
    expect(payslip.summary.totalDeductions).not.toBe(768.91);
    expect(salary?.unitValue).not.toBe(salary?.quantity);
    expect(salary?.amount).not.toBe(salary?.unitValue);
    expect(payslip.fieldConfidence?.grossAmount?.confidence).toBe('confirmed');
    expect(payslip.fieldConfidence?.totalDeductions?.confidence).toBe('confirmed');
    expect(payslip.fieldConfidence?.netAmount?.confidence).toBe('confirmed');
  });

  it('Layout Logistica 1 usa solo le celle del riepilogo finale per competenze trattenute e netto', () => {
    const payslip = parsePayslip(
      structuredFromItems([
        cell('AZIENDA DEMO', 10, 760),
        cell('VOCE ORE/GG/MESI IMPORTO', 10, 720),
        cell('1000 RETRIBUZIONE/STIPENDIO 87,38 22,00 9.999,99', 10, 700),
        cell('IMPONIBILE FISCALE 8.888,88', 10, 680),
        cell('BONIFICO 123,45', 10, 660),
        cell('PERIODO DI PAGA', 30, 160),
        cell('MARZO', 230, 160),
        cell('2026', 300, 160),
        cell('DATA VALUTA', 30, 135),
        cell('14/04/2026', 230, 135),
        cell('TOTALE TRATTENUTE', 30, 110),
        cell('367,86', 220, 110),
        cell('TOTALE COMPETENZE', 340, 110),
        cell('2.224,18', 560, 110),
        cell('NETTO', 30, 85),
        cell('1.856,32', 220, 85),
      ])
    );

    expect(payslip.summary.grossAmount).toBe(2224.18);
    expect(payslip.summary.totalEarnings).toBe(2224.18);
    expect(payslip.summary.totalDeductions).toBe(367.86);
    expect(payslip.summary.netAmount).toBe(1856.32);
    expect(payslip.summary.grossAmount).not.toBe(9999.99);
    expect(payslip.summary.grossAmount).not.toBe(8888.88);
    expect(payslip.summary.netAmount).not.toBe(123.45);
    expect(payslip.confidence).toBe(100);
    expect(payslip.fieldConfidence?.grossAmount?.parserUsed).toBe('logisticsLayoutV1FinalTable');
    expect(payslip.fieldConfidence?.totalDeductions?.parserUsed).toBe('logisticsLayoutV1FinalTable');
    expect(payslip.fieldConfidence?.netAmount?.parserUsed).toBe('logisticsLayoutV1FinalTable');
  });

  it('Layout Logistica 1 segnala warning quando le tre celle finali non quadrano', () => {
    const payslip = parsePayslip(
      structuredFromItems([
        cell('AZIENDA DEMO', 10, 760),
        cell('VOCE ORE/GG/MESI IMPORTO', 10, 720),
        cell('PERIODO DI PAGA', 30, 160),
        cell('MARZO', 230, 160),
        cell('2026', 300, 160),
        cell('TOTALE COMPETENZE', 30, 110),
        cell('2.224,18', 300, 110),
        cell('TOTALE TRATTENUTE', 30, 85),
        cell('367,86', 300, 85),
        cell('NETTO', 30, 60),
        cell('1.800,00', 300, 60),
      ])
    );

    expect(payslip.summary.grossAmount).toBe(2224.18);
    expect(payslip.summary.totalDeductions).toBe(367.86);
    expect(payslip.summary.netAmount).toBeUndefined();
    expect(payslip.confidence).not.toBe(100);
    expect(payslip.fieldConfidence?.grossAmount?.confidence).toBe('uncertain');
    expect(payslip.fieldConfidence?.totalDeductions?.confidence).toBe('uncertain');
    expect(payslip.fieldConfidence?.netAmount?.confidence).toBe('uncertain');
    expect(payslip.fieldConfidence?.netAmount?.value).toBe(1800);
    expect(payslip.warnings.some((warning) => warning.includes('Riepilogo finale Logistica 1 incoerente'))).toBe(true);
  });

  it('Layout Logistica 1 non usa IRPEF come fallback quando il netto finale manca', () => {
    const payslip = parsePayslip(
      structuredFromItems([
        cell('AZIENDA DEMO', 10, 760),
        cell('VOCE', 20, 730),
        cell('DESCRIZIONE', 80, 730),
        cell('VALORE UNITARIO', 280, 730),
        cell('ORE/GG/MESI', 360, 730),
        cell('TRATTENUTE', 470, 730),
        cell('COMPETENZE', 580, 730),
        cell('1000', 20, 700),
        cell('RETRIBUZIONE/STIPENDIO', 80, 700),
        cell('87,38', 280, 700),
        cell('22,00', 360, 700),
        cell('1.922,36', 580, 700),
        cell('8002', 20, 678),
        cell('TRATTENUTE FISCALI', 80, 678),
        cell('133,35', 470, 678),
        cell('PERIODO DI PAGA', 40, 150),
        cell('MARZO', 230, 150),
        cell('2026', 300, 150),
        cell('TOTALE TRATTENUTE', 40, 106),
        cell('367,86', 230, 106),
        cell('TOTALE COMPETENZE', 350, 106),
        cell('2.224,18', 580, 106),
      ])
    );

    expect(payslip.detectedFormat).toBe('logisticsLayoutV1');
    expect(payslip.summary.grossAmount).toBe(2224.18);
    expect(payslip.summary.totalDeductions).toBe(367.86);
    expect(payslip.parsedLines.find((line) => line.code === '8002')?.amount).toBe(133.35);
    expect(payslip.summary.netAmount).toBeUndefined();
    expect(payslip.summary.netAmount).not.toBe(133.35);
    expect(payslip.fieldConfidence?.netAmount?.confidence).toBe('missing');
  });

  it('tollera piccoli spostamenti geometrici nello stesso Layout Logistica 1', () => {
    const payslip = parsePayslip(
      structuredFromItems([
        cell('AZIENDA DEMO', 18, 790),
        cell('VOCE', 22, 731),
        cell('DESCRIZIONE', 84, 730),
        cell('VALORE UNITARIO', 259, 731),
        cell('ORE-GG-MESI', 366, 730),
        cell('TRATTENUTE', 475, 731),
        cell('COMPETENZE', 583, 730),
        cell('0169', 18, 708),
        cell('ORE LAVORATE MESE', 83, 707),
        cell('168,00', 390, 708),
        cell('0170', 19, 687),
        cell('GIORNI LAVORATI', 82, 688),
        cell('20,00', 390, 687),
        cell('1052', 18, 676),
        cell('E.D.R. EX ACCORDO', 82, 676),
        cell('2.350,50', 578, 676),
        cell('2310', 18, 665),
        cell('TRASFERTA', 82, 666),
        cell('22,50', 270, 665),
        cell('20,00', 340, 666),
        cell('450,00', 578, 665),
        cell('8001', 18, 644),
        cell('TRATTENUTE INPS', 82, 644),
        cell('500,50', 485, 644),
        cell('IMPONIBILE FISCALE', 34, 228),
        cell('2.214,86', 312, 228),
        cell('PERIODO DI PAGA', 46, 154),
        cell('MAGGIO', 236, 154),
        cell('2026', 307, 154),
        cell('DATA VALUTA', 46, 132),
        cell('14/06/2026', 236, 132),
        cell('TOTALE TRATTENUTE', 46, 109),
        cell('500,50', 238, 109),
        cell('TOTALE COMPETENZE', 356, 110),
        cell('2.800,50', 578, 110),
        cell('NETTO', 356, 85),
        cell('2.300,00', 578, 84),
      ])
    );

    expect(payslip.month).toBe(5);
    expect(payslip.year).toBe(2026);
    expect(payslip.summary.grossAmount).toBe(2800.5);
    expect(payslip.summary.totalDeductions).toBe(500.5);
    expect(payslip.summary.netAmount).toBe(2300);
    expect(payslip.summary.grossAmount).not.toBe(2214.86);
    expect(payslip.fieldConfidence?.grossAmount?.confidence).toBe('confirmed');
    expect(payslip.fieldConfidence?.totalDeductions?.confidence).toBe('confirmed');
    expect(payslip.fieldConfidence?.netAmount?.confidence).toBe('confirmed');
  });

  it('non sostituisce totale competenze con retribuzione o imponibile intermedi', () => {
    const payslip = parsePayslip(marchRealLikeStructured);

    expect(payslip.summary.grossAmount).toBe(2224.18);
    expect(payslip.summary.grossAmount).not.toBe(1922.36);
    expect(payslip.summary.grossAmount).not.toBe(1932);
  });

  it('legge i totali mensili di settembre 2025 per colonne ed esclude il TFR dal netto', () => {
    const payslip = parsePayslip(
      structuredFromItems([
        cell('AZIENDA DEMO', 20, 760),
        cell('VOCE', 20, 720),
        cell('DESCRIZIONE', 90, 720),
        cell('VALORE UNITARIO', 270, 720),
        cell('ORE/GG/MESI', 370, 720),
        cell('TRATTENUTE', 470, 720),
        cell('COMPETENZE', 570, 720),
        cell('TOTALE RETRIBUZIONE', 20, 280),
        cell('1.885,06', 350, 280),
        cell('PROGRESSIVI', 20, 260),
        cell('GG. DETRAZIONE', 20, 78.93),
        cell('ALTRE DETRAZIONI', 90, 78.93),
        cell('DETRAZIONI FAMILIARI', 165, 78.93),
        cell('IMPONIBILE SOCIALE', 235, 78.93),
        cell('TRATTENUTE SOCIALI', 285, 78.93),
        cell('IMP.LE FISCALE', 325, 78.93),
        { ...cell('IMPOSTA VERSATA', 352.6445, 78.93), width: 38.0105286 },
        { ...cell('TOTALE TRATTENUTE', 400.8804, 78.93), width: 42.3315 },
        { ...cell('TOTALE COMPETENZE', 484.1595, 78.93), width: 44.1321 },
        cell('273', 20, 72.42),
        cell('2.291,70', 100, 72.42),
        cell('21.014,00', 180, 72.42),
        cell('1.994,24', 240, 72.42),
        cell('19.022,34', 315, 72.42),
        { ...cell('2.083,45', 374.51, 72.42), width: 23.352 },
        { ...cell('382,44', 462.32, 72.42), width: 18.348 },
        { ...cell('2.194,51', 538.58, 72.42), width: 23.352 },
        cell('TFR', 20, 220),
        cell('MAT. MESE AL NETTO DELLO 0,5 %', 100, 220),
        cell('130,61', 350, 220),
        cell('PAGAMENTO IN', 20, 50),
        cell('PERIODO DI PAGA', 140, 50),
        cell('DATA VALUTA', 280, 50),
        cell('ARROTONDAMENTO', 390, 50),
        cell('NETTO', 535, 50),
        cell('C/C: IT00 TEST', 20, 30),
        cell('SETTEMBRE', 140, 30),
        cell('2025', 215, 30),
        cell('15/10/2025', 280, 30),
        cell('1.812,07', 535, 30),
      ])
    );

    expect(payslip.payrollPeriodLabel).toBe('SETTEMBRE 2025');
    expect(payslip.month).toBe(9);
    expect(payslip.year).toBe(2025);
    expect(payslip.summary.paymentDate).toBe('2025-10-15');
    expect(payslip.summary.netAmount).toBe(1812.07);
    expect(payslip.summary.netAmount).not.toBe(130.61);
    expect(payslip.summary.grossAmount).toBe(2194.51);
    expect(payslip.summary.totalEarnings).toBe(2194.51);
    expect(payslip.summary.totalDeductions).toBe(382.44);
    expect(payslip.summary.totalDeductions).not.toBe(2083.45);
    expect(payslip.summary.grossAmount).not.toBe(1885.06);
    expect(
      Math.round(((payslip.summary.grossAmount ?? 0) - (payslip.summary.totalDeductions ?? 0) + Number.EPSILON) * 100) / 100
    ).toBe(payslip.summary.netAmount);
    expect(payslip.fieldConfidence?.grossAmount?.parserUsed).toBe('logisticsLayoutV1MonthlyTotals');
    expect(payslip.fieldConfidence?.totalDeductions?.parserUsed).toBe('logisticsLayoutV1MonthlyTotals');
    expect(payslip.warnings.some((warning) => warning.includes('Associazione geometrica ambigua'))).toBe(false);
  });

  it('non combina i totali mensili con una riga valori non adiacente', () => {
    const payslip = parsePayslip(
      structuredFromItems([
        cell('AZIENDA DEMO', 20, 760),
        cell('VOCE', 20, 720),
        cell('DESCRIZIONE', 90, 720),
        cell('VALORE UNITARIO', 270, 720),
        cell('ORE/GG/MESI', 370, 720),
        cell('TRATTENUTE', 470, 720),
        cell('COMPETENZE', 570, 720),
        cell('TOTALE TRATTENUTE', 170, 250),
        cell('TOTALE COMPETENZE', 430, 250),
        cell('RIGA INTERMEDIA', 20, 235),
        cell('382,44', 170, 220),
        cell('2.194,51', 430, 220),
        cell('PERIODO DI PAGA SETTEMBRE 2025', 20, 100),
        cell('NETTO 1.812,07', 430, 80),
      ])
    );

    expect(payslip.summary.grossAmount).not.toBe(2194.51);
    expect(payslip.summary.totalDeductions).not.toBe(382.44);
    expect(payslip.warnings.some((warning) => warning.includes('non adiacente'))).toBe(true);
  });

  it('analizza tutti i riepiloghi e seleziona quello completo e coerente anche se successivo', () => {
    const payslip = parsePayslip(january2026SummaryAnonymizedFixture());

    expect(payslip.payrollPeriodLabel).toBe('GENNAIO 2026');
    expect(payslip.summary.totalEarnings).toBe(2896.57);
    expect(payslip.summary.grossAmount).toBe(2896.57);
    expect(payslip.summary.totalDeductions).toBe(986.93);
    expect(payslip.summary.netAmount).toBe(1909.64);
    expect(payslip.summary.paymentDate).toBe('2026-02-13');
    expect(
      Math.round(((payslip.summary.totalEarnings ?? 0) - (payslip.summary.totalDeductions ?? 0) + Number.EPSILON) * 100) / 100
    ).toBe(payslip.summary.netAmount);
    expect(payslip.summary.netAmount).not.toBe(1700);
    expect(payslip.warnings.some((warning) => warning.includes('non coerenti'))).toBe(false);
  });

  it('non sostituisce totale trattenute con trattenute parziali', () => {
    const payslip = parsePayslip(marchRealLikeStructured);

    expect(payslip.summary.totalDeductions).toBe(367.86);
    expect(payslip.summary.totalDeductions).not.toBe(183.35);
    expect(payslip.summary.totalDeductions).not.toBe(133.35);
    expect(payslip.summary.totalDeductions).not.toBe(9);
  });

  it('riconosce presenze e trasferte nel caso reale marzo', () => {
    const payslip = parsePayslip(marchRealLikeStructured);

    expect(payslip.parsedLines.find((line) => line.code === '0170')?.informationalValue).toBe(13);
    expect(payslip.parsedLines.find((line) => line.code === '0169')?.informationalValue).toBe(107.1);
    expect(payslip.parsedLines.find((line) => line.code === '5000')?.quantity).toBe(7);
    expect(payslip.parsedLines.find((line) => line.code === '2310')?.quantity).toBe(13);
    expect(payslip.parsedLines.find((line) => line.code === '2310')?.unitValue).toBe(22.5);
    expect(payslip.parsedLines.find((line) => line.code === '2310')?.amount).toBe(292.5);
    expect(payslip.parsedLines.find((line) => line.code === '2310')?.earningAmount).toBe(292.5);
    expect(payslip.parsedLines.find((line) => line.code === '2310')?.quantityUnit).toBe('days');
    expect(payslip.parsedLines.find((line) => line.code === '2310')?.amount).not.toBe(22.5);
  });

  it('non deriva il periodo dalla data valuta quando il periodo paga manca', () => {
    const payslip = parsePayslip(structuredFromLines(['DATA VALUTA MAGGIO 2026', 'TOTALE COMPETENZE 3.025,79', 'NETTO 2.184,68']));

    expect(payslip.month).toBeUndefined();
    expect(payslip.year).toBeUndefined();
  });

  it('mantiene il periodo paga anche se discordante dalla data valuta', () => {
    const payslip = parsePayslip(structuredFromLines(['PERIODO DI PAGA DICEMBRE 2025', 'DATA VALUTA GENNAIO 2026', 'NETTO 1.600,00']));

    expect(payslip.month).toBe(12);
    expect(payslip.year).toBe(2025);
  });

  it('mantiene gennaio 2026 anche con data pagamento febbraio', () => {
    const payslip = parsePayslip(structuredFromLines(['PERIODO DI PAGA GENNAIO 2026', 'DATA PAGAMENTO FEBBRAIO 2026', 'NETTO 1.806,52']));

    expect(payslip.month).toBe(1);
    expect(payslip.year).toBe(2026);
  });

  it('parser generico riconosce Stipendio lordo 2.350,00', () => {
    const payslip = parsePayslip(
      structuredFromLines(['Periodo paga FEBBRAIO 2026', 'Stipendio lordo 2.350,00', 'Netto da pagare 1.820,50'])
    );

    expect(payslip.detectedFormat).toBe('generic');
    expect(payslip.summary.grossAmount).toBe(2350);
  });

  it('non seleziona Layout Logistica 1 per un layout differente fittizio', () => {
    const structured = structuredFromLines([
      'CEDOLINO DEMO DIFFERENTE',
      'Periodo paga MARZO 2026',
      'Descrizione Importo',
      'Stipendio lordo 2.350,00',
      'Trattenute totali 450,00',
      'Netto da pagare 1.900,00',
    ]);
    const detection = detectPayslipFormat(structured);
    const payslip = parsePayslip(structured);

    expect(detection.format).toBe('generic');
    expect(payslip.detectedFormat).toBe('generic');
    expect(payslip.parserUsed).toBe('generic');
    expect(payslip.summary.grossAmount).toBe(2350);
    expect(payslip.summary.netAmount).toBe(1900);
  });

  it('mantiene gennaio 2026 solo quando il periodo e scritto nel PDF', () => {
    const payslip = parsePayslip(structuredFromLines(['Periodo paga GENNAIO 2026', 'Stipendio lordo 2.350,00', 'Netto 1.800,00']));

    expect(payslip.month).toBe(1);
    expect(payslip.year).toBe(2026);
    expect(payslip.payrollPeriodLabel).toBe('GENNAIO 2026');
  });

  it('mantiene febbraio 2026 senza contaminazione da gennaio', () => {
    const january = parsePayslip(structuredFromLines(['Periodo paga GENNAIO 2026', 'Stipendio lordo 2.300,00', 'Netto 1.700,00']));
    const february = parsePayslip(structuredFromLines(['Periodo paga FEBBRAIO 2026', 'Stipendio lordo 2.350,00', 'Netto 1.820,50']));

    expect(january.month).toBe(1);
    expect(february.month).toBe(2);
    expect(february.year).toBe(2026);
  });

  it('riconosce dicembre 2025', () => {
    const payslip = parsePayslip(structuredFromLines(['Periodo paga DICEMBRE 2025', 'Stipendio lordo 2.100,00', 'Netto 1.600,00']));

    expect(payslip.month).toBe(12);
    expect(payslip.year).toBe(2025);
  });

  it('non usa gennaio 2026 come fallback quando il periodo manca', () => {
    const payslip = parsePayslip(structuredFromLines(['Stipendio lordo 2.100,00', 'Netto 1.600,00']));

    expect(payslip.month).toBeUndefined();
    expect(payslip.year).toBeUndefined();
    expect(payslip.payrollPeriodLabel).toBeUndefined();
    expect(payslip.warnings).toContain('Periodo di competenza non riconosciuto.');
    expect(payslip.id).toContain('period_unknown');
  });

  it('parser generico riconosce Netto da pagare 1.820,50', () => {
    const payslip = parsePayslip(
      structuredFromLines(['Periodo paga FEBBRAIO 2026', 'Stipendio lordo 2.350,00', 'Netto da pagare 1.820,50'])
    );

    expect(payslip.summary.netAmount).toBe(1820.5);
  });

  it('non confonde imponibile fiscale con lordo', () => {
    const payslip = parsePayslip(structuredFromLines(['Periodo paga MARZO 2026', 'Imponibile fiscale 2.350,00', 'Netto 1.700,00']));

    expect(payslip.summary.grossAmount).toBeUndefined();
    expect(payslip.summary.netAmount).toBe(1700);
  });

  it('non accetta 8,3 come netto o lordo mensile', () => {
    const payslip = parsePayslip(structuredFromLines(['Periodo paga APRILE 2026', 'Aliquota 8,3', 'Ore lavorate 168,00']));

    expect(payslip.summary.grossAmount).toBeUndefined();
    expect(payslip.summary.netAmount).toBeUndefined();
  });

  it('parsa righe Layout Logistica 1 ricostruite da celle separate', () => {
    const items: PdfTextItem[] = [
      { text: 'AZIENDA DEMO', page: 1, x: 10, y: 760 },
      { text: 'PERIODO DI PAGA GENNAIO 2026', page: 1, x: 10, y: 740 },
      { text: 'VOCE ORE/GG/MESI IMPORTO', page: 1, x: 10, y: 720 },
      { text: '2310', page: 1, x: 10, y: 700 },
      { text: 'TRASFERTA', page: 1, x: 70, y: 701 },
      { text: '22,50', page: 1, x: 260, y: 699 },
      { text: '17,00', page: 1, x: 330, y: 700 },
      { text: '382,50', page: 1, x: 410, y: 700 },
      { text: 'PERIODO DI PAGA', page: 1, x: 30, y: 150 },
      { text: 'GENNAIO', page: 1, x: 220, y: 150 },
      { text: '2026', page: 1, x: 300, y: 150 },
      { text: 'TOTALE COMPETENZE', page: 1, x: 30, y: 110 },
      { text: '2.318,86', page: 1, x: 300, y: 110 },
      { text: 'TOTALE TRATTENUTE', page: 1, x: 30, y: 85 },
      { text: '512,34', page: 1, x: 300, y: 85 },
      { text: 'NETTO', page: 1, x: 30, y: 60 },
      { text: '1.806,52', page: 1, x: 300, y: 60 },
    ];
    const reconstructedLines = reconstructPdfLines(items);
    const payslip = parsePayslip({
      pages: 1,
      items,
      reconstructedLines,
      plainText: reconstructedLines.map((line) => line.text).join('\n'),
    });

    expect(payslip.parsedLines.find((line) => line.code === '2310')?.amount).toBe(382.5);
  });
});
