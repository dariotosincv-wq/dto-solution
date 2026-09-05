import { normalizePayrollValidationConfidence } from '../payrollObservedAdapter';
import type {
  PayrollObservedSnapshot,
  PayrollValidationCheck,
  PayrollValidationContext,
  PayrollValidationEvidence,
  PayrollValidationMissingInput,
  PayrollValidationResult as EnginePayrollValidationResult,
} from '../types';

export const NET_PAY_CONSISTENCY_CHECK_ID = 'economic.net-pay-consistency';
export const NET_PAY_CONSISTENCY_CHECK_VERSION = '1.0.0';
export const NET_PAY_CONSISTENCY_TOLERANCE_CENTS = 2;

export interface NetPayConsistencyCheckOptions {
  readonly clock?: () => string;
}

const euroValue = (value: number) => ({
  kind: 'NUMBER' as const,
  value,
  unit: 'EUR' as const,
});

const toCents = (value: number): number => Math.round((value + Number.EPSILON) * 100);
const fromCents = (value: number): number => value / 100;

const fieldConfidence = (
  payroll: Readonly<PayrollObservedSnapshot>,
  field: 'totalEarnings' | 'totalDeductions' | 'netAmount'
): number =>
  normalizePayrollValidationConfidence(
    payroll.economicSummary.fieldConfidence?.[field],
    payroll.confidence
  );

const resultConfidence = (payroll?: Readonly<PayrollObservedSnapshot>): number => {
  if (!payroll) return normalizePayrollValidationConfidence(undefined);
  const confidence = payroll.economicSummary.fieldConfidence;
  const completeFieldConfidence =
    confidence?.totalEarnings !== undefined &&
    confidence.totalDeductions !== undefined &&
    confidence.netAmount !== undefined;

  if (completeFieldConfidence) {
    return Math.min(
      normalizePayrollValidationConfidence(confidence.totalEarnings),
      normalizePayrollValidationConfidence(confidence.totalDeductions),
      normalizePayrollValidationConfidence(confidence.netAmount)
    );
  }
  return normalizePayrollValidationConfidence(payroll.confidence);
};

const payrollEvidence = (
  payroll: Readonly<PayrollObservedSnapshot>,
  id: string,
  description: string,
  field: 'totalEarnings' | 'totalDeductions' | 'netAmount',
  value: number
): PayrollValidationEvidence => ({
  id,
  source: 'PAYROLL',
  description,
  value: euroValue(value),
  period: payroll.period,
  confidence: fieldConfidence(payroll, field),
  technicalReference: `payroll.economicSummary.${field}`,
});

const missingInput = (
  id: string,
  description: string
): PayrollValidationMissingInput => ({
  id,
  description,
  required: true,
  effect: 'BLOCKS_CHECK',
});

