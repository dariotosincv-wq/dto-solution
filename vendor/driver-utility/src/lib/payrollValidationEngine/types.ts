import type { RuleResolver } from './ruleEngine/types';
import type { PayrollFiscalUnit } from '../driverPayrollFiscalTypes';

/**
 * Esito ufficiale di un controllo del Payroll Validation Engine.
 *
 * PASS: controllo eseguito con dati sufficienti e risultato coerente.
 * WARNING: dato ambiguo, differenza contenuta, regola non certificata oppure
 * affidabilità insufficiente per dichiarare un errore.
 * FAIL: differenza concreta rilevata mediante dati e regole sufficientemente affidabili.
 * INFO: controllo non applicabile oppure non eseguibile per dati mancanti.
 *
 * La mancanza di dati non deve essere rappresentata automaticamente come PASS o FAIL.
 */
export type PayrollValidationStatus = 'PASS' | 'WARNING' | 'FAIL' | 'INFO';

export const PAYROLL_VALIDATION_CATEGORIES = {
  PRESENCE: 'PRESENCE',
  WORKING_TIME: 'WORKING_TIME',
  TRAVEL_ALLOWANCE: 'TRAVEL_ALLOWANCE',
  PREMIUM: 'PREMIUM',
  ABSENCE: 'ABSENCE',
  COMPENSATION: 'COMPENSATION',
  CONTRACT: 'CONTRACT',
  ECONOMIC: 'ECONOMIC',
  FISCAL: 'FISCAL',
  TAX: 'TAX',
  TFR: 'TFR',
  HISTORY: 'HISTORY',
  COMPLETENESS: 'COMPLETENESS',
} as const;

export type OfficialPayrollValidationCategory =
  typeof PAYROLL_VALIDATION_CATEGORIES[keyof typeof PAYROLL_VALIDATION_CATEGORIES];

export type PayrollValidationCategory =
  | OfficialPayrollValidationCategory
  | `CUSTOM:${string}`;

export type PayrollValidationNumericUnit =
  | 'EUR'
  | 'HOURS'
  | 'DAYS'
  | 'QUANTITY'
  | 'PERCENT';

export type PayrollValidationUnavailableReason =
  | 'MISSING'
  | 'NOT_DETERMINABLE'
  | 'NOT_APPLICABLE';

export type PayrollValidationValue =
  | {
      readonly kind: 'NUMBER';
      readonly value: number;
      readonly unit: PayrollValidationNumericUnit;
    }
  | {
      readonly kind: 'TEXT';
      readonly value: string;
    }
  | {
      readonly kind: 'BOOLEAN';
      readonly value: boolean;
    }
  | {
      readonly kind: 'UNAVAILABLE';
      readonly reason: PayrollValidationUnavailableReason;
      readonly description?: string;
    };

export type PayrollValidationEvidenceSource =
  | 'PAYROLL'
  | 'WORK_SHIFTS'
  | 'CONTRACT'
  | 'COMPANY_PROFILE'
  | 'HISTORY'
  | 'CALCULATION'
  | 'MANUAL_INPUT';

export interface PayrollValidationEvidence {
  readonly id: string;
  readonly source: PayrollValidationEvidenceSource;
  readonly description: string;
  readonly value?: PayrollValidationValue;
  readonly period?: PayrollValidationPeriod;
  readonly date?: string;
  readonly confidence: number;
  readonly technicalReference?: string;
}

export type PayrollValidationMissingInputEffect =
  | 'BLOCKS_CHECK'
  | 'REDUCES_CONFIDENCE'
  | 'LIMITS_SCOPE';

export interface PayrollValidationMissingInput {
  readonly id: string;
  readonly description: string;
  readonly required: boolean;
  readonly effect: PayrollValidationMissingInputEffect;
}

export type PayrollValidationRuleSourceType =
  | 'CCNL'
  | 'LAW'
  | 'CALCULATION'
  | 'COMPANY_PROFILE'
  | 'PAYROLL_OBSERVED'
  | 'HISTORY'
  | 'MANUAL';

export type PayrollValidationRuleStatus =
  | 'CONFIRMED'
  | 'ESTIMATED'
  | 'REQUIRES_VERIFICATION';

