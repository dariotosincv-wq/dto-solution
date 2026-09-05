import { normalizePayrollValidationConfidence } from '../payrollObservedAdapter';
import type {
  PayrollObservedLine,
  PayrollObservedSnapshot,
  PayrollValidationCheck,
  PayrollValidationContext,
  PayrollValidationEvidence,
  PayrollValidationMissingInput,
  PayrollValidationResult as EnginePayrollValidationResult,
} from '../types';

export const SUMMARY_CONSISTENCY_CHECK_ID = 'economic.summary-consistency';
export const SUMMARY_CONSISTENCY_CHECK_VERSION = '1.0.0';
export const SUMMARY_CONSISTENCY_TOLERANCE_CENTS = 2;

export interface SummaryConsistencyCheckOptions {
  readonly clock?: () => string;
}

const euroValue = (value: number) => ({
  kind: 'NUMBER' as const,
  value,
  unit: 'EUR' as const,
});

const quantityValue = (value: number) => ({
  kind: 'NUMBER' as const,
  value,
  unit: 'QUANTITY' as const,
});

const toCents = (value: number): number => Math.round((value + Number.EPSILON) * 100);
const fromCents = (value: number): number => value / 100;

const missingInput = (
  id: string,
  description: string
): PayrollValidationMissingInput => ({
  id,
  description,
  required: true,
  effect: 'BLOCKS_CHECK',
});

const summaryConfidence = (
  payroll: Readonly<PayrollObservedSnapshot>,
  field: 'totalEarnings' | 'totalDeductions'
): number =>
  normalizePayrollValidationConfidence(
    payroll.economicSummary.fieldConfidence?.[field],
    payroll.confidence
  );

const resultConfidence = (
  payroll: Readonly<PayrollObservedSnapshot> | undefined,
  economicLines: ReadonlyArray<Readonly<PayrollObservedLine>>
): number => {
  if (!payroll) return normalizePayrollValidationConfidence(undefined);
  const fieldConfidence = payroll.economicSummary.fieldConfidence;
  if (
    fieldConfidence?.totalEarnings === undefined ||
    fieldConfidence.totalDeductions === undefined
  ) {
    return normalizePayrollValidationConfidence(payroll.confidence);
  }

  return Math.min(
    normalizePayrollValidationConfidence(fieldConfidence.totalEarnings),
    normalizePayrollValidationConfidence(fieldConfidence.totalDeductions),
    ...economicLines.map((line) => normalizePayrollValidationConfidence(line.confidence))
  );
};

const pairValue = (earnings: number, deductions: number) => ({
  kind: 'TEXT' as const,
  value: `competenze=${earnings.toFixed(2)} EUR; trattenute=${deductions.toFixed(2)} EUR`,
});

