import type { StructuredPdfText } from '../driverPayrollPdfLayout';
import type { PayslipImport, PayslipSummary } from '../driverPayrollTypes';
import {
  buildId,
  fieldConfidence,
  findMoneyValues,
  isPlausibleMoney,
  isPlausibleMonth,
  isPlausibleYear,
  MONTHS,
  normalizeText,
} from './payslipParserHelpers';
import {
  finalSummaryFieldConfidence,
  mergeFinalSummaryIntoSummary,
  parsePayslipFinalSummary,
} from './finalSummaryParser';

const findBySynonyms = (rows: string[], synonyms: string[], forbidden: string[] = []) => {
  for (const row of rows) {
    const normalized = normalizeText(row);
    if (forbidden.some((term) => normalized.includes(normalizeText(term)))) continue;
    if (!synonyms.some((term) => normalized.includes(normalizeText(term)))) continue;

    const values = findMoneyValues(row).filter((value) => isPlausibleMoney(value));
    if (values.length > 0) return { value: values[values.length - 1], row };
  }
  return {};
};

const findPeriod = (rows: string[]) => {
  const monthNames = Object.keys(MONTHS).join('|');
  const explicitPeriodRow = rows.find((row) => /periodo\s+(?:di\s+)?paga|periodo\s+pag/i.test(normalizeText(row)));
  const fallbackRows = rows.filter((row) => !/data\s+valuta|data\s+pagamento|pagamento|bonifico|data\s+documento|data\s+stampa/i.test(normalizeText(row)));
  const sourceText = normalizeText(explicitPeriodRow ?? fallbackRows.join(' '));
  const match = sourceText.match(new RegExp(`\\b(${monthNames})\\s+(20\\d{2})\\b`, 'i'));
  if (!match) return {};

  const month = MONTHS[match[1].toLowerCase()];
  const year = Number(match[2]);
  return {
    label: `${match[1].toUpperCase()} ${match[2]}`,
    month: isPlausibleMonth(month) ? month : undefined,
    year: isPlausibleYear(year) ? year : undefined,
  };
};

export function parseGenericPayslip(structuredText: StructuredPdfText): PayslipImport {
  const rows = structuredText.reconstructedLines.map((line) => line.text);
  const finalSummary = parsePayslipFinalSummary(structuredText);
  const fallbackPeriod = findPeriod(rows);
  const period = {
    label: finalSummary.periodLabel ?? fallbackPeriod.label,
    month: finalSummary.month ?? fallbackPeriod.month,
    year: finalSummary.year ?? fallbackPeriod.year,
  };
  const grossSource = findBySynonyms(
    rows,
    ['stipendio lordo', 'retribuzione lorda', 'totale competenze', 'totale retribuzione', 'lordo'],
    ['imponibile fiscale', 'imponibile inps']
  );
  const netSource = findBySynonyms(rows, ['netto da pagare', 'netto in busta', 'totale netto', 'importo netto', 'bonifico', 'netto']);
  const deductionsSource = findBySynonyms(rows, ['totale trattenute', 'trattenute', 'ritenute']);
  const explicitDeductionsSource = findBySynonyms(rows, ['totale trattenute']);
  const year = period.year;
  const month = period.month;
  const summary: PayslipSummary = mergeFinalSummaryIntoSummary({
    grossAmount: grossSource.value,
    totalEarnings: grossSource.value,
    netAmount: netSource.value,
    totalDeductions: explicitDeductionsSource.value !== undefined && explicitDeductionsSource.value >= 0 ? explicitDeductionsSource.value : undefined,
  }, finalSummary);
  const warnings: string[] = ['Parser generico usato: controlla e correggi i dati prima di salvare.'];

  if (!period.label) warnings.push('Periodo di competenza non riconosciuto.');
  if (summary.grossAmount === undefined) warnings.push('Lordo non riconosciuto con confidenza sufficiente.');
  if (summary.netAmount === undefined) warnings.push('Netto non riconosciuto con confidenza sufficiente.');

  return {
    id: buildId(year, month),
    payrollProvider: 'Generic Payroll Layout',
    detectedFormat: summary.grossAmount || summary.netAmount ? 'generic' : 'unknown',
    parserUsed: 'generic',
    payrollPeriodLabel: period.label,
    year,
    month,
    importedAt: new Date().toISOString(),
    extractionMethod: 'pdf_text',
    confidence: summary.grossAmount || summary.netAmount ? 55 : 25,
    rawTextTemporary: structuredText.plainText,
    parsedLines: [],
    summary,
    warnings,
    fieldConfidence: {
      payrollPeriodLabel: finalSummaryFieldConfidence(finalSummary, 'period', period.label, 'generic'),
      grossAmount: finalSummary.sources.totalEarnings
        ? finalSummaryFieldConfidence(finalSummary, 'totalEarnings', summary.grossAmount, 'generic')
        : fieldConfidence(summary.grossAmount !== undefined ? 'probable' : 'missing', 'generic', summary.grossAmount, grossSource.row),
      netAmount: finalSummary.sources.net
        ? finalSummaryFieldConfidence(finalSummary, 'net', summary.netAmount, 'generic')
        : fieldConfidence(summary.netAmount !== undefined ? 'probable' : 'missing', 'generic', summary.netAmount, netSource.row),
      totalDeductions: finalSummary.sources.totalDeductions
        ? finalSummaryFieldConfidence(finalSummary, 'totalDeductions', summary.totalDeductions, 'generic')
        : fieldConfidence(
            summary.totalDeductions !== undefined ? 'probable' : 'missing',
            'generic',
            summary.totalDeductions,
            explicitDeductionsSource.row
          ),
    },
  };
}
