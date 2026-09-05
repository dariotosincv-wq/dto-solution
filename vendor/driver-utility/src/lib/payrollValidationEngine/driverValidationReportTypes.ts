import type {
  PayrollValidationEvidence,
  PayrollValidationJsonValue,
  PayrollValidationMissingInput,
  PayrollValidationRuleSource,
  PayrollValidationRunnerError,
  PayrollValidationValue,
} from './types';

export type DriverPayrollValidationOverallStatus =
  | 'OK'
  | 'ATTENTION'
  | 'ISSUE'
  | 'INCOMPLETE';

export type DriverPayrollValidationUserStatus =
  | 'CORRECT'
  | 'CHECK'
  | 'PROBLEM'
  | 'INFORMATION';

export type DriverPayrollValidationIndicator =
  | 'GREEN'
  | 'YELLOW'
  | 'RED'
  | 'BLUE';

export interface DriverPayrollValidationReadableValue {
  readonly text: string;
  readonly unit?: string;
}

export interface DriverPayrollValidationSummary {
  readonly totalResults: number;
  readonly correctCount: number;
  readonly checkCount: number;
  readonly problemCount: number;
  readonly informationCount: number;
  readonly technicalProblemCount: number;
  readonly overallStatus: DriverPayrollValidationOverallStatus;
  readonly message: string;
}

export interface DriverPayrollValidationItem {
  readonly title: string;
  readonly userStatus: DriverPayrollValidationUserStatus;
  readonly indicator: DriverPayrollValidationIndicator;
  readonly checked: string;
  readonly expected?: DriverPayrollValidationReadableValue;
  readonly actual?: DriverPayrollValidationReadableValue;
  readonly difference?: DriverPayrollValidationReadableValue;
  readonly tolerance?: DriverPayrollValidationReadableValue;
  readonly shortExplanation: string;
  readonly detailedExplanation: string;
  readonly suggestion: string;
  readonly missingInformation: ReadonlyArray<string>;
}

export interface DriverPayrollValidationTechnicalDetail {
  readonly checkId: string;
  readonly version: string;
  readonly category: string;
  readonly confidence: number;
  readonly evidence: ReadonlyArray<PayrollValidationEvidence>;
  readonly missingInputs: ReadonlyArray<PayrollValidationMissingInput>;
  readonly ruleSource?: PayrollValidationRuleSource;
  readonly expected?: PayrollValidationValue;
  readonly actual?: PayrollValidationValue;
  readonly difference?: PayrollValidationValue;
  readonly tolerance?: PayrollValidationValue;
  readonly executedAt: string;
  readonly metadata?: Readonly<Record<string, PayrollValidationJsonValue>>;
}

export interface DriverPayrollValidationTechnicalLevel {
  readonly runExecutedAt: string;
  readonly executedChecks: number;
  readonly skippedChecks: number;
  readonly internalErrors: ReadonlyArray<PayrollValidationRunnerError>;
  readonly items: ReadonlyArray<DriverPayrollValidationTechnicalDetail>;
}

export interface DriverPayrollValidationTechnicalProblem {
  readonly message: string;
}

export interface DriverPayrollValidationReport {
  readonly summary: DriverPayrollValidationSummary;
  readonly items: ReadonlyArray<DriverPayrollValidationItem>;
  readonly technicalProblems: ReadonlyArray<DriverPayrollValidationTechnicalProblem>;
  readonly technical: DriverPayrollValidationTechnicalLevel;
}
