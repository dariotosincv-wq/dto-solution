import type { PayslipFiscalData } from './driverPayrollFiscalTypes';

export type DriverPayrollStorageKey =
  | 'driverPayroll.profiles'
  | 'driverPayroll.contractSources'
  | 'driverPayroll.rules'
  | 'driverPayroll.codes'
  | 'driverPayroll.payslips'
  | 'driverPayroll.predictions'
  | 'driverPayroll.comparisons'
  | 'driverPayroll.learningProfile';

export type ContractSourceType =
  | 'ccnl'
  | 'accordo_nazionale'
  | 'accordo_aziendale'
  | 'nota_interna';

export type EmploymentType =
  | 'full_time'
  | 'part_time_orizzontale'
  | 'part_time_verticale'
  | 'part_time_misto';

export type PayrollRuleCategory =
  | 'base_pay'
  | 'edr'
  | 'epa'
  | 'seniority_increment'
  | 'contractual_allowance'
  | 'allowance'
  | 'travel_allowance'
  | 'meal_allowance'
  | 'mileage_reimbursement'
  | 'generic_allowance'
  | 'overtime'
  | 'overtime_premium'
  | 'night_premium'
  | 'sunday_premium'
  | 'holiday_premium'
  | 'shift_premium'
  | 'generic_premium'
  | 'absence'
  | 'paid_leave'
  | 'vacation'
  | 'permission'
  | 'former_holiday_leave'
  | 'sickness'
  | 'sickness_waiting_period'
  | 'sickness_employer_supplement'
  | 'injury'
  | 'accident'
  | 'accident_employer_supplement'
  | 'unpaid_absence'
  | 'strike'
  | 'rest_day'
  | 'holiday'
  | 'bonus'
  | 'thirteenth_month'
  | 'fourteenth_month'
  | 'performance_bonus'
  | 'production_bonus'
  | 'welfare'
  | 'fringe_benefit'
  | 'generic_bonus'
  | 'reimbursement'
  | 'expense_reimbursement'
  | 'employee_social_contribution'
  | 'employer_social_contribution'
  | 'bilateral_body_employee_contribution'
  | 'bilateral_body_employer_contribution'
  | 'union_fee'
  | 'salary_advance'
  | 'salary_advance_recovery'
  | 'generic_deduction'
  | 'deduction'
  | 'tax'
  | 'income_tax'
  | 'regional_tax'
  | 'municipal_tax_balance'
  | 'municipal_tax_advance'
  | 'tax_deduction'
  | 'tax_credit'
  | 'tax_adjustment'
  | 'contribution'
  | 'worked_hours'
  | 'worked_days'
  | 'theoretical_hours'
  | 'effective_hours'
  | 'social_security_taxable'
  | 'income_tax_taxable'
  | 'tfr_taxable'
  | 'informational'
  | 'accrual'
  | 'other';

export type PayrollCodeType =
  | 'earning'
  | 'deduction'
  | 'neutral'
  | 'informational';

export type PayrollLineEconomicType = PayrollCodeType | 'unknown';
export type PayrollTaxTreatment = 'taxable' | 'exempt' | 'partial' | 'unknown';
export type PayrollSocialSecurityTreatment = 'subject' | 'exempt' | 'unknown';
export type PayrollCodeDefinitionSource = 'builtin' | 'company_profile' | 'user_confirmed';
export type PayrollHistoricalBehavior = 'structural' | 'recurring' | 'variable' | 'one_off' | 'progressive' | 'unknown';
export type PayrollLineCalculationRule =
  | 'unit_times_quantity'
  | 'percentage'
  | 'fixed_amount'
  | 'external_calculation'
  | 'unknown';

export type PayslipQuantityUnit =
  | 'hours'
  | 'days'
  | 'months'
  | 'percentage'
  | 'units'
  | 'unknown';

export type PayslipLineSourceColumn =
  | 'unit_value'
  | 'quantity'
  | 'earnings'
  | 'deductions'
  | 'informational';

export type PayrollCodeSign = 'positive' | 'negative' | 'mixed';