export interface PayrollValidationRuleSource {
  readonly id: string;
  readonly version: string;
  readonly sourceType: PayrollValidationRuleSourceType;
  readonly validFrom?: string;
  readonly validTo?: string;
  readonly status: PayrollValidationRuleStatus;
  readonly documentReference?: string;
  readonly confidence: number;
}

export type PayrollValidationJsonPrimitive = string | number | boolean | null;
export type PayrollValidationJsonValue =
  | PayrollValidationJsonPrimitive
  | ReadonlyArray<PayrollValidationJsonValue>
  | { readonly [key: string]: PayrollValidationJsonValue };

export interface PayrollValidationResult {
  readonly id: string;
  readonly checkVersion: string;
  readonly title: string;
  readonly category: PayrollValidationCategory;
  readonly status: PayrollValidationStatus;
  readonly expectedValue?: PayrollValidationValue;
  readonly actualValue?: PayrollValidationValue;
  readonly difference?: PayrollValidationValue;
  readonly tolerance?: PayrollValidationValue;
  readonly shortExplanation: string;
  readonly detailedExplanation: string;
  readonly confidence: number;
  readonly suggestion?: string;
  readonly evidence: ReadonlyArray<PayrollValidationEvidence>;
  readonly missingInputs: ReadonlyArray<PayrollValidationMissingInput>;
  readonly ruleSource?: PayrollValidationRuleSource;
  readonly executedAt: string;
  readonly metadata?: Readonly<Record<string, PayrollValidationJsonValue>>;
}

export interface PayrollValidationPeriod {
  readonly year?: number;
  readonly month?: number;
  readonly label?: string;
}

export interface PayrollEmploymentRelationship {
  readonly relationshipId?: string;
  readonly companyId?: string;
  readonly companyName?: string;
  readonly driverProfileId?: string;
  readonly siteCode?: string;
  readonly siteCostCenter?: string;
  readonly costCenterCode?: string;
  readonly costCenterDescription?: string;
  readonly activityCode?: string;
}

export type PayrollSnapshotQuantityUnit =
  | 'EUR'
  | 'HOURS'
  | 'DAYS'
  | 'MONTHS'
  | 'QUANTITY'
  | 'PERCENT'
  | 'UNKNOWN';

export type PayrollObservedEconomicType =
  | 'earning'
  | 'deduction'
  | 'neutral'
  | 'informational';

export interface PayrollObservedLine {
  readonly canonicalKey: string;
  readonly description: string;
  readonly originalCode?: string;
  readonly originalDescription?: string;
  readonly category?: string;
  readonly economicType?: PayrollObservedEconomicType;
  readonly quantity?: number;
  readonly quantityUnit?: PayrollSnapshotQuantityUnit;
  readonly unitValue?: number;
  readonly earningAmount?: number;
  readonly deductionAmount?: number;
  readonly informationalValue?: number;
  readonly confidence: number;
  readonly provenance: ReadonlyArray<PayrollValidationEvidence>;
}

export interface PayrollObservedEconomicSummary {
  readonly totalEarnings?: number;
  readonly totalDeductions?: number;
  readonly netAmount?: number;
  readonly grossAmount?: number;
  readonly rounding?: number;
  readonly paymentDate?: string;
  readonly fieldConfidence?: {
    readonly totalEarnings?: number;
    readonly totalDeductions?: number;
    readonly netAmount?: number;
  };
}

export interface PayrollObservedFiscalSummary {
  readonly socialSecurityTaxable?: number;
  readonly employeeSocialContributions?: number;
  readonly incomeTaxTaxable?: number;
  readonly grossIncomeTax?: number;
  readonly workDeductions?: number;
  readonly familyDeductions?: number;
  readonly additionalDeductions?: number;
  readonly taxCredits?: number;
  readonly incomeTaxWithheld?: number;
  readonly taxAdjustment?: number;
  readonly regionalTax?: number;
  readonly municipalTax?: number;
  readonly municipalTaxAdvance?: number;
  readonly bilateralEmployeeContributions?: number;
  readonly bilateralEmployerContributions?: number;
  readonly fiscalDays?: number;
  readonly tfrUsefulSalary?: number;
  readonly tfrMonthlyAccrual?: number;
  readonly tfrProgressiveAccrual?: number;
  readonly tfrOverallAccrual?: number;
  readonly tfrRevaluation?: number;
  readonly tfrRevaluationTax?: number;
  readonly tfrPensionFundContribution?: number;
  readonly tfrDestination?: string;
}

