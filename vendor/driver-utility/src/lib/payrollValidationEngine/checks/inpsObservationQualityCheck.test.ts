import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizePayslipFiscalData } from '../../driverPayrollFiscalNormalizer';
import { october2025AnonymizedFixture } from '../../driverPayrollParsers/fixtures/october2025AnonymizedFixture';
import { parsePayslip } from '../../driverPayrollParsers/payslipParserRegistry';
import { adaptPayrollToObservedSnapshot } from '../payrollObservedAdapter';
import type {
  PayrollObservedFiscalValue,
  PayrollObservedSnapshot,
  PayrollValidationContext,
  PayrollValidationResult as EnginePayrollValidationResult,
} from '../types';
import {
  createInpsObservationQualityCheck,
  INPS_OBSERVATION_QUALITY_CANONICAL_FIELD,
  INPS_OBSERVATION_QUALITY_CHECK_ID,
  INPS_OBSERVATION_QUALITY_CHECK_VERSION,
  INPS_OBSERVATION_QUALITY_MIN_CONFIDENCE,
} from './inpsObservationQualityCheck';

const FIXED_EXECUTED_AT = '2026-07-31T16:00:00.000Z';

const observation = (
  overrides: Partial<PayrollObservedFiscalValue> = {}
): PayrollObservedFiscalValue => ({
  canonicalField: INPS_OBSERVATION_QUALITY_CANONICAL_FIELD,
  value: 1942,
  unit: 'UNSPECIFIED',
  classificationStatus: 'CLASSIFIED',
  fiscalPeriod: 'monthly',
  source: 'fiscal_section',
  confidence: 90,
  ambiguous: false,
  page: 1,
  section: 'SOCIALI_INPS',
  extractionMethod: 'geometric_column',
  provenance: [
    {
      id: 'inps-source',
      source: 'PAYROLL',
      description: 'Imponibile INPS osservato',
      confidence: 90,
    },
  ],
  ...overrides,
});

const snapshot = (
  values?: ReadonlyArray<PayrollObservedFiscalValue>,
  confidence = 85
): PayrollObservedSnapshot => ({
  period: { year: 2025, month: 9 },
  lines: [],
  economicSummary: {},
  fiscalObservations: values === undefined
    ? undefined
    : {
        schemaVersion: 'fiscal-v1',
        period: { year: 2025, month: 9 },
        values,
        warnings: [],
      },
  confidence,
  provenance: [],
});

const execute = async (
  context: PayrollValidationContext
): Promise<EnginePayrollValidationResult> => {
  const check = createInpsObservationQualityCheck({
    clock: () => FIXED_EXECUTED_AT,
  });
  return Promise.resolve(check.execute(context));
};

