import { describe, expect, it, vi } from 'vitest';
import type { PayslipImport } from './driverPayrollTypes';
import { PAYROLL_ECONOMIC_INCOHERENCE_WARNING } from './driverPayrollParserDiagnostics';
import {
  createPayrollLogicalFingerprint,
  importDriverPayrollPdf,
  importDriverPayrollPdfs,
  saveConfirmedImportedPayroll,
} from './driverPayrollImportService';

const validText = `
AZIENDA DEMO
PERIODO PAGA GENNAIO 2026
LIVELLO G1
SEDE/COSTO DL05 - HUB LOGISTICO
VOCE ORE/GG/MESI IMPORTO
1000 RETRIBUZIONE/STIPENDIO * * 87,38 22,00 1.922,36
2310 TRASFERTA 22,50 17,00 382,50
2315 INDENNITA LAVORO DOMENICALE 7,00 2,00 14,00
TOTALE COMPETENZE 2.318,86
TOTALE TRATTENUTE 512,34
DATA VALUTA 10/02/2026
NETTO 1.806,52
`;

const textWithPeriod = (period: string) => `
AZIENDA DEMO
PERIODO PAGA ${period}
LIVELLO G1
VOCE ORE/GG/MESI IMPORTO
1000 RETRIBUZIONE/STIPENDIO * * 87,38 22,00 1.922,36
TOTALE COMPETENZE 2.318,86
TOTALE TRATTENUTE 512,34
NETTO 1.806,52
`;

function pdfFile(name = 'payslip.pdf', content = 'fake pdf'): File {
  return new File([content], name, { type: 'application/pdf' });
}

function txtFile(): File {
  return new File(['not pdf'], 'documento.txt', { type: 'text/plain' });
}

function emptyPdfFile(): File {
  return new File([], 'empty.pdf', { type: 'application/pdf' });
}

