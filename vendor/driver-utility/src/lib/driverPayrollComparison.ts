import { createDriverPayrollComparisonBase } from './driverPayrollAnalysis';
import type {
  DriverPayrollComparisonMetricKey,
  DriverPayrollComparisonMetricValues,
  DriverPayrollMonthlyComparisonBase,
  PayrollPrediction,
  PayslipImport,
  PayslipLine,
} from './driverPayrollTypes';

export type DriverPayrollDifferenceSeverity = 'unavailable' | 'match' | 'small' | 'large';

export type DriverPayrollDifferenceCauseKind =
  | 'travel_allowance'
  | 'holiday'
  | 'overtime'
  | 'permit'
  | 'sickness'
  | 'bonus'
  | 'gross'
  | 'net'
  | 'ccnl_rule';

export interface DriverPayrollDifferenceExplanationSeed {
  kind: DriverPayrollDifferenceCauseKind;
  label: string;
  ruleCategory?: string;
  ccnlRuleCandidateIds: string[];
}

export interface DriverPayrollComparisonThreshold {
  small: number;
  large: number;
}

export type DriverPayrollComparisonThresholds = Partial<
  Record<DriverPayrollComparisonMetricKey, DriverPayrollComparisonThreshold>
>;

export interface DriverPayrollComparisonRow {
  key: DriverPayrollComparisonMetricKey;
  label: string;
  predicted?: number;
  actual?: number;
  difference?: number;
  severity: DriverPayrollDifferenceSeverity;
  explanationSeeds: DriverPayrollDifferenceExplanationSeed[];
}

export interface DriverPayrollComparisonResult {
  year: number;
  month: number;
  label: string;
  rows: DriverPayrollComparisonRow[];
  source: DriverPayrollMonthlyComparisonBase;
}

export const driverPayrollComparisonMetricLabels: Record<DriverPayrollComparisonMetricKey, string> = {
  grossAmount: 'Lordo',
  netAmount: 'Netto',
  travelDays: 'Trasferte',
  overtimeHours: 'Straordinari',
  bonusAmount: 'Premi',
  holidayDays: 'Festivita',
  vacationDays: 'Ferie',
  permitHours: 'Permessi',
  sicknessDays: 'Malattie',
};

export const driverPayrollComparisonMetricOrder: DriverPayrollComparisonMetricKey[] = [
  'travelDays',
  'overtimeHours',
  'bonusAmount',
  'holidayDays',
  'vacationDays',
  'permitHours',
  'sicknessDays',
];

const monthNames = [
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre',
];

const defaultThresholds: Record<DriverPayrollComparisonMetricKey, DriverPayrollComparisonThreshold> = {
  grossAmount: { small: 5, large: 50 },
  netAmount: { small: 5, large: 50 },
  travelDays: { small: 1, large: 2 },
  overtimeHours: { small: 0.5, large: 2 },
  bonusAmount: { small: 5, large: 50 },
  holidayDays: { small: 0.5, large: 1 },
  vacationDays: { small: 0.5, large: 1 },
  permitHours: { small: 0.5, large: 2 },
  sicknessDays: { small: 0.5, large: 1 },
};

const lineMetricCodes: Partial<Record<DriverPayrollComparisonMetricKey, { codes: string[]; valueKey: 'quantity' | 'amount' }>> = {
  bonusAmount: { codes: ['4009', '5340', '5390', '5963'], valueKey: 'amount' },
};

const sumPredictionLines = (lines: PayslipLine[], key: DriverPayrollComparisonMetricKey) => {
  const config = lineMetricCodes[key];
  if (!config) return undefined;
  const matching = lines.filter((line) => line.code && config.codes.includes(line.code));
  if (matching.length === 0) return undefined;
  return matching.reduce((total, line) => total + (line[config.valueKey] ?? 0), 0);
};

const getMonthLabel = (month: number, year: number) => {
  const name = month >= 1 && month <= 12 ? monthNames[month - 1] : 'Mese da verificare';
  return `${name} ${year || ''}`.trim();
};

const periodKey = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;

