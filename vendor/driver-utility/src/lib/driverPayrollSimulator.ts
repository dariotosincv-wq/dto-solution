import { buildPayrollMonthInput, type DriverAttendanceDay } from './driverPayrollAttendance';
import {
  DEFAULT_DRIVER_CONTRACT_PROFILE,
  DRIVER_CONTRACT_PROFILE_STORAGE_KEY,
  normalizeDriverContractProfile,
} from './driverContractProfile';
import { DEFAULT_DRIVER_PAYROLL_COMPANY_PROFILES, GENERIC_LOGISTICS_DL05_PROFILE } from './driverPayrollCompanyProfiles';
import { estimateDriverPayroll } from './driverPayrollEngine';
import { DRIVER_PAYROLL_BASE_RULES } from './driverPayrollRules';
import ccnlExplanationRules from './driverPayrollCcnlRules.json';
import type {
  DriverPayrollCompanyProfile,
  DriverPayrollEstimateOptions,
  DriverPayrollEstimateResult,
  DriverPayrollManualLine,
  PayrollMonthInput,
  PayrollPrediction,
} from './driverPayrollTypes';

export const DRIVER_ATTENDANCE_STORAGE_KEY = 'attendance';

export type DriverPayrollSimulatorManualLineKind =
  | 'authorized_overtime'
  | 'expense_reimbursement'
  | 'damage_deduction'
  | 'advance_recovery'
  | 'manual_bonus'
  | 'manual_deduction'
  | 'other_positive'
  | 'other_negative';

export interface DriverPayrollSimulatorManualLine {
  id: string;
  kind: DriverPayrollSimulatorManualLineKind;
  description: string;
  amount: number;
  type: 'earning' | 'deduction';
}

export interface DriverPayrollSimulatorOptions {
  year: number;
  month: number;
  attendance: Record<string, DriverAttendanceDay>;
  companyProfile?: DriverPayrollCompanyProfile;
  manualLines?: DriverPayrollSimulatorManualLine[];
  authorizedOvertime30Hours?: number;
  authorizedOvertime50Hours?: number;
  overtime30HourlyAmount?: number;
  overtime50HourlyAmount?: number;
}

export interface DriverPayrollSimulatorEventSummary {
  workedDays: number;
  vacationDays: number;
  permitDays: number;
  permitHours: number;
  sicknessDays: number;
  injuryDays: number;
  restDays: number;
  abortDays: number;
  medicalVisitDays: number;
  sundaysWorked: number;
  holidaysWorked: number;
  holidaysNotWorked: number;
  exHolidayDays: number;
  authorizedOvertimeHours: number;
}

