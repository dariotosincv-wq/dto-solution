import { normalizePayrollValidationConfidence } from '../payrollObservedAdapter';
import { selectFiscalObservation } from '../fiscalObservationSelector';
import {
  PAYROLL_VALIDATION_CATEGORIES,
  type PayrollObservedFiscalValue,
  type PayrollObservedSnapshot,
  type PayrollValidationCheck,
  type PayrollValidationContext,
  type PayrollValidationEvidence,
  type PayrollValidationMissingInput,
  type PayrollValidationResult,
} from '../types';
import { INPS_OBSERVATION_QUALITY_MIN_CONFIDENCE } from './inpsObservationQualityCheck';

export const INPS_OBSERVED_CALCULATION_CONSISTENCY_CHECK_ID =
  'fiscal.inps-observed-calculation-consistency';
export const INPS_OBSERVED_CALCULATION_CONSISTENCY_CHECK_VERSION = '1.0.0';
export const INPS_OBSERVED_CALCULATION_TOLERANCE_EUR = 0.02;

export const INPS_OBSERVED_CALCULATION_FIELDS = Object.freeze({
  taxable: 'socialSecurity.taxable',
  rate: 'socialSecurity.contributionRate',
  contribution: 'socialSecurity.employeeContributions',
} as const);

export interface InpsObservedCalculationConsistencyCheckOptions {
  readonly clock?: () => string;
}

type RequiredField = keyof typeof INPS_OBSERVED_CALCULATION_FIELDS;

const missingInput = (field: RequiredField): PayrollValidationMissingInput => ({
  id: `payroll.fiscalObservations.${INPS_OBSERVED_CALCULATION_FIELDS[field]}`,
  description: `Osservazione fiscale ${INPS_OBSERVED_CALCULATION_FIELDS[field]}`,
  required: true,
  effect: 'BLOCKS_CHECK',
});

const moneyValue = (value: number) => ({
  kind: 'NUMBER' as const,
  value,
  unit: 'EUR' as const,
});

const unavailableValue = (description: string) => ({
  kind: 'UNAVAILABLE' as const,
  reason: 'NOT_DETERMINABLE' as const,
  description,
});

const minimumConfidence = (
  payroll: Readonly<PayrollObservedSnapshot> | undefined,
  observations: ReadonlyArray<Readonly<PayrollObservedFiscalValue>>
): number =>
  observations.length > 0
    ? Math.min(
        ...observations.map((observation) =>
          normalizePayrollValidationConfidence(observation.confidence)
        )
      )
    : normalizePayrollValidationConfidence(payroll?.confidence);

const observationEvidence = (
  payroll: Readonly<PayrollObservedSnapshot>,
  field: RequiredField,
  observation: Readonly<PayrollObservedFiscalValue>
): PayrollValidationEvidence => ({
  id: `inps-observed-calculation:${field}`,
  source: observation.provenance[0]?.source ?? 'PAYROLL',
  description: `Valore osservato: ${INPS_OBSERVED_CALCULATION_FIELDS[field]}`,
  value: {
    kind: 'TEXT',
    value: `${String(observation.value)} [${observation.unit}]`,
  },
  period: payroll.period,
  confidence: normalizePayrollValidationConfidence(observation.confidence),
  technicalReference: [
    `canonicalField=${INPS_OBSERVED_CALCULATION_FIELDS[field]}`,
    `unit=${observation.unit}`,
    `fiscalPeriod=${observation.fiscalPeriod}`,
    `classification=${observation.classificationStatus}`,
    `source=${observation.source}`,
    `ambiguous=${observation.ambiguous === true}`,
  ].join('; '),
});

const createBaseResult = (
  clock: () => string,
  confidence: number
) => ({
  id: INPS_OBSERVED_CALCULATION_CONSISTENCY_CHECK_ID,
  checkVersion: INPS_OBSERVED_CALCULATION_CONSISTENCY_CHECK_VERSION,
  title: 'Coerenza matematica dei contributi INPS osservati',
  category: PAYROLL_VALIDATION_CATEGORIES.FISCAL,
  confidence,
  ruleSource: {
    id: 'calculation.inps-observed-taxable-times-rate',
    version: INPS_OBSERVED_CALCULATION_CONSISTENCY_CHECK_VERSION,
    sourceType: 'CALCULATION' as const,
    status: 'CONFIRMED' as const,
    confidence: 100,
    documentReference:
      'Confronto tecnico tra imponibile, aliquota e contributo osservati; nessuna valutazione normativa',
  },
  executedAt: clock(),
});

