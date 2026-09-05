import { resolvePayrollCodeDefinition } from './driverPayrollCodeCatalog';
import type { PayrollFiscalValue } from './driverPayrollFiscalTypes';
import type { PayrollHistoricalBehavior, PayslipImport, PayslipLine, PayslipQuantityUnit } from './driverPayrollTypes';

export type PayrollHistoricalOverallStatus = 'valid' | 'valid_with_warnings' | 'inconsistent' | 'insufficient_data';
export type PayrollHistoricalCheckStatus = 'passed' | 'warning' | 'failed' | 'skipped';
export type PayrollHistoricalSeverity = 'info' | 'low' | 'medium' | 'high';
export type PayrollDocumentType =
  | 'ordinary' | 'thirteenth_month' | 'fourteenth_month' | 'adjustment'
  | 'tax_adjustment' | 'termination' | 'arrears' | 'bonus_only' | 'unknown';
export type PayrollHistoricalCheckCategory =
  | 'timeline' | 'progressive_social_security' | 'progressive_income_tax'
  | 'progressive_tax_withheld' | 'progressive_tfr' | 'monthly_delta'
  | 'duplicate_period' | 'missing_period' | 'payroll_line_trend'
  | 'employment_continuity' | 'data_quality';

export interface PayrollHistoricalPeriod {
  payslipId: string;
  periodKey?: string;
  year?: number;
  month?: number;
  label: string;
  paymentDate?: string;
  documentType: PayrollDocumentType;
  companyName?: string;
  relationshipId?: string;
  relationshipConfidence: number;
  periodConfidence: number;
  ambiguous: boolean;
  fiscalDataVersion?: string;
  payslip: PayslipImport;
}

export interface PayrollHistoricalValidationCheck {
  id: string;
  category: PayrollHistoricalCheckCategory;
  status: PayrollHistoricalCheckStatus;
  severity: PayrollHistoricalSeverity;
  currentPeriod?: string;
  previousPeriod?: string;
  previousValue?: number;
  currentValue?: number;
  expectedDelta?: number;
  actualDelta?: number;
  difference?: number;
  tolerance?: number;
  confidence: number;
  explanation: string;
  sourceCanonicalKeys?: string[];
  sourceCodes?: string[];
  metadata?: Record<string, unknown>;
}

export interface PayrollHistoricalLinePoint {
  period: string;
  payslipId: string;
  amount?: number;
  quantity?: number;
  unitValue?: number;
  quantityUnit?: PayslipQuantityUnit;
}

export interface PayrollHistoricalLineSeries {
  canonicalKey: string;
  description: string;
  behavior: PayrollHistoricalBehavior;
  points: PayrollHistoricalLinePoint[];
  average?: number;
  median?: number;
  minimum?: number;
  maximum?: number;
}

export interface PayrollHistoricalValidationResult {
  schemaVersion: 'historical-v1';
  overallStatus: PayrollHistoricalOverallStatus;
  confidence: number;
  timeline: PayrollHistoricalPeriod[];
  checks: PayrollHistoricalValidationCheck[];
  lineSeries: PayrollHistoricalLineSeries[];
  summary: { passed: number; warnings: number; failed: number; skipped: number };
  warnings: string[];
  errors: string[];
  informationalNotes: string[];
}

export interface PayrollHistoricalValidationOptions {
  ordinaryTolerance?: number;
  warningTolerance?: number;
  minimumConfidence?: number;
  fromPeriod?: string;
  toPeriod?: string;
}

const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const normalizeIdentity = (value?: string) =>
  value?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\W+/g, ' ').trim();
const periodKey = (year?: number, month?: number) =>
  year && month && month >= 1 && month <= 12 ? `${year}-${String(month).padStart(2, '0')}` : undefined;
const monthIndex = (year: number, month: number) => year * 12 + month - 1;

export const identifyHistoricalPayrollPeriod = (payslip: PayslipImport) => {
  const normalizedKey = periodKey(payslip.year, payslip.month);
  if (normalizedKey) {
    const explicit = Boolean(payslip.payrollPeriodLabel?.includes(String(payslip.year)));
    return {
      year: payslip.year,
      month: payslip.month,
      periodKey: normalizedKey,
      confidence: explicit ? 100 : 90,
      ambiguous: false,
      method: explicit ? 'explicit_period' : 'normalized_period',
    };
  }
  if (payslip.summary.paymentDate) {
    const date = new Date(`${payslip.summary.paymentDate}T00:00:00`);
    if (!Number.isNaN(date.getTime())) {
      return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        periodKey: periodKey(date.getFullYear(), date.getMonth() + 1),
        confidence: 40,
        ambiguous: true,
        method: 'payment_date_fallback',
      };
    }
  }
  return { confidence: 10, ambiguous: true, method: 'unresolved' };
};

