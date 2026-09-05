import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type {
  PayrollObservedFiscalValue,
  PayrollObservedSnapshot,
  PayrollValidationContext,
  PayrollValidationResult,
} from '../types';
import {
  createInpsTaxableStructuralConsistencyCheck,
  INPS_TAXABLE_STRUCTURAL_CONSISTENCY_CHECK_ID,
  INPS_TAXABLE_STRUCTURAL_CONSISTENCY_CHECK_VERSION,
} from './inpsTaxableStructuralConsistencyCheck';

const FIXED_EXECUTED_AT = '2026-07-31T18:00:00.000Z';

const observation = (
  overrides: Partial<PayrollObservedFiscalValue> = {}
): PayrollObservedFiscalValue => ({
  canonicalField: 'socialSecurity.taxable',
  value: 1942,
  unit: 'UNSPECIFIED',
  classificationStatus: 'CLASSIFIED',
  fiscalPeriod: 'monthly',
  source: 'fiscal_section',
  confidence: 90,
  ambiguous: false,
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
  values?: ReadonlyArray<PayrollObservedFiscalValue>
): PayrollObservedSnapshot => ({
  period: { year: 2025, month: 10 },
  lines: [],
  economicSummary: {},
  fiscalObservations: values === undefined
    ? undefined
    : {
        schemaVersion: 'fiscal-v1',
        period: { year: 2025, month: 10 },
        values,
        warnings: [],
      },
  confidence: 85,
  provenance: [],
});

const execute = async (
  context: PayrollValidationContext
): Promise<PayrollValidationResult> => {
  const check = createInpsTaxableStructuralConsistencyCheck({
    clock: () => FIXED_EXECUTED_AT,
  });
  return Promise.resolve(check.execute(context));
};

describe('inpsTaxableStructuralConsistencyCheck', () => {
  it('mantiene identità, versione e categoria FISCAL', () => {
    expect(createInpsTaxableStructuralConsistencyCheck()).toMatchObject({
      id: INPS_TAXABLE_STRUCTURAL_CONSISTENCY_CHECK_ID,
      version: INPS_TAXABLE_STRUCTURAL_CONSISTENCY_CHECK_VERSION,
      category: 'FISCAL',
    });
  });

  it('restituisce PASS con osservazione valida e positiva', async () => {
    const result = await execute({ payroll: snapshot([observation()]) });

    expect(result.status).toBe('PASS');
    expect(result.actualValue).toEqual({ kind: 'TEXT', value: '1942' });
    expect(result.detailedExplanation).toContain('non ne verifica la correttezza fiscale');
  });

  it('restituisce INFO quando fiscalObservations o il canonicalField mancano', async () => {
    const withoutObservations = await execute({ payroll: snapshot() });
    const withoutCanonicalField = await execute({
      payroll: snapshot([observation({ canonicalField: 'incomeTax.taxable' })]),
    });

    expect(withoutObservations.status).toBe('INFO');
    expect(withoutCanonicalField.status).toBe('INFO');
  });

  it('restituisce INFO quando il valore osservato è assente', async () => {
    const result = await execute({
      payroll: snapshot([observation({ value: undefined })]),
    });

    expect(result.status).toBe('INFO');
    expect(result.metadata?.structuralIssues).toEqual(['VALUE_MISSING']);
  });

  it.each([
    ['testo', '1942'],
    ['NaN', Number.NaN],
    ['infinito', Number.POSITIVE_INFINITY],
  ])('restituisce FAIL con valore presente non rappresentabile: %s', async (
    _label,
    value
  ) => {
    const result = await execute({ payroll: snapshot([observation({ value })]) });

    expect(result.status).toBe('FAIL');
    expect(result.metadata?.structuralIssues).toEqual([
      'NON_FINITE_OR_NON_NUMERIC_VALUE',
    ]);
  });

  it.each([0, -1])('restituisce FAIL con valore non positivo: %s', async (value) => {
    const result = await execute({ payroll: snapshot([observation({ value })]) });

    expect(result.status).toBe('FAIL');
    expect(result.actualValue).toEqual({ kind: 'TEXT', value: String(value) });
    expect(result.metadata?.structuralIssues).toEqual(['NON_POSITIVE_VALUE']);
  });

  it('restituisce WARNING con più osservazioni valide concorrenti', async () => {
    const result = await execute({
      payroll: snapshot([observation({ value: 1942 }), observation({ value: 1950 })]),
    });

    expect(result.status).toBe('WARNING');
    expect(result.metadata?.structuralIssues).toEqual([
      'CONCURRENT_VALID_OBSERVATIONS',
    ]);
  });

  it('restituisce WARNING con osservazione ambigua', async () => {
    const result = await execute({
      payroll: snapshot([observation({ ambiguous: true })]),
    });

    expect(result.status).toBe('WARNING');
    expect(result.metadata?.structuralIssues).toEqual(['AMBIGUOUS']);
  });

  it('seleziona l\u2019unico candidato utilizzabile senza inferire dai candidati scartati', async () => {
    const result = await execute({
      payroll: snapshot([
        observation({ value: 1900, classificationStatus: 'UNCLASSIFIED' }),
        observation({ value: 1942 }),
      ]),
    });

    expect(result.status).toBe('PASS');
    expect(result.actualValue).toEqual({ kind: 'TEXT', value: '1942' });
  });

  it.each([
    observation({ classificationStatus: 'UNCLASSIFIED' }),
    observation({ fiscalPeriod: 'progressive' }),
    observation({ confidence: 69 }),
    observation({ provenance: [] }),
  ])('non dichiara PASS quando il prerequisito di qualità non è soddisfatto', async (
    unusable
  ) => {
    const result = await execute({ payroll: snapshot([unusable]) });

    expect(result.status).toBe('WARNING');
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

    expect((await execute({ payroll })).status).toBe('INFO');
  });

  it('non dipende da fallback, parser, UI o storage', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/lib/payrollValidationEngine/checks/inpsTaxableStructuralConsistencyCheck.ts'
      ),
      'utf8'
    );

    [
      'rawText',
      'driverPayrollParser',
      'OCR',
      'react',
      'localStorage',
      'driverPayrollStorage',
    ].forEach((dependency) => expect(source).not.toContain(dependency));
    expect(source).not.toContain('payroll.fiscalSummary');
    expect(source).not.toContain('payroll.lines');
    expect(source).not.toMatch(/\sas\s/);
  });

  it('non modifica il context ed è serializzabile', async () => {
    const context: PayrollValidationContext = {
      payroll: snapshot([observation()]),
    };
    const before = JSON.stringify(context);
    const result = await execute(context);

    expect(JSON.stringify(context)).toBe(before);
    expect(JSON.parse(JSON.stringify(result))).toMatchObject({
      id: INPS_TAXABLE_STRUCTURAL_CONSISTENCY_CHECK_ID,
      status: 'PASS',
      executedAt: FIXED_EXECUTED_AT,
    });
  });
});
