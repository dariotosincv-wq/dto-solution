import type {
  DriverPayrollMonthlyComparisonBase,
  PayslipImport,
  PayslipLine,
} from './driverPayrollTypes';
import {
  getPayslipLineEconomicAmount,
  getPayslipLineQuantity,
  matchesPayslipLineSemantic,
  type PayslipLineSemanticSelector,
} from './driverPayrollLineValues';

export type DriverPayrollAnalysisMetricKey =
  | 'netAmount'
  | 'grossAmount'
  | 'travelDays'
  | 'overtimeHours'
  | 'bonusAmount'
  | 'vacationDays'
  | 'permitHours'
  | 'sicknessDays'
  | 'holidayDays';

export type DriverPayrollTrendKey = 'netAmount' | 'travelDays' | 'overtimeHours';

export interface DriverPayrollMonthlyAnalysis {
  payslipId: string;
  year: number;
  month: number;
  label: string;
  values: Partial<Record<DriverPayrollAnalysisMetricKey, number>>;
}

export interface DriverPayrollTrendMessage {
  key: DriverPayrollTrendKey;
  direction: 'up' | 'down';
  message: string;
}

export interface DriverPayrollHistoryAnalysis {
  totalPayslips: number;
  periodCovered?: string;
  firstPayslip?: DriverPayrollMonthlyAnalysis;
  lastPayslip?: DriverPayrollMonthlyAnalysis;
  averages: Partial<Record<DriverPayrollAnalysisMetricKey, number>>;
  monthly: DriverPayrollMonthlyAnalysis[];
  trends: DriverPayrollTrendMessage[];
  comparisonBase: DriverPayrollMonthlyComparisonBase[];
}

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

const metricCodes: Record<
  Exclude<DriverPayrollAnalysisMetricKey, 'netAmount' | 'grossAmount'>,
  { selector: PayslipLineSemanticSelector; valueKey: 'quantity' | 'amount' }
> = {
  travelDays: {
    selector: { canonicalKeys: ['payroll.travel_allowance'], categories: ['travel_allowance'], legacyCodes: ['2310'] },
    valueKey: 'quantity',
  },
  overtimeHours: {
    selector: { canonicalKeys: ['payroll.overtime', 'payroll.overtime.part_time_18'], categories: ['overtime'], legacyCodes: ['2030', '2014'] },
    valueKey: 'quantity',
  },
  bonusAmount: {
    selector: { canonicalKeys: ['payroll.performance_bonus'], categories: ['performance_bonus', 'production_bonus', 'generic_bonus'], legacyCodes: ['4009'] },
    valueKey: 'amount',
  },
  vacationDays: {
    selector: { canonicalKeys: ['payroll.vacation'], categories: ['vacation'], legacyCodes: ['5000'] },
    valueKey: 'quantity',
  },
  permitHours: {
    selector: { canonicalKeys: ['payroll.permission'], categories: ['permission'], legacyCodes: ['5050'] },
    valueKey: 'quantity',
  },
  sicknessDays: {
    selector: { categories: ['sickness', 'sickness_waiting_period', 'sickness_employer_supplement'], legacyCodes: ['1981', '2500', '2520', '2530', '2600'] },
    valueKey: 'quantity',
  },
  holidayDays: {
    selector: { canonicalKeys: ['payroll.holiday.paid', 'payroll.holiday.premium'], categories: ['paid_leave', 'holiday_premium'], legacyCodes: ['3900', '3901'] },
    valueKey: 'quantity',
  },
};

const isReliableLine = (line: PayslipLine) => (line.confidence ?? 100) >= 70;

const sumLines = (lines: PayslipLine[], selector: PayslipLineSemanticSelector, valueKey: 'quantity' | 'amount') => {
  const matching = lines.filter((line) => matchesPayslipLineSemantic(line, selector) && isReliableLine(line));
  if (matching.length === 0) return undefined;

  return matching.reduce(
    (total, line) =>
      total +
      (valueKey === 'quantity'
        ? getPayslipLineQuantity(line) ?? 0
        : getPayslipLineEconomicAmount(line) ?? 0),
    0
  );
};

const monthLabel = (month: number, year: number) => {
  if (!(month >= 1 && month <= 12) || !(year > 0)) return 'Periodo non riconosciuto';
  const name = month >= 1 && month <= 12 ? monthNames[month - 1] : 'Mese da verificare';
  return `${name} ${year || ''}`.trim();
};

const average = (values: Array<number | undefined>) => {
  const available = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (available.length === 0) return undefined;

  return available.reduce((total, value) => total + value, 0) / available.length;
};

