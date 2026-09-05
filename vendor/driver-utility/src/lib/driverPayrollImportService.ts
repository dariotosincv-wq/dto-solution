import { DriverPayrollPdfTextError, extractStructuredTextFromPayslipPdf } from './driverPayrollPdfText';
import { getPayslipLineEconomicAmount, getPayslipLineQuantity } from './driverPayrollLineValues';
import { payrollDebugLog } from './driverPayrollDebugLogger';
import { stripPayslipTemporaryData } from './driverPayrollPayslipParser';
import { createStructuredTextFromPlainText } from './driverPayrollParsers/payslipParserHelpers';
import { parsePayslip } from './driverPayrollParsers/payslipParserRegistry';
import {
  applyPayrollEconomicCoherenceGuard,
  buildPayrollParserDiagnosticReport,
  PAYROLL_ECONOMIC_INCOHERENCE_WARNING,
} from './driverPayrollParserDiagnostics';
import { parsePayslipFinalSummary } from './driverPayrollParsers/finalSummaryParser';
import {
  PAYROLL_ECONOMIC_SELECTION_CRITERION,
  validatePayrollConsistency,
} from './driverPayrollValidation';
import {
  diagnosePayrollFiscalSectionMatches,
  normalizePayslipFiscalData,
} from './driverPayrollFiscalNormalizer';
import {
  LOGISTICS_V1_PARSER_BUILD_MARKER,
  LOGISTICS_V1_PARSER_SOURCE_FILE,
} from './driverPayrollParsers/logisticsLayoutV1Parser';
import { validatePayslipFiscalData } from './driverPayrollFiscalValidation';
import {
  DRIVER_PAYROLL_KEYS,
  getDriverPayrollCollection,
  upsertDriverPayrollItem,
} from './driverPayrollStorage';
import type { PayslipImport, PayslipLine } from './driverPayrollTypes';
import type {
  DriverPayrollImportError,
  DriverPayrollImportResult,
  DriverPayrollImportServiceOptions,
  DriverPayrollImportWarning,
  DriverPayrollTemporaryReadDiagnostic,
  DriverPayrollValueSource,
} from './driverPayrollImportTypes';
import { adaptPayrollToObservedSnapshot } from './payrollValidationEngine/payrollObservedAdapter';
import {
  PayrollValidationPipelineError,
  runDriverPayrollValidationPipeline,
} from './payrollValidationEngine/payrollValidationPipeline';

export const DEFAULT_MAX_PAYROLL_PDF_SIZE_BYTES = 15 * 1024 * 1024;

export const DRIVER_PAYROLL_IMPORT_PRIVACY_NOTE =
  'Il PDF viene analizzato temporaneamente e non viene salvato. Driver Payroll Engine conserva solo le cifre e le informazioni necessarie ai calcoli, allo storico e alle previsioni. Dati personali come codice fiscale, indirizzo, IBAN e altri identificativi non vengono memorizzati. Tutti i dati Payroll restano esclusivamente sul dispositivo e non vengono inviati al Cloud.';

const PRIVACY_REPORT = {
  originalPdfStored: false,
  rawTextStored: false,
  sensitiveDataStored: false,
} as const;

const buildRuntimeProvenance = (
  structuredText: DriverPayrollTemporaryReadDiagnostic['structuredText'],
  payslip?: PayslipImport
): NonNullable<DriverPayrollTemporaryReadDiagnostic['runtimeProvenance']> => ({
  parserBuildMarker: LOGISTICS_V1_PARSER_BUILD_MARKER,
  parserSourceFile: LOGISTICS_V1_PARSER_SOURCE_FILE,
  registrySourceFile: 'src/lib/driverPayrollParsers/payslipParserRegistry.ts',
  validationSourceFile: 'src/lib/driverPayrollValidation.ts',
  fiscalNormalizerSourceFile: 'src/lib/driverPayrollFiscalNormalizer.ts',
  economicSelectionCriterion: PAYROLL_ECONOMIC_SELECTION_CRITERION,
  extractedSiteCode: payslip?.siteCode,
  extractedCostCenterCode: payslip?.costCenterCode ?? payslip?.siteCostCenter,
  extractedCostCenterDescription: payslip?.costCenterDescription,
  fiscalSectionMatches: diagnosePayrollFiscalSectionMatches(structuredText),
});

