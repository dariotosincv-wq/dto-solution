import {
  INPS_OBSERVATION_QUALITY_CANONICAL_FIELD,
  INPS_OBSERVATION_QUALITY_MIN_CONFIDENCE,
} from './inpsObservationQualityCheck';
import {
  PAYROLL_VALIDATION_CATEGORIES,
  type PayrollObservedFiscalValue,
  type PayrollObservedSnapshot,
  type PayrollValidationCheck,
  type PayrollValidationContext,
  type PayrollValidationEvidence,
  type PayrollValidationMissingInput,
  type PayrollValidationResult,
  type PayrollValidationValue,
} from '../types';
import { selectFiscalObservation } from '../fiscalObservationSelector';

export const INPS_TAXABLE_STRUCTURAL_CONSISTENCY_CHECK_ID =
  'fiscal.inps-taxable-structural-consistency';
export const INPS_TAXABLE_STRUCTURAL_CONSISTENCY_CHECK_VERSION = '1.0.0';

export interface InpsTaxableStructuralConsistencyCheckOptions {
  readonly clock?: () => string;
}

const normalizeConfidence = (confidence?: number): number => {
  if (confidence === undefined || !Number.isFinite(confidence)) return 50;
  return Math.max(0, Math.min(100, confidence));
};

const unavailableValue = (
  reason: 'MISSING' | 'NOT_DETERMINABLE',
  description: string
): PayrollValidationValue => ({ kind: 'UNAVAILABLE', reason, description });

