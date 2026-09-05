import type { PayrollFiscalValue, PayslipFiscalData } from '../driverPayrollFiscalTypes';
import type {
  PayslipFieldConfidenceLevel,
  PayslipImport,
  PayslipLine,
  PayslipQuantityUnit,
} from '../driverPayrollTypes';
import type {
  PayrollObservedFiscalSummary,
  PayrollObservedFiscalObservations,
  PayrollObservedFiscalValue,
  PayrollObservedLine,
  PayrollObservedSnapshot,
  PayrollSnapshotQuantityUnit,
  PayrollValidationEvidence,
  PayrollValidationPeriod,
  PayrollValidationValue,
} from './types';

const DEFAULT_UNKNOWN_CONFIDENCE = 50;

export interface PayrollObservedAdapterOptions {
  readonly fiscalData?: PayslipFiscalData;
  readonly rounding?: number;
}

export const normalizePayrollValidationConfidence = (
  value: number | undefined,
  fallback = DEFAULT_UNKNOWN_CONFIDENCE
): number => {
  const candidate = Number.isFinite(value) ? value as number : fallback;
  return Math.max(0, Math.min(100, candidate));
};

export const mapObservedFieldConfidence = (
  confidence: PayslipFieldConfidenceLevel | undefined
): number | undefined => {
  switch (confidence) {
    case 'confirmed':
      return 100;
    case 'probable':
      return 75;
    case 'uncertain':
      return 40;
    case 'missing':
      return 0;
    default:
      return undefined;
  }
};

const mapQuantityUnit = (unit?: PayslipQuantityUnit): PayrollSnapshotQuantityUnit | undefined => {
  switch (unit) {
    case 'hours':
      return 'HOURS';
    case 'days':
      return 'DAYS';
    case 'months':
      return 'MONTHS';
    case 'percentage':
      return 'PERCENT';
    case 'units':
      return 'QUANTITY';
    case 'unknown':
      return 'UNKNOWN';
    default:
      return undefined;
  }
};

const payrollPeriod = (payslip: Readonly<PayslipImport>): PayrollValidationPeriod => ({
  year: payslip.year,
  month: payslip.month,
  label: payslip.payrollPeriodLabel,
});

const technicalReference = (
  payslip: Readonly<PayslipImport>,
  line?: Readonly<PayslipLine>
): string | undefined => {
  const parts = [
    payslip.parserUsed ? `parser=${payslip.parserUsed}` : undefined,
    payslip.detectedFormat ? `layout=${payslip.detectedFormat}` : undefined,
    line?.sourcePage !== undefined ? `page=${line.sourcePage}` : undefined,
    line?.interpretationMethod ? `method=${line.interpretationMethod}` : undefined,
  ].filter((part): part is string => Boolean(part));
  return parts.length ? parts.join('; ') : undefined;
};

const lineEvidenceValue = (line: Readonly<PayslipLine>): PayrollValidationValue | undefined => {
  if (line.earningAmount !== undefined) return { kind: 'NUMBER', value: line.earningAmount, unit: 'EUR' };
  if (line.deductionAmount !== undefined) return { kind: 'NUMBER', value: line.deductionAmount, unit: 'EUR' };
  if (line.informationalValue !== undefined) return { kind: 'NUMBER', value: line.informationalValue, unit: 'QUANTITY' };
  if (line.quantity !== undefined) {
    const unit = mapQuantityUnit(line.quantityUnit);
    return {
      kind: 'NUMBER',
      value: line.quantity,
      unit: unit === 'HOURS' || unit === 'DAYS' || unit === 'PERCENT' ? unit : 'QUANTITY',
    };
  }
  return undefined;
};

const adaptLine = (
  payslip: Readonly<PayslipImport>,
  line: Readonly<PayslipLine>,
  index: number
): PayrollObservedLine => {
  const confidence = normalizePayrollValidationConfidence(
    line.classificationConfidence ?? line.confidence
  );
  const provenance: PayrollValidationEvidence = {
    id: `payroll-line:${payslip.id}:${index}`,
    source: 'PAYROLL',
    description: `Voce osservata: ${line.originalDescription ?? line.label}`,
    value: lineEvidenceValue(line),
    period: payrollPeriod(payslip),
    confidence,
    technicalReference: technicalReference(payslip, line),
  };

  return {
    canonicalKey: line.canonicalKey ?? line.classification ?? 'unknown',
    description: line.label,
    originalCode: line.originalCode ?? line.code,
    originalDescription: line.originalDescription ?? line.label,
    category: line.category,
    economicType: line.economicType,
    quantity: line.quantity,
    quantityUnit: mapQuantityUnit(line.quantityUnit),
    unitValue: line.unitValue,
    earningAmount: line.earningAmount,
    deductionAmount: line.deductionAmount,
    informationalValue: line.informationalValue,
    confidence,
    provenance: [provenance],
  };
};