const SENSITIVE_TEXT_PATTERNS = [
  /\bIT\d{2}[A-Z]\d{10}[0-9A-Z]{12}\b/i,
  /\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/i,
  /\biban\b/i,
  /\bcodice\s+fiscale\b/i,
  /\bindirizzo\b/i,
  /\bdata\s+di\s+nascita\b/i,
  /\bluogo\s+di\s+nascita\b/i,
  /\bmatricola\s+(?:inps|inail|previdenziale)\b/i,
];

const BLOCKED_RESULT_KEYS = new Set([
  'rawTextTemporary',
  'rawText',
  'rawLine',
  'sourceGeometry',
  'pdf',
  'pdfFile',
  'file',
  'blob',
  'arrayBuffer',
  'base64',
  'objectUrl',
  'url',
]);

function buildImportId(now: Date): string {
  return `payroll_import_${now.getTime()}_${Math.random().toString(36).slice(2, 10)}`;
}

function isProbablyPdf(file: File): boolean {
  if (file.type) return file.type === 'application/pdf';
  return file.name.toLowerCase().endsWith('.pdf');
}

function validateFile(
  file: File | undefined,
  maxFileSizeBytes: number
): DriverPayrollImportError | undefined {
  if (!file) {
    return {
      code: 'FILE_MISSING',
      message: 'Seleziona un file PDF da importare.',
    };
  }

  if (file.size === 0) {
    return {
      code: 'FILE_EMPTY',
      message: 'Il file selezionato e vuoto.',
    };
  }

  if (!isProbablyPdf(file)) {
    return {
      code: 'FILE_NOT_PDF',
      message: 'Il file selezionato non sembra essere un PDF.',
    };
  }

  if (file.size > maxFileSizeBytes) {
    return {
      code: 'FILE_TOO_LARGE',
      message: 'Il PDF selezionato e troppo grande per essere importato in modo sicuro.',
      technicalDetails: `Dimensione massima consentita: ${maxFileSizeBytes} byte.`,
    };
  }

  return undefined;
}

function createFailedResult(
  file: File | undefined,
  error: DriverPayrollImportError,
  now: Date,
  warnings: DriverPayrollImportWarning[] = [],
  temporaryReadDiagnostic?: DriverPayrollTemporaryReadDiagnostic
): DriverPayrollImportResult {
  return {
    importId: buildImportId(now),
    fileName: file?.name ?? '',
    status: 'failed',
    warnings,
    errors: [error],
    importedAt: now.toISOString(),
    temporaryReadDiagnostic,
    privacy: PRIVACY_REPORT,
  };
}

function hasSensitiveData(text: string): boolean {
  return SENSITIVE_TEXT_PATTERNS.some((pattern) => pattern.test(text));
}

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sanitizeString(value: string): string {
  return SENSITIVE_TEXT_PATTERNS.reduce((current, pattern) => current.replace(pattern, '[dato rimosso]'), value);
}

function sanitizeUnknown<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeUnknown(item)) as T;
  }

  if (typeof value === 'string') {
    return sanitizeString(value) as T;
  }

  if (!isObjectLike(value)) return value;

  const sanitized: Record<string, unknown> = {};

  Object.entries(value).forEach(([key, entry]) => {
    if (BLOCKED_RESULT_KEYS.has(key)) return;
    sanitized[key] = sanitizeUnknown(entry);
  });

  return sanitized as T;
}

export function sanitizeImportedPayrollData(payslip: PayslipImport): PayslipImport {
  const temporaryFree = stripPayslipTemporaryData(payslip);
  return sanitizeUnknown(temporaryFree);
}

function buildValueSources(payslip: PayslipImport): Record<string, DriverPayrollValueSource> {
  const sources: Record<string, DriverPayrollValueSource> = {
    year: 'parser',
    month: 'parser',
    summary: 'parser',
    parsedLines: 'parser',
  };

  payslip.parsedLines.forEach((line, index) => {
    const key = line.code ? `line.${line.code}` : `line.${index}`;
    sources[key] = 'parser';
  });

  return sources;
}

