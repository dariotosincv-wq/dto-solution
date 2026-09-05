import type { PayrollCodeType, PayslipImport, PayslipLine, PayslipSummary } from './driverPayrollTypes';
import { normalizePayslipLines } from './driverPayrollPayslipNormalizer';

export const DRIVER_PAYROLL_ENGINE_TECHNICAL_NOTE =
  'Il Driver Payroll Engine e progettato per funzionare con layout di buste paga della logistica italiana. Il parser riconosce automaticamente la struttura del documento senza essere legato ad una specifica azienda.';

type ParsedLineDraft = PayslipLine & {
  rawNumbers?: number[];
};

const MONTHS: Record<string, number> = {
  gennaio: 1,
  febbraio: 2,
  marzo: 3,
  aprile: 4,
  maggio: 5,
  giugno: 6,
  luglio: 7,
  agosto: 8,
  settembre: 9,
  ottobre: 10,
  novembre: 11,
  dicembre: 12,
};

const TRACKED_CODES = new Set([
  '0169',
  '0170',
  '0779',
  '0785',
  '1000',
  '1981',
  '1989',
  '2014',
  '2030',
  '2050',
  '2250',
  '2310',
  '2315',
  '2500',
  '2520',
  '2530',
  '2600',
  '2650',
  '2700',
  '2720',
  '2800',
  '2850',
  '3900',
  '3901',
  '4009',
  '4301',
  '5000',
  '5050',
  '5100',
  '5121',
  '5340',
  '5390',
  '5963',
  '6633',
  '7033',
  '9202',
  '9250',
  '9300',
  '9531',
]);

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