const canonicalForLine = (line: PayslipLine) =>
  line.canonicalKey ??
  resolvePayrollCodeDefinition({ code: line.code, description: line.originalDescription ?? line.label }).definition?.canonicalKey;

export const identifyPayrollDocumentType = (payslip: PayslipImport): PayrollDocumentType => {
  const keys = payslip.parsedLines.map(canonicalForLine);
  if (keys.includes('payroll.thirteenth_month')) return 'thirteenth_month';
  if (keys.includes('payroll.fourteenth_month')) return 'fourteenth_month';
  if (keys.includes('payroll.tax.adjustment.730')) return 'tax_adjustment';
  if (keys.includes('payroll.base_pay')) return 'ordinary';
  if (keys.some((key) => key?.includes('arrears'))) return 'arrears';
  if (keys.some((key) => key?.includes('bonus'))) return 'bonus_only';
  if (
    payslip.summary.netAmount !== undefined &&
    (payslip.summary.grossAmount !== undefined || payslip.summary.totalEarnings !== undefined)
  ) return 'ordinary';
  return 'unknown';
};

export const identifyPayrollRelationship = (payslip: PayslipImport) => {
  if (payslip.driverProfileId) {
    const company = normalizeIdentity(payslip.companyName);
    return {
      id: `profile:${payslip.driverProfileId}${company ? `|company:${company}` : ''}`,
      confidence: company ? 100 : 90,
      method: company ? 'driver_profile_and_company' : 'driver_profile',
    };
  }
  const company = normalizeIdentity(payslip.companyName);
  if (company) {
    const parts = [company, normalizeIdentity(payslip.payrollProvider), normalizeIdentity(payslip.siteCostCenter)].filter(Boolean);
    return { id: `company:${parts.join('|')}`, confidence: parts.length >= 2 ? 80 : 65, method: 'company_context' };
  }
  return { id: undefined, confidence: 20, method: 'insufficient_identity' };
};

const sameRelationship = (previous: PayrollHistoricalPeriod, current: PayrollHistoricalPeriod) => {
  if (!previous.relationshipId || !current.relationshipId) {
    return { comparable: false, confidence: 20, reason: 'identità del rapporto insufficiente' };
  }
  if (previous.relationshipId !== current.relationshipId) {
    return { comparable: false, confidence: 95, reason: 'rapporto o azienda differenti' };
  }
  return {
    comparable: previous.relationshipConfidence >= 60 && current.relationshipConfidence >= 60,
    confidence: Math.min(previous.relationshipConfidence, current.relationshipConfidence),
    reason: 'rapporto compatibile',
  };
};

const buildTimelineItem = (payslip: PayslipImport): PayrollHistoricalPeriod => {
  const period = identifyHistoricalPayrollPeriod(payslip);
  const relationship = identifyPayrollRelationship(payslip);
  return {
    payslipId: payslip.id,
    periodKey: period.periodKey,
    year: period.year,
    month: period.month,
    label: period.year && period.month ? `${monthNames[period.month - 1]} ${period.year}` : 'Periodo non identificato',
    paymentDate: payslip.summary.paymentDate,
    documentType: identifyPayrollDocumentType(payslip),
    companyName: payslip.companyName,
    relationshipId: relationship.id,
    relationshipConfidence: relationship.confidence,
    periodConfidence: period.confidence,
    ambiguous: period.ambiguous,
    fiscalDataVersion: payslip.fiscalDataVersion,
    payslip,
  };
};

export const buildPayrollHistoricalTimeline = (
  payslips: PayslipImport[],
  options: PayrollHistoricalValidationOptions = {}
): PayrollHistoricalPeriod[] =>
  payslips
    .map(buildTimelineItem)
    .filter((item) => (!options.fromPeriod || !item.periodKey || item.periodKey >= options.fromPeriod))
    .filter((item) => (!options.toPeriod || !item.periodKey || item.periodKey <= options.toPeriod))
    .sort((a, b) => {
      if (!a.periodKey || !b.periodKey) return a.periodKey ? -1 : b.periodKey ? 1 : 0;
      return a.periodKey.localeCompare(b.periodKey) ||
        new Date(a.payslip.importedAt).getTime() - new Date(b.payslip.importedAt).getTime();
    });

