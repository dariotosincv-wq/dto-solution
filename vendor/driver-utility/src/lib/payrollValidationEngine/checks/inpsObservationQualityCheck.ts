import { normalizePayrollValidationConfidence } from '../payrollObservedAdapter';
import { selectFiscalObservation } from '../fiscalObservationSelector';
import type {
  PayrollObservedFiscalValue,
  PayrollObservedSnapshot,
  PayrollValidationCheck,
  PayrollValidationContext,
  PayrollValidationEvidence,
  PayrollValidationMissingInput,
  PayrollValidationResult as EnginePayrollValidationResult,
} from '../types';

export const INPS_OBSERVATION_QUALITY_CHECK_ID =
  'fiscal.inps-observation-quality';
export const INPS_OBSERVATION_QUALITY_CHECK_VERSION = '1.0.0';
export const INPS_OBSERVATION_QUALITY_CANONICAL_FIELD =
  'socialSecurity.taxable';
export const INPS_OBSERVATION_QUALITY_MIN_CONFIDENCE = 70;

export interface InpsObservationQualityCheckOptions {
  readonly clock?: () => string;
}

const textValue = (value: string) => ({
  kind: 'TEXT' as const,
  value,
});

const unavailableValue = (
  reason: 'MISSING' | 'NOT_DETERMINABLE',
  description: string
) => ({
  kind: 'UNAVAILABLE' as const,
  reason,
  description,
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

const resultConfidence = (
  payroll?: Readonly<PayrollObservedSnapshot>,
  observation?: Readonly<PayrollObservedFiscalValue>
): number =>
  observation
    ? normalizePayrollValidationConfidence(observation.confidence)
    : normalizePayrollValidationConfidence(payroll?.confidence);

const observedQuality = (
  observation: Readonly<PayrollObservedFiscalValue>
): string => [
  `valueType=${typeof observation.value}`,
  `classification=${observation.classificationStatus}`,
  `period=${observation.fiscalPeriod}`,
  `ambiguous=${observation.ambiguous === true}`,
  `confidence=${observation.confidence}`,
  `provenance=${observation.provenance.length}`,
].join('; ');

const observationEvidence = (
  payroll: Readonly<PayrollObservedSnapshot>,
  observation: Readonly<PayrollObservedFiscalValue>
): PayrollValidationEvidence[] => {
  const source = observation.provenance[0]?.source ?? 'PAYROLL';
  const details = [
    `field=${observation.canonicalField ?? ''}`,
    `unit=${observation.unit}`,
    `period=${observation.fiscalPeriod}`,
    `source=${observation.source}`,
    `classification=${observation.classificationStatus}`,
    `confidence=${observation.confidence}`,
    `ambiguous=${observation.ambiguous === true}`,
    observation.page !== undefined ? `page=${observation.page}` : undefined,
    observation.section ? `section=${observation.section}` : undefined,
    `method=${observation.extractionMethod}`,
    observation.rawText ? `rawText=${observation.rawText}` : undefined,
  ].filter((part): part is string => part !== undefined);
  const evidence: PayrollValidationEvidence[] = [
    {
      id: 'inps-taxable-observation',
      source,
      description: 'Osservazione dell’imponibile previdenziale INPS',
      value: textValue(
        observation.value === undefined
          ? `undefined [${observation.unit}]`
          : `${String(observation.value)} [${observation.unit}]`
      ),
      period: payroll.period,
      confidence: normalizePayrollValidationConfidence(observation.confidence),
      technicalReference: details.join('; '),
    },
    ...observation.provenance,
  ];

  observation.alternatives?.forEach((alternative, index) => {
    evidence.push({
      id: `inps-taxable-alternative:${index}`,
      source,
      description: 'Interpretazione alternativa osservata',
      value: textValue(alternative),
      period: payroll.period,
      confidence: normalizePayrollValidationConfidence(observation.confidence),
      technicalReference: `alternative=${alternative}`,
    });
  });

  return evidence;
};

export const createInpsObservationQualityCheck = (
  options: Readonly<InpsObservationQualityCheckOptions> = {}
): PayrollValidationCheck => {
  const clock = options.clock ?? (() => new Date().toISOString());

  return {
    id: INPS_OBSERVATION_QUALITY_CHECK_ID,
    version: INPS_OBSERVATION_QUALITY_CHECK_VERSION,
    title: 'Qualità dell’imponibile previdenziale INPS osservato',
    category: 'FISCAL',
    requiredInputs: [
      {
        id: 'payroll.fiscalObservations',
        description: 'Osservazioni fiscali complete',
      },
      {
        id: `payroll.fiscalObservations.${INPS_OBSERVATION_QUALITY_CANONICAL_FIELD}`,
        description: 'Imponibile previdenziale INPS osservato',
      },
    ],
    optionalInputs: [],
    applicability: {
      description:
        'Applicabile a uno snapshot payroll; l’assenza delle osservazioni fiscali produce INFO.',
      evaluate: (context) =>
        context.payroll !== undefined &&
        (
          context.payroll.fiscalObservations === undefined ||
          context.payroll.fiscalObservations.schemaVersion === 'fiscal-v1'
        ),
    },
    execute: (
      context: Readonly<PayrollValidationContext>
    ): EnginePayrollValidationResult => {
      const payroll = context.payroll;
      const fiscalObservations = payroll?.fiscalObservations;
      const selection = selectFiscalObservation(
        fiscalObservations,
        INPS_OBSERVATION_QUALITY_CANONICAL_FIELD
      );
      const observation = 'observation' in selection
        ? selection.observation
        : undefined;
      const confidence = resultConfidence(payroll, observation);
      const expectedValue = textValue(
        'Valore numerico mensile, CLASSIFIED, non ambiguo, confidence >= 70 e provenienza disponibile'
      );
      const ruleSource = {
        id: 'quality.fiscal-observation-usability',
        version: INPS_OBSERVATION_QUALITY_CHECK_VERSION,
        sourceType: 'CALCULATION' as const,
        status: 'CONFIRMED' as const,
        confidence: 100,
        documentReference:
          'Regola tecnica di qualità del dato osservato; non è una norma fiscale',
      };
      const baseResult = {
        id: INPS_OBSERVATION_QUALITY_CHECK_ID,
        checkVersion: INPS_OBSERVATION_QUALITY_CHECK_VERSION,
        title: 'Qualità dell’imponibile previdenziale INPS osservato',
        category: 'FISCAL' as const,
        expectedValue,
        confidence,
        ruleSource,
        executedAt: clock(),
      };

      if (!payroll || !fiscalObservations) {
        return {
          ...baseResult,
          status: 'INFO',
          actualValue: unavailableValue(
            'MISSING',
            'Dati fiscali osservati non disponibili'
          ),
          shortExplanation: 'I dati fiscali osservati non sono disponibili.',
          detailedExplanation:
            'Il controllo non può valutare la qualità dell’imponibile previdenziale INPS perché fiscalObservations è assente.',
          suggestion: 'Acquisire osservazioni fiscali complete per il cedolino.',
          evidence: [],
          missingInputs: [
            missingInput(
              'payroll.fiscalObservations',
              'Osservazioni fiscali complete'
            ),
          ],
          metadata: {
            canonicalField: INPS_OBSERVATION_QUALITY_CANONICAL_FIELD,
            qualityIssues: ['FISCAL_OBSERVATIONS_MISSING'],
          },
        };
      }

      if (selection.status === 'MULTIPLE_CANDIDATES') {
        return {
          ...baseResult,
          status: 'WARNING',
          actualValue: unavailableValue(
            'NOT_DETERMINABLE',
            'Più imponibili previdenziali osservati concorrenti'
          ),
          shortExplanation: 'Sono presenti più osservazioni concorrenti.',
          detailedExplanation:
            'Il selector condiviso non sceglie arbitrariamente tra candidati equivalenti.',
          suggestion: 'Verificare quale osservazione mensile sia quella principale.',
          evidence: selection.candidates.flatMap((candidate) =>
            observationEvidence(payroll, candidate)
          ),
          missingInputs: [],
          metadata: {
            canonicalField: INPS_OBSERVATION_QUALITY_CANONICAL_FIELD,
            candidateCount: selection.candidates.length,
            qualityIssues: ['MULTIPLE_CANDIDATES'],
          },
        };
      }

      if (!observation) {
        return {
          ...baseResult,
          status: 'INFO',
          actualValue: unavailableValue(
            'MISSING',
            'Imponibile previdenziale INPS non osservato'
          ),
          shortExplanation:
            'L’imponibile previdenziale INPS non è stato osservato.',
          detailedExplanation:
            'Le osservazioni fiscali sono disponibili, ma non contengono il canonicalField socialSecurity.taxable.',
          suggestion:
            'Verificare la disponibilità dell’imponibile previdenziale nel cedolino.',
          evidence: [],
          missingInputs: [
            missingInput(
              `payroll.fiscalObservations.${INPS_OBSERVATION_QUALITY_CANONICAL_FIELD}`,
              'Imponibile previdenziale INPS osservato'
            ),
          ],
          metadata: {
            canonicalField: INPS_OBSERVATION_QUALITY_CANONICAL_FIELD,
            fiscalWarnings: [...fiscalObservations.warnings],
            qualityIssues: ['INPS_TAXABLE_OBSERVATION_MISSING'],
          },
        };
      }

      const evidence = observationEvidence(payroll, observation);
      if (
        typeof observation.value !== 'number' ||
        !Number.isFinite(observation.value)
      ) {
        return {
          ...baseResult,
          status: 'INFO',
          actualValue: unavailableValue(
            'NOT_DETERMINABLE',
            'Il valore osservato non è numerico'
          ),
          shortExplanation:
            'L’imponibile previdenziale INPS non è utilizzabile come dato numerico.',
          detailedExplanation:
            'Il valore osservato non è numerico e non viene convertito o ricostruito.',
          suggestion: 'Verificare il valore fiscale osservato.',
          evidence,
          missingInputs: [
            missingInput(
              `payroll.fiscalObservations.${INPS_OBSERVATION_QUALITY_CANONICAL_FIELD}.value`,
              'Valore numerico dell’imponibile previdenziale INPS'
            ),
          ],
          metadata: {
            canonicalField: INPS_OBSERVATION_QUALITY_CANONICAL_FIELD,
            observedValue: observation.value ?? null,
            fiscalWarnings: [...fiscalObservations.warnings],
            alternatives: [...(observation.alternatives ?? [])],
            qualityIssues: ['NON_NUMERIC_VALUE'],
          },
        };
      }

      const qualityIssues: string[] = [];
      if (observation.classificationStatus !== 'CLASSIFIED') {
        qualityIssues.push('UNCLASSIFIED');
      }
      if (observation.ambiguous === true) {
        qualityIssues.push('AMBIGUOUS');
      }
      if (observation.fiscalPeriod !== 'monthly') {
        qualityIssues.push('NON_MONTHLY_PERIOD');
      }
      if (observation.confidence < INPS_OBSERVATION_QUALITY_MIN_CONFIDENCE) {
        qualityIssues.push('LOW_CONFIDENCE');
      }
      if (observation.provenance.length === 0) {
        qualityIssues.push('PROVENANCE_MISSING');
      }

      const missingInputs = observation.provenance.length === 0
        ? [
            missingInput(
              `payroll.fiscalObservations.${INPS_OBSERVATION_QUALITY_CANONICAL_FIELD}.provenance`,
              'Provenienza dell’imponibile previdenziale INPS'
            ),
          ]
        : [];
      const passed = qualityIssues.length === 0;

      return {
        ...baseResult,
        status: passed ? 'PASS' : 'WARNING',
        actualValue: textValue(observedQuality(observation)),
        shortExplanation: passed
          ? 'Il valore dell’imponibile previdenziale INPS è osservato con qualità sufficiente per un successivo controllo matematico.'
          : 'Il valore è presente, ma presenta una o più criticità di qualità.',
        detailedExplanation: passed
          ? 'Il risultato certifica esclusivamente l’utilizzabilità tecnica del dato osservato; non verifica la correttezza dell’imponibile, dei contributi o della busta paga.'
          : `Criticità osservate: ${qualityIssues.join(', ')}. Il controllo non dichiara un errore della busta paga.`,
        suggestion: passed
          ? 'Il dato può essere fornito a un successivo controllo matematico INPS.'
          : 'Verificare classificazione, periodo, ambiguità, confidence e provenienza del dato.',
        evidence,
        missingInputs,
        metadata: {
          canonicalField: observation.canonicalField ?? null,
          observedValue: observation.value,
          unit: observation.unit,
          classificationStatus: observation.classificationStatus,
          fiscalPeriod: observation.fiscalPeriod,
          source: observation.source,
          observedConfidence: observation.confidence,
          ambiguous: observation.ambiguous === true,
          page: observation.page ?? null,
          section: observation.section ?? null,
          extractionMethod: observation.extractionMethod,
          rawText: observation.rawText ?? null,
          alternatives: [...(observation.alternatives ?? [])],
          provenanceCount: observation.provenance.length,
          fiscalWarnings: [...fiscalObservations.warnings],
          qualityIssues,
        },
      };
    },
  };
};

export const inpsObservationQualityCheck =
  createInpsObservationQualityCheck();