export interface DriverPayrollSimulationResult {
  input: PayrollMonthInput;
  estimate: DriverPayrollEstimateResult;
  eventSummary: DriverPayrollSimulatorEventSummary;
  prediction: PayrollPrediction;
  rulesSnapshot: {
    payrollRules: number;
    ccnlExplanationRules: number;
    companyProfileId: string;
  };
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const getStatusCount = (input: PayrollMonthInput, status: string) =>
  input.attendanceEvents.filter((event) => event.status === status).length;

const mapManualLineKind = (kind: DriverPayrollSimulatorManualLineKind): DriverPayrollManualLine['kind'] => {
  if (kind === 'expense_reimbursement' || kind === 'other_positive') return 'expense_reimbursement';
  if (kind === 'damage_deduction') return 'damage_deduction';
  if (kind === 'advance_recovery') return 'advance_recovery';
  if (kind === 'manual_bonus' || kind === 'authorized_overtime') return 'manual_bonus';
  return 'manual_deduction';
};

const toEstimateManualLines = (manualLines: DriverPayrollSimulatorManualLine[] = []): DriverPayrollManualLine[] =>
  manualLines
    .filter((line) => line.description.trim() && Number.isFinite(line.amount) && line.amount > 0)
    .map((line) => ({
      id: line.id,
      kind: mapManualLineKind(line.kind),
      label: line.description.trim(),
      amount: round2(Math.abs(line.amount)),
      type: line.type,
    }));

const createPredictionId = (year: number, month: number) => `driver_payroll_prediction_${year}_${String(month + 1).padStart(2, '0')}`;

export const readDriverAttendanceFromLocalStorage = (): Record<string, DriverAttendanceDay> => {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(DRIVER_ATTENDANCE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

export const readDriverContractProfileFromLocalStorage = () => {
  if (typeof window === 'undefined') return DEFAULT_DRIVER_CONTRACT_PROFILE;
  try {
    const raw = window.localStorage.getItem(DRIVER_CONTRACT_PROFILE_STORAGE_KEY);
    return normalizeDriverContractProfile(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_DRIVER_CONTRACT_PROFILE;
  }
};

export const createDriverPayrollSimulation = (options: DriverPayrollSimulatorOptions): DriverPayrollSimulationResult => {
  const companyProfile = options.companyProfile ?? DEFAULT_DRIVER_PAYROLL_COMPANY_PROFILES[0] ?? GENERIC_LOGISTICS_DL05_PROFILE;
  const input = buildPayrollMonthInput({
    year: options.year,
    month: options.month,
    attendance: options.attendance,
    theoreticalHoursPerDay: 8,
    contractProfile: readDriverContractProfileFromLocalStorage(),
  });

  const estimateOptions: DriverPayrollEstimateOptions = {
    manualLines: toEstimateManualLines(options.manualLines),
    authorizedOvertime30Hours: options.authorizedOvertime30Hours,
    authorizedOvertime50Hours: options.authorizedOvertime50Hours,
    overtime30HourlyAmount: options.overtime30HourlyAmount,
    overtime50HourlyAmount: options.overtime50HourlyAmount,
  };
  const estimate = estimateDriverPayroll(input, companyProfile, estimateOptions);
  const authorizedOvertimeHours = (options.authorizedOvertime30Hours ?? input.overtime30Hours) + (options.authorizedOvertime50Hours ?? input.overtime50Hours);

  const eventSummary: DriverPayrollSimulatorEventSummary = {
    workedDays: input.workedDays,
    vacationDays: input.vacationDays,
    permitDays: getStatusCount(input, 'par'),
    permitHours: input.parHours,
    sicknessDays: input.sicknessDays,
    injuryDays: input.injuryDays,
    restDays: getStatusCount(input, 'rest'),
    abortDays: input.abortDays,
    medicalVisitDays: getStatusCount(input, 'medical_visit'),
    sundaysWorked: input.sundaysWorked,
    holidaysWorked: input.holidaysWorked,
    holidaysNotWorked: getStatusCount(input, 'holiday_not_worked'),
    exHolidayDays: getStatusCount(input, 'ex_holiday'),
    authorizedOvertimeHours,
  };

  const prediction: PayrollPrediction = {
    id: createPredictionId(options.year, options.month),
    year: options.year,
    month: options.month + 1,
    createdAt: new Date().toISOString(),
    inputSnapshot: {
      ...input,
      month: input.month + 1,
      overtime30Hours: options.authorizedOvertime30Hours ?? input.overtime30Hours,
      overtime50Hours: options.authorizedOvertime50Hours ?? input.overtime50Hours,
    },
    predictedLines: estimate.predictedLines,
    predictedSummary: estimate.summary,
    confidence: estimate.confidenceScore,
    assumptions: [
      'Stima generata dai Turni Driver locali.',
      `Profilo aziendale: ${companyProfile.name}.`,
    ],
    missingData: estimate.requiresManualInputs,
  };

  return {
    input,
    estimate,
    eventSummary,
    prediction,
    rulesSnapshot: {
      payrollRules: DRIVER_PAYROLL_BASE_RULES.length,
      ccnlExplanationRules: (ccnlExplanationRules as unknown[]).length,
      companyProfileId: companyProfile.id,
    },
  };
};
