import type { DriverPayrollValidationReport } from './driverValidationReportTypes';
import { mapPayrollValidationRunToDriverReport } from './driverValidationReportMapper';
import { createFiscalRuleIntegrationV1 } from './fiscalRuleIntegration';
import { payrollPeriodToRuleEffectiveDate } from './ruleEffectiveDate';
import {
  getAllChecks,
  PayrollValidationRegistryStatus,
} from './validationRegistry';
import { runPayrollValidation } from './validationRunner';
import type {
  CompanyProfileSnapshot,
  ContractSnapshot,
  HistorySnapshot,
  PayrollObservedSnapshot,
  PayrollValidationContext,
  PayrollValidationEvidence,
  PayrollValidationPeriod,
  PayrollValidationRunResult,
  PayrollValidationServices,
  WorkSnapshot,
} from './types';

export type PayrollValidationPipelineProfile = 'PRODUCTION' | 'DIAGNOSTIC';
export type PayrollValidationPipelineServiceSource =
  | 'NONE'
  | 'EXPLICIT'
  | 'FISCAL_V1';

export interface PayrollValidationPipelineInput {
  readonly payroll: PayrollObservedSnapshot;
  readonly period: PayrollValidationPeriod;
  readonly profile: PayrollValidationPipelineProfile;
  readonly services?: PayrollValidationServices;
  readonly useFiscalRuleIntegrationV1?: boolean;
  readonly clock?: () => string;
  readonly work?: WorkSnapshot;
  readonly contract?: ContractSnapshot;
  readonly history?: HistorySnapshot;
  readonly companyProfile?: CompanyProfileSnapshot;
  readonly manualEvidence?: ReadonlyArray<PayrollValidationEvidence>;
}

export interface PayrollValidationPipelineResult {
  readonly profile: PayrollValidationPipelineProfile;
  readonly selectedCheckIds: ReadonlyArray<string>;
  readonly technicalRun: PayrollValidationRunResult;
  readonly driverReport: DriverPayrollValidationReport;
  readonly executedAt: string;
  readonly serviceSource: PayrollValidationPipelineServiceSource;
}

export type PayrollValidationPipelineErrorCode =
  | 'SNAPSHOT_MISSING'
  | 'PERIOD_INVALID'
  | 'PROFILE_INVALID';

export class PayrollValidationPipelineError extends Error {
  readonly code: PayrollValidationPipelineErrorCode;

  constructor(code: PayrollValidationPipelineErrorCode, message: string) {
    super(message);
    this.name = 'PayrollValidationPipelineError';
    this.code = code;
  }
}

const deepClone = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map(deepClone) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, deepClone(item)])
    ) as T;
  }
  return value;
};

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

const assertInput = (
  input: Readonly<PayrollValidationPipelineInput>
): void => {
  if (!input.payroll) {
    throw new PayrollValidationPipelineError(
      'SNAPSHOT_MISSING',
      'PayrollObservedSnapshot obbligatorio per la pipeline.'
    );
  }
  if (input.profile !== 'PRODUCTION' && input.profile !== 'DIAGNOSTIC') {
    throw new PayrollValidationPipelineError(
      'PROFILE_INVALID',
      'Profilo pipeline non riconosciuto: usare PRODUCTION o DIAGNOSTIC.'
    );
  }
  try {
    payrollPeriodToRuleEffectiveDate(input.period);
  } catch {
    throw new PayrollValidationPipelineError(
      'PERIOD_INVALID',
      'PayrollValidationPeriod deve contenere anno e mese validi.'
    );
  }
};

const selectServices = (
  input: Readonly<PayrollValidationPipelineInput>
): {
  readonly services?: PayrollValidationServices;
  readonly source: PayrollValidationPipelineServiceSource;
} => {
  if (input.services !== undefined) {
    return { services: input.services, source: 'EXPLICIT' };
  }
  if (input.useFiscalRuleIntegrationV1 === true) {
    return {
      services: createFiscalRuleIntegrationV1().services,
      source: 'FISCAL_V1',
    };
  }
  return { source: 'NONE' };
};

export async function runDriverPayrollValidationPipeline(
  input: Readonly<PayrollValidationPipelineInput>
): Promise<PayrollValidationPipelineResult> {
  assertInput(input);
  const selectedEntries = getAllChecks().filter((entry) =>
    entry.status === PayrollValidationRegistryStatus.STABLE ||
    (
      input.profile === 'DIAGNOSTIC' &&
      entry.status === PayrollValidationRegistryStatus.EXPERIMENTAL
    )
  );
  const selectedCheckIds = selectedEntries.map((entry) => entry.id);
  const selectedServices = selectServices(input);
  const context: PayrollValidationContext = {
    payroll: input.payroll,
    period: input.period,
    services: selectedServices.services,
    work: input.work,
    contract: input.contract,
    history: input.history,
    companyProfile: input.companyProfile,
    manualEvidence: input.manualEvidence,
  };
  const technicalRun = await runPayrollValidation(
    context,
    selectedEntries.map((entry) => entry.check),
    { clock: input.clock }
  );
  const driverReport = mapPayrollValidationRunToDriverReport(technicalRun);
  const result: PayrollValidationPipelineResult = {
    profile: input.profile,
    selectedCheckIds,
    technicalRun: deepClone(technicalRun),
    driverReport,
    executedAt: technicalRun.executedAt,
    serviceSource: selectedServices.source,
  };

  return deepFreeze(result);
}