function findLineByCode(lines: PayslipLine[], code: string): PayslipLine | undefined {
  return lines.find((line) => line.code === code);
}

export function createPayrollLogicalFingerprint(payslip: PayslipImport): string {
  const travelLine = findLineByCode(payslip.parsedLines, '2310');
  const workedDaysLine = findLineByCode(payslip.parsedLines, '0170');
  const parts = [
    payslip.year,
    payslip.month,
    payslip.summary.grossAmount ?? payslip.summary.totalEarnings ?? '',
    payslip.summary.netAmount ?? '',
    payslip.summary.totalDeductions ?? '',
    payslip.parsedLines.length,
    travelLine ? getPayslipLineQuantity(travelLine) ?? '' : '',
    travelLine ? getPayslipLineEconomicAmount(travelLine) ?? '' : '',
    workedDaysLine ? getPayslipLineQuantity(workedDaysLine) ?? '' : '',
  ];

  return parts.join('|');
}

function collectWarnings(
  payslip: PayslipImport,
  rawText: string,
  existingPayslips: PayslipImport[]
): DriverPayrollImportWarning[] {
  const warnings: DriverPayrollImportWarning[] = payslip.warnings.map((message) => ({
    code: 'PARSER_WARNING',
    message,
  }));

  if (!payslip.payrollPeriodLabel) {
    warnings.push({
      code: 'PAYROLL_PERIOD_MISSING',
      message: 'Periodo di competenza non riconosciuto.',
      field: 'payrollPeriodLabel',
    });
  }

  if (payslip.summary.netAmount === undefined) {
    warnings.push({
      code: 'NET_AMOUNT_MISSING',
      message: 'Netto non riconosciuto.',
      field: 'summary.netAmount',
    });
  }

  if (payslip.summary.grossAmount === undefined && payslip.summary.totalEarnings === undefined) {
    warnings.push({
      code: 'GROSS_AMOUNT_MISSING',
      message: 'Lordo non riconosciuto.',
      field: 'summary.grossAmount',
    });
  }

  if (rawText.trim().length < 120) {
    warnings.push({
      code: 'TEXT_INSUFFICIENT',
      message: 'Testo insufficiente: alcuni dati potrebbero non essere stati letti correttamente.',
    });
  }

  const containsSensitiveData = hasSensitiveData(rawText);

  const fingerprint = createPayrollLogicalFingerprint(payslip);
  const duplicate = existingPayslips.some(
    (existingPayslip) => createPayrollLogicalFingerprint(existingPayslip) === fingerprint
  );

  if (duplicate) {
    warnings.push({
      code: 'POSSIBLE_DUPLICATE',
      message: 'Questa busta paga potrebbe essere gia presente nello storico.',
    });
  }

  return deduplicateWarnings(warnings).filter((warning) => {
    if (!containsSensitiveData) return true;
    return warning.code !== 'SENSITIVE_DATA_REMOVED';
  });
}

function warningSemanticKey(warning: DriverPayrollImportWarning): string {
  if (warning.message === PAYROLL_ECONOMIC_INCOHERENCE_WARNING) return 'payroll-economic-incoherence';

  const message = warning.message.toLowerCase();
  if (warning.field === 'payrollPeriodLabel' || message.includes('periodo di competenza')) return 'payrollPeriodLabel';
  if (warning.field === 'summary.netAmount' || message.includes('netto non riconosciuto')) return 'summary.netAmount';
  if (warning.field === 'summary.grossAmount' || message.includes('lordo non riconosciuto')) return 'summary.grossAmount';
  return warning.code;
}

function warningScore(warning: DriverPayrollImportWarning): number {
  let score = warning.field ? 3 : 0;
  if (!warning.message.includes('confidenza sufficiente')) score += 2;
  if (warning.code !== 'PARSER_WARNING') score += 1;
  return score;
}

function deduplicateWarnings(warnings: DriverPayrollImportWarning[]): DriverPayrollImportWarning[] {
  const byKey = new Map<string, DriverPayrollImportWarning>();

  warnings.forEach((warning) => {
    const key = warningSemanticKey(warning);
    const current = byKey.get(key);
    if (!current || warningScore(warning) > warningScore(current)) {
      byKey.set(key, warning);
    }
  });

  return Array.from(byKey.values());
}