const sortByPeriodAscending = (payslips: PayslipImport[]) =>
  [...payslips].sort((a, b) => {
    const aHasPeriod = a.year > 0 && a.month >= 1 && a.month <= 12;
    const bHasPeriod = b.year > 0 && b.month >= 1 && b.month <= 12;
    if (aHasPeriod !== bHasPeriod) return aHasPeriod ? -1 : 1;
    if (a.year !== b.year) return a.year - b.year;
    if (a.month !== b.month) return a.month - b.month;
    return new Date(a.importedAt).getTime() - new Date(b.importedAt).getTime();
  });

export const extractDriverPayrollMonthlyValues = (
  payslip: PayslipImport
): Partial<Record<DriverPayrollAnalysisMetricKey, number>> => {
  const values: Partial<Record<DriverPayrollAnalysisMetricKey, number>> = {};

  if (typeof payslip.summary.netAmount === 'number') values.netAmount = payslip.summary.netAmount;
  if (typeof payslip.summary.grossAmount === 'number') {
    values.grossAmount = payslip.summary.grossAmount;
  } else if (typeof payslip.summary.totalEarnings === 'number') {
    values.grossAmount = payslip.summary.totalEarnings;
  }

  Object.entries(metricCodes).forEach(([key, config]) => {
    const value = sumLines(payslip.parsedLines, config.selector, config.valueKey);
    if (typeof value === 'number') {
      values[key as DriverPayrollAnalysisMetricKey] = value;
    }
  });

  return values;
};

export const createDriverPayrollComparisonBase = (
  payslips: PayslipImport[]
): DriverPayrollMonthlyComparisonBase[] =>
  sortByPeriodAscending(payslips).map((payslip) => ({
    year: payslip.year,
    month: payslip.month,
    predicted: {},
    actual: extractDriverPayrollMonthlyValues(payslip),
    payslipImportId: payslip.id,
  }));

const calculateTrend = (
  monthly: DriverPayrollMonthlyAnalysis[],
  key: DriverPayrollTrendKey,
  upMessage: string,
  downMessage: string
): DriverPayrollTrendMessage | undefined => {
  const values = monthly
    .map((item) => item.values[key])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  if (values.length < 3) return undefined;

  const splitIndex = Math.ceil(values.length / 2);
  const firstAverage = average(values.slice(0, splitIndex));
  const lastAverage = average(values.slice(splitIndex));
  if (firstAverage === undefined || lastAverage === undefined || firstAverage === lastAverage) return undefined;

  const direction = lastAverage > firstAverage ? 'up' : 'down';
  return {
    key,
    direction,
    message: direction === 'up' ? upMessage : downMessage,
  };
};

export const analyzeDriverPayrollHistory = (payslips: PayslipImport[]): DriverPayrollHistoryAnalysis => {
  const sorted = sortByPeriodAscending(payslips);
  const monthly = sorted.map<DriverPayrollMonthlyAnalysis>((payslip) => ({
    payslipId: payslip.id,
    year: payslip.year,
    month: payslip.month,
    label: monthLabel(payslip.month, payslip.year),
    values: extractDriverPayrollMonthlyValues(payslip),
  }));

  const firstPayslip = monthly[0];
  const lastPayslip = monthly[monthly.length - 1];

  const metricKeys: DriverPayrollAnalysisMetricKey[] = [
    'netAmount',
    'grossAmount',
    'travelDays',
    'overtimeHours',
    'bonusAmount',
    'vacationDays',
    'permitHours',
    'sicknessDays',
    'holidayDays',
  ];

  const averages = metricKeys.reduce<Partial<Record<DriverPayrollAnalysisMetricKey, number>>>((acc, key) => {
    const value = average(monthly.map((item) => item.values[key]));
    if (value !== undefined) acc[key] = value;
    return acc;
  }, {});

  const trends = [
    calculateTrend(monthly, 'netAmount', 'Netto medio in aumento', 'Netto medio in diminuzione'),
    calculateTrend(monthly, 'travelDays', 'Trasferte in crescita', 'Trasferte in diminuzione'),
    calculateTrend(monthly, 'overtimeHours', 'Straordinari in crescita', 'Straordinari in calo'),
  ].filter((trend): trend is DriverPayrollTrendMessage => Boolean(trend));

  return {
    totalPayslips: sorted.length,
    periodCovered: firstPayslip && lastPayslip ? `${firstPayslip.label} - ${lastPayslip.label}` : undefined,
    firstPayslip,
    lastPayslip,
    averages,
    monthly,
    trends,
    comparisonBase: createDriverPayrollComparisonBase(sorted),
  };
};