const fiscalValue = <T>(value?: PayrollFiscalValue<T>): T | undefined => value?.value;

const unclassifiedFiscalValue = (
  fiscalData: PayslipFiscalData,
  field: string
): number | undefined =>
  fiscalData.unclassifiedValues.find((item) => item.field === field)?.value;

const adaptFiscalSummary = (
  fiscalData?: PayslipFiscalData
): PayrollObservedFiscalSummary | undefined => {
  if (!fiscalData) return undefined;

  return {
    socialSecurityTaxable: fiscalValue(fiscalData.socialSecurity.monthlyTaxable),
    employeeSocialContributions: fiscalValue(fiscalData.socialSecurity.employeeContributions),
    incomeTaxTaxable: fiscalValue(fiscalData.incomeTax.monthlyTaxable),
    grossIncomeTax: fiscalValue(fiscalData.incomeTax.grossTax),
    workDeductions: fiscalValue(fiscalData.incomeTax.workDeductions),
    familyDeductions: fiscalValue(fiscalData.incomeTax.familyDeductions),
    additionalDeductions: fiscalValue(fiscalData.incomeTax.additionalDeductions),
    taxCredits: fiscalValue(fiscalData.incomeTax.taxCredits),
    incomeTaxWithheld: fiscalValue(
      fiscalData.incomeTax.totalTaxWithheld ??
      fiscalData.incomeTax.taxWithheld ??
      fiscalData.incomeTax.netTax
    ),
    taxAdjustment: fiscalValue(fiscalData.incomeTax.taxAdjustment),
    regionalTax: fiscalValue(fiscalData.additionalTaxes.regionalBalance),
    municipalTax: fiscalValue(fiscalData.additionalTaxes.municipalBalance),
    municipalTaxAdvance: fiscalValue(fiscalData.additionalTaxes.municipalAdvance),
    bilateralEmployeeContributions: fiscalValue(
      fiscalData.socialSecurity.bilateralEmployeeContributions
    ),
    bilateralEmployerContributions: fiscalValue(
      fiscalData.socialSecurity.bilateralEmployerContributions
    ),
    fiscalDays: fiscalValue(fiscalData.incomeTax.deductionDays),
    tfrUsefulSalary: fiscalValue(fiscalData.tfr.taxableBase),
    tfrMonthlyAccrual: fiscalValue(fiscalData.tfr.monthlyAccrual),
    tfrProgressiveAccrual: fiscalValue(fiscalData.tfr.progressiveAccrual),
    tfrOverallAccrual: unclassifiedFiscalValue(fiscalData, 'tfr.accrualFrom2001'),
    tfrRevaluation: fiscalValue(fiscalData.tfr.revaluation),
    tfrRevaluationTax: fiscalValue(fiscalData.tfr.revaluationTax),
    tfrPensionFundContribution: fiscalValue(fiscalData.tfr.pensionFundContribution),
    tfrDestination: fiscalValue(fiscalData.tfr.destination),
  };
};

const classifiedFiscalValues = (
  fiscalData: Readonly<PayslipFiscalData>
): ReadonlyArray<Readonly<PayrollFiscalValue<number | string>>> => [
  ...Object.values(fiscalData.socialSecurity),
  ...Object.values(fiscalData.incomeTax),
  ...Object.values(fiscalData.additionalTaxes),
  ...Object.values(fiscalData.tfr),
  ...Object.values(fiscalData.annualProgressives),
].filter((value) => value !== undefined);

const fiscalEvidenceSource = (
  source: PayrollFiscalValue['source']
): PayrollValidationEvidence['source'] =>
  source === 'derived' ? 'CALCULATION' : 'PAYROLL';