const lineFingerprint = (line: PayslipLine) => [
  canonicalForLine(line) ?? line.code ?? 'unknown',
  line.earningAmount ?? '', line.deductionAmount ?? '', line.quantity ?? '', line.unitValue ?? '',
].join(':');

export const createHistoricalPayslipFingerprint = (payslip: PayslipImport) => JSON.stringify({
  period: periodKey(payslip.year, payslip.month),
  net: payslip.summary.netAmount,
  earnings: payslip.summary.grossAmount ?? payslip.summary.totalEarnings,
  deductions: payslip.summary.totalDeductions,
  paymentDate: payslip.summary.paymentDate,
  lines: payslip.parsedLines.map(lineFingerprint).sort(),
  fiscal: payslip.fiscalData ? {
    social: payslip.fiscalData.socialSecurity.progressiveTaxable?.value,
    tax: payslip.fiscalData.incomeTax.progressiveTaxable?.value,
    taxPaid: payslip.fiscalData.annualProgressives.netTax?.value,
    tfr: payslip.fiscalData.tfr.progressiveAccrual?.value,
  } : undefined,
});

const skippedCheck = (
  id: string,
  category: PayrollHistoricalCheckCategory,
  explanation: string,
  previous?: PayrollHistoricalPeriod,
  current?: PayrollHistoricalPeriod
): PayrollHistoricalValidationCheck => ({
  id,
  category,
  status: 'skipped',
  severity: 'low',
  previousPeriod: previous?.periodKey,
  currentPeriod: current?.periodKey,
  confidence: 20,
  explanation,
});

type ProgressiveDefinition = {
  id: string;
  category: PayrollHistoricalCheckCategory;
  annualReset: boolean;
  progressive: (item: PayrollHistoricalPeriod) => PayrollFiscalValue | undefined;
  monthly: (item: PayrollHistoricalPeriod) => PayrollFiscalValue | undefined;
  adjustment?: (item: PayrollHistoricalPeriod) => number;
};

const progressiveDefinitions: ProgressiveDefinition[] = [
  {
    id: 'HIST_SOCIAL_TAXABLE',
    category: 'progressive_social_security',
    annualReset: true,
    progressive: (item) => item.payslip.fiscalData?.socialSecurity.progressiveTaxable,
    monthly: (item) => item.payslip.fiscalData?.socialSecurity.monthlyTaxable,
  },
  {
    id: 'HIST_INCOME_TAXABLE',
    category: 'progressive_income_tax',
    annualReset: true,
    progressive: (item) => item.payslip.fiscalData?.incomeTax.progressiveTaxable,
    monthly: (item) => item.payslip.fiscalData?.incomeTax.monthlyTaxable,
  },
  {
    id: 'HIST_TAX_WITHHELD',
    category: 'progressive_tax_withheld',
    annualReset: true,
    progressive: (item) => item.payslip.fiscalData?.annualProgressives.netTax,
    monthly: (item) => item.payslip.fiscalData?.incomeTax.taxWithheld ?? item.payslip.fiscalData?.incomeTax.netTax,
  },
  {
    id: 'HIST_EMPLOYEE_CONTRIBUTIONS',
    category: 'progressive_social_security',
    annualReset: true,
    progressive: (item) => item.payslip.fiscalData?.annualProgressives.employeeContributions,
    monthly: (item) => item.payslip.fiscalData?.socialSecurity.employeeContributions,
  },
  {
    id: 'HIST_TFR',
    category: 'progressive_tfr',
    annualReset: false,
    progressive: (item) => item.payslip.fiscalData?.tfr.progressiveAccrual,
    monthly: (item) => item.payslip.fiscalData?.tfr.monthlyAccrual,
    adjustment: (item) => Number(item.payslip.fiscalData?.tfr.revaluation?.value ?? 0),
  },
];

const reliableFiscal = (value: PayrollFiscalValue | undefined, minimumConfidence: number) =>
  value && !value.ambiguous && value.confidence >= minimumConfidence && typeof value.value === 'number';

