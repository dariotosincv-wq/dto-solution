import type { StructuredPdfText } from './driverPayrollPdfLayout';
import type { PayslipImport } from './driverPayrollTypes';
import { parsePayslipFinalSummary } from './driverPayrollParsers/finalSummaryParser';
import { detectPayslipFormat } from './driverPayrollParsers/payslipFormatDetector';

export type PayrollPdfDiagnosticToken = {
  page: number;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PayrollParserDiagnosticReport = {
  parserId: string;
  pageCount: number;
  pages: Array<{
    page: number;
    width: number;
    height: number;
    tokens: PayrollPdfDiagnosticToken[];
    reconstructedRows: Array<{
      y: number;
      text: string;
      tokenIndexes: number[];
    }>;
  }>;
  finalSummaryCandidates: {
    period: unknown[];
    totalEarnings: unknown[];
    totalDeductions: unknown[];
    net: unknown[];
  };
  selectedValues: {
    month?: number;
    year?: number;
    totalEarnings?: number;
    totalDeductions?: number;
    net?: number;
  };
  validation: {
    equationChecked: boolean;
    expectedNet?: number;
    difference?: number;
    valid: boolean;
  };
  warnings: string[];
};

const moneyKeys = ['grossAmount', 'totalEarnings', 'totalDeductions', 'netAmount'] as const;
export const PAYROLL_ECONOMIC_INCOHERENCE_WARNING = 'I valori economici letti non sono matematicamente coerenti.';

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const anonymizePayrollDiagnosticText = (value: string): string => {
  let text = value;
  text = text.replace(/\bIT\d{2}[A-Z]\d{10}[0-9A-Z]{12}\b/gi, '[IBAN]');
  text = text.replace(/\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/g, '[CODICE_FISCALE]');
  text = text.replace(/\b(nome|cognome|dipendente)\s*[:\-]?\s+[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ' ]{2,}/gi, '$1 [PERSONA]');
  text = text.replace(/\b(indirizzo|residenza|domicilio)\s*[:\-]?\s+[^,\n]+(?:,\s*\d+)?/gi, '$1 [INDIRIZZO]');
  text = text.replace(/\b(matricola|badge|codice badge)\s*[:\-]?\s*[A-Z0-9/-]{3,}\b/gi, '$1 [MATRICOLA]');
  text = text.replace(/\b(data di nascita|nato il)\s*[:\-]?\s*\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/gi, '$1 [DATA_NASCITA]');
  return text;
};

const anonymizeUnknown = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map((item) => anonymizeUnknown(item)) as T;
  if (typeof value === 'string') return anonymizePayrollDiagnosticText(value) as T;
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, anonymizeUnknown(entry)])) as T;
};

const tokenKey = (token: PayrollPdfDiagnosticToken) =>
  `${token.page}:${token.x}:${token.y}:${token.text}:${token.width}:${token.height}`;

const pageSizeFor = (structuredText: StructuredPdfText, page: number, tokens: PayrollPdfDiagnosticToken[]) => {
  const explicit = structuredText.pageSizes?.find((item) => item.page === page);
  if (explicit) return explicit;
  const width = tokens.length > 0 ? Math.max(...tokens.map((token) => token.x + token.width)) : 0;
  const height = tokens.length > 0 ? Math.max(...tokens.map((token) => token.y + token.height)) : 0;
  return { page, width, height };
};

const candidateFromSource = (source: unknown) => {
  if (!source || typeof source !== 'object') return [];
  return [anonymizeUnknown(source)];
};

export const validatePayrollEconomicEquation = (
  totalEarnings?: number,
  totalDeductions?: number,
  net?: number,
  rounding = 0,
  tolerance = 0.02
) => {
  const equationChecked = totalEarnings !== undefined && totalDeductions !== undefined && net !== undefined;
  if (!equationChecked) return { equationChecked, valid: false };
  const expectedNet = round2(totalEarnings - totalDeductions + rounding);
  const difference = round2(expectedNet - net);
  return {
    equationChecked,
    expectedNet,
    difference,
    valid: Math.abs(difference) <= tolerance,
  };
};