export type PayrollObservedFiscalPeriod =
  | 'monthly'
  | 'progressive'
  | 'annual'
  | 'previous_employment'
  | 'adjustment'
  | 'unknown_period';

export type PayrollObservedFiscalSource =
  | 'fiscal_section'
  | 'payroll_line'
  | 'summary'
  | 'progressive_section'
  | 'derived'
  | 'unknown';

export type PayrollObservedFiscalExtractionMethod =
  | 'label_catalog'
  | 'geometric_column'
  | 'payroll_line'
  | 'derived'
  | 'unknown';

/**
 * PayrollFiscalValue non espone ancora un'unità sorgente. UNSPECIFIED preserva
 * esplicitamente questa assenza senza dedurre l'unità dal nome del campo.
 */
export type PayrollObservedFiscalUnit = PayrollFiscalUnit;

export type PayrollObservedFiscalClassificationStatus =
  | 'CLASSIFIED'
  | 'UNCLASSIFIED';

export interface PayrollObservedFiscalValue {
  readonly canonicalField?: string;
  readonly value?: number | string;
  readonly unit: PayrollObservedFiscalUnit;
  readonly classificationStatus: PayrollObservedFiscalClassificationStatus;
  readonly fiscalPeriod: PayrollObservedFiscalPeriod;
  readonly source: PayrollObservedFiscalSource;
  readonly confidence: number;
  readonly ambiguous?: boolean;
  readonly rawText?: string;
  readonly page?: number;
  readonly section?: string;
  readonly extractionMethod: PayrollObservedFiscalExtractionMethod;
  readonly alternatives?: ReadonlyArray<string>;
  readonly provenance: ReadonlyArray<PayrollValidationEvidence>;
}

export interface PayrollObservedFiscalObservations {
  readonly schemaVersion: 'fiscal-v1';
  readonly period?: {
    readonly month?: number;
    readonly year?: number;
  };
  readonly values: ReadonlyArray<PayrollObservedFiscalValue>;
  readonly warnings: ReadonlyArray<string>;
}

export interface PayrollObservedSnapshot {
  readonly period: PayrollValidationPeriod;
  readonly relationship?: PayrollEmploymentRelationship;
  readonly level?: string;
  readonly lines: ReadonlyArray<PayrollObservedLine>;
  readonly economicSummary: PayrollObservedEconomicSummary;
  readonly fiscalSummary?: PayrollObservedFiscalSummary;
  readonly fiscalObservations?: PayrollObservedFiscalObservations;
  readonly confidence: number;
  readonly provenance: ReadonlyArray<PayrollValidationEvidence>;
}

export interface WorkSnapshot {
  readonly period: PayrollValidationPeriod;
  readonly workedDays?: number;
  readonly ordinaryHours?: number;
  readonly effectiveHours?: number;
  readonly overtimeHours?: number;
  readonly eligibleTravelDays?: number;
  readonly sundaysWorked?: number;
  readonly holidaysWorked?: number;
  readonly holidaysNotWorked?: number;
  readonly vacationDays?: number;
  readonly permitHours?: number;
  readonly sicknessDays?: number;
  readonly injuryDays?: number;
  readonly incompleteEventCount: number;
  readonly confidence: number;
  readonly provenance: ReadonlyArray<PayrollValidationEvidence>;
}

export interface ContractEconomicParameter {
  readonly id: string;
  readonly value: PayrollValidationValue;
  readonly validFrom?: string;
  readonly validTo?: string;
  readonly confidence: number;
}

export interface ContractSnapshot {
  readonly contractId: string;
  readonly contractName?: string;
  readonly level?: string;
  readonly employmentType?: string;
  readonly validFrom?: string;
  readonly validTo?: string;
  readonly economicParameters: ReadonlyArray<ContractEconomicParameter>;
  readonly applicableRules: ReadonlyArray<PayrollValidationRuleSource>;
  readonly sources: ReadonlyArray<PayrollValidationEvidence>;
  readonly confidence: number;
}

