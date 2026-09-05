import { describe, expect, it } from 'vitest';
import type { DriverPayrollImportResult } from './driverPayrollImportTypes';
import {
  buildDriverPayrollReadDiagnosticFileName,
  buildDriverPayrollReadDiagnosticTxt,
} from './driverPayrollReadDiagnosticTxt';
import { createStructuredTextFromPlainText } from './driverPayrollParsers/payslipParserHelpers';
import { validatePayrollConsistency } from './driverPayrollValidation';
import { normalizePayslipFiscalData } from './driverPayrollFiscalNormalizer';
import { validatePayslipFiscalData } from './driverPayrollFiscalValidation';
import { validatePayrollHistory } from './driverPayrollHistoricalValidation';

const rawText = [
  'PERIODO PAGA GIUGNO 2026',
  'VOCE ORE/GG/MESI COMPETENZE TRATTENUTE',
  '2310 TRASFERTA 22,50 17,00 382,50',
  'TOTALE COMPETENZE 2.000,00',
  'TOTALE TRATTENUTE 400,00',
  'NETTO 1.600,00',
  'IBAN IT60X0542811101000000123456',
].join('\n');

const payslip = {
  id: 'payslip_2026_06',
  payrollPeriodLabel: 'GIUGNO 2026',
  year: 2026,
  month: 6,
  importedAt: '2026-07-26T08:00:00.000Z',
  extractionMethod: 'pdf_text' as const,
  detectedFormat: 'logisticsLayoutV1' as const,
  parserUsed: 'logisticsLayoutV1',
  confidence: 92,
  rawTextTemporary: rawText,
  parsedLines: [{
    code: '2310',
    label: 'Trasferta',
    quantity: 17,
    unitValue: 22.5,
    amount: 382.5,
    confidence: 94,
    rawLine: '2310 TRASFERTA 22,50 17,00 382,50',
  }],
  summary: {
    totalEarnings: 2000,
    totalDeductions: 400,
    netAmount: 1600,
  },
  warnings: [],
};

const result: DriverPayrollImportResult = {
  importId: 'import_1',
  fileName: 'cedolino giugno.pdf',
  status: 'ready',
  payslip: { ...payslip, rawTextTemporary: undefined, parsedLines: payslip.parsedLines.map(({ rawLine: _rawLine, ...line }) => line) },
  warnings: [],
  errors: [],
  confidence: 92,
  importedAt: '2026-07-26T08:00:00.000Z',
  temporaryReadDiagnostic: {
    analyzedAt: '2026-07-26T08:00:00.000Z',
    extractionMethod: 'pdf_text',
    structuredText: createStructuredTextFromPlainText(rawText),
    parserPayslip: payslip,
    runtimeProvenance: {
      parserBuildMarker: 'logistics-v1-fix-2026-07-26-02',
      parserSourceFile: 'src/lib/driverPayrollParsers/logisticsLayoutV1Parser.ts',
      registrySourceFile: 'src/lib/driverPayrollParsers/payslipParserRegistry.ts',
      validationSourceFile: 'src/lib/driverPayrollValidation.ts',
      fiscalNormalizerSourceFile: 'src/lib/driverPayrollFiscalNormalizer.ts',
      economicSelectionCriterion: 'logisticsLayoutV1_geometric_columns + sourceColumn certificata',
      extractedSiteCode: '03',
      extractedCostCenterCode: '03',
      extractedCostCenterDescription: 'DL05 - AMAZON',
      fiscalSectionMatches: [{
        target: 'socialSecurity.taxable',
        value: 1942,
        page: 1,
        section: 'SOCIALI_INPS',
        confidence: 98,
        extractionMethod: 'geometric_column',
        rawText: 'SOCIALI I.N.P.S. | IMPONIBILE 1.942,00',
      }],
    },
  },
  payrollValidation: validatePayrollConsistency(payslip),
  fiscalAnalysis: (() => {
    const fiscalData = normalizePayslipFiscalData(createStructuredTextFromPlainText(rawText), payslip);
    return { fiscalData, validation: validatePayslipFiscalData(fiscalData, payslip) };
  })(),
  privacy: {
    originalPdfStored: false,
    rawTextStored: false,
    sensitiveDataStored: false,
  },
};

describe('driverPayrollReadDiagnosticTxt', () => {
  it('include contenuto grezzo, token, righe, controlli e decisioni senza sanitizzare il report richiesto', () => {
    const historicalPayslip = {
      ...result.payslip!,
      driverProfileId: 'driver-1',
      companyName: 'Azienda prova',
      fiscalDataVersion: 'fiscal-v1' as const,
      fiscalData: result.fiscalAnalysis!.fiscalData,
      parsedLines: [{
        ...result.payslip!.parsedLines[0],
        canonicalKey: 'payroll.travel_allowance',
      }],
    };
    const report = buildDriverPayrollReadDiagnosticTxt(
      result,
      validatePayrollHistory([historicalPayslip])
    );

    expect(report).toContain('2. TESTO GREZZO ESTRATTO');
    expect(report).toContain('parserBuildMarker: logistics-v1-fix-2026-07-26-02');
    expect(report).toContain('1A. PROVENIENZA RUNTIME DEL PARSER');
    expect(report).toContain('Risultato estrazione sedeCodice: 03');
    expect(report).toContain('Risultato estrazione centroCostoCodice: 03');
    expect(report).toContain('Risultato estrazione centroCostoDescrizione: DL05 - AMAZON');
    expect(report).toContain('target=socialSecurity.taxable; valore=1942');
    expect(report).toContain('3. TOKEN PDF');
    expect(report).toContain('6. VOCI PAGA RICONOSCIUTE');
    expect(report).toContain('8. CONTROLLI DI COERENZA');
    expect(report).toContain('10. DECISIONI DEL PARSER');
    expect(report).toContain('11. VALIDAZIONE MATEMATICA');
    expect(report).toContain('[PASSED][SUMMARY_EQUATION]');
    expect(report).toContain('Somma delle singole competenze');
    expect(report).toContain('12. DATI FISCALI E CONTRIBUTIVI');
    expect(report).toContain('Versione schema: fiscal-v1');
    expect(report).toContain('13. VALIDAZIONE FISCALE E CONTRIBUTIVA');
    expect(report).toContain('14. TIMELINE STORICA');
    expect(report).toContain('15. CONTROLLI STORICI MULTI-MESE');
    expect(report).toContain('16. VARIAZIONI DELLE VOCI PAGA');
    expect(report).toContain('historical-v1');
    expect(report).toContain('RULE_001');
    expect(report).toContain('RULE_004');
    expect(report).toContain('IT60X0542811101000000123456');
  });

  it('costruisce il nome TXT con periodo e nome sorgente', () => {
    expect(buildDriverPayrollReadDiagnosticFileName(result))
      .toBe('Diagnostica_BustaPaga_2026-06_cedolino_giugno.txt');
  });
});