export type AttendanceStatus =
  | 'worked'
  | 'rest'
  | 'sunday_worked'
  | 'holiday_worked'
  | 'holiday_not_worked'
  | 'vacation'
  | 'par'
  | 'ex_holiday'
  | 'sickness'
  | 'injury'
  | 'union_leave'
  | 'paid_leave'
  | 'unpaid_leave'
  | 'strike'
  | 'abort'
  | 'training'
  | 'medical_visit';

export type PayslipExtractionMethod = 'pdf_text' | 'ocr' | 'manual';

export type PayslipDetectedFormat = 'logisticsLayoutV1' | 'generic' | 'unknown';

export type PayslipFieldConfidenceLevel = 'confirmed' | 'probable' | 'uncertain' | 'missing';

export interface PayslipFieldConfidence {
  value?: string | number;
  sourceLabel?: string;
  page?: number;
  confidence: PayslipFieldConfidenceLevel;
  parserUsed: string;
}

export type DriverPayrollRuleSourceType =
  | 'ccnl'
  | 'companyProfile'
  | 'payslipObserved'
  | 'userExperience'
  | 'requiresVerification';

export type DriverPayrollRuleConfidence =
  | 'confirmed'
  | 'estimated'
  | 'requiresVerification';

export type DriverPayrollManualLineKind =
  | 'expense_reimbursement'
  | 'advance_recovery'
  | 'damage_deduction'
  | 'manual_bonus'
  | 'manual_deduction'
  | 'other_reimbursement';

export interface DriverProfile {
  id: string;
  displayName?: string;
  companyName?: string;
  siteCode?: string;
  contractCode: string;
  payrollProvider?: string;
  level?: string;
  employmentType: EmploymentType;
  weeklyHours?: number;
  monthlyTheoreticalHours?: number;
  hireDate?: string;
  seniorityDate?: string;
  nextSeniorityIncreaseDate?: string;
  province?: string;
  region?: string;
  hasUnionFee?: boolean;
  unionFeeAmount?: number;
  hasEbilogContribution?: boolean;
  notes?: string;
}

export interface ContractSource {
  id: string;
  title: string;
  type: ContractSourceType;
  validFrom?: string;
  validTo?: string;
  version?: string;
  documentName?: string;
  pages?: string;
  confidence?: number;
}

export interface PayrollRule {
  id: string;
  code: string;
  name: string;
  category: PayrollRuleCategory;
  sourceIds: string[];
  validFrom?: string;
  validTo?: string;
  appliesWhen: string[];
  doesNotApplyWhen: string[];
  formula?: string;
  parameters?: Record<string, string | number | boolean>;
  examples?: string[];
  exceptions?: string[];
  notes?: string;
  confidence?: number;
}

export interface PayrollCode {
  code: string;
  label: string;
  normalizedName: string;
  type: PayrollCodeType;
  category: PayrollRuleCategory;
  linkedRuleIds: string[];
  sign: PayrollCodeSign;
  isTaxable?: boolean;
  affectsTfr?: boolean;
  affectsInps?: boolean;
  affectsIrpef?: boolean;
  parserAliases: string[];
  examples?: string[];
}

export interface PayrollCodeDefinition {
  code: string;
  canonicalKey: string;
  canonicalDescription: string;
  aliases?: string[];
  descriptionPatterns?: string[];
  category: PayrollRuleCategory;
  economicType: PayrollLineEconomicType;
  quantityUnit?: PayslipQuantityUnit;
  companyId?: string;
  companyAliases?: string[];
  contractType?: string;
  payrollSoftware?: string;
  validFrom?: string;
  validTo?: string;
  priority?: number;
  taxTreatment?: PayrollTaxTreatment;
  socialSecurityTreatment?: PayrollSocialSecurityTreatment;
  affectsTfr?: boolean | 'unknown';
  calculationRule?: PayrollLineCalculationRule;
  historicalBehavior?: PayrollHistoricalBehavior;
  source: PayrollCodeDefinitionSource;
  legacyPayrollCode?: PayrollCode;
}

export interface PayrollCodeResolutionContext {
  companyId?: string;
  companyName?: string;
  contractType?: string;
  payrollSoftware?: string;
  effectiveDate?: string;
}

export interface PayrollCodeResolution {
  definition?: PayrollCodeDefinition;
  method: 'exact_company_code' | 'exact_generic_code' | 'description_alias' | 'description_pattern' | 'unknown';
  confidence: number;
  ambiguous: boolean;
  alternatives: PayrollCodeDefinition[];
}