export interface PayrollHistoryPeriod {
  readonly period: PayrollValidationPeriod;
  readonly payrollId?: string;
  readonly comparable: boolean;
  readonly confidence: number;
}

export interface PayrollHistorySeriesPoint {
  readonly period: PayrollValidationPeriod;
  readonly value: PayrollValidationValue;
  readonly confidence: number;
}

export interface PayrollHistorySeries {
  readonly canonicalKey: string;
  readonly points: ReadonlyArray<PayrollHistorySeriesPoint>;
}

export interface PayrollHistoryRelationshipChange {
  readonly date?: string;
  readonly description: string;
  readonly confidence: number;
}

export interface HistorySnapshot {
  readonly availablePeriods: ReadonlyArray<PayrollValidationPeriod>;
  readonly comparablePayrolls: ReadonlyArray<PayrollHistoryPeriod>;
  readonly series: ReadonlyArray<PayrollHistorySeries>;
  readonly relationshipChanges: ReadonlyArray<PayrollHistoryRelationshipChange>;
  readonly missingPeriods: ReadonlyArray<PayrollValidationPeriod>;
  readonly confidence: number;
}

export interface CompanyProfileRate {
  readonly id: string;
  readonly value: PayrollValidationValue;
  readonly validFrom?: string;
  readonly validTo?: string;
  readonly confidence: number;
}

export interface CompanyProfileSnapshot {
  readonly companyId?: string;
  readonly companyName: string;
  readonly configurations: Readonly<Record<string, PayrollValidationJsonValue>>;
  readonly rates: ReadonlyArray<CompanyProfileRate>;
  readonly validFrom?: string;
  readonly validTo?: string;
  readonly provenance: ReadonlyArray<PayrollValidationEvidence>;
  readonly confidence: number;
}

export interface PayrollValidationContext {
  readonly period?: PayrollValidationPeriod;
  readonly payroll?: PayrollObservedSnapshot;
  readonly work?: WorkSnapshot;
  readonly contract?: ContractSnapshot;
  readonly history?: HistorySnapshot;
  readonly companyProfile?: CompanyProfileSnapshot;
  readonly manualEvidence?: ReadonlyArray<PayrollValidationEvidence>;
  readonly services?: PayrollValidationServices;
}

export interface PayrollValidationServices {
  readonly ruleResolver?: RuleResolver;
}

export interface PayrollValidationInputRequirement {
  readonly id: string;
  readonly description: string;
}

export interface PayrollValidationApplicability {
  readonly description: string;
  readonly evaluate: (context: Readonly<PayrollValidationContext>) => boolean;
}

export type PayrollValidationCheckExecution =
  | PayrollValidationResult
  | Promise<PayrollValidationResult>;

export interface PayrollValidationCheck {
  readonly id: string;
  readonly version: string;
  readonly title: string;
  readonly category: PayrollValidationCategory;
  readonly requiredInputs: ReadonlyArray<PayrollValidationInputRequirement>;
  readonly optionalInputs: ReadonlyArray<PayrollValidationInputRequirement>;
  readonly applicability: PayrollValidationApplicability;
  readonly execute: (
    context: Readonly<PayrollValidationContext>
  ) => PayrollValidationCheckExecution;
}

export type PayrollValidationRunnerErrorStage =
  | 'APPLICABILITY'
  | 'EXECUTION';

export interface PayrollValidationRunnerError {
  readonly checkId: string;
  readonly checkVersion: string;
  readonly stage: PayrollValidationRunnerErrorStage;
  readonly errorName: string;
  readonly message: string;
}

export interface PayrollValidationRunResult {
  readonly results: ReadonlyArray<PayrollValidationResult>;
  readonly executedAt: string;
  readonly executedChecks: number;
  readonly skippedChecks: number;
  readonly passCount: number;
  readonly warningCount: number;
  readonly failCount: number;
  readonly infoCount: number;
  readonly internalErrors: ReadonlyArray<PayrollValidationRunnerError>;
}
