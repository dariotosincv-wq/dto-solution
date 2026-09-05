import type { StructuredPdfText } from '../driverPayrollPdfLayout';
import type { PayslipFieldConfidence, PayslipImport, PayslipLine } from '../driverPayrollTypes';
import { getPayslipLineEconomicAmount } from '../driverPayrollLineValues';

export const MONTHS: Record<string, number> = {
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

export const stripAccents = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const normalizeText = (value: string): string =>
  stripAccents(value).toLowerCase().replace(/\s+/g, ' ').trim();

export const parseItalianNumber = (value: string): number | undefined => {
  const parsed = Number(value.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

export const moneyPattern = '[+-]?(?:\\d{1,3}(?:\\.\\d{3})+|\\d+),\\d{2}';

export const findMoneyValues = (text: string): number[] =>
  Array.from(text.matchAll(new RegExp(`\\b(${moneyPattern})\\b`, 'g')))
    .map((match) => parseItalianNumber(match[1]))
    .filter((value): value is number => value !== undefined);

export const isPlausibleMoney = (value: number | undefined, min = 100, max = 20000): value is number =>
  value !== undefined && value >= min && value <= max;

export const isPlausibleYear = (value: number | undefined): value is number =>
  value !== undefined && value >= 2020 && value <= 2035;

export const isPlausibleMonth = (value: number | undefined): value is number =>
  value !== undefined && value >= 1 && value <= 12;

export const isPlausibleDays = (value: number | undefined): value is number =>
  value !== undefined && value >= 0 && value <= 31;

export const isPlausibleHours = (value: number | undefined): value is number =>
  value !== undefined && value >= 0 && value <= 400;

export const createStructuredTextFromPlainText = (text: string): StructuredPdfText => {
  const reconstructedLines = text
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line, index) => ({
      page: 1,
      y: 1000 - index * 12,
      text: line.replace(/\s+/g, ' ').trim(),
      items: [
        {
          text: line.replace(/\s+/g, ' ').trim(),
          page: 1,
          x: 0,
          y: 1000 - index * 12,
        },
      ],
    }))
    .filter((line) => line.text);

  return {
    pages: 1,
    items: reconstructedLines.flatMap((line) => line.items),
    reconstructedLines,
    plainText: reconstructedLines.map((line) => line.text).join('\n'),
  };
};

export const buildId = (year?: number, month?: number): string => {
  const periodPart = isPlausibleYear(year) && isPlausibleMonth(month)
    ? `${year}_${String(month).padStart(2, '0')}`
    : 'period_unknown';
  return `payslip_${periodPart}_${Date.now()}`;
};

export const fieldConfidence = (
  confidence: PayslipFieldConfidence['confidence'],
  parserUsed: string,
  value?: string | number,
  sourceLabel?: string,
  page?: number
): PayslipFieldConfidence => ({
  value,
  sourceLabel,
  page,
  confidence,
  parserUsed,
});

export const cleanPersistablePayslip = (payslip: PayslipImport): PayslipImport => ({
  ...payslip,
  parsedLines: payslip.parsedLines.map(({ rawLine, ...line }) => line),
});

export const sumLineAmounts = (lines: PayslipLine[]): number =>
  round2(lines.reduce((total, line) => total + (getPayslipLineEconomicAmount(line) ?? 0), 0));
