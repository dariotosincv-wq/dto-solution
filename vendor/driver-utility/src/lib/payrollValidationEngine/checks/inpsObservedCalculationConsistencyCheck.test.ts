import { describe, expect, it } from 'vitest';
import { normalizePayslipFiscalData } from '../../driverPayrollFiscalNormalizer';
import { october2025AnonymizedFixture } from '../../driverPayrollParsers/fixtures/october2025AnonymizedFixture';
import { september2025AnonymizedFixture } from '../../driverPayrollParsers/fixtures/september2025AnonymizedFixture';
import { parsePayslip } from '../../driverPayrollParsers/payslipParserRegistry';
import { adaptPayrollToObservedSnapshot } from '../payrollObservedAdapter';
import { runPayrollValidation } from '../validationRunner';
import type {
  PayrollObservedFiscalUnit,
  PayrollObservedFiscalValue,
  PayrollObservedSnapshot,
} from '../types';
import {
  createInpsObservedCalculationConsistencyCheck,
  INPS_OBSERVED_CALCULATION_CONSISTENCY_CHECK_ID,
} from './inpsObservedCalculationConsistencyCheck';

const NOW = '2026-07-31T15:00:00.000Z';

const observation = (
  canonicalField: string,
  value: number | string | undefined,
  unit: PayrollObservedFiscalUnit,
  overrides: Partial<PayrollObservedFiscalValue> = {}
): PayrollObservedFiscalValue => ({
  canonicalField,
  value,
  unit,
  classificationStatus: 'CLASSIFIED',
  fiscalPeriod: 'monthly',
  source: 'fiscal_section',
  confidence: 90,
  extractionMethod: 'label_catalog',
  provenance: [{
    id: `source:${canonicalField}`,
    source: 'PAYROLL',
    description: canonicalField,
    confidence: 90,
  }],
  ...overrides,
});

const values = (
  rate = 9.19,
  rateUnit: PayrollObservedFiscalUnit = 'PERCENT_POINTS',
  contribution = 183.8
): PayrollObservedFiscalValue[] => [
  observation('socialSecurity.taxable', 2000, 'EUR'),
  observation('socialSecurity.contributionRate', rate, rateUnit),
  observation('socialSecurity.employeeContributions', contribution, 'EUR'),
];

const snapshot = (
  fiscalValues: PayrollObservedFiscalValue[],
  fiscalSummary?: PayrollObservedSnapshot['fiscalSummary']
): PayrollObservedSnapshot => ({
  period: { year: 2026, month: 7 },
  lines: [],
  economicSummary: {},
  fiscalSummary,
  fiscalObservations: {
    schemaVersion: 'fiscal-v1',
    period: { year: 2026, month: 7 },
    values: fiscalValues,
    warnings: [],
  },
  confidence: 95,
  provenance: [],
});

const execute = (fiscalValues: PayrollObservedFiscalValue[]) =>
  createInpsObservedCalculationConsistencyCheck({ clock: () => NOW }).execute({
    payroll: snapshot(fiscalValues),
  });