export const createNetPayConsistencyCheck = (
  options: Readonly<NetPayConsistencyCheckOptions> = {}
): PayrollValidationCheck => {
  const clock = options.clock ?? (() => new Date().toISOString());

  return {
    id: NET_PAY_CONSISTENCY_CHECK_ID,
    version: NET_PAY_CONSISTENCY_CHECK_VERSION,
    title: 'Coerenza del netto',
    category: 'ECONOMIC',
    requiredInputs: [
      { id: 'payroll.economicSummary.totalEarnings', description: 'Totale competenze' },
      { id: 'payroll.economicSummary.totalDeductions', description: 'Totale trattenute' },
      { id: 'payroll.economicSummary.netAmount', description: 'Netto osservato' },
    ],
    optionalInputs: [
      {
        id: 'payroll.economicSummary.rounding',
        description: 'Arrotondamento osservato, non applicato nella versione 1.0.0',
      },
    ],
    applicability: {
      description: 'Applicabile a un cedolino con riepilogo economico osservato.',
      evaluate: (context) => context.payroll !== undefined,
    },
    execute: (
      context: Readonly<PayrollValidationContext>
    ): EnginePayrollValidationResult => {
      const payroll = context.payroll;
      const totalEarnings = payroll?.economicSummary.totalEarnings;
      const totalDeductions = payroll?.economicSummary.totalDeductions;
      const observedNet = payroll?.economicSummary.netAmount;
      const missingInputs: PayrollValidationMissingInput[] = [];

      if (totalEarnings === undefined) {
        missingInputs.push(missingInput(
          'payroll.economicSummary.totalEarnings',
          'Totale competenze'
        ));
      }
      if (totalDeductions === undefined) {
        missingInputs.push(missingInput(
          'payroll.economicSummary.totalDeductions',
          'Totale trattenute'
        ));
      }
      if (observedNet === undefined) {
        missingInputs.push(missingInput(
          'payroll.economicSummary.netAmount',
          'Netto osservato'
        ));
      }

      const evidence: PayrollValidationEvidence[] = [];
      if (payroll && totalEarnings !== undefined) {
        evidence.push(payrollEvidence(
          payroll,
          'payroll-total-earnings',
          'Totale competenze osservato',
          'totalEarnings',
          totalEarnings
        ));
      }
      if (payroll && totalDeductions !== undefined) {
        evidence.push(payrollEvidence(
          payroll,
          'payroll-total-deductions',
          'Totale trattenute osservato',
          'totalDeductions',
          totalDeductions
        ));
      }
      if (payroll && observedNet !== undefined) {
        evidence.push(payrollEvidence(
          payroll,
          'payroll-net-amount',
          'Netto osservato',
          'netAmount',
          observedNet
        ));
      }

      const baseResult = {
        id: NET_PAY_CONSISTENCY_CHECK_ID,
        checkVersion: NET_PAY_CONSISTENCY_CHECK_VERSION,
        title: 'Coerenza del netto',
        category: 'ECONOMIC' as const,
        confidence: resultConfidence(payroll),
        tolerance: euroValue(fromCents(NET_PAY_CONSISTENCY_TOLERANCE_CENTS)),
        evidence,
        missingInputs,
        ruleSource: {
          id: 'calculation.net-equals-earnings-minus-deductions',
          version: NET_PAY_CONSISTENCY_CHECK_VERSION,
          sourceType: 'CALCULATION' as const,
          status: 'CONFIRMED' as const,
          confidence: 100,
          documentReference: 'totale competenze - totale trattenute = netto',
        },
        executedAt: clock(),
        metadata: {
          formula: 'totalEarnings - totalDeductions = netAmount',
          monetaryPrecision: 'integer_cents',
          roundingApplied: false,
          observedRoundingIgnored: payroll?.economicSummary.rounding !== undefined,
        },
      };

      if (
        missingInputs.length > 0 ||
        totalEarnings === undefined ||
        totalDeductions === undefined ||
        observedNet === undefined
      ) {
        return {
          ...baseResult,
          status: 'INFO',
          shortExplanation: 'Non è possibile verificare la coerenza del netto.',
          detailedExplanation: 'Mancano uno o più totali necessari per eseguire il controllo.',
          suggestion: 'Controlla che il cedolino contenga totale competenze, totale trattenute e netto.',
        };
      }

      const expectedNetCents = toCents(totalEarnings) - toCents(totalDeductions);
      const actualNetCents = toCents(observedNet);
      const differenceCents = actualNetCents - expectedNetCents;
      const passed = Math.abs(differenceCents) <= NET_PAY_CONSISTENCY_TOLERANCE_CENTS;
      const expectedNet = fromCents(expectedNetCents);
      const difference = fromCents(differenceCents);
      evidence.push({
        id: 'net-pay-calculation',
        source: 'CALCULATION',
        description: 'Totale competenze meno totale trattenute',
        value: euroValue(expectedNet),
        period: payroll.period,
        confidence: baseResult.confidence,
        technicalReference: 'totalEarnings - totalDeductions',
      });

      return {
        ...baseResult,
        status: passed ? 'PASS' : 'FAIL',
        expectedValue: euroValue(expectedNet),
        actualValue: euroValue(fromCents(actualNetCents)),
        difference: euroValue(difference),
        shortExplanation: passed
          ? 'Il netto è coerente con competenze e trattenute.'
          : 'Il netto non coincide con competenze meno trattenute.',
        detailedExplanation: passed
          ? 'Le competenze meno le trattenute corrispondono al netto indicato nel cedolino entro la tolleranza di arrotondamento.'
          : 'Il netto osservato differisce dal valore matematicamente atteso oltre la tolleranza ammessa.',
        suggestion: passed
          ? 'Nessuna verifica necessaria.'
          : 'Verifica i totali del cedolino o chiedi chiarimenti all’ufficio paghe.',
      };
    },
  };
};

export const netPayConsistencyCheck = createNetPayConsistencyCheck();