export const buildPayrollParserDiagnosticReport = (
  structuredText: StructuredPdfText,
  payslip?: PayslipImport
): PayrollParserDiagnosticReport => {
  const detection = detectPayslipFormat(structuredText);
  const finalSummary = parsePayslipFinalSummary(structuredText);
  const tokens: PayrollPdfDiagnosticToken[] = structuredText.items.map((item) => ({
    page: item.page,
    text: anonymizePayrollDiagnosticText(item.text),
    x: item.x,
    y: item.y,
    width: item.width ?? item.text.length * 6,
    height: item.height ?? 10,
  }));
  const tokenIndexByKey = new Map(tokens.map((token, index) => [tokenKey(token), index]));
  const pages = Array.from({ length: structuredText.pages }, (_, index) => index + 1).map((page) => {
    const pageTokens = tokens.filter((token) => token.page === page);
    const size = pageSizeFor(structuredText, page, pageTokens);
    return {
      page,
      width: size.width,
      height: size.height,
      tokens: pageTokens,
      reconstructedRows: structuredText.reconstructedLines
        .filter((row) => row.page === page)
        .map((row) => ({
          y: row.y,
          text: anonymizePayrollDiagnosticText(row.text),
          tokenIndexes: row.items
            .map((item) =>
              tokenIndexByKey.get(
                tokenKey({
                  page: item.page,
                  text: anonymizePayrollDiagnosticText(item.text),
                  x: item.x,
                  y: item.y,
                  width: item.width ?? item.text.length * 6,
                  height: item.height ?? 10,
                })
              )
            )
            .filter((value): value is number => value !== undefined),
        })),
    };
  });

  const totalEarnings = payslip?.summary.grossAmount ?? payslip?.summary.totalEarnings ?? finalSummary.totalEarnings;
  const totalDeductions = payslip?.summary.totalDeductions ?? finalSummary.totalDeductions;
  const net = payslip?.summary.netAmount ?? finalSummary.net;
  const validation = validatePayrollEconomicEquation(totalEarnings, totalDeductions, net, finalSummary.rounding ?? 0);

  return {
    parserId: payslip?.parserUsed ?? detection.format,
    pageCount: structuredText.pages,
    pages,
    finalSummaryCandidates: {
      period: candidateFromSource(finalSummary.sources.period),
      totalEarnings: candidateFromSource(finalSummary.sources.totalEarnings),
      totalDeductions: candidateFromSource(finalSummary.sources.totalDeductions),
      net: candidateFromSource(finalSummary.sources.net),
    },
    selectedValues: {
      month: payslip?.month ?? finalSummary.month,
      year: payslip?.year ?? finalSummary.year,
      totalEarnings,
      totalDeductions,
      net,
    },
    validation,
    warnings: [...finalSummary.warnings, ...(payslip?.warnings ?? [])].map(anonymizePayrollDiagnosticText),
  };
};

export const serializePayrollParserDiagnosticReport = (report: PayrollParserDiagnosticReport): string =>
  JSON.stringify(report, null, 2);

export const parsePayrollParserDiagnosticFixture = (json: string): PayrollParserDiagnosticReport =>
  JSON.parse(json) as PayrollParserDiagnosticReport;

export const applyPayrollEconomicCoherenceGuard = (payslip: PayslipImport): PayslipImport => {
  const totalEarnings = payslip.summary.grossAmount ?? payslip.summary.totalEarnings;
  const totalDeductions = payslip.summary.totalDeductions;
  const net = payslip.summary.netAmount;
  const validation = validatePayrollEconomicEquation(totalEarnings, totalDeductions, net);
  if (!validation.equationChecked || validation.valid) return payslip;

  const fieldConfidence = { ...(payslip.fieldConfidence ?? {}) };
  moneyKeys.forEach((key) => {
    if (fieldConfidence[key]) {
      fieldConfidence[key] = { ...fieldConfidence[key], confidence: 'uncertain' };
    }
  });

  const warnings = payslip.warnings.includes(PAYROLL_ECONOMIC_INCOHERENCE_WARNING)
    ? payslip.warnings
    : [...payslip.warnings, PAYROLL_ECONOMIC_INCOHERENCE_WARNING];

  return {
    ...payslip,
    summary: {
      ...payslip.summary,
      netAmount: undefined,
    },
    fieldConfidence,
    warnings,
  };
};