function getStatus(warnings: DriverPayrollImportWarning[]): DriverPayrollImportResult['status'] {
  return warnings.length > 0 ? 'warning' : 'ready';
}

function mapPdfTextError(error: unknown): { error: DriverPayrollImportError; warnings?: DriverPayrollImportWarning[] } {
  if (error instanceof DriverPayrollPdfTextError) {
    if (error.code === 'PDF_PASSWORD_PROTECTED') {
      return {
        error: {
          code: 'PDF_PASSWORD_PROTECTED',
          message: 'Questo PDF e protetto da password e non puo essere letto automaticamente.',
          technicalDetails: error.message,
        },
      };
    }

    if (error.code === 'PDF_INVALID') {
      return {
        error: {
          code: 'PDF_INVALID',
          message: 'Questo PDF sembra danneggiato o non valido.',
          technicalDetails: error.message,
        },
      };
    }

    if (error.code === 'PDF_SCANNED_DOCUMENT') {
      return {
        error: {
          code: 'PDF_SCANNED_DOCUMENT',
          message: 'Questo PDF sembra composto solo da immagini. L OCR locale verra aggiunto in uno step successivo.',
        },
        warnings: [
          {
            code: 'SCANNED_DOCUMENT',
            message: 'Questo PDF sembra composto solo da immagini. L OCR locale verra aggiunto in uno step successivo.',
          },
        ],
      };
    }

    return {
      error: {
        code: 'PDF_READER_ERROR',
        message: 'Errore tecnico durante la lettura locale del PDF.',
        technicalDetails: error.message,
      },
    };
  }

  return {
    error: {
      code: 'PDF_TEXT_EXTRACTION_FAILED',
      message:
        'Non e stato possibile leggere questo PDF. Il documento potrebbe essere protetto, danneggiato o composto solo da immagini.',
      technicalDetails: error instanceof Error ? error.message : String(error),
    },
  };
}