function normalizeSpaces(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

export function normalizePayslipTextRows(text: string): string[] {
  return text
    .replace(/\r/g, '\n')
    .split('\n')
    .map(normalizeSpaces)
    .filter(Boolean);
}

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function parseItalianNumber(value: string): number | undefined {
  const cleaned = value.replace(/\./g, '').replace(',', '.');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isNumericToken(value: string): boolean {
  return /^[+-]?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?$/.test(value);
}

function parseItalianDate(value: string): string | undefined {
  const match = value.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);
  if (!match) return undefined;

  const day = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${month}-${day}`;
}

function buildId(year?: number, month?: number): string {
  const periodPart = year && month ? `${year}_${String(month).padStart(2, '0')}` : 'period_unknown';
  return `payslip_${periodPart}_${Date.now()}`;
}

function inferLineNumbers(numbers: number[]): Pick<PayslipLine, 'quantity' | 'unitValue' | 'amount' | 'confidence'> {
  if (numbers.length === 0) return { confidence: 35 };

  const amount = numbers[numbers.length - 1];

  if (numbers.length >= 3) {
    const unitValue = numbers[numbers.length - 3];
    const quantity = numbers[numbers.length - 2];
    const expected = round2(unitValue * quantity);
    const confidence = Math.abs(expected - amount) <= 0.02 ? 92 : 68;

    return { unitValue, quantity, amount, confidence };
  }

  if (numbers.length === 2) {
    return { quantity: numbers[0], amount, confidence: 62 };
  }

  return { amount, confidence: 55 };
}

export function parsePayrollLayoutV1Line(row: string): ParsedLineDraft | undefined {
  const lineMatch = normalizeSpaces(row).match(/^(\d{4})\s+(.+)$/);
  if (!lineMatch) return undefined;

  const code = lineMatch[1];
  const rest = lineMatch[2];

  if (!TRACKED_CODES.has(code)) return undefined;

  const tokens = rest.split(' ');
  const firstValueIndex = tokens.findIndex((token) => token === '*' || isNumericToken(token));
  const descriptionTokens = firstValueIndex >= 0 ? tokens.slice(0, firstValueIndex) : tokens;
  const valueTokens = firstValueIndex >= 0 ? tokens.slice(firstValueIndex) : [];
  const rawNumbers = valueTokens
    .filter((token) => token !== '*' && isNumericToken(token))
    .map((token) => parseItalianNumber(token))
    .filter((value): value is number => value !== undefined);

  const inferred = inferLineNumbers(rawNumbers);

  return {
    code,
    label: descriptionTokens.join(' ').trim(),
    rawLine: row,
    rawNumbers,
    ...inferred,
  };
}

function findPeriod(rows: string[]): { label?: string; month?: number; year?: number } {
  const explicitPeriodRow = rows.find((row) => /periodo\s+(?:di\s+)?paga|periodo\s+pag/i.test(stripAccents(row).toLowerCase()));
  const fallbackRows = rows.filter((row) => !/data\s+valuta|data\s+pagamento|pagamento|bonifico|data\s+documento|data\s+stampa/i.test(stripAccents(row).toLowerCase()));
  const joined = stripAccents(explicitPeriodRow ?? fallbackRows.join(' ')).toLowerCase();
  const monthNames = Object.keys(MONTHS).join('|');
  const match = joined.match(new RegExp(`\\b(${monthNames})\\s+(20\\d{2})\\b`, 'i'));
  if (!match) return {};

  const monthName = match[1].toLowerCase();
  return {
    label: `${match[1].toUpperCase()} ${match[2]}`,
    month: MONTHS[monthName],
    year: Number(match[2]),
  };
}

function findMoneyAfterLabels(rows: string[], labels: string[], forbidden: string[] = []): number | undefined {
  const labelPattern = labels.map((label) => stripAccents(label).replace(/\s+/g, '\\s+')).join('|');
  const moneyPattern = '([+-]?(?:\\d{1,3}(?:\\.\\d{3})+|\\d+),\\d{2})';

  for (const row of rows) {
    const normalized = stripAccents(row);
    if (forbidden.some((label) => normalized.toLowerCase().includes(stripAccents(label).toLowerCase()))) continue;
    const match = normalized.match(new RegExp(`(?:${labelPattern}).*?${moneyPattern}`, 'i'));
    const lastMoney = normalized.match(new RegExp(`${moneyPattern}(?!.*${moneyPattern})`));

    if (match) return parseItalianNumber(match[1]);
    if (labels.some((label) => normalized.toLowerCase().includes(stripAccents(label).toLowerCase())) && lastMoney) {
      return parseItalianNumber(lastMoney[1]);
    }
  }

  return undefined;
}

function extractSummary(rows: string[], parsedLines: PayslipLine[]): PayslipSummary {
  const totalEarnings = findMoneyAfterLabels(rows, ['totale competenze']) ?? findMoneyAfterLabels(rows, ['competenze']);
  const totalDeductions = findMoneyAfterLabels(rows, ['totale trattenute']);
  const netAmount =
    findMoneyAfterLabels(rows, ['netto in busta', 'netto a pagare', 'totale netto', 'importo netto', 'netto'], [
      'imponibile',
      'arrotondamento',
      'totale competenze',
      'totale trattenute',
    ]) ?? findMoneyAfterLabels(rows, ['bonifico']);
  const paymentRow = rows.find((row) => /pagamento|bonifico/i.test(stripAccents(row)));
  const paymentDate = paymentRow ? parseItalianDate(paymentRow) : undefined;
  const grossFromLines = round2(
    parsedLines
      .filter((line) => line.type === 'earning')
      .reduce((total, line) => total + Math.max(0, line.amount ?? 0), 0)
  );

  return {
    grossAmount: totalEarnings ?? (grossFromLines > 0 ? grossFromLines : undefined),
    netAmount,
    totalEarnings,
    totalDeductions,
    paymentDate,
  };
}

function extractMetadata(rows: string[]) {
  const period = findPeriod(rows);
  const companyName = rows
    .slice(0, 8)
    .find((row) => /\b(?:s\.?r\.?l\.?|s\.?p\.?a\.?|societa|azienda|company)\b/i.test(row));
  const level = rows.join(' ').match(/\bLIV(?:ELLO)?\.?\s*[:\-]?\s*(G\d+)\b/i)?.[1];
  const siteCostCenter = rows.join(' ').match(/\b(DL\d{2}\s*-\s*[A-Z0-9 ]+)\b/i)?.[1]?.trim();

  return {
    companyName: companyName?.toUpperCase().replace(/\s+/g, ' '),
    payrollPeriodLabel: period.label,
    month: period.month,
    year: period.year,
    level,
    siteCostCenter,
  };
}

function classifyWarnings(lines: PayslipLine[], text: string): string[] {
  const warnings: string[] = [];
  if (!/periodo paga|livello|bonifico|totale competenze/i.test(stripAccents(text))) {
    warnings.push('Layout busta paga non confermato nel testo estratto.');
  }
  if (lines.length === 0) warnings.push('Nessuna riga paga riconosciuta dai codici supportati.');
  if (lines.some((line) => (line.confidence ?? 0) < 70)) {
    warnings.push('Alcune righe hanno numeri ambigui: verificare quantita, importo unitario e totale.');
  }
  return warnings;
}

function estimateConfidence(lines: PayslipLine[], warnings: string[], summary: PayslipSummary): number {
  const lineScore =
    lines.length === 0 ? 20 : lines.reduce((total, line) => total + (line.confidence ?? 50), 0) / lines.length;
  const summaryBonus = summary.netAmount !== undefined ? 8 : 0;
  const warningPenalty = warnings.length * 8;

  return Math.max(10, Math.min(98, Math.round(lineScore + summaryBonus - warningPenalty)));
}

export function stripPayslipTemporaryData(payslip: PayslipImport): PayslipImport {
  const { rawTextTemporary, ...persistable } = payslip;
  return persistable;
}

export function parsePayrollLayoutV1Text(text: string): PayslipImport {
  const rows = normalizePayslipTextRows(text);
  const metadata = extractMetadata(rows);
  const parsedLines = normalizePayslipLines(
    rows
      .map(parsePayrollLayoutV1Line)
      .filter((line): line is ParsedLineDraft => Boolean(line))
      .map(({ rawNumbers: _rawNumbers, ...line }) => line)
  );
  const summary = extractSummary(rows, parsedLines);
  const warnings = classifyWarnings(parsedLines, text);
  if (!metadata.payrollPeriodLabel) warnings.push('Periodo di competenza non riconosciuto.');

  return {
    id: buildId(metadata.year, metadata.month),
    payrollProvider: 'Payroll Layout v1',
    companyName: metadata.companyName,
    payrollPeriodLabel: metadata.payrollPeriodLabel,
    level: metadata.level,
    siteCostCenter: metadata.siteCostCenter,
    year: metadata.year,
    month: metadata.month,
    importedAt: new Date().toISOString(),
    extractionMethod: 'pdf_text',
    confidence: estimateConfidence(parsedLines, warnings, summary),
    rawTextTemporary: text,
    parsedLines,
    summary,
    warnings,
  };
}

export function getPayslipLineByCode(payslip: PayslipImport, code: string): PayslipLine | undefined {
  return payslip.parsedLines.find((line) => line.code === code);
}

export type { PayrollCodeType };