const adaptFiscalObservations = (
  payslip: Readonly<PayslipImport>,
  fiscalData?: Readonly<PayslipFiscalData>
): PayrollObservedFiscalObservations | undefined => {
  if (!fiscalData) return undefined;

  const sourceValues = [
    ...classifiedFiscalValues(fiscalData).map((value) => ({
      value,
      classificationStatus: 'CLASSIFIED' as const,
    })),
    ...fiscalData.unclassifiedValues.map((value) => ({
      value,
      classificationStatus: 'UNCLASSIFIED' as const,
    })),
  ];
  const values = sourceValues.map((sourceValue, index): PayrollObservedFiscalValue => {
    const { value, classificationStatus } = sourceValue;
    const technicalParts = [
      value.field ? `field=${value.field}` : undefined,
      `source=${value.source}`,
      `period=${value.period}`,
      value.page !== undefined ? `page=${value.page}` : undefined,
      value.section ? `section=${value.section}` : undefined,
      `method=${value.extractionMethod}`,
    ].filter((part): part is string => part !== undefined);

    return {
      canonicalField: value.field,
      value: value.value,
      unit: value.unit ?? 'UNSPECIFIED',
      classificationStatus,
      fiscalPeriod: value.period,
      source: value.source,
      confidence: value.confidence,
      ambiguous: value.ambiguous,
      rawText: value.rawText,
      page: value.page,
      section: value.section,
      extractionMethod: value.extractionMethod,
      alternatives: value.alternatives
        ? [...value.alternatives]
        : undefined,
      provenance: [
        {
          id: `payroll-fiscal:${payslip.id}:${index}`,
          source: fiscalEvidenceSource(value.source),
          description: value.field
            ? `Valore fiscale osservato: ${value.field}`
            : 'Valore fiscale osservato non classificato',
          period: payrollPeriod(payslip),
          confidence: normalizePayrollValidationConfidence(value.confidence),
          technicalReference: technicalParts.join('; '),
        },
      ],
    };
  });

  return {
    schemaVersion: fiscalData.schemaVersion,
    period: fiscalData.period
      ? { ...fiscalData.period }
      : undefined,
    values,
    warnings: [...fiscalData.warnings],
  };
};

export function adaptPayrollToObservedSnapshot(
  payslip: Readonly<PayslipImport>,
  options: Readonly<PayrollObservedAdapterOptions> = {}
): PayrollObservedSnapshot {
  const confidence = normalizePayrollValidationConfidence(payslip.confidence);
  const period = payrollPeriod(payslip);
  const provenance: PayrollValidationEvidence = {
    id: `payroll:${payslip.id}`,
    source: 'PAYROLL',
    description: 'Cedolino payroll normalizzato osservato.',
    period,
    date: payslip.importedAt,
    confidence,
    technicalReference: technicalReference(payslip),
  };
  const fiscalData = options.fiscalData ?? payslip.fiscalData;

  return {
    period,
    relationship: {
      relationshipId: payslip.driverProfileId,
      driverProfileId: payslip.driverProfileId,
      companyName: payslip.companyName,
      siteCode: payslip.siteCode,
      siteCostCenter: payslip.siteCostCenter,
      costCenterCode: payslip.costCenterCode,
      costCenterDescription: payslip.costCenterDescription,
      activityCode: payslip.activityCode,
    },
    level: payslip.level,
    lines: payslip.parsedLines.map((line, index) => adaptLine(payslip, line, index)),
    economicSummary: {
      totalEarnings: payslip.summary.totalEarnings,
      totalDeductions: payslip.summary.totalDeductions,
      netAmount: payslip.summary.netAmount,
      grossAmount: payslip.summary.grossAmount,
      rounding: options.rounding,
      paymentDate: payslip.summary.paymentDate,
      fieldConfidence: {
        totalEarnings: mapObservedFieldConfidence(
          payslip.fieldConfidence?.grossAmount?.confidence
        ),
        totalDeductions: mapObservedFieldConfidence(
          payslip.fieldConfidence?.totalDeductions?.confidence
        ),
        netAmount: mapObservedFieldConfidence(
          payslip.fieldConfidence?.netAmount?.confidence
        ),
      },
    },
    fiscalSummary: adaptFiscalSummary(fiscalData),
    fiscalObservations: adaptFiscalObservations(payslip, fiscalData),
    confidence,
    provenance: [provenance],
  };
}