const observedNumberValue = (value: number): PayrollValidationValue => ({
  kind: 'TEXT',
  value: String(value),
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

const isQualityUsable = (
  observation: Readonly<PayrollObservedFiscalValue>
): boolean =>
  observation.classificationStatus === 'CLASSIFIED' &&
  observation.fiscalPeriod === 'monthly' &&
  observation.ambiguous !== true &&
  observation.confidence >= INPS_OBSERVATION_QUALITY_MIN_CONFIDENCE &&
  observation.provenance.length > 0 &&
  typeof observation.value === 'number' &&
  Number.isFinite(observation.value);

const qualityIssues = (
  observation: Readonly<PayrollObservedFiscalValue>
): string[] => {
  const issues: string[] = [];
  if (observation.classificationStatus !== 'CLASSIFIED') issues.push('UNCLASSIFIED');
  if (observation.ambiguous === true) issues.push('AMBIGUOUS');
  if (observation.fiscalPeriod !== 'monthly') issues.push('NON_MONTHLY_PERIOD');
  if (observation.confidence < INPS_OBSERVATION_QUALITY_MIN_CONFIDENCE) {
    issues.push('LOW_CONFIDENCE');
  }
  if (observation.provenance.length === 0) issues.push('PROVENANCE_MISSING');
  return issues;
};

const resultConfidence = (
  payroll?: Readonly<PayrollObservedSnapshot>,
  observations: ReadonlyArray<Readonly<PayrollObservedFiscalValue>> = []
): number =>
  observations.length > 0
    ? Math.min(
        ...observations.map((observation) =>
          normalizeConfidence(observation.confidence)
        )
      )
    : normalizeConfidence(payroll?.confidence);

const observationEvidence = (
  payroll: Readonly<PayrollObservedSnapshot>,
  observations: ReadonlyArray<Readonly<PayrollObservedFiscalValue>>
): PayrollValidationEvidence[] =>
  observations.flatMap((observation, index) => [
    {
      id: `inps-taxable-structural-observation:${index}`,
      source: observation.provenance[0]?.source ?? 'PAYROLL',
      description: 'Imponibile previdenziale osservato candidato',
      value:
        typeof observation.value === 'number' && Number.isFinite(observation.value)
          ? observedNumberValue(observation.value)
          : unavailableValue('NOT_DETERMINABLE', 'Valore numerico non utilizzabile'),
      period: payroll.period,
      confidence: normalizeConfidence(observation.confidence),
      technicalReference: [
        `canonicalField=${INPS_OBSERVATION_QUALITY_CANONICAL_FIELD}`,
        `classification=${observation.classificationStatus}`,
        `period=${observation.fiscalPeriod}`,
        `ambiguous=${observation.ambiguous === true}`,
        `provenance=${observation.provenance.length}`,
      ].join('; '),
    },
    ...observation.provenance,
  ]);

export const createInpsTaxableStructuralConsistencyCheck = (
  options: Readonly<InpsTaxableStructuralConsistencyCheckOptions> = {}
): PayrollValidationCheck => {
  const clock = options.clock ?? (() => new Date().toISOString());

  return {
    id: INPS_TAXABLE_STRUCTURAL_CONSISTENCY_CHECK_ID,
    version: INPS_TAXABLE_STRUCTURAL_CONSISTENCY_CHECK_VERSION,
    title: 'Coerenza strutturale dell\u2019imponibile previdenziale INPS',
    category: PAYROLL_VALIDATION_CATEGORIES.FISCAL,
    requiredInputs: [
      { id: 'payroll.fiscalObservations', description: 'Osservazioni fiscali complete' },
      {
        id: `payroll.fiscalObservations.${INPS_OBSERVATION_QUALITY_CANONICAL_FIELD}`,
        description: 'Imponibile previdenziale INPS osservato',
      },
    ],
    optionalInputs: [],
    applicability: {
      description:
        'Applicabile a uno snapshot payroll; i dati fiscali insufficienti producono INFO.',
      evaluate: (context) => context.payroll !== undefined,
    },
    execute: (context: Readonly<PayrollValidationContext>): PayrollValidationResult => {
      const payroll = context.payroll;
      const fiscalObservations = payroll?.fiscalObservations;
      const selection = selectFiscalObservation(
        fiscalObservations,
        INPS_OBSERVATION_QUALITY_CANONICAL_FIELD
      );
      const candidates = selection.candidates;
      const confidence = resultConfidence(payroll, candidates);
      const baseResult = {
        id: INPS_TAXABLE_STRUCTURAL_CONSISTENCY_CHECK_ID,
        checkVersion: INPS_TAXABLE_STRUCTURAL_CONSISTENCY_CHECK_VERSION,
        title: 'Coerenza strutturale dell\u2019imponibile previdenziale INPS',
        category: PAYROLL_VALIDATION_CATEGORIES.FISCAL,
        confidence,
        ruleSource: {
          id: 'structure.inps-taxable-positive-finite-observation',
          version: INPS_TAXABLE_STRUCTURAL_CONSISTENCY_CHECK_VERSION,
          sourceType: 'CALCULATION',
          status: 'CONFIRMED',
          confidence: 100,
          documentReference:
            'Verifica strutturale del valore osservato; nessuna regola o aliquota contributiva',
        },
        executedAt: clock(),
      } satisfies Pick<
        PayrollValidationResult,
        | 'id'
        | 'checkVersion'
        | 'title'
        | 'category'
        | 'confidence'
        | 'ruleSource'
        | 'executedAt'
      >;

      if (!payroll || !fiscalObservations || candidates.length === 0) {
        return {
          ...baseResult,
          status: 'INFO',
          actualValue: unavailableValue('MISSING', 'Imponibile previdenziale non osservato'),
          shortExplanation: 'Manca un imponibile previdenziale osservato utilizzabile.',
          detailedExplanation:
            'Il controllo non usa fiscalSummary, righe paga o altre sorgenti come fallback.',
          suggestion: 'Acquisire una fiscalObservation per socialSecurity.taxable.',
          evidence: [],
          missingInputs: [
            missingInput(
              fiscalObservations
                ? `payroll.fiscalObservations.${INPS_OBSERVATION_QUALITY_CANONICAL_FIELD}`
                : 'payroll.fiscalObservations',
              'Imponibile previdenziale INPS osservato'
            ),
          ],
          metadata: {
            canonicalField: INPS_OBSERVATION_QUALITY_CANONICAL_FIELD,
            structuralIssues: ['INPS_TAXABLE_OBSERVATION_MISSING'],
          },
        };
      }

      const evidence = observationEvidence(payroll, candidates);
      const invalidNumeric = candidates.find(
        (candidate) =>
          candidate.value !== undefined &&
          (typeof candidate.value !== 'number' || !Number.isFinite(candidate.value))
      );
      if (invalidNumeric) {
        return {
          ...baseResult,
          status: 'FAIL',
          actualValue: unavailableValue('NOT_DETERMINABLE', 'Valore non numerico o non finito'),
          shortExplanation: 'L\u2019imponibile previdenziale osservato è strutturalmente invalido.',
          detailedExplanation:
            'È presente un valore che non è numerico finito; il controllo non tenta conversioni o ricostruzioni.',
          suggestion: 'Verificare il valore normalizzato dell\u2019osservazione fiscale.',
          evidence,
          missingInputs: [],
          metadata: {
            canonicalField: INPS_OBSERVATION_QUALITY_CANONICAL_FIELD,
            candidateCount: candidates.length,
            structuralIssues: ['NON_FINITE_OR_NON_NUMERIC_VALUE'],
          },
        };
      }

      const missingValue = candidates.find((candidate) => candidate.value === undefined);
      if (missingValue) {
        return {
          ...baseResult,
          status: 'INFO',
          actualValue: unavailableValue('MISSING', 'Valore numerico assente'),
          shortExplanation: 'L\u2019osservazione non contiene un valore sufficiente.',
          detailedExplanation:
            'Il canonicalField è presente, ma manca il valore numerico necessario al controllo.',
          suggestion: 'Acquisire il valore normalizzato dell\u2019imponibile previdenziale.',
          evidence,
          missingInputs: [
            missingInput(
              `payroll.fiscalObservations.${INPS_OBSERVATION_QUALITY_CANONICAL_FIELD}.value`,
              'Valore numerico dell\u2019imponibile previdenziale INPS'
            ),
          ],
          metadata: {
            canonicalField: INPS_OBSERVATION_QUALITY_CANONICAL_FIELD,
            candidateCount: candidates.length,
            structuralIssues: ['VALUE_MISSING'],
          },
        };
      }

      const nonPositive = candidates.find(
        (candidate) => typeof candidate.value === 'number' && candidate.value <= 0
      );
      if (nonPositive && typeof nonPositive.value === 'number') {
        return {
          ...baseResult,
          status: 'FAIL',
          expectedValue: { kind: 'TEXT', value: 'Valore finito e positivo' },
          actualValue: observedNumberValue(nonPositive.value),
          shortExplanation: 'L\u2019imponibile previdenziale osservato non è positivo.',
          detailedExplanation:
            'Un valore uguale a zero o negativo è strutturalmente invalido per questo controllo.',
          suggestion: 'Verificare l\u2019osservazione fiscale normalizzata.',
          evidence,
          missingInputs: [],
          metadata: {
            canonicalField: INPS_OBSERVATION_QUALITY_CANONICAL_FIELD,
            candidateCount: candidates.length,
            structuralIssues: ['NON_POSITIVE_VALUE'],
          },
        };
      }

      const usableCandidates = candidates.filter(isQualityUsable);
      if (usableCandidates.length > 1) {
        return {
          ...baseResult,
          status: 'WARNING',
          shortExplanation: 'Sono presenti più imponibili previdenziali concorrenti.',
          detailedExplanation:
            'Più osservazioni soddisfano i requisiti minimi e non è possibile scegliere con certezza quella principale.',
          suggestion: 'Verificare quale osservazione mensile sia quella principale.',
          evidence,
          missingInputs: [],
          metadata: {
            canonicalField: INPS_OBSERVATION_QUALITY_CANONICAL_FIELD,
            candidateCount: candidates.length,
            usableCandidateCount: usableCandidates.length,
            structuralIssues: ['CONCURRENT_VALID_OBSERVATIONS'],
          },
        };
      }

      const primary = usableCandidates[0] ?? candidates[0];
      const primaryValue = primary.value;
      if (typeof primaryValue !== 'number' || !Number.isFinite(primaryValue)) {
        return {
          ...baseResult,
          status: 'FAIL',
          actualValue: unavailableValue('NOT_DETERMINABLE', 'Valore non numerico o non finito'),
          shortExplanation: 'L\u2019imponibile previdenziale osservato è strutturalmente invalido.',
          detailedExplanation:
            'Il candidato principale non contiene un numero finito e non viene convertito o ricostruito.',
          suggestion: 'Verificare il valore normalizzato dell\u2019osservazione fiscale.',
          evidence,
          missingInputs: [],
          metadata: {
            canonicalField: INPS_OBSERVATION_QUALITY_CANONICAL_FIELD,
            candidateCount: candidates.length,
            structuralIssues: ['NON_FINITE_OR_NON_NUMERIC_VALUE'],
          },
        };
      }
      const issues = qualityIssues(primary);
      if (issues.length > 0) {
        return {
          ...baseResult,
          status: 'WARNING',
          actualValue: observedNumberValue(primaryValue),
          shortExplanation: 'L\u2019osservazione esiste ma non è pienamente utilizzabile.',
          detailedExplanation: `Criticità qualitative: ${issues.join(', ')}.`,
          suggestion: 'Verificare qualità e univocità dell\u2019osservazione fiscale.',
          evidence,
          missingInputs: primary.provenance.length === 0
            ? [
                missingInput(
                  `payroll.fiscalObservations.${INPS_OBSERVATION_QUALITY_CANONICAL_FIELD}.provenance`,
                  'Provenienza dell\u2019imponibile previdenziale INPS'
                ),
              ]
            : [],
          metadata: {
            canonicalField: INPS_OBSERVATION_QUALITY_CANONICAL_FIELD,
            candidateCount: candidates.length,
            structuralIssues: issues,
          },
        };
      }

      return {
        ...baseResult,
        status: 'PASS',
        expectedValue: { kind: 'TEXT', value: 'Valore finito e positivo' },
        actualValue: observedNumberValue(primaryValue),
        shortExplanation: 'L\u2019imponibile previdenziale osservato è strutturalmente valido.',
        detailedExplanation:
          'Il risultato attesta soltanto positività, finitezza, qualità minima e univocità del dato osservato; non ne verifica la correttezza fiscale.',
        suggestion: 'Il dato può essere usato da successivi controlli fiscali sperimentali.',
        evidence,
        missingInputs: [],
        metadata: {
          canonicalField: INPS_OBSERVATION_QUALITY_CANONICAL_FIELD,
          candidateCount: candidates.length,
          usableCandidateCount: usableCandidates.length,
          structuralIssues: [],
        },
      };
    },
  };
};

export const inpsTaxableStructuralConsistencyCheck =
  createInpsTaxableStructuralConsistencyCheck();