const progressiveCheck = (
  definition: ProgressiveDefinition,
  previous: PayrollHistoricalPeriod,
  current: PayrollHistoricalPeriod,
  options: Required<Pick<PayrollHistoricalValidationOptions, 'ordinaryTolerance' | 'warningTolerance' | 'minimumConfidence'>>
): PayrollHistoricalValidationCheck => {
  const relationship = sameRelationship(previous, current);
  if (!relationship.comparable) {
    return skippedCheck(`${definition.id}:${previous.payslipId}:${current.payslipId}`, 'employment_continuity', relationship.reason, previous, current);
  }
  if (previous.ambiguous || current.ambiguous || previous.documentType !== 'ordinary' || current.documentType !== 'ordinary') {
    return skippedCheck(`${definition.id}:${previous.payslipId}:${current.payslipId}`, definition.category, 'Periodo ambiguo o cedolino non ordinario: confronto progressivo non certificato.', previous, current);
  }
  if (definition.annualReset && previous.year !== current.year) {
    return {
      ...skippedCheck(`${definition.id}:${previous.payslipId}:${current.payslipId}`, definition.category, 'Cambio anno: il progressivo annuale può ripartire e non viene considerato regressivo.', previous, current),
      severity: 'info',
      confidence: 85,
    };
  }
  const previousProgressive = definition.progressive(previous);
  const currentProgressive = definition.progressive(current);
  const currentMonthly = definition.monthly(current);
  if (
    !reliableFiscal(previousProgressive, options.minimumConfidence) ||
    !reliableFiscal(currentProgressive, options.minimumConfidence) ||
    !reliableFiscal(currentMonthly, options.minimumConfidence)
  ) {
    return skippedCheck(`${definition.id}:${previous.payslipId}:${current.payslipId}`, definition.category, 'Progressivi o valore mensile non disponibili con confidence sufficiente.', previous, current);
  }
  const adjustment = definition.adjustment?.(current) ?? 0;
  const actualDelta = round2(currentProgressive.value! - previousProgressive.value!);
  const expectedDelta = round2(currentMonthly.value! + adjustment);
  const difference = round2(actualDelta - expectedDelta);
  const decreasing = currentProgressive.value! < previousProgressive.value!;
  const magnitude = Math.abs(difference);
  const status: PayrollHistoricalCheckStatus = decreasing || magnitude > options.warningTolerance
    ? 'failed'
    : magnitude > options.ordinaryTolerance ? 'warning' : 'passed';
  return {
    id: `${definition.id}:${previous.payslipId}:${current.payslipId}`,
    category: definition.category,
    status,
    severity: status === 'failed' ? 'high' : status === 'warning' ? 'medium' : 'info',
    previousPeriod: previous.periodKey,
    currentPeriod: current.periodKey,
    previousValue: previousProgressive.value,
    currentValue: currentProgressive.value,
    expectedDelta,
    actualDelta,
    difference,
    tolerance: options.ordinaryTolerance,
    confidence: Math.min(relationship.confidence, previousProgressive.confidence, currentProgressive.confidence, currentMonthly.confidence),
    explanation: decreasing
      ? 'Il progressivo corrente è inferiore al precedente nello stesso ciclo annuale/di rapporto; verificare rettifiche o cessazioni.'
      : status === 'passed'
        ? 'L’incremento del progressivo è coerente con il valore mensile disponibile.'
        : 'L’incremento del progressivo differisce dal valore mensile; verificare conguagli, arretrati o dati incompleti.',
    metadata: { previousProgressive, currentProgressive, currentMonthly, adjustment },
  };
};