describe('inpsObservationQualityCheck', () => {
  it('usa identità, categoria e versione ufficiali', () => {
    const check = createInpsObservationQualityCheck();

    expect(check).toMatchObject({
      id: INPS_OBSERVATION_QUALITY_CHECK_ID,
      version: INPS_OBSERVATION_QUALITY_CHECK_VERSION,
      category: 'FISCAL',
    });
    expect(INPS_OBSERVATION_QUALITY_CANONICAL_FIELD).toBe(
      'socialSecurity.taxable'
    );
  });

  it('resta applicabile senza fiscalObservations per produrre INFO', async () => {
    const payroll = snapshot();
    const check = createInpsObservationQualityCheck();

    expect(check.applicability.evaluate({ payroll })).toBe(true);
    const result = await execute({ payroll });
    expect(result.status).toBe('INFO');
    expect(result.missingInputs.map((item) => item.id)).toEqual([
      'payroll.fiscalObservations',
    ]);
  });

  it('restituisce INFO quando manca l’intero snapshot', async () => {
    const result = await execute({});

    expect(result.status).toBe('INFO');
    expect(result.confidence).toBe(50);
  });

  it('restituisce INFO quando manca il canonicalField INPS', async () => {
    const result = await execute({
      payroll: snapshot([
        observation({ canonicalField: 'incomeTax.taxable' }),
      ]),
    });

    expect(result.status).toBe('INFO');
    expect(result.missingInputs[0].id).toContain('socialSecurity.taxable');
  });

  it.each([
    ['testo', '1942'],
    ['valore assente', undefined],
    ['NaN', Number.NaN],
  ])('restituisce INFO per valore non numerico o inutilizzabile: %s', async (
    _label,
    value
  ) => {
    const result = await execute({
      payroll: snapshot([observation({ value })]),
    });

    expect(result.status).toBe('INFO');
    expect(result.metadata?.qualityIssues).toEqual(['NON_NUMERIC_VALUE']);
    expect(result.missingInputs[0].id).toContain('.value');
  });

  it('restituisce WARNING per osservazione UNCLASSIFIED', async () => {
    const result = await execute({
      payroll: snapshot([
        observation({ classificationStatus: 'UNCLASSIFIED' }),
      ]),
    });

    expect(result.status).toBe('WARNING');
    expect(result.metadata?.qualityIssues).toEqual(['UNCLASSIFIED']);
    expect(result.missingInputs).toEqual([]);
  });

  it('restituisce WARNING quando ambiguous è true', async () => {
    const result = await execute({
      payroll: snapshot([observation({ ambiguous: true })]),
    });

    expect(result.status).toBe('WARNING');
    expect(result.metadata?.qualityIssues).toEqual(['AMBIGUOUS']);
  });

  it.each([
    'progressive',
    'annual',
    'adjustment',
    'unknown_period',
  ] as const)('restituisce WARNING per periodo fiscale %s', async (
    fiscalPeriod
  ) => {
    const result = await execute({
      payroll: snapshot([observation({ fiscalPeriod })]),
    });

    expect(result.status).toBe('WARNING');
    expect(result.metadata?.qualityIssues).toEqual(['NON_MONTHLY_PERIOD']);
  });

  it('applica la soglia confidence: 69 WARNING e 70 PASS', async () => {
    const low = await execute({
      payroll: snapshot([observation({ confidence: 69 })]),
    });
    const threshold = await execute({
      payroll: snapshot([observation({ confidence: 70 })]),
    });

    expect(INPS_OBSERVATION_QUALITY_MIN_CONFIDENCE).toBe(70);
    expect(low.status).toBe('WARNING');
    expect(low.confidence).toBe(69);
    expect(threshold.status).toBe('PASS');
    expect(threshold.confidence).toBe(70);
  });

  it('restituisce WARNING e missingInput quando manca la provenance', async () => {
    const result = await execute({
      payroll: snapshot([observation({ provenance: [] })]),
    });

    expect(result.status).toBe('WARNING');
    expect(result.metadata?.qualityIssues).toEqual(['PROVENANCE_MISSING']);
    expect(result.missingInputs[0]).toMatchObject({
      required: true,
      effect: 'BLOCKS_CHECK',
    });
  });

  it('restituisce PASS esclusivamente come certificazione di utilizzabilità', async () => {
    const result = await execute({
      payroll: snapshot([observation()]),
    });

    expect(result.status).toBe('PASS');
    expect(result.shortExplanation).toContain(
      'qualità sufficiente per un successivo controllo matematico'
    );
    expect(result.detailedExplanation).toContain(
      'non verifica la correttezza'
    );
    expect(result.difference).toBeUndefined();
    expect(result.tolerance).toBeUndefined();
  });

  it('conserva le alternative nelle evidenze e nei metadata', async () => {
    const result = await execute({
      payroll: snapshot([
        observation({
          ambiguous: true,
          alternatives: [
            'socialSecurity.progressiveTaxable',
            'incomeTax.taxable',
          ],
        }),
      ]),
    });

    expect(result.status).toBe('WARNING');
    expect(result.evidence.filter((item) =>
      item.id.startsWith('inps-taxable-alternative:')
    ).map((item) => item.value)).toEqual([
      { kind: 'TEXT', value: 'socialSecurity.progressiveTaxable' },
      { kind: 'TEXT', value: 'incomeTax.taxable' },
    ]);
    expect(result.metadata?.alternatives).toEqual([
      'socialSecurity.progressiveTaxable',
      'incomeTax.taxable',
    ]);
  });

  it('produce un solo WARNING con tutte le criticità contemporanee', async () => {
    const result = await execute({
      payroll: snapshot([
        observation({
          classificationStatus: 'UNCLASSIFIED',
          ambiguous: true,
          fiscalPeriod: 'progressive',
          confidence: 40,
          provenance: [],
        }),
      ]),
    });

    expect(result.status).toBe('WARNING');
    expect(result.metadata?.qualityIssues).toEqual([
      'UNCLASSIFIED',
      'AMBIGUOUS',
      'NON_MONTHLY_PERIOD',
      'LOW_CONFIDENCE',
      'PROVENANCE_MISSING',
    ]);
  });

  it('non usa fiscalSummary o payLines come fallback', async () => {
    const payroll: PayrollObservedSnapshot = {
      ...snapshot([]),
      lines: [
        {
          canonicalKey: 'payroll.social_security_taxable',
          description: 'Imponibile INPS',
          informationalValue: 1942,
          confidence: 100,
          provenance: [],
        },
      ],
      fiscalSummary: { socialSecurityTaxable: 1942 },
    };
    const result = await execute({ payroll });

    expect(result.status).toBe('INFO');
    expect(result.metadata?.qualityIssues).toEqual([
      'INPS_TAXABLE_OBSERVATION_MISSING',
    ]);
  });

  it('usa confidence osservata normalizzata e quella snapshot quando il dato manca', async () => {
    const observed = await execute({
      payroll: snapshot([observation({ confidence: 140 })], 30),
    });
    const missing = await execute({ payroll: snapshot([], 77) });

    expect(observed.confidence).toBe(100);
    expect(missing.confidence).toBe(77);
  });

  it('usa una ruleSource tecnica e non normativa', async () => {
    const result = await execute({
      payroll: snapshot([observation()]),
    });

    expect(result.ruleSource).toMatchObject({
      id: 'quality.fiscal-observation-usability',
      version: '1.0.0',
      sourceType: 'CALCULATION',
      status: 'CONFIRMED',
      confidence: 100,
    });
    expect(result.ruleSource?.documentReference).toContain(
      'non è una norma fiscale'
    );
  });

  it('produce evidenze complete usando la source della provenance', async () => {
    const result = await execute({
      payroll: snapshot([
        observation({
          rawText: 'IMPONIBILE INPS 1.942,00',
          alternatives: [],
        }),
      ]),
    });

    expect(result.evidence[0]).toMatchObject({
      id: 'inps-taxable-observation',
      source: 'PAYROLL',
      confidence: 90,
    });
    expect(result.evidence[0].technicalReference).toContain(
      'field=socialSecurity.taxable'
    );
    expect(result.evidence[0].technicalReference).toContain(
      'rawText=IMPONIBILE INPS 1.942,00'
    );
    expect(result.evidence).toContainEqual(
      observation().provenance[0]
    );
  });

  it('non modifica context, observation, alternatives o provenance ed è JSON serializzabile', async () => {
    const alternatives = ['incomeTax.taxable'];
    const provenance = observation().provenance;
    const fiscalObservation = observation({ alternatives, provenance });
    const context: PayrollValidationContext = {
      payroll: snapshot([fiscalObservation]),
    };
    const before = JSON.stringify(context);
    const result = await execute(context);
    const restored = JSON.parse(JSON.stringify(result));

    expect(JSON.stringify(context)).toBe(before);
    expect(alternatives).toEqual(['incomeTax.taxable']);
    expect(provenance).toEqual(observation().provenance);
    expect(restored).toMatchObject({
      id: INPS_OBSERVATION_QUALITY_CHECK_ID,
      status: 'PASS',
      executedAt: FIXED_EXECUTED_AT,
    });
  });

  it('usa il clock iniettato per un timestamp deterministico', async () => {
    const result = await execute({
      payroll: snapshot([observation()]),
    });

    expect(result.executedAt).toBe(FIXED_EXECUTED_AT);
  });

  it('non dipende da fiscalSummary, payLines, parser, UI o storage', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/lib/payrollValidationEngine/checks/inpsObservationQualityCheck.ts'
      ),
      'utf8'
    );

    [
      'fiscalSummary',
      'parsedLines',
      'driverPayrollParser',
      'logisticsLayoutV1',
      'react',
      'localStorage',
      'driverPayrollStorage',
      'pages/',
    ].forEach((dependency) => expect(source).not.toContain(dependency));
  });

  it('restituisce PASS sulla qualità dell’osservazione reale ottobre 2025', async () => {
    const fixture = october2025AnonymizedFixture();
    const payslip = parsePayslip(fixture);
    const fiscalData = normalizePayslipFiscalData(fixture, payslip);
    const payroll = adaptPayrollToObservedSnapshot(payslip, { fiscalData });
    const realObservation = payroll.fiscalObservations?.values.find(
      (value) =>
        value.canonicalField ===
        INPS_OBSERVATION_QUALITY_CANONICAL_FIELD
    );
    const result = await execute({ payroll });

    expect(realObservation).toMatchObject({
      canonicalField: 'socialSecurity.taxable',
      value: 1894,
      classificationStatus: 'CLASSIFIED',
      fiscalPeriod: 'monthly',
    });
    expect(realObservation?.ambiguous).not.toBe(true);
    expect(result.status).toBe('PASS');
  });
});
