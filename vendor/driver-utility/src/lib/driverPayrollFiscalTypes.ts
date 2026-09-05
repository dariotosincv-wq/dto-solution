import type { PayslipLine } from './driverPayrollTypes';
import type { PayrollValidationResult } from './driverPayrollValidation';

export type PayrollFiscalPeriod =
  | 'monthly'
  | 'progressive'
  | 'annual'
  | 'previous_employment'
  | 'adjustment'
  | 'unknown_period';

export type PayrollFiscalValueSource =
  | 'fiscal_section'
  | 'payroll_line'
  | 'summary'
  | 'progressive_section'
  | 'derived'
  | 'unknown';

export type PayrollFiscalValueKind =
  | 'money'
  | 'percentage'
  | 'fraction'
  | 'integer';

export type PayrollFiscalUnit =
  | 'EUR'
  | 'PERCENT_POINTS'
  | 'FRACTION'
  | 'UNSPECIFIED';

export interface PayrollFiscalValue<T = number> {
  field?: string;
  value?: T;
  valueKind?: PayrollFiscalValueKind;
  unit?: PayrollFiscalUnit;
  source: PayrollFiscalValueSource;
  period: PayrollFiscalPeriod;
  confidence: number;
  ambiguous?: boolean;
  rawText?: string;
  page?: number;
  section?: string;
  extractionMethod: 'label_catalog' | 'geometric_column' | 'payroll_line' | 'derived' | 'unknown';
  alternatives?: string[];
}

export interface PayslipFiscalData {
  schemaVersion: 'fiscal-v1';
  period?: { month?: number; year?: number };
  socialSecurity: {
    monthlyTaxable?: PayrollFiscalValue;
    progressiveTaxable?: PayrollFiscalValue;
    employeeContributions?: PayrollFiscalValue;
    employerContributions?: PayrollFiscalValue;
    totalContributions?: PayrollFiscalValue;
    contributionRate?: PayrollFiscalValue;
    days?: PayrollFiscalValue;
    weeks?: PayrollFiscalValue;
    hours?: PayrollFiscalValue;
    bilateralEmployeeContributions?: PayrollFiscalValue;
    bilateralEmployerContributions?: PayrollFiscalValue;
  };
  incomeTax: {
    deductionDays?: PayrollFiscalValue;
    monthlyTaxable?: PayrollFiscalValue;
    ordinaryMonthlyTaxable?: PayrollFiscalValue;
    supplementaryMonthlyTaxable?: PayrollFiscalValue;
    progressiveTaxable?: PayrollFiscalValue;
    grossTax?: PayrollFiscalValue;
    workDeductions?: PayrollFiscalValue;
    familyDeductions?: PayrollFiscalValue;
    additionalDeductions?: PayrollFiscalValue;
    taxCredits?: PayrollFiscalValue;
    supplementaryTreatment?: PayrollFiscalValue;
    netTax?: PayrollFiscalValue;
    taxWithheld?: PayrollFiscalValue;
    ordinaryTaxWithheld?: PayrollFiscalValue;
    supplementaryTaxWithheld?: PayrollFiscalValue;
    totalTaxWithheld?: PayrollFiscalValue;
    taxAdjustment?: PayrollFiscalValue;
  };
  additionalTaxes: {
    regionalBalance?: PayrollFiscalValue;
    municipalBalance?: PayrollFiscalValue;
    municipalAdvance?: PayrollFiscalValue;
    other?: PayrollFiscalValue;
  };
  tfr: {
    monthlyAccrual?: PayrollFiscalValue;
    progressiveAccrual?: PayrollFiscalValue;
    taxableBase?: PayrollFiscalValue;
    revaluation?: PayrollFiscalValue;
    revaluationTax?: PayrollFiscalValue;
    destination?: PayrollFiscalValue<string>;
    pensionFundContribution?: PayrollFiscalValue;
  };
  annualProgressives: {
    deductionDays?: PayrollFiscalValue;
    grossIncome?: PayrollFiscalValue;
    socialSecurityTaxable?: PayrollFiscalValue;
    incomeTaxTaxable?: PayrollFiscalValue;
    employeeContributions?: PayrollFiscalValue;
    grossTax?: PayrollFiscalValue;
    deductions?: PayrollFiscalValue;
    netTax?: PayrollFiscalValue;
  };
  unclassifiedValues: PayrollFiscalValue[];
  warnings: string[];
}

export interface DriverPayrollFiscalAnalysis {
  fiscalData: PayslipFiscalData;
  validation: PayrollValidationResult;
}

export interface PayrollFiscalLineContext {
  lines: PayslipLine[];
}