export interface AttendanceEvent {
  date: string;
  status: AttendanceStatus;
  hoursWorked?: number;
  theoreticalHours?: number;
  isSunday: boolean;
  isHoliday: boolean;
  isContractualDay?: boolean;
  isWorkedHoliday: boolean;
  isAbort: boolean;
  isPaid: boolean;
  eligibleForTravelAllowance: boolean;
  shortWorkedDay?: boolean;
  eligibleForSundayAllowance: boolean;
  overtimeHours30?: number;
  overtimeHours50?: number;
  notes?: string;
}

export interface PayrollMonthInput {
  year: number;
  month: number;
  driverProfileId?: string;
  attendanceEvents: AttendanceEvent[];
  workedDays: number;
  eligibleTravelDays: number;
  sundaysWorked: number;
  holidaysWorked: number;
  vacationDays: number;
  parHours: number;
  sicknessDays: number;
  injuryDays: number;
  strikeHours: number;
  abortDays: number;
  ordinaryHours: number;
  effectiveHours: number;
  theoreticalHours: number;
  overtime30Hours: number;
  overtime50Hours: number;
}

export interface PayslipLine {
  code?: string;
  label: string;
  originalCode?: string;
  originalDescription?: string;
  normalizedDescription?: string;
  classification?: string;
  category?: string;
  quantity?: number;
  quantityUnit?: PayslipQuantityUnit;
  unitValue?: number;
  amount?: number;
  earningAmount?: number;
  deductionAmount?: number;
  informationalValue?: number;
  section?: string;
  type?: PayrollCodeType;
  economicType?: PayrollCodeType;
  sourceColumn?: PayslipLineSourceColumn;
  linkedPayrollCode?: string;
  linkedRuleId?: string;
  confidence?: number;
  rawLine?: string;
  sourcePage?: number;
  sourceRowY?: number;
  geometricEconomicCertified?: boolean;
  economicSelectionResult?: 'included' | 'excluded' | 'pending';
  economicSelectionExclusionReason?: string;
  sourceGeometry?: {
    y: number;
    cells: Array<{
      text: string;
      x: number;
      y: number;
      width: number;
    }>;
  };
  interpretationMethod?: string;
  canonicalKey?: string;
  classificationMethod?: PayrollCodeResolution['method'];
  classificationConfidence?: number;
  classificationAmbiguous?: boolean;
  classificationAlternatives?: string[];
  calculationRule?: PayrollLineCalculationRule;
}

export interface PayslipSummary {
  grossAmount?: number;
  netAmount?: number;
  totalEarnings?: number;
  totalDeductions?: number;
  inpsTaxable?: number;
  inpsContributions?: number;
  irpefTaxable?: number;
  irpefAmount?: number;
  regionalTax?: number;
  municipalTax?: number;
  tfrUsefulSalary?: number;
  paymentDate?: string;
}

export interface DriverPayrollRuleDefinition {
  id: string;
  name: string;
  category: PayrollRuleCategory;
  sourceType: DriverPayrollRuleSourceType;
  description: string;
  appliesWhen: string[];
  excludesWhen: string[];
  calculationHint: string;
  confidence: DriverPayrollRuleConfidence;
}

export interface DriverPayrollCompanyProfile {
  id: string;
  name: string;
  payrollProvider?: string;
  siteCode?: string;
  contractCode?: string;
  level?: string;
  fullTimeDefault: boolean;
  defaultEmploymentType: EmploymentType;
  travelAllowanceRates: Array<{
    validFrom: string;
    validTo?: string;
    amount: number;
  }>;
  sundayTravelExtraAmount?: number;
  sundayWorkPremiumAmount?: number;
  unionFeeMode: 'notFixed' | 'fixed' | 'disabled';
  unionFeeAmount?: number;
  ebilogMode: 'readFromPayslip' | 'fixed' | 'disabled';
  ebilogAmount?: number;
  pdrMode: 'nonPredictable' | 'manualOnly' | 'fixed';
  pdrAmount?: number;
  notes: string[];
}