describe('driverPayrollImportService', () => {
  it('integra la pipeline PRODUCTION nel risultato reale di importazione', async () => {
    const result = await importDriverPayrollPdf(pdfFile(), {
      extractText: async () => validText,
      readExistingPayslips: async () => [],
      now: () => new Date('2026-07-31T18:00:00.000Z'),
    });

    expect(result.observedSnapshot).toBeDefined();
    expect(result.validationPipeline).toMatchObject({
      status: 'COMPLETED',
      profile: 'PRODUCTION',
      serviceSource: 'FISCAL_V1',
      executedAt: '2026-07-31T18:00:00.000Z',
    });
    expect(result.validationPipeline?.technicalRun).toBeDefined();
    expect(result.validationPipeline?.driverReport).toBeDefined();
    expect(result.validationPipeline?.selectedCheckIds).toEqual([
      'economic.net-pay-consistency',
      'fiscal.inps-observation-quality',
    ]);
    expect(result.validationPipeline?.technicalRun?.results.find(
      (item) => item.id === 'economic.net-pay-consistency'
    )).toMatchObject({ status: 'PASS' });
    expect(result.validationPipeline?.selectedCheckIds).not.toEqual(expect.arrayContaining([
      'economic.summary-consistency',
      'fiscal.inps-taxable-structural-consistency',
      'fiscal.inps-taxable-rule-availability',
      'fiscal.inps-observed-calculation-consistency',
    ]));
  });

  it('deriva il periodo esclusivamente dal cedolino e non dalla data valuta', async () => {
    const result = await importDriverPayrollPdf(pdfFile(), {
      extractText: async () => validText,
      readExistingPayslips: async () => [],
    });

    expect(result.observedSnapshot?.period).toMatchObject({ year: 2026, month: 1 });
    expect(result.validationPipeline?.technicalRun?.results[0].evidence[0]?.period)
      .toMatchObject({ year: 2026, month: 1 });
    expect(result.payslip?.summary.paymentDate).toBe('2026-02-10');
  });

  it('crea lo snapshot dopo guard economico e normalizzazione fiscale', async () => {
    const result = await importDriverPayrollPdf(pdfFile('incoerente-pipeline.pdf'), {
      extractText: async () => `
AZIENDA DEMO
PERIODO PAGA MARZO 2026
STIPENDIO LORDO 2.214,86
TOTALE TRATTENUTE 367,86
NETTO DA PAGARE 133,43
IMPONIBILE INPS 1.900,00
`,
      readExistingPayslips: async () => [],
    });

    expect(result.temporaryReadDiagnostic?.parserPayslip?.summary.netAmount).toBe(133.43);
    expect(result.observedSnapshot?.economicSummary.netAmount).toBeUndefined();
    expect(result.observedSnapshot?.fiscalObservations?.schemaVersion).toBe('fiscal-v1');
    expect(result.validationPipeline?.status).toBe('COMPLETED');
  });

  it('periodo mancante lascia importazione disponibile e pipeline NOT_RUN', async () => {
    const result = await importDriverPayrollPdf(pdfFile('senza-periodo-pipeline.pdf'), {
      extractText: async () => 'STIPENDIO LORDO 2.100,00\nNETTO DA PAGARE 1.600,00',
      readExistingPayslips: async () => [],
    });

    expect(result.status).toBe('warning');
    expect(result.payslip).toBeDefined();
    expect(result.observedSnapshot).toBeDefined();
    expect(result.validationPipeline).toMatchObject({
      status: 'NOT_RUN',
      profile: 'PRODUCTION',
      selectedCheckIds: [],
      error: { code: 'PAYROLL_PERIOD_INVALID' },
    });
  });

  it('errore tecnico della pipeline non blocca anteprima e non crea falso FAIL', async () => {
    const result = await importDriverPayrollPdf(pdfFile('pipeline-error.pdf'), {
      extractText: async () => validText,
      readExistingPayslips: async () => [],
      runValidationPipeline: async () => { throw new Error('pipeline offline'); },
    });

    expect(result.status).toBe('ready');
    expect(result.payslip).toBeDefined();
    expect(result.validationPipeline).toMatchObject({
      status: 'TECHNICAL_ERROR',
      error: { code: 'PAYROLL_VALIDATION_PIPELINE_FAILED', message: 'pipeline offline' },
    });
    expect(result.validationPipeline?.technicalRun).toBeUndefined();
    expect(result.errors).toEqual([]);
  });

  it('aggiunge diagnostica sintetica senza duplicare il report', async () => {
    const result = await importDriverPayrollPdf(pdfFile(), {
      extractText: async () => validText,
      readExistingPayslips: async () => [],
    });
    const diagnostic = result.temporaryReadDiagnostic?.payrollValidationPipeline;

    expect(diagnostic).toMatchObject({
      status: 'COMPLETED', snapshotCreated: true, started: true,
      profile: 'PRODUCTION', failCount: 0, internalErrorCount: 0,
    });
    expect(diagnostic?.selectedCheckIds).toEqual(result.validationPipeline?.selectedCheckIds);
    expect(diagnostic).not.toHaveProperty('driverReport');
    expect(diagnostic).not.toHaveProperty('technicalRun');
  });

  it('non modifica dati economici, fingerprint o deduplicazione', async () => {
    const first = await importDriverPayrollPdf(pdfFile(), {
      extractText: async () => validText,
      readExistingPayslips: async () => [],
    });
    const second = await importDriverPayrollPdf(pdfFile('duplicate-pipeline.pdf'), {
      extractText: async () => validText,
      readExistingPayslips: async () => [first.payslip!],
    });

    expect(first.payslip?.summary).toMatchObject({
      totalEarnings: 2318.86, totalDeductions: 512.34, netAmount: 1806.52,
    });
    expect(first.logicalFingerprint).toBe(createPayrollLogicalFingerprint(first.payslip!));
    expect(second.logicalFingerprint).toBe(first.logicalFingerprint);
    expect(second.warnings.map((warning) => warning.code)).toContain('POSSIBLE_DUPLICATE');
  });

  it('mantiene report in memoria senza persisterlo nel PayslipImport', async () => {
    const result = await importDriverPayrollPdf(pdfFile(), {
      extractText: async () => validText,
      readExistingPayslips: async () => [],
    });
    const savePayslip = vi.fn();
    await saveConfirmedImportedPayroll(result, { savePayslip });
    const persisted = savePayslip.mock.calls[0][0];

    expect(result.validationPipeline?.driverReport).toBeDefined();
    expect(persisted).not.toHaveProperty('validationPipeline');
    expect(persisted).not.toHaveProperty('observedSnapshot');
    expect(JSON.stringify(result.validationPipeline?.driverReport)).not.toContain('rawText');
  });

  it('importa un PDF valido con dati riconosciuti', async () => {
    const result = await importDriverPayrollPdf(pdfFile(), {
      extractText: async () => validText,
      readExistingPayslips: async () => [],
    });

    expect(result.status).toBe('ready');
    expect(result.payslip?.month).toBe(1);
    expect(result.payslip?.year).toBe(2026);
    expect(result.payslip?.summary.netAmount).toBe(1806.52);
    expect(result.payslip?.summary.totalEarnings).toBe(2318.86);
    expect(result.payslip?.summary.totalDeductions).toBe(512.34);
    expect(result.payslip?.warnings).not.toContain(PAYROLL_ECONOMIC_INCOHERENCE_WARNING);
    expect(result.warnings.map((warning) => warning.message)).not.toContain(PAYROLL_ECONOMIC_INCOHERENCE_WARNING);
    expect(result.payslip?.parsedLines.find((line) => line.code === '2310')?.quantity).toBe(17);
    expect(result.valueSources?.['line.2310']).toBe('parser');
    expect(result.diagnosticReport?.parserId).toBe('logisticsLayoutV1');
    expect(result.diagnosticReport?.pages[0].tokens.length).toBeGreaterThan(0);
    expect(result.diagnosticReport?.validation.valid).toBe(true);
    expect(result.payrollValidation?.checks.find((check) => check.id === 'SUMMARY_EQUATION')).toMatchObject({
      status: 'passed',
      expectedValue: 1806.52,
      actualValue: 1806.52,
    });
    expect(result.payrollValidation?.overallStatus).not.toBe('inconsistent');
    expect(result.fiscalAnalysis?.fiscalData.schemaVersion).toBe('fiscal-v1');
    expect(result.fiscalAnalysis?.fiscalData.socialSecurity.employeeContributions?.value).toBeUndefined();
    expect(result.fiscalAnalysis?.validation.overallStatus).not.toBe('inconsistent');
  });

  it('applica il guard end-to-end a un cedolino incoerente prima di validazioni e anteprima', async () => {
    const result = await importDriverPayrollPdf(pdfFile('incoerente.pdf'), {
      extractText: async () => `
AZIENDA DEMO
PERIODO PAGA MARZO 2026
STIPENDIO LORDO 2.214,86
TOTALE TRATTENUTE 367,86
NETTO DA PAGARE 133,43
`,
      readExistingPayslips: async () => [],
    });

    expect(result.temporaryReadDiagnostic?.parserPayslip?.summary.netAmount).toBe(133.43);
    expect(result.temporaryReadDiagnostic?.guardedPayslip?.summary.netAmount).toBeUndefined();
    expect(result.payslip?.summary.grossAmount).toBe(2214.86);
    expect(result.payslip?.summary.totalEarnings).toBe(2214.86);
    expect(result.payslip?.summary.totalDeductions).toBe(367.86);
    expect(result.payslip?.summary.netAmount).toBeUndefined();
    expect(result.payslip?.fieldConfidence?.grossAmount?.confidence).toBe('uncertain');
    expect(result.payslip?.fieldConfidence?.totalDeductions?.confidence).toBe('uncertain');
    expect(result.payslip?.fieldConfidence?.netAmount?.confidence).toBe('uncertain');
    expect(result.payslip?.warnings).toContain(PAYROLL_ECONOMIC_INCOHERENCE_WARNING);
    expect(result.warnings.map((warning) => warning.message)).toContain(PAYROLL_ECONOMIC_INCOHERENCE_WARNING);
    expect(result.warnings.map((warning) => warning.code)).toContain('NET_AMOUNT_MISSING');
    expect(result.status).toBe('warning');
    expect(result.payrollValidation?.checks.find((check) => check.id === 'SUMMARY_EQUATION')?.status).toBe('skipped');
    expect(result.diagnosticReport?.validation).toMatchObject({
      equationChecked: true,
      valid: false,
    });
  });

  it('rifiuta file non PDF', async () => {
    const result = await importDriverPayrollPdf(txtFile(), {
      extractText: async () => validText,
    });

    expect(result.status).toBe('failed');
    expect(result.errors[0]?.code).toBe('FILE_NOT_PDF');
  });

  it('rifiuta file vuoto', async () => {
    const result = await importDriverPayrollPdf(emptyPdfFile(), {
      extractText: async () => validText,
    });

    expect(result.status).toBe('failed');
    expect(result.errors[0]?.code).toBe('FILE_EMPTY');
  });

  it('gestisce PDF senza testo estraibile', async () => {
    const result = await importDriverPayrollPdf(pdfFile(), {
      extractText: async () => '',
    });

    expect(result.status).toBe('failed');
    expect(result.errors[0]?.code).toBe('PDF_TEXT_EMPTY');
    expect(result.warnings.map((warning) => warning.code)).toContain('PDF_TEXT_WITHOUT_USEFUL_TEXT');
  });

  it('rimuove rawTextTemporary restituito dal parser', async () => {
    const result = await importDriverPayrollPdf(pdfFile(), {
      extractText: async () => validText,
      readExistingPayslips: async () => [],
    });

    expect(result.payslip).toBeDefined();
    expect('rawTextTemporary' in result.payslip!).toBe(false);
    expect(result.temporaryReadDiagnostic?.parserPayslip?.rawTextTemporary).toContain('PERIODO PAGA GENNAIO 2026');
    expect(result.temporaryReadDiagnostic?.runtimeProvenance).toMatchObject({
      parserBuildMarker: 'logistics-v1-fix-2026-07-26-02',
      parserSourceFile: 'src/lib/driverPayrollParsers/logisticsLayoutV1Parser.ts',
      registrySourceFile: 'src/lib/driverPayrollParsers/payslipParserRegistry.ts',
      validationSourceFile: 'src/lib/driverPayrollValidation.ts',
      fiscalNormalizerSourceFile: 'src/lib/driverPayrollFiscalNormalizer.ts',
    });
    expect(result.temporaryReadDiagnostic?.runtimeProvenance?.economicSelectionCriterion)
      .toContain('logisticsLayoutV1_geometric_columns');
  });

  it('non espone Blob, ArrayBuffer o PDF originale nel risultato', async () => {
    const result = await importDriverPayrollPdf(pdfFile('persona.pdf'), {
      extractText: async () => `${validText}\nIBAN IT60X0542811101000000123456`,
      readExistingPayslips: async () => [],
    });
    const serializedPayslip = JSON.stringify(result.payslip);
    const serializedDiagnostic = JSON.stringify(result.temporaryReadDiagnostic);

    expect(serializedPayslip).not.toContain('arrayBuffer');
    expect(serializedPayslip).not.toContain('Blob');
    expect(serializedPayslip).not.toContain('fake pdf');
    expect(serializedPayslip).not.toContain('base64');
    expect(serializedPayslip).not.toContain('IT60X0542811101000000123456');
    expect(serializedDiagnostic).toContain('IT60X0542811101000000123456');
    expect(result.privacy).toEqual({
      originalPdfStored: false,
      rawTextStored: false,
      sensitiveDataStored: false,
    });
    expect(result.warnings.map((warning) => warning.code)).not.toContain('SENSITIVE_DATA_REMOVED');
    expect(result.warnings.map((warning) => warning.message)).not.toContain('Campo sensibile rimosso dal risultato di importazione.');
  });

  it('deduplica warning semanticamente uguali su periodo e netto', async () => {
    const result = await importDriverPayrollPdf(pdfFile('incompleta.pdf'), {
      extractText: async () => 'AZIENDA DEMO\nVOCE ORE/GG/MESI IMPORTO\n1000 RETRIBUZIONE/STIPENDIO 1.922,36',
      readExistingPayslips: async () => [],
    });

    const periodWarnings = result.warnings.filter((warning) => warning.message.toLowerCase().includes('periodo di competenza'));
    const netWarnings = result.warnings.filter((warning) => warning.message.toLowerCase().includes('netto non riconosciuto'));

    expect(periodWarnings).toHaveLength(1);
    expect(periodWarnings[0].code).toBe('PAYROLL_PERIOD_MISSING');
    expect(netWarnings).toHaveLength(1);
    expect(netWarnings[0].code).toBe('NET_AMOUNT_MISSING');
  });

  it('importa piu file senza bloccare tutti se uno fallisce', async () => {
    const results = await importDriverPayrollPdfs([pdfFile('ok.pdf'), txtFile()], {
      extractText: async () => validText,
      readExistingPayslips: async () => [],
    });

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe('ready');
    expect(results[1].status).toBe('failed');
    expect(results[1].errors[0]?.code).toBe('FILE_NOT_PDF');
  });

  it('import multiplo mantiene periodi indipendenti tra file diversi', async () => {
    const extractText = vi
      .fn()
      .mockResolvedValueOnce(textWithPeriod('GENNAIO 2026'))
      .mockResolvedValueOnce(textWithPeriod('FEBBRAIO 2026'))
      .mockResolvedValueOnce(textWithPeriod('DICEMBRE 2025'));

    const results = await importDriverPayrollPdfs([
      pdfFile('gennaio.pdf'),
      pdfFile('febbraio.pdf'),
      pdfFile('dicembre.pdf'),
    ], {
      extractText,
      readExistingPayslips: async () => [],
    });

    expect(results.map((result) => result.payslip?.month)).toEqual([1, 2, 12]);
    expect(results.map((result) => result.payslip?.year)).toEqual([2026, 2026, 2025]);
  });

  it('PDF senza periodo non viene trasformato in gennaio 2026', async () => {
    const result = await importDriverPayrollPdf(pdfFile('senza-periodo.pdf'), {
      extractText: async () => 'Stipendio lordo 2.100,00\nNetto da pagare 1.600,00',
      readExistingPayslips: async () => [],
    });

    expect(result.status).toBe('warning');
    expect(result.payslip?.month).toBeUndefined();
    expect(result.payslip?.year).toBeUndefined();
    expect(result.warnings.map((warning) => warning.code)).toContain('PAYROLL_PERIOD_MISSING');
  });

  it('segnala un possibile duplicato usando impronta logica non sensibile', async () => {
    const first = await importDriverPayrollPdf(pdfFile(), {
      extractText: async () => validText,
      readExistingPayslips: async () => [],
    });
    const existing = first.payslip as PayslipImport;
    const fingerprint = createPayrollLogicalFingerprint(existing);

    const second = await importDriverPayrollPdf(pdfFile('seconda.pdf'), {
      extractText: async () => validText,
      readExistingPayslips: async () => [existing],
    });

    expect(second.logicalFingerprint).toBe(fingerprint);
    expect(second.status).toBe('warning');
    expect(second.warnings.map((warning) => warning.code)).toContain('POSSIBLE_DUPLICATE');
  });

  it('gestisce errore di estrazione senza crash generale', async () => {
    const results = await importDriverPayrollPdfs([pdfFile('rotto.pdf'), pdfFile('ok.pdf')], {
      extractText: vi
        .fn()
        .mockRejectedValueOnce(new Error('file protetto'))
        .mockResolvedValueOnce(validText),
      readExistingPayslips: async () => [],
    });

    expect(results[0].status).toBe('failed');
    expect(results[0].errors[0]?.code).toBe('PDF_TEXT_EXTRACTION_FAILED');
    expect(results[1].status).toBe('ready');
  });

  it('salva solo una importazione confermata e sanitizzata', async () => {
    const result = await importDriverPayrollPdf(pdfFile(), {
      extractText: async () => validText,
      readExistingPayslips: async () => [],
    });
    const savePayslip = vi.fn();
    const saved = await saveConfirmedImportedPayroll(result, { savePayslip });

    expect(savePayslip).toHaveBeenCalledOnce();
    expect('rawTextTemporary' in saved).toBe(false);
    expect(JSON.stringify(savePayslip.mock.calls[0][0])).not.toContain('temporaryReadDiagnostic');
    expect(saved.fiscalDataVersion).toBe('fiscal-v1');
    expect(saved.fiscalData?.schemaVersion).toBe('fiscal-v1');
    expect(JSON.stringify(saved.fiscalData)).not.toContain('rawText');
    expect(saved.summary.netAmount).toBe(1806.52);
  });
});