const duplicateChecks = (timeline: PayrollHistoricalPeriod[]): PayrollHistoricalValidationCheck[] => {
  const checks: PayrollHistoricalValidationCheck[] = [];
  const groups = new Map<string, PayrollHistoricalPeriod[]>();
  timeline.filter((item) => item.periodKey).forEach((item) => {
    const key = `${item.relationshipId ?? 'unknown'}:${item.periodKey}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });
  groups.forEach((items) => {
    if (items.length < 2) return;
    for (let index = 1; index < items.length; index += 1) {
      const previous = items[index - 1];
      const current = items[index];
      const exact = createHistoricalPayslipFingerprint(previous.payslip) === createHistoricalPayslipFingerprint(current.payslip);
      const differentTypes = previous.documentType !== current.documentType &&
        previous.documentType !== 'unknown' && current.documentType !== 'unknown';
      checks.push({
        id: `HIST_DUPLICATE:${previous.payslipId}:${current.payslipId}`,
        category: 'duplicate_period',
        status: exact || !differentTypes ? 'warning' : 'passed',
        severity: exact ? 'medium' : !differentTypes ? 'low' : 'info',
        previousPeriod: previous.periodKey,
        currentPeriod: current.periodKey,
        confidence: exact ? 100 : differentTypes ? 90 : 60,
        explanation: exact
          ? 'Possibile duplicato esatto dello stesso periodo; nessun record è stato eliminato.'
          : differentTypes
            ? 'Due cedolini differenti nello stesso mese sono distinti per tipologia e non vengono trattati come duplicati.'
            : 'Sono presenti cedolini differenti nello stesso periodo; verificare se ordinario, rettificativo o aggiuntivo.',
        metadata: { duplicateKind: exact ? 'exact' : differentTypes ? 'different_document_type' : 'possible' },
      });
    }
  });
  return checks;
};

const missingPeriodChecks = (timeline: PayrollHistoricalPeriod[]): PayrollHistoricalValidationCheck[] => {
  const ordinary = timeline.filter((item) => item.documentType === 'ordinary' && !item.ambiguous && item.year && item.month);
  const checks: PayrollHistoricalValidationCheck[] = [];
  for (let index = 1; index < ordinary.length; index += 1) {
    const previous = ordinary[index - 1];
    const current = ordinary[index];
    if (!sameRelationship(previous, current).comparable) continue;
    const gap = monthIndex(current.year!, current.month!) - monthIndex(previous.year!, previous.month!);
    if (gap <= 1) continue;
    if (ordinary.length < 3 || gap > 2) {
      checks.push(skippedCheck(
        `HIST_MISSING:${previous.payslipId}:${current.payslipId}`,
        'missing_period',
        'Storico parziale: l’intervallo non consente di concludere che i periodi intermedi non esistano.',
        previous,
        current
      ));
      continue;
    }
    const missingIndex = monthIndex(previous.year!, previous.month!) + 1;
    const missingYear = Math.floor(missingIndex / 12);
    const missingMonth = missingIndex % 12 + 1;
    checks.push({
      id: `HIST_MISSING:${previous.payslipId}:${current.payslipId}`,
      category: 'missing_period',
      status: 'warning',
      severity: 'low',
      previousPeriod: previous.periodKey,
      currentPeriod: current.periodKey,
      confidence: 70,
      explanation: `Non risulta importato un cedolino ordinario per ${monthNames[missingMonth - 1]} ${missingYear}.`,
      metadata: { missingPeriods: [periodKey(missingYear, missingMonth)] },
    });
  }
  return checks;
};

const behaviorForLine = (line: PayslipLine): PayrollHistoricalBehavior =>
  resolvePayrollCodeDefinition({ code: line.code, description: line.originalDescription ?? line.label }).definition?.historicalBehavior ?? 'unknown';
const amountForLine = (line: PayslipLine) => line.earningAmount ?? line.deductionAmount ?? line.amount;
const median = (values: number[]) => {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

export const aggregateHistoricalLines = (timeline: PayrollHistoricalPeriod[]): PayrollHistoricalLineSeries[] => {
  const byKey = new Map<string, PayrollHistoricalLineSeries>();
  timeline.filter((item) => item.documentType === 'ordinary' && item.periodKey).forEach((item) => {
    item.payslip.parsedLines.forEach((line) => {
      const canonicalKey = canonicalForLine(line);
      if (!canonicalKey || canonicalKey === 'unknown' || canonicalKey.includes('.unknown')) return;
      const current = byKey.get(canonicalKey) ?? {
        canonicalKey,
        description: line.normalizedDescription ?? line.label,
        behavior: behaviorForLine(line),
        points: [],
      };
      current.points.push({
        period: item.periodKey!,
        payslipId: item.payslipId,
        amount: amountForLine(line),
        quantity: line.quantity,
        unitValue: line.unitValue,
        quantityUnit: line.quantityUnit,
      });
      byKey.set(canonicalKey, current);
    });
  });
  return [...byKey.values()].map((series) => {
    const amounts = series.points.map((point) => point.amount).filter((value): value is number => value !== undefined);
    return {
      ...series,
      average: amounts.length ? amounts.reduce((sum, value) => sum + value, 0) / amounts.length : undefined,
      median: median(amounts),
      minimum: amounts.length ? Math.min(...amounts) : undefined,
      maximum: amounts.length ? Math.max(...amounts) : undefined,
    };
  });
};

const lineTrendChecks = (
  timeline: PayrollHistoricalPeriod[],
  series: PayrollHistoricalLineSeries[]
): PayrollHistoricalValidationCheck[] => {
  const ordinaryPeriods = timeline.filter((item) => item.documentType === 'ordinary' && item.periodKey);
  const checks: PayrollHistoricalValidationCheck[] = [];
  series.forEach((item) => {
    const uniquePeriods = new Map(item.points.map((point) => [point.period, point]));
    if (item.behavior === 'structural') {
      if (ordinaryPeriods.length < 2) {
        checks.push(skippedCheck(`HIST_LINE_STRUCTURAL:${item.canonicalKey}`, 'payroll_line_trend', 'Storico insufficiente per verificare la voce strutturale.'));
      } else {
        const missing = ordinaryPeriods.filter((period) => !uniquePeriods.has(period.periodKey!));
        const amounts = item.points.map((point) => point.amount).filter((value): value is number => value !== undefined);
        const changed = new Set(amounts.map(round2)).size > 1;
        checks.push({
          id: `HIST_LINE_STRUCTURAL:${item.canonicalKey}`,
          category: 'payroll_line_trend',
          status: missing.length || changed ? 'warning' : 'passed',
          severity: missing.length || changed ? 'medium' : 'info',
          confidence: 85,
          explanation: missing.length
            ? `La voce strutturale non è presente in ${missing.length} periodo/i ordinario/i.`
            : changed
              ? 'L’importo della voce strutturale è cambiato; verificare livello, rinnovo o decorrenza.'
              : 'La voce strutturale è presente e stabile nei periodi confrontabili.',
          sourceCanonicalKeys: [item.canonicalKey],
          metadata: { missingPeriods: missing.map((period) => period.periodKey), statistics: item },
        });
      }
    } else if (item.behavior === 'variable' && item.points.length >= 2) {
      checks.push({
        id: `HIST_LINE_VARIABLE:${item.canonicalKey}`,
        category: 'payroll_line_trend',
        status: 'passed',
        severity: 'info',
        confidence: 75,
        explanation: 'Voce variabile: le oscillazioni sono informative e non vengono considerate automaticamente anomalie.',
        sourceCanonicalKeys: [item.canonicalKey],
        metadata: { statistics: item },
      });
    }

    const ordered = [...item.points].sort((a, b) => a.period.localeCompare(b.period));
    ordered.forEach((point) => {
      if (point.quantity !== undefined && point.quantity < 0) {
        checks.push({
          id: `HIST_NEGATIVE_QUANTITY:${item.canonicalKey}:${point.period}`,
          category: 'payroll_line_trend',
          status: 'warning',
          severity: 'medium',
          currentPeriod: point.period,
          currentValue: point.quantity,
          confidence: 90,
          explanation: 'La quantità estratta è negativa; il dato viene conservato ma richiede verifica.',
          sourceCanonicalKeys: [item.canonicalKey],
        });
      }
    });
    const quantities = ordered
      .map((point) => point.quantity)
      .filter((value): value is number => value !== undefined && value >= 0);
    const quantityMedian = median(quantities);
    if (quantities.length >= 3 && quantityMedian !== undefined && quantityMedian > 0) {
      ordered.forEach((point) => {
        if (point.quantity !== undefined && point.quantity > quantityMedian * 5) {
          checks.push({
            id: `HIST_QUANTITY_OUTLIER:${item.canonicalKey}:${point.period}`,
            category: 'payroll_line_trend',
            status: 'warning',
            severity: 'low',
            currentPeriod: point.period,
            currentValue: point.quantity,
            confidence: 65,
            explanation: 'La quantità è molto superiore alla mediana storica; è una segnalazione statistica, non una correzione del cedolino.',
            sourceCanonicalKeys: [item.canonicalKey],
            metadata: { median: quantityMedian },
          });
        }
      });
    }
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1];
      const current = ordered[index];
      if (previous.unitValue !== undefined && current.unitValue !== undefined && previous.unitValue !== current.unitValue) {
        checks.push({
          id: `HIST_RATE:${item.canonicalKey}:${current.period}`,
          category: 'payroll_line_trend',
          status: 'warning',
          severity: 'low',
          previousPeriod: previous.period,
          currentPeriod: current.period,
          previousValue: previous.unitValue,
          currentValue: current.unitValue,
          difference: round2(current.unitValue - previous.unitValue),
          confidence: 85,
          explanation: 'La tariffa della stessa voce è cambiata rispetto al periodo precedente.',
          sourceCanonicalKeys: [item.canonicalKey],
        });
      }
      if (previous.quantityUnit && current.quantityUnit && previous.quantityUnit !== current.quantityUnit) {
        checks.push({
          id: `HIST_UNIT:${item.canonicalKey}:${current.period}`,
          category: 'payroll_line_trend',
          status: 'warning',
          severity: 'medium',
          previousPeriod: previous.period,
          currentPeriod: current.period,
          confidence: 90,
          explanation: `L’unità della voce è cambiata da ${previous.quantityUnit} a ${current.quantityUnit}.`,
          sourceCanonicalKeys: [item.canonicalKey],
          metadata: { previousUnit: previous.quantityUnit, currentUnit: current.quantityUnit },
        });
      }
    }
  });
  return checks;
};

export const validatePayrollHistory = (
  payslips: PayslipImport[],
  options: PayrollHistoricalValidationOptions = {}
): PayrollHistoricalValidationResult => {
  const resolvedOptions = {
    ordinaryTolerance: options.ordinaryTolerance ?? 0.02,
    warningTolerance: options.warningTolerance ?? 0.1,
    minimumConfidence: options.minimumConfidence ?? 70,
  };
  const timeline = buildPayrollHistoricalTimeline(payslips, options);
  const comparable = timeline.filter((item) => !item.ambiguous && item.documentType === 'ordinary');
  const checks: PayrollHistoricalValidationCheck[] = [...duplicateChecks(timeline), ...missingPeriodChecks(timeline)];
  for (let index = 1; index < comparable.length; index += 1) {
    const previous = comparable[index - 1];
    const current = comparable[index];
    progressiveDefinitions.forEach((definition) => checks.push(progressiveCheck(definition, previous, current, resolvedOptions)));
  }
  const lineSeries = aggregateHistoricalLines(timeline);
  checks.push(...lineTrendChecks(timeline, lineSeries));
  if (timeline.some((item) => item.ambiguous)) {
    checks.push({
      id: 'HIST_AMBIGUOUS_PERIODS',
      category: 'data_quality',
      status: 'warning',
      severity: 'medium',
      confidence: 90,
      explanation: `${timeline.filter((item) => item.ambiguous).length} cedolino/i con periodo ambiguo sono esclusi dai confronti certificati.`,
      metadata: { payslipIds: timeline.filter((item) => item.ambiguous).map((item) => item.payslipId) },
    });
  }

  const count = (status: PayrollHistoricalCheckStatus) => checks.filter((check) => check.status === status).length;
  const summary = { passed: count('passed'), warnings: count('warning'), failed: count('failed'), skipped: count('skipped') };
  const highFailure = checks.some((check) => check.status === 'failed' && check.severity === 'high');
  const comparableRelationships = comparable.slice(1).filter((item, index) => sameRelationship(comparable[index], item).comparable).length;
  const overallStatus: PayrollHistoricalOverallStatus = highFailure
    ? 'inconsistent'
    : comparable.length < 2 || comparableRelationships === 0
      ? 'insufficient_data'
      : summary.warnings || summary.skipped || summary.failed ? 'valid_with_warnings' : 'valid';
  const periodQuality = timeline.length ? timeline.reduce((sum, item) => sum + item.periodConfidence, 0) / timeline.length : 0;
  const relationshipQuality = timeline.length ? timeline.reduce((sum, item) => sum + item.relationshipConfidence, 0) / timeline.length : 0;
  const fiscalCoverage = timeline.length ? timeline.filter((item) => item.payslip.fiscalDataVersion === 'fiscal-v1').length / timeline.length : 0;
  const confidence = Math.max(0, Math.min(100, Math.round(
    periodQuality * 0.35 + relationshipQuality * 0.35 + fiscalCoverage * 20 +
    Math.min(comparableRelationships, 4) * 2.5 - summary.warnings * 2 - summary.failed * 8
  )));
  return {
    schemaVersion: 'historical-v1',
    overallStatus,
    confidence,
    timeline,
    checks,
    lineSeries,
    summary,
    warnings: checks.filter((check) => check.status === 'warning').map((check) => check.explanation),
    errors: checks.filter((check) => check.status === 'failed').map((check) => check.explanation),
    informationalNotes: checks.filter((check) => check.status === 'skipped').map((check) => check.explanation),
  };
};