export const createInpsObservedCalculationConsistencyCheck = (
  options: Readonly<InpsObservedCalculationConsistencyCheckOptions> = {}
): PayrollValidationCheck => {
  const clock = options.clock ?? (() => new Date().toISOString());

  return {
    id: INPS_OBSERVED_CALCULATION_CONSISTENCY_CHECK_ID,
    version: INPS_OBSERVED_CALCULATION_CONSISTENCY_CHECK_VERSION,
    title: 'Coerenza matematica dei contributi INPS osservati',
    category: PAYROLL_VALIDATION_CATEGORIES.FISCAL,
    requiredInputs: Object.keys(INPS_OBSERVED_CALCULATION_FIELDS).map((field) => ({
      id: `payroll.fiscalObservations.${INPS_OBSERVED_CALCULATION_FIELDS[field as RequiredField]}`,
      description: `Osservazione fiscale ${INPS_OBSERVED_CALCULATION_FIELDS[field as RequiredField]}`,
    })),
    optionalInputs: [],
    applicability: {
      description:
        'Applicabile allo snapshot payroll; dati mancanti o non determinabili producono INFO.',
      evaluate: (context) => context.payroll !== undefined,
    },
    execute: (context: Readonly<PayrollValidationContext>): PayrollValidationResult => {
      const payroll = context.payroll;
      const selections = {
        taxable: selectFiscalObservation(
          payroll?.fiscalObservations,
          INPS_OBSERVED_CALCULATION_FIELDS.taxable
        ),
        rate: selectFiscalObservation(
          payroll?.fiscalObservations,
          INPS_OBSERVED_CALCULATION_FIELDS.rate
        ),
        contribution: selectFiscalObservation(
          payroll?.fiscalObservations,
          INPS_OBSERVED_CALCULATION_FIELDS.contribution
        ),
      };
      const candidateGroups = {
        taxable: selections.taxable.candidates,
        rate: selections.rate.candidates,
        contribution: selections.contribution.candidates,
      };
      const allCandidates = Object.values(candidateGroups).flat();
      const confidence = minimumConfidence(payroll, allCandidates);
      const baseResult = createBaseResult(clock, confidence);
      const missingFields = (Object.keys(selections) as RequiredField[]).filter(
        (field) => selections[field].status === 'MISSING'
      );

      if (!payroll?.fiscalObservations || missingFields.length > 0) {
        return {
          ...baseResult,
          status: 'INFO',
          actualValue: unavailableValue('Uno o più valori fiscali osservati sono assenti'),
          shortExplanation: 'Mancano dati osservati necessari al confronto INPS.',
          detailedExplanation:
            'Il controllo usa esclusivamente fiscalObservations e non applica fallback verso riepiloghi, righe paga, parser o Rule Engine.',
          evidence: [],
          missingInputs: payroll?.fiscalObservations
            ? missingFields.map(missingInput)
            : [{ ...missingInput('taxable'), id: 'payroll.fiscalObservations', description: 'Osservazioni fiscali complete' }],
          metadata: { issues: ['MISSING_OBSERVATION'], missingFields },
        };
      }

      const concurrentFields = (Object.keys(selections) as RequiredField[]).filter(
        (field) => selections[field].status === 'MULTIPLE_CANDIDATES'
      );
      if (concurrentFields.length > 0) {
        return {
          ...baseResult,
          status: 'WARNING',
          shortExplanation: 'Sono presenti osservazioni fiscali concorrenti.',
          detailedExplanation:
            'Il controllo non sceglie arbitrariamente tra candidati con lo stesso canonicalField.',
          evidence: allCandidates.map((observation, index) => ({
            ...observationEvidence(payroll, 'taxable', observation),
            id: `inps-observed-calculation:concurrent:${index}`,
          })),
          missingInputs: [],
          metadata: { issues: ['CONCURRENT_OBSERVATIONS'], concurrentFields },
        };
      }

      const selected = {
        taxable: 'observation' in selections.taxable
          ? selections.taxable.observation
          : candidateGroups.taxable[0],
        rate: 'observation' in selections.rate
          ? selections.rate.observation
          : candidateGroups.rate[0],
        contribution: 'observation' in selections.contribution
          ? selections.contribution.observation
          : candidateGroups.contribution[0],
      };
      const selectedEntries = Object.entries(selected) as Array<
        [RequiredField, Readonly<PayrollObservedFiscalValue>]
      >;
      const evidence = selectedEntries.map(([field, observation]) =>
        observationEvidence(payroll, field, observation)
      );
      const nonNumericFields = selectedEntries
        .filter(([, observation]) =>
          typeof observation.value !== 'number' || !Number.isFinite(observation.value)
        )
        .map(([field]) => field);
      const invalidUnitFields: RequiredField[] = [];
      if (selected.taxable.unit !== 'EUR') invalidUnitFields.push('taxable');
      if (selected.contribution.unit !== 'EUR') invalidUnitFields.push('contribution');
      if (selected.rate.unit !== 'PERCENT_POINTS' && selected.rate.unit !== 'FRACTION') {
        invalidUnitFields.push('rate');
      }

      if (nonNumericFields.length > 0 || invalidUnitFields.length > 0) {
        return {
          ...baseResult,
          status: 'INFO',
          actualValue: unavailableValue('Valore non numerico oppure unità non determinabile'),
          shortExplanation: 'I valori osservati non sono utilizzabili matematicamente.',
          detailedExplanation:
            'La scala non viene dedotta dal numero, dal rawText o dal canonicalField.',
          evidence,
          missingInputs: [...new Set([...nonNumericFields, ...invalidUnitFields])].map(missingInput),
          metadata: { issues: ['NON_DETERMINABLE_VALUE_OR_UNIT'], nonNumericFields, invalidUnitFields },
        };
      }

      const qualityIssues: string[] = [];
      if (selectedEntries.some(([, observation]) => observation.ambiguous === true)) {
        qualityIssues.push('AMBIGUOUS_OBSERVATION');
      }
      if (selectedEntries.some(([, observation]) => observation.confidence < INPS_OBSERVATION_QUALITY_MIN_CONFIDENCE)) {
        qualityIssues.push('LOW_CONFIDENCE');
      }
      if (selectedEntries.some(([, observation]) => observation.fiscalPeriod !== 'monthly')) {
        qualityIssues.push('INCOHERENT_OR_NON_MONTHLY_PERIOD');
      }
      if (selectedEntries.some(([, observation]) => observation.classificationStatus !== 'CLASSIFIED')) {
        qualityIssues.push('UNCLASSIFIED_OBSERVATION');
      }
      if (selectedEntries.some(([, observation]) => observation.provenance.length === 0)) {
        qualityIssues.push('PROVENANCE_MISSING');
      }
      if (qualityIssues.length > 0) {
        return {
          ...baseResult,
          status: 'WARNING',
          shortExplanation: 'I dati esistono ma non hanno qualità sufficiente per il confronto.',
          detailedExplanation: `Criticità osservate: ${qualityIssues.join(', ')}.`,
          evidence,
          missingInputs: [],
          metadata: { issues: qualityIssues },
        };
      }

      const taxable = selected.taxable.value as number;
      const observedRate = selected.rate.value as number;
      const observedContribution = selected.contribution.value as number;
      const normalizedRate = selected.rate.unit === 'PERCENT_POINTS'
        ? observedRate / 100
        : observedRate;
      const expectedCents = Math.round(taxable * normalizedRate * 100);
      const observedCents = Math.round(observedContribution * 100);
      const differenceCents = observedCents - expectedCents;
      const expectedContribution = expectedCents / 100;
      const actualContribution = observedCents / 100;
      const difference = differenceCents / 100;
      const passed = Math.abs(differenceCents) <= 2;
      const calculationEvidence: PayrollValidationEvidence[] = [
        ...evidence,
        {
          id: 'inps-observed-calculation:normalized-rate',
          source: 'CALCULATION',
          description: 'Aliquota osservata normalizzata per il calcolo',
          value: { kind: 'TEXT', value: String(normalizedRate) },
          period: payroll.period,
          confidence,
          technicalReference: `${observedRate} [${selected.rate.unit}] -> ${normalizedRate}`,
        },
        {
          id: 'inps-observed-calculation:formula',
          source: 'CALCULATION',
          description: 'Formula tecnica applicata',
          value: { kind: 'TEXT', value: 'taxable * normalizedRate' },
          period: payroll.period,
          confidence,
          technicalReference: `${taxable} * ${normalizedRate} = ${expectedContribution} EUR`,
        },
        {
          id: 'inps-observed-calculation:expected-contribution',
          source: 'CALCULATION',
          description: 'Contributo atteso arrotondato ai centesimi',
          value: moneyValue(expectedContribution),
          period: payroll.period,
          confidence,
        },
      ];

      return {
        ...baseResult,
        status: passed ? 'PASS' : 'FAIL',
        expectedValue: moneyValue(expectedContribution),
        actualValue: moneyValue(actualContribution),
        difference: moneyValue(difference),
        tolerance: moneyValue(INPS_OBSERVED_CALCULATION_TOLERANCE_EUR),
        shortExplanation: passed
          ? 'Il contributo osservato è coerente con imponibile e aliquota osservati.'
          : 'Il contributo osservato non coincide con il prodotto matematico dei valori osservati.',
        detailedExplanation: passed
          ? 'La differenza in centesimi rientra nella tolleranza tecnica di 0,02 EUR.'
          : 'Il risultato segnala esclusivamente un’incoerenza matematica; non valuta la correttezza normativa dell’aliquota.',
        suggestion: passed ? undefined : 'Verificare i tre valori riportati nel cedolino.',
        evidence: calculationEvidence,
        missingInputs: [],
        metadata: {
          formula: 'taxable * normalizedRate',
          rateUnit: selected.rate.unit,
          normalizedRate,
          expectedCents,
          observedCents,
          differenceCents,
          toleranceCents: 2,
          fiscalPeriod: 'monthly',
        },
      };
    },
  };
};

export const inpsObservedCalculationConsistencyCheck =
  createInpsObservedCalculationConsistencyCheck();