export async function importDriverPayrollPdf(
  file: File,
  options: DriverPayrollImportServiceOptions = {}
): Promise<DriverPayrollImportResult> {
  const now = options.now?.() ?? new Date();
  const maxFileSizeBytes = options.maxFileSizeBytes ?? DEFAULT_MAX_PAYROLL_PDF_SIZE_BYTES;
  const validationError = validateFile(file, maxFileSizeBytes);

  if (validationError) return createFailedResult(file, validationError, now);

  let rawText = '';
  let parsedPayslip: PayslipImport | undefined;
  let structuredText = createStructuredTextFromPlainText('');
  let temporaryReadDiagnostic: DriverPayrollTemporaryReadDiagnostic | undefined;

  try {
    if (options.extractText) {
      rawText = await options.extractText(file);
      structuredText = createStructuredTextFromPlainText(rawText);
    } else {
      structuredText = await extractStructuredTextFromPayslipPdf(file);
      rawText = structuredText.plainText;
    }
    temporaryReadDiagnostic = {
      analyzedAt: now.toISOString(),
      extractionMethod: 'pdf_text',
      structuredText,
      runtimeProvenance: buildRuntimeProvenance(structuredText),
    };
    payrollDebugLog('[PAYROLL][1] Estrazione PDF completata:', {
      pages: structuredText.pages,
      tokenCount: structuredText.items.length,
      reconstructedLineCount: structuredText.reconstructedLines.length,
      textLength: rawText.length,
    });
  } catch (error) {
    if (error instanceof DriverPayrollPdfTextError && error.structuredText) {
      temporaryReadDiagnostic = {
        analyzedAt: now.toISOString(),
        extractionMethod: 'pdf_text',
        structuredText: error.structuredText,
        runtimeProvenance: buildRuntimeProvenance(error.structuredText),
      };
    }
    const mappedError = mapPdfTextError(error);
    return createFailedResult(
      file,
      mappedError.error,
      now,
      mappedError.warnings ?? [],
      temporaryReadDiagnostic
    );
  }

  if (!rawText.trim()) {
    return createFailedResult(
      file,
      {
        code: 'PDF_TEXT_EMPTY',
        message:
          'PDF testuale letto, ma senza testo utile per la busta paga.',
      },
      now,
      [
        {
          code: 'PDF_TEXT_WITHOUT_USEFUL_TEXT',
          message:
            'PDF testuale letto, ma senza testo utile per la busta paga.',
        },
      ],
      temporaryReadDiagnostic
    );
  }

  try {
    parsedPayslip = parsePayslip(structuredText);
    temporaryReadDiagnostic = {
      ...temporaryReadDiagnostic!,
      parserPayslip: parsedPayslip,
      runtimeProvenance: buildRuntimeProvenance(structuredText, parsedPayslip),
    };
    payrollDebugLog('[PAYROLL][4] Risultato parser grezzo disponibile:', {
      parserUsed: parsedPayslip.parserUsed,
      detectedFormat: parsedPayslip.detectedFormat,
      parsedLineCount: parsedPayslip.parsedLines.length,
      confidence: parsedPayslip.confidence,
    });
    payrollDebugLog('[PAYROLL][5] Netto prima dei fallback:', parsedPayslip.summary.netAmount ?? null);
    const guardedPayslip = applyPayrollEconomicCoherenceGuard(parsedPayslip);
    temporaryReadDiagnostic = {
      ...temporaryReadDiagnostic!,
      guardedPayslip,
    };
    payrollDebugLog('[PAYROLL][6] Netto dopo i fallback:', guardedPayslip.summary.netAmount ?? null);
    const diagnosticReport = buildPayrollParserDiagnosticReport(structuredText, guardedPayslip);
    const finalSummary = parsePayslipFinalSummary(structuredText);
    const fiscalData = normalizePayslipFiscalData(structuredText, guardedPayslip);
    const payrollValidation = validatePayrollConsistency(guardedPayslip, {
      rounding: finalSummary.rounding,
      fiscalData,
    });
    const fiscalAnalysis = {
      fiscalData,
      validation: validatePayslipFiscalData(fiscalData, guardedPayslip),
    };
    const sanitizedPayslip = sanitizeImportedPayrollData(guardedPayslip);
    const observedSnapshot = adaptPayrollToObservedSnapshot(sanitizedPayslip, {
      fiscalData,
      rounding: finalSummary.rounding,
    });
    const pipelineProfile = 'PRODUCTION' as const;
    let validationPipeline: NonNullable<DriverPayrollImportResult['validationPipeline']>;
    const hasValidPeriod =
      Number.isInteger(sanitizedPayslip.year) &&
      Number.isInteger(sanitizedPayslip.month) &&
      (sanitizedPayslip.year as number) >= 1 &&
      (sanitizedPayslip.month as number) >= 1 &&
      (sanitizedPayslip.month as number) <= 12;

    if (!hasValidPeriod) {
      validationPipeline = {
        status: 'NOT_RUN',
        profile: pipelineProfile,
        selectedCheckIds: [],
        error: {
          code: 'PAYROLL_PERIOD_INVALID',
          message: 'Pipeline non eseguita: periodo di competenza assente o non valido.',
        },
      };
    } else {
      try {
        const executePipeline = options.runValidationPipeline ??
          runDriverPayrollValidationPipeline;
        const pipelineResult = await executePipeline({
          payroll: observedSnapshot,
          period: {
            year: sanitizedPayslip.year,
            month: sanitizedPayslip.month,
            label: sanitizedPayslip.payrollPeriodLabel,
          },
          profile: pipelineProfile,
          useFiscalRuleIntegrationV1: true,
          clock: () => now.toISOString(),
        });
        validationPipeline = {
          status: 'COMPLETED',
          profile: pipelineResult.profile,
          serviceSource: pipelineResult.serviceSource,
          selectedCheckIds: [...pipelineResult.selectedCheckIds],
          technicalRun: pipelineResult.technicalRun,
          driverReport: pipelineResult.driverReport,
          executedAt: pipelineResult.executedAt,
        };
      } catch (error) {
        validationPipeline = {
          status: 'TECHNICAL_ERROR',
          profile: pipelineProfile,
          selectedCheckIds: [],
          error: {
            code: error instanceof PayrollValidationPipelineError
              ? error.code
              : 'PAYROLL_VALIDATION_PIPELINE_FAILED',
            message: error instanceof Error ? error.message : String(error),
          },
        };
      }
    }
    temporaryReadDiagnostic = {
      ...temporaryReadDiagnostic!,
      payrollValidationPipeline: {
        status: validationPipeline.status,
        snapshotCreated: true,
        started: validationPipeline.status !== 'NOT_RUN',
        profile: validationPipeline.profile,
        selectedCheckIds: [...validationPipeline.selectedCheckIds],
        passCount: validationPipeline.technicalRun?.passCount ?? 0,
        warningCount: validationPipeline.technicalRun?.warningCount ?? 0,
        failCount: validationPipeline.technicalRun?.failCount ?? 0,
        infoCount: validationPipeline.technicalRun?.infoCount ?? 0,
        internalErrorCount: validationPipeline.technicalRun?.internalErrors.length ?? 0,
        executedAt: validationPipeline.executedAt,
        error: validationPipeline.error,
      },
    };
    const existingPayslips = await (options.readExistingPayslips?.() ??
      getDriverPayrollCollection(DRIVER_PAYROLL_KEYS.payslips));
    const warnings = collectWarnings(sanitizedPayslip, rawText, existingPayslips);
    const logicalFingerprint = createPayrollLogicalFingerprint(sanitizedPayslip);

    rawText = '';

    const sanitizedResult = sanitizeUnknown({
      importId: buildImportId(now),
      fileName: file.name,
      status: getStatus(warnings),
      payslip: sanitizedPayslip,
      warnings,
      errors: [],
      confidence: sanitizedPayslip.confidence,
      importedAt: now.toISOString(),
      logicalFingerprint,
      valueSources: buildValueSources(sanitizedPayslip),
      diagnosticReport,
      payrollValidation,
      fiscalAnalysis,
      observedSnapshot,
      validationPipeline,
      privacy: PRIVACY_REPORT,
    });
    const result: DriverPayrollImportResult = {
      ...sanitizedResult,
      temporaryReadDiagnostic,
    };
    payrollDebugLog("[PAYROLL][7] Oggetto inviato all'anteprima:", {
      importId: result.importId,
      status: result.status,
      parserUsed: result.payslip?.parserUsed,
      warningCount: result.warnings.length,
      errorCount: result.errors.length,
      temporaryDiagnosticAvailable: Boolean(result.temporaryReadDiagnostic),
    });

    return result;
  } catch (error) {
    rawText = '';

    return createFailedResult(
      file,
      {
        code: 'PAYSLIP_PARSE_FAILED',
        message: 'Non e stato possibile riconoscere i dati principali della busta paga.',
        technicalDetails: error instanceof Error ? error.message : String(error),
      },
      now,
      [],
      temporaryReadDiagnostic
    );
  }
}