export interface DriverPayrollManualLine {
  id?: string;
  kind: DriverPayrollManualLineKind;
  label: string;
  amount: number;
  type: PayrollCodeType;
  code?: string;
  notes?: string;
}

export interface DriverPayrollEstimateOptions {
  manualLines?: DriverPayrollManualLine[];
  authorizedOvertime30Hours?: number;
  authorizedOvertime50Hours?: number;
  overtime30HourlyAmount?: number;
  overtime50HourlyAmount?: number;
}

export interface DriverPayrollEstimateSummary extends PayslipSummary {
  workedRealDays: number;
  paidOrdinaryDays: number;
  eligibleTravelDays: number;
  sundaysWorked: number;
  holidaysWorked: number;
  abortDays: number;
  vacationDays: number;
  parHours: number;
  sicknessDays: number;
  injuryDays: number;
  manualEarnings: number;
  manualDeductions: number;
}

export interface DriverPayrollEstimateResult {
  summary: DriverPayrollEstimateSummary;
  predictedLines: PayslipLine[];
  warnings: string[];
  requiresManualInputs: string[];
  confidenceScore: number;
}

export interface PayslipImport {
  id: string;
  driverProfileId?: string;
  sourceFileHash?: string;
  payrollProvider?: string;
  companyName?: string;
  payrollPeriodLabel?: string;
  level?: string;
  siteCode?: string;
  costCenterCode?: string;
  costCenterDescription?: string;
  activityCode?: string;
  siteCostCenter?: string;
  year: number;
  month: number;
  importedAt: string;
  extractionMethod: PayslipExtractionMethod;
  confidence?: number;
  detectedFormat?: PayslipDetectedFormat;
  parserUsed?: string;
  fieldConfidence?: Record<string, PayslipFieldConfidence>;
  rawTextTemporary?: string;
  parsedLines: PayslipLine[];
  summary: PayslipSummary;
  warnings: string[];
  fiscalDataVersion?: 'fiscal-v1';
  fiscalData?: PayslipFiscalData;
}

export interface PayrollPrediction {
  id: string;
  driverProfileId?: string;
  year: number;
  month: number;
  createdAt: string;
  inputSnapshot: PayrollMonthInput;
  predictedLines: PayslipLine[];
  predictedSummary: PayslipSummary;
  confidence?: number;
  assumptions: string[];
  missingData: string[];
}

export interface PayrollLineDifference {
  code?: string;
  label: string;
  predictedAmount?: number;
  actualAmount?: number;
  difference: number;
  possibleCause?: string;
}

export interface PayrollComparison {
  id: string;
  predictionId: string;
  payslipImportId: string;
  year: number;
  month: number;
  netDifference?: number;
  grossDifference?: number;
  lineDifferences: PayrollLineDifference[];
  possibleCauses: string[];
  modelUpdatesSuggested: string[];
  accuracyPercent?: number;
}

export type DriverPayrollComparisonMetricKey =
  | 'netAmount'
  | 'grossAmount'
  | 'travelDays'
  | 'overtimeHours'
  | 'bonusAmount'
  | 'holidayDays'
  | 'vacationDays'
  | 'permitHours'
  | 'sicknessDays';

export type DriverPayrollComparisonMetricValues = Partial<Record<DriverPayrollComparisonMetricKey, number>>;

export interface DriverPayrollMonthlyComparisonBase {
  year: number;
  month: number;
  predicted: DriverPayrollComparisonMetricValues;
  actual: DriverPayrollComparisonMetricValues;
  predictionId?: string;
  payslipImportId?: string;
}

export interface LearningProfile {
  driverProfileId?: string;
  payrollProvider?: string;
  knownAliases: Record<string, string[]>;
  recurringDeductions: PayslipLine[];
  recurringEarnings: PayslipLine[];
  roundingPatterns: Record<string, number>;
  usualPaymentDay?: number;
  usualPayrollDelayDays?: number;
  confidenceByRule: Record<string, number>;
  lastUpdatedAt?: string;
}

export interface DriverPayrollDataStore {
  profiles: DriverProfile[];
  contractSources: ContractSource[];
  rules: PayrollRule[];
  codes: PayrollCode[];
  payslips: PayslipImport[];
  predictions: PayrollPrediction[];
  comparisons: PayrollComparison[];
  learningProfile: LearningProfile[];
}