export const extractDriverPayrollPredictedValues = (
  prediction: PayrollPrediction
): DriverPayrollComparisonMetricValues => {
  const values: DriverPayrollComparisonMetricValues = {};
  const input = prediction.inputSnapshot;

  if (typeof input.eligibleTravelDays === 'number') values.travelDays = input.eligibleTravelDays;
  if (typeof input.overtime30Hours === 'number' || typeof input.overtime50Hours === 'number') {
    values.overtimeHours = (input.overtime30Hours ?? 0) + (input.overtime50Hours ?? 0);
  }
  if (typeof input.holidaysWorked === 'number') values.holidayDays = input.holidaysWorked;
  if (typeof input.vacationDays === 'number') values.vacationDays = input.vacationDays;
  if (typeof input.parHours === 'number') values.permitHours = input.parHours;
  if (typeof input.sicknessDays === 'number') values.sicknessDays = input.sicknessDays;

  const bonusAmount = sumPredictionLines(prediction.predictedLines, 'bonusAmount');
  if (typeof bonusAmount === 'number') values.bonusAmount = bonusAmount;

  return values;
};

export const createDriverPayrollComparisonBaseFromLocalData = (
  payslips: PayslipImport[],
  predictions: PayrollPrediction[] = []
): DriverPayrollMonthlyComparisonBase[] => {
  const byPeriod = new Map<string, DriverPayrollMonthlyComparisonBase>();

  createDriverPayrollComparisonBase(payslips).forEach((entry) => {
    byPeriod.set(periodKey(entry.year, entry.month), entry);
  });

  predictions.forEach((prediction) => {
    const key = periodKey(prediction.year, prediction.month);
    const existing = byPeriod.get(key);
    byPeriod.set(key, {
      year: prediction.year,
      month: prediction.month,
      actual: existing?.actual ?? {},
      predicted: extractDriverPayrollPredictedValues(prediction),
      predictionId: prediction.id,
      payslipImportId: existing?.payslipImportId,
    });
  });

  return Array.from(byPeriod.values()).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });
};

const getSeverity = (
  key: DriverPayrollComparisonMetricKey,
  predicted: number | undefined,
  actual: number | undefined,
  thresholds: DriverPayrollComparisonThresholds
): DriverPayrollDifferenceSeverity => {
  if (predicted === undefined || actual === undefined) return 'unavailable';

  const diff = Math.abs(actual - predicted);
  const threshold = thresholds[key] ?? defaultThresholds[key];
  if (diff === 0) return 'match';
  if (diff <= threshold.small) return 'small';
  if (diff > threshold.large) return 'large';
  return 'small';
};

const getExplanationSeeds = (key: DriverPayrollComparisonMetricKey): DriverPayrollDifferenceExplanationSeed[] => {
  const common = { ccnlRuleCandidateIds: [] };

  const map: Record<DriverPayrollComparisonMetricKey, DriverPayrollDifferenceExplanationSeed[]> = {
    grossAmount: [{ ...common, kind: 'gross', label: 'Regola CCNL', ruleCategory: 'base_pay' }],
    netAmount: [{ ...common, kind: 'net', label: 'Regola CCNL', ruleCategory: 'tax' }],
    travelDays: [{ ...common, kind: 'travel_allowance', label: 'Trasferta diversa', ruleCategory: 'allowance' }],
    overtimeHours: [{ ...common, kind: 'overtime', label: 'Straordinario', ruleCategory: 'overtime' }],
    bonusAmount: [{ ...common, kind: 'bonus', label: 'Premio', ruleCategory: 'bonus' }],
    holidayDays: [{ ...common, kind: 'holiday', label: 'Festivita', ruleCategory: 'holiday' }],
    vacationDays: [{ ...common, kind: 'ccnl_rule', label: 'Regola CCNL', ruleCategory: 'absence' }],
    permitHours: [{ ...common, kind: 'permit', label: 'Permesso', ruleCategory: 'absence' }],
    sicknessDays: [{ ...common, kind: 'sickness', label: 'Malattia', ruleCategory: 'sickness' }],
  };

  return map[key];
};

export const compareDriverPayrollMonth = (
  source: DriverPayrollMonthlyComparisonBase,
  thresholds: DriverPayrollComparisonThresholds = {}
): DriverPayrollComparisonResult => {
  const rows = driverPayrollComparisonMetricOrder.map<DriverPayrollComparisonRow>((key) => {
    const predicted = source.predicted[key];
    const actual = source.actual[key];
    const difference = predicted !== undefined && actual !== undefined ? actual - predicted : undefined;
    const severity = getSeverity(key, predicted, actual, thresholds);

    return {
      key,
      label: driverPayrollComparisonMetricLabels[key],
      predicted,
      actual,
      difference,
      severity,
      explanationSeeds: severity === 'large' ? getExplanationSeeds(key) : [],
    };
  });

  return {
    year: source.year,
    month: source.month,
    label: getMonthLabel(source.month, source.year),
    rows,
    source,
  };
};