export async function importDriverPayrollPdfs(
  files: File[],
  options: DriverPayrollImportServiceOptions = {}
): Promise<DriverPayrollImportResult[]> {
  const results: DriverPayrollImportResult[] = [];

  for (const file of files) {
    results.push(await importDriverPayrollPdf(file, options));
  }

  return results;
}

export async function saveConfirmedImportedPayroll(
  result: DriverPayrollImportResult,
  options: DriverPayrollImportServiceOptions = {}
): Promise<PayslipImport> {
  if (result.status === 'failed' || !result.payslip) {
    throw new Error('Importazione non salvabile: manca una busta paga valida e confermata.');
  }

  const payslipWithFiscalData: PayslipImport = result.fiscalAnalysis
    ? {
        ...result.payslip,
        fiscalDataVersion: 'fiscal-v1',
        fiscalData: sanitizeUnknown(result.fiscalAnalysis.fiscalData),
      }
    : result.payslip;
  const sanitizedPayslip = sanitizeImportedPayrollData(payslipWithFiscalData);
  payrollDebugLog('[PAYROLL][8] Oggetto salvato nello storico:', sanitizedPayslip);
  await (options.savePayslip?.(sanitizedPayslip) ??
    upsertDriverPayrollItem(DRIVER_PAYROLL_KEYS.payslips, sanitizedPayslip));

  return sanitizedPayslip;
}