export const createSummaryConsistencyCheck = (
  options: Readonly<SummaryConsistencyCheckOptions> = {}
): PayrollValidationCheck => {
  const clock = options.clock ?? (() => new Date().toISOString());

  return {
    id: SUMMARY_CONSISTENCY_CHECK_ID,
    version: SUMMARY_CONSISTENCY_CHECK_VERSION,
    title: 'Coerenza del riepilogo economico',
    category: 'ECONOMIC',
    requiredInputs: [
      { id: 'payroll.lines', description: 'Righe paga con classificazione economica completa' },
      { id: 'payroll.economicSummary.totalEarnings', description: 'Totale competenze osservato' },
      { id: 'payroll.economicSummary.totalDeductions', description: 'Totale trattenute osservato' },
    ],
    optionalInputs: [],
    applicability: {
      description: 'Applicabile a un cedolino osservato.',
      evaluate: (context) => context.payroll !== undefined,
    },
    execute: (
      context: Readonly<PayrollValidationContext>
    ): EnginePayrollValidationResult => {
      const payroll = context.payroll;
      const lines = payroll?.lines ?? [];
      const earningLines = lines.filter((line) => line.economicType === 'earning');
      const deductionLines = lines.filter((line) => line.economicType === 'deduction');
      const economicLines = [...earningLines, ...deductionLines];
      const missingInputs: PayrollValidationMissingInput[] = [];

      if (!payroll?.lines.length) {
        missingInputs.push(missingInput('payroll.lines', 'Righe paga'));
      }
      if (payroll?.economicSummary.totalEarnings === undefined) {
        missingInputs.push(missingInput(
          'payroll.economicSummary.totalEarnings',
          'Totale competenze osservato'
        ));
      }
      if (payroll?.economicSummary.totalDeductions === undefined) {
        missingInputs.push(missingInput(
          'payroll.economicSummary.totalDeductions',
          'Totale trattenute osservato'
        ));
      }

      lines.forEach((line, index) => {
        if (line.economicType === undefined) {
          missingInputs.push(missingInput(
            `payroll.lines.${index}.economicType`,
            `Classificazione economica della riga ${index + 1}`
          ));
        } else if (line.economicType === 'earning' && line.earningAmount === undefined) {
          missingInputs.push(missingInput(
            `payroll.lines.${index}.earningAmount`,
            `Importo competenza della riga ${index + 1}`
          ));
        } else if (line.economicType === 'deduction' && line.deductionAmount === undefined) {
          missingInputs.push(missingInput(
            `payroll.lines.${index}.deductionAmount`,
            `Importo trattenuta della riga ${index + 1}`
          ));
        }
      });

      const confidence = resultConfidence(payroll, economicLines);
      const evidence: PayrollValidationEvidence[] = [];
      const baseResult = {
        id: SUMMARY_CONSISTENCY_CHECK_ID,
        checkVersion: SUMMARY_CONSISTENCY_CHECK_VERSION,
        title: 'Coerenza del riepilogo economico',
        category: 'ECONOMIC' as const,
        confidence,
        tolerance: euroValue(fromCents(SUMMARY_CONSISTENCY_TOLERANCE_CENTS)),
        evidence,
        missingInputs,
        ruleSource: {
          id: 'calculation.summary-equals-economic-lines',
          version: SUMMARY_CONSISTENCY_CHECK_VERSION,
          sourceType: 'CALCULATION' as const,
          status: 'CONFIRMED' as const,
          confidence: 100,
          documentReference: 'somma righe earning/deduction = totali osservati',
        },
        executedAt: clock(),
        metadata: {
          formula: 'sum(earning lines) = totalEarnings; sum(deduction lines) = totalDeductions',
          monetaryPrecision: 'integer_cents',
          completenessRequired: true,
          earningLineCount: earningLines.length,
          deductionLineCount: deductionLines.length,
          consideredLineCount: economicLines.length,
        },
      };

      if (!payroll || missingInputs.length > 0) {
        return {
          ...baseResult,
          status: 'INFO',
          shortExplanation: 'Non è possibile verificare il riepilogo economico.',
          detailedExplanation: 'Le righe paga o i dati necessari non sono completi; il controllo non usa un sottoinsieme parziale per dichiarare PASS.',
          suggestion: 'Verifica che tutte le righe abbiano classificazione economica e importo necessari.',
        };
      }

      const reconstructedEarningsCents = earningLines.reduce(
        (sum, line) => sum + toCents(line.earningAmount as number),
        0
      );
      const reconstructedDeductionsCents = deductionLines.reduce(
        (sum, line) => sum + toCents(line.deductionAmount as number),
        0
      );
      const observedEarningsCents = toCents(payroll.economicSummary.totalEarnings as number);
      const observedDeductionsCents = toCents(payroll.economicSummary.totalDeductions as number);
      const earningsDifferenceCents = observedEarningsCents - reconstructedEarningsCents;
      const deductionsDifferenceCents = observedDeductionsCents - reconstructedDeductionsCents;
      const reconstructedEarnings = fromCents(reconstructedEarningsCents);
      const reconstructedDeductions = fromCents(reconstructedDeductionsCents);
      const observedEarnings = fromCents(observedEarningsCents);
      const observedDeductions = fromCents(observedDeductionsCents);
      const earningsDifference = fromCents(earningsDifferenceCents);
      const deductionsDifference = fromCents(deductionsDifferenceCents);
      const passed =
        Math.abs(earningsDifferenceCents) <= SUMMARY_CONSISTENCY_TOLERANCE_CENTS &&
        Math.abs(deductionsDifferenceCents) <= SUMMARY_CONSISTENCY_TOLERANCE_CENTS;

      evidence.push(
        {
          id: 'reconstructed-earnings',
          source: 'CALCULATION',
          description: 'Somma delle righe di competenza',
          value: euroValue(reconstructedEarnings),
          period: payroll.period,
          confidence,
          technicalReference: 'sum(lines[economicType=earning].earningAmount)',
        },
        {
          id: 'reconstructed-deductions',
          source: 'CALCULATION',
          description: 'Somma delle righe di trattenuta',
          value: euroValue(reconstructedDeductions),
          period: payroll.period,
          confidence,
          technicalReference: 'sum(lines[economicType=deduction].deductionAmount)',
        },
        {
          id: 'considered-line-count',
          source: 'CALCULATION',
          description: 'Numero di righe economiche considerate',
          value: quantityValue(economicLines.length),
          period: payroll.period,
          confidence,
          technicalReference: 'earningLines.length + deductionLines.length',
        },
        {
          id: 'summary-consistency-formula',
          source: 'CALCULATION',
          description: 'Formula di confronto del riepilogo economico',
          value: {
            kind: 'TEXT',
            value: 'Σ competenze = totale competenze; Σ trattenute = totale trattenute',
          },
          period: payroll.period,
          confidence: 100,
          technicalReference: baseResult.metadata.formula,
        }
      );

      return {
        ...baseResult,
        status: passed ? 'PASS' : 'FAIL',
        expectedValue: pairValue(reconstructedEarnings, reconstructedDeductions),
        actualValue: pairValue(observedEarnings, observedDeductions),
        difference: pairValue(earningsDifference, deductionsDifference),
        shortExplanation: passed
          ? 'Il riepilogo economico coincide con le righe paga.'
          : 'Il riepilogo economico non coincide con le righe paga.',
        detailedExplanation: passed
          ? 'Le somme delle competenze e delle trattenute coincidono con entrambi i totali osservati entro la tolleranza.'
          : 'Almeno uno dei totali osservati differisce dalla somma delle relative righe oltre la tolleranza ammessa.',
        suggestion: passed
          ? 'Nessuna verifica necessaria.'
          : 'Verifica le righe paga e i totali del riepilogo economico.',
        metadata: {
          ...baseResult.metadata,
          reconstructedEarnings,
          reconstructedDeductions,
          observedEarnings,
          observedDeductions,
          earningsDifference,
          deductionsDifference,
        },
      };
    },
  };
};

export const summaryConsistencyCheck = createSummaryConsistencyCheck();
