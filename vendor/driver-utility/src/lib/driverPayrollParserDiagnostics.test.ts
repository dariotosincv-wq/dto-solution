import { describe, expect, it } from 'vitest';
import { reconstructPdfLines, type PdfTextItem, type StructuredPdfText } from './driverPayrollPdfLayout';
import {
  PAYROLL_ECONOMIC_INCOHERENCE_WARNING,
  anonymizePayrollDiagnosticText,
  applyPayrollEconomicCoherenceGuard,
  buildPayrollParserDiagnosticReport,
  parsePayrollParserDiagnosticFixture,
  serializePayrollParserDiagnosticReport,
  validatePayrollEconomicEquation,
} from './driverPayrollParserDiagnostics';
import type { PayslipImport } from './driverPayrollTypes';

const cell = (text: string, x: number, y: number): PdfTextItem => ({
  text,
  page: 1,
  x,
  y,
  width: text.length * 6,
  height: 10,
});

const structuredFromItems = (items: PdfTextItem[]): StructuredPdfText => {
  const reconstructedLines = reconstructPdfLines(items);
  return {
    pages: 1,
    pageSizes: [{ page: 1, width: 640, height: 820 }],
    items,
    reconstructedLines,
    plainText: reconstructedLines.map((line) => line.text).join('\n'),
  };
};

const structured = structuredFromItems([
  cell('Nome Mario Rossi', 20, 790),
  cell('Codice fiscale RSSMRA80A01H501U', 20, 775),
  cell('IBAN IT60X0542811101000000123456', 20, 760),
  cell('Indirizzo Via Roma 10', 20, 745),
  cell('VOCE ORE/GG/MESI IMPORTO', 20, 720),
  cell('2310 TRASFERTA 22,50 13,00 292,50', 20, 700),
  cell('PERIODO DI PAGA', 30, 150),
  cell('MARZO', 220, 150),
  cell('2026', 290, 150),
  cell('TOTALE COMPETENZE', 30, 110),
  cell('2.224,18', 300, 110),
  cell('TOTALE TRATTENUTE', 30, 85),
  cell('367,86', 300, 85),
  cell('NETTO', 30, 60),
  cell('1.856,32', 300, 60),
]);

const payslip = {
  id: 'test',
  payrollProvider: 'Payroll Layout v1',
  detectedFormat: 'logisticsLayoutV1',
  parserUsed: 'logisticsLayoutV1',
  payrollPeriodLabel: 'MARZO 2026',
  year: 2026,
  month: 3,
  importedAt: '2026-04-14T00:00:00.000Z',
  extractionMethod: 'pdf_text',
  parsedLines: [],
  summary: {
    grossAmount: 2224.18,
    totalEarnings: 2224.18,
    totalDeductions: 367.86,
    netAmount: 1856.32,
  },
  warnings: [],
  fieldConfidence: {
    grossAmount: { confidence: 'confirmed', parserUsed: 'test', value: 2224.18 },
    totalDeductions: { confidence: 'confirmed', parserUsed: 'test', value: 367.86 },
    netAmount: { confidence: 'confirmed', parserUsed: 'test', value: 1856.32 },
  },
} satisfies PayslipImport;

describe('driverPayrollParserDiagnostics', () => {
  it('genera report con token, coordinate e righe geometriche', () => {
    const report = buildPayrollParserDiagnosticReport(structured, payslip);

    expect(report.parserId).toBe('logisticsLayoutV1');
    expect(report.pageCount).toBe(1);
    expect(report.pages[0].width).toBe(640);
    expect(report.pages[0].tokens[0]).toMatchObject({ page: 1, x: 20, y: 790, width: expect.any(Number), height: 10 });
    expect(report.pages[0].reconstructedRows.some((row) => row.text.includes('TOTALE COMPETENZE'))).toBe(true);
  });

  it('anonimizza nome codice fiscale IBAN indirizzo e mantiene label/importi payroll', () => {
    const report = buildPayrollParserDiagnosticReport(structured, payslip);
    const serialized = serializePayrollParserDiagnosticReport(report);

    expect(serialized).toContain('[PERSONA]');
    expect(serialized).toContain('[CODICE_FISCALE]');
    expect(serialized).toContain('[IBAN]');
    expect(serialized).toContain('[INDIRIZZO]');
    expect(serialized).toContain('TOTALE COMPETENZE');
    expect(serialized).toContain('2.224,18');
    expect(serialized).not.toContain('Mario Rossi');
    expect(serialized).not.toContain('RSSMRA80A01H501U');
    expect(serialized).not.toContain('IT60X0542811101000000123456');
  });

  it('non include PDF o base64 nel JSON diagnostico', () => {
    const serialized = serializePayrollParserDiagnosticReport(buildPayrollParserDiagnosticReport(structured, payslip));

    expect(serialized).not.toContain('data:application/pdf');
    expect(serialized).not.toContain('base64');
    expect(serialized).not.toContain('arrayBuffer');
    expect(serialized).not.toContain('Blob');
  });

  it('valida equazione economica corretta e non valida', () => {
    expect(validatePayrollEconomicEquation(2224.18, 367.86, 1856.32)).toMatchObject({
      equationChecked: true,
      valid: true,
      expectedNet: 1856.32,
      difference: 0,
    });
    expect(validatePayrollEconomicEquation(2214.86, 367.86, 133.43)).toMatchObject({
      equationChecked: true,
      valid: false,
    });
  });

  it('rimuove il netto incoerente dai valori confermati e lo lascia da verificare', () => {
    const guarded = applyPayrollEconomicCoherenceGuard({
      ...payslip,
      summary: { ...payslip.summary, grossAmount: 2214.86, totalEarnings: 2214.86, netAmount: 133.43 },
      fieldConfidence: {
        ...payslip.fieldConfidence,
        grossAmount: { confidence: 'confirmed', parserUsed: 'test', value: 2214.86 },
        netAmount: { confidence: 'confirmed', parserUsed: 'test', value: 133.43 },
      },
    });

    expect(guarded.summary.grossAmount).toBe(2214.86);
    expect(guarded.summary.netAmount).toBeUndefined();
    expect(guarded.fieldConfidence?.grossAmount?.confidence).toBe('uncertain');
    expect(guarded.fieldConfidence?.totalDeductions?.confidence).toBe('uncertain');
    expect(guarded.fieldConfidence?.netAmount?.confidence).toBe('uncertain');
    expect(guarded.fieldConfidence?.netAmount?.value).toBe(133.43);
    expect(guarded.warnings).toContain(PAYROLL_ECONOMIC_INCOHERENCE_WARNING);
  });

  it('serializza e ricarica fixture diagnostica JSON locale', () => {
    const json = serializePayrollParserDiagnosticReport(buildPayrollParserDiagnosticReport(structured, payslip));
    const fixture = parsePayrollParserDiagnosticFixture(json);

    expect(fixture.selectedValues).toMatchObject({ month: 3, year: 2026, totalEarnings: 2224.18 });
    expect(fixture.validation.valid).toBe(true);
  });

  it('non contiene riferimenti a Cloud o Supabase', () => {
    const json = serializePayrollParserDiagnosticReport(buildPayrollParserDiagnosticReport(structured, payslip)).toLowerCase();

    expect(json).not.toContain('supabase');
    expect(json).not.toContain('cloud');
  });

  it('anonimizza stringhe standalone', () => {
    expect(anonymizePayrollDiagnosticText('Dipendente Mario Rossi IBAN IT60X0542811101000000123456')).toContain('[PERSONA]');
  });
});