describe('fiscal.inps-observed-calculation-consistency', () => {
  it.each([
    ['PERCENT_POINTS', 9.19, 183.8],
    ['FRACTION', 0.0919, 183.8],
  ] as const)('produce PASS esatto con %s', async (unit, rate, contribution) => {
    const result = await execute(values(rate, unit, contribution));

    expect(result.status).toBe('PASS');
    expect(result.metadata?.normalizedRate).toBe(0.0919);
  });

  it.each([
    [183.81, 'PASS', 0.01],
    [183.82, 'PASS', 0.02],
    [183.83, 'FAIL', 0.03],
    [183.77, 'FAIL', -0.03],
  ] as const)('contributo %s produce %s e conserva differenza %s', async (actual, status, difference) => {
    const result = await execute(values(9.19, 'PERCENT_POINTS', actual));

    expect(result.status).toBe(status);
    expect(result.difference).toEqual({ kind: 'NUMBER', value: difference, unit: 'EUR' });
  });

  it.each([
    ['socialSecurity.taxable'],
    ['socialSecurity.contributionRate'],
    ['socialSecurity.employeeContributions'],
  ])('produce INFO quando manca %s', async (field) => {
    const result = await execute(values().filter((item) => item.canonicalField !== field));

    expect(result.status).toBe('INFO');
    expect(result.missingInputs[0].id).toContain(field);
  });

  it('produce INFO per aliquota UNSPECIFIED senza inferire la scala', async () => {
    const rate = observation(
      'socialSecurity.contributionRate',
      9.19,
      'UNSPECIFIED',
      { rawText: 'ALIQUOTA 9,19 %' }
    );
    const result = await execute([values()[0], rate, values()[2]]);

    expect(result.status).toBe('INFO');
    expect(result.metadata?.invalidUnitFields).toEqual(['rate']);
  });

  it.each(['taxable', 'contribution'] as const)('produce INFO se %s non ha unità EUR', async (field) => {
    const input = values();
    const index = field === 'taxable' ? 0 : 2;
    input[index] = { ...input[index], unit: 'UNSPECIFIED' };

    expect((await execute(input)).status).toBe('INFO');
  });

  it('produce INFO per valore non numerico senza conversioni implicite', async () => {
    const input = values();
    input[1] = { ...input[1], value: '9.19' };
    const result = await execute(input);

    expect(result.status).toBe('INFO');
    expect(result.metadata?.nonNumericFields).toEqual(['rate']);
  });

  it('produce WARNING per osservazione ambigua', async () => {
    const input = values();
    input[0] = { ...input[0], ambiguous: true };
    expect((await execute(input)).status).toBe('WARNING');
  });

  it('produce WARNING senza scegliere fra candidati concorrenti', async () => {
    const input = [...values(), observation('socialSecurity.taxable', 2100, 'EUR')];
    const result = await execute(input);

    expect(result.status).toBe('WARNING');
    expect(result.metadata?.concurrentFields).toEqual(['taxable']);
    expect(result.expectedValue).toBeUndefined();
  });

  it('produce WARNING per periodo non mensile', async () => {
    const input = values();
    input[2] = { ...input[2], fiscalPeriod: 'progressive' };
    expect((await execute(input)).status).toBe('WARNING');
  });

  it('applica la soglia confidence 70 e usa la confidence minima normalizzata', async () => {
    const low = values();
    low[1] = { ...low[1], confidence: 69 };
    const boundary = values();
    boundary[0] = { ...boundary[0], confidence: 88 };
    boundary[1] = { ...boundary[1], confidence: 70 };
    boundary[2] = { ...boundary[2], confidence: 140 };

    expect((await execute(low)).status).toBe('WARNING');
    const result = await execute(boundary);
    expect(result.status).toBe('PASS');
    expect(result.confidence).toBe(70);
  });

  it('espone expected, actual, difference, tolerance, evidenze e regola tecnica', async () => {
    const result = await execute(values(9.19, 'PERCENT_POINTS', 183.81));

    expect(result).toMatchObject({
      id: INPS_OBSERVED_CALCULATION_CONSISTENCY_CHECK_ID,
      checkVersion: '1.0.0',
      category: 'FISCAL',
      expectedValue: { kind: 'NUMBER', value: 183.8, unit: 'EUR' },
      actualValue: { kind: 'NUMBER', value: 183.81, unit: 'EUR' },
      difference: { kind: 'NUMBER', value: 0.01, unit: 'EUR' },
      tolerance: { kind: 'NUMBER', value: 0.02, unit: 'EUR' },
      executedAt: NOW,
      ruleSource: { sourceType: 'CALCULATION', status: 'CONFIRMED', version: '1.0.0', confidence: 100 },
    });
    expect(result.evidence.map((item) => item.id)).toEqual(expect.arrayContaining([
      'inps-observed-calculation:taxable',
      'inps-observed-calculation:rate',
      'inps-observed-calculation:contribution',
      'inps-observed-calculation:normalized-rate',
      'inps-observed-calculation:formula',
      'inps-observed-calculation:expected-contribution',
    ]));
  });

  it('non modifica lo snapshot ed è serializzabile', async () => {
    const payroll = snapshot(values());
    const before = JSON.stringify(payroll);
    const result = await createInpsObservedCalculationConsistencyCheck({ clock: () => NOW })
      .execute({ payroll });

    expect(JSON.stringify(payroll)).toBe(before);
    expect(JSON.parse(JSON.stringify(result))).toMatchObject({ status: 'PASS', executedAt: NOW });
  });

  it('funziona tramite Validation Runner con conteggi corretti', async () => {
    const check = createInpsObservedCalculationConsistencyCheck({ clock: () => NOW });
    const run = await runPayrollValidation(
      { payroll: snapshot(values()) },
      [check],
      { clock: () => NOW }
    );

    expect(run).toMatchObject({
      executedChecks: 1,
      skippedChecks: 0,
      passCount: 1,
      warningCount: 0,
      failCount: 0,
      infoCount: 0,
      internalErrors: [],
    });
  });

  it('non usa fiscalSummary o payLines come fallback', async () => {
    const payroll = snapshot([], {
      socialSecurityTaxable: 2000,
      employeeSocialContributions: 183.8,
    });
    payroll.lines as unknown as Array<unknown>;
    const result = await createInpsObservedCalculationConsistencyCheck({ clock: () => NOW })
      .execute({ payroll: { ...payroll, lines: [{ canonicalKey: 'rate', description: '9.19', confidence: 100, provenance: [] }] } });

    expect(result.status).toBe('INFO');
  });

  it.each([
    ['settembre 2025', september2025AnonymizedFixture],
    ['ottobre 2025', october2025AnonymizedFixture],
  ] as const)('la fixture reale %s produce INFO senza aliquota osservata', async (_name, fixtureFactory) => {
    const fixture = fixtureFactory();
    const payslip = parsePayslip(fixture);
    const fiscalData = normalizePayslipFiscalData(fixture, payslip);
    const payroll = adaptPayrollToObservedSnapshot(payslip, { fiscalData });
    const result = await createInpsObservedCalculationConsistencyCheck({ clock: () => NOW })
      .execute({ payroll });

    expect(result.status).toBe('INFO');
    expect(result.missingInputs).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'payroll.fiscalObservations.socialSecurity.contributionRate' }),
    ]));
  });
});
