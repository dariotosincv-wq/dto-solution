import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { january2026SummaryAnonymizedFixture } from '../../driverPayrollParsers/fixtures/january2026SummaryAnonymizedFixture';
import { october2025AnonymizedFixture } from '../../driverPayrollParsers/fixtures/october2025AnonymizedFixture';
import { september2025AnonymizedFixture } from '../../driverPayrollParsers/fixtures/september2025AnonymizedFixture';
import { parsePayslip } from '../../driverPayrollParsers/payslipParserRegistry';
import { adaptPayrollToObservedSnapshot } from '../payrollObservedAdapter';
import type {
  PayrollObservedEconomicSummary,
  PayrollObservedLine,
  PayrollObservedSnapshot,
  PayrollValidationContext,
  PayrollValidationResult as EnginePayrollValidationResult,
} from '../types';
import {
  createSummaryConsistencyCheck,
  SUMMARY_CONSISTENCY_CHECK_ID,
  SUMMARY_CONSISTENCY_CHECK_VERSION,
  SUMMARY_CONSISTENCY_TOLERANCE_CENTS,
} from './summaryConsistencyCheck';

const FIXED_EXECUTED_AT = '2026-07-31T12:00:00.000Z';

const line = (
  economicType: PayrollObservedLine['economicType'],
  amount: number,
  confidence = 90
): PayrollObservedLine => ({
  canonicalKey: `test.${economicType ?? 'missing'}`,
  description: `Riga ${economicType ?? 'senza tipo'}`,
  category: economicType === 'informational' ? 'informational' : 'test_category',
  economicType,
  ...(economicType === 'earning' ? { earningAmount: amount } : {}),
  ...(economicType === 'deduction' ? { deductionAmount: amount } : {}),
  ...(economicType === 'informational' ? { informationalValue: amount } : {}),
  confidence,
  provenance: [],
});

const observedSnapshot = (
  lines: ReadonlyArray<PayrollObservedLine>,
  economicSummary: PayrollObservedEconomicSummary = {
    totalEarnings: 100,
    totalDeductions: 20,
  },
  confidence = 90
): PayrollObservedSnapshot => ({
  period: { year: 2026, month: 1 },
  lines,
  economicSummary,
  confidence,
  provenance: [],
});

const execute = async (
  context: PayrollValidationContext
): Promise<EnginePayrollValidationResult> => {
  const check = createSummaryConsistencyCheck({ clock: () => FIXED_EXECUTED_AT });
  return Promise.resolve(check.execute(context));
};

describe('summaryConsistencyCheck', () => {
  it('restituisce PASS quando entrambi i totali sono coerenti', async () => {
    const result = await execute({
      payroll: observedSnapshot([line('earning', 100), line('deduction', 20)]),
    });

    expect(result).toMatchObject({
      id: SUMMARY_CONSISTENCY_CHECK_ID,
      checkVersion: SUMMARY_CONSISTENCY_CHECK_VERSION,
      title: 'Coerenza del riepilogo economico',
      category: 'ECONOMIC',
      status: 'PASS',
      tolerance: { kind: 'NUMBER', value: 0.02, unit: 'EUR' },
      metadata: {
        reconstructedEarnings: 100,
        reconstructedDeductions: 20,
        observedEarnings: 100,
        observedDeductions: 20,
        earningsDifference: 0,
        deductionsDifference: 0,
      },
    });
  });

  it.each([
    ['competenze', [line('earning', 99), line('deduction', 20)], 1, 0],
    ['trattenute', [line('earning', 100), line('deduction', 19)], 0, 1],
    ['entrambi', [line('earning', 99), line('deduction', 19)], 1, 1],
  ] as const)('restituisce FAIL quando non sono coerenti %s', async (
    _label,
    lines,
    earningsDifference,
    deductionsDifference
  ) => {
    const result = await execute({ payroll: observedSnapshot(lines) });

    expect(result.status).toBe('FAIL');
    expect(result.metadata).toMatchObject({ earningsDifference, deductionsDifference });
  });

  it.each([
    [0.01, 'PASS'],
    [0.02, 'PASS'],
    [0.03, 'FAIL'],
  ] as const)('applica la tolleranza in centesimi: scarto %s', async (difference, status) => {
    const result = await execute({
      payroll: observedSnapshot(
        [line('earning', 100), line('deduction', 20)],
        { totalEarnings: 100 + difference, totalDeductions: 20 }
      ),
    });

    expect(result.status).toBe(status);
    expect(result.metadata).toMatchObject({ earningsDifference: difference });
  });

  it('esclude informational e neutral dai calcoli', async () => {
    const result = await execute({
      payroll: observedSnapshot([
        line('earning', 100),
        line('deduction', 20),
        line('informational', 9999),
        line('neutral', 9999),
      ]),
    });

    expect(result.status).toBe('PASS');
    expect(result.metadata).toMatchObject({
      earningLineCount: 1,
      deductionLineCount: 1,
      consideredLineCount: 2,
    });
  });

  it('non usa category per classificare una riga unknown', async () => {
    const unknown: PayrollObservedLine = {
      ...line(undefined, 100),
      category: 'unknown',
      earningAmount: 100,
    };
    const result = await execute({
      payroll: observedSnapshot([line('earning', 100), line('deduction', 20), unknown]),
    });

    expect(result.status).toBe('INFO');
    expect(result.missingInputs.map((item) => item.id)).toContain(
      'payroll.lines.2.economicType'
    );
  });

  it.each([
    ['snapshot', {}, ['payroll.lines', 'payroll.economicSummary.totalEarnings', 'payroll.economicSummary.totalDeductions']],
    ['righe', { payroll: observedSnapshot([]) }, ['payroll.lines']],
    [
      'riepilogo',
      { payroll: observedSnapshot([line('earning', 100)], {}) },
      ['payroll.economicSummary.totalEarnings', 'payroll.economicSummary.totalDeductions'],
    ],
  ] as const)('restituisce INFO quando mancano %s', async (_label, context, missingIds) => {
    const result = await execute(context);

    expect(result.status).toBe('INFO');
    expect(result.missingInputs.map((item) => item.id)).toEqual(missingIds);
  });

  it('restituisce INFO se una riga economica non contiene il proprio importo', async () => {
    const incomplete: PayrollObservedLine = {
      ...line('earning', 100),
      earningAmount: undefined,
    };
    const result = await execute({
      payroll: observedSnapshot([incomplete, line('deduction', 20)]),
    });

    expect(result.status).toBe('INFO');
    expect(result.missingInputs[0].id).toBe('payroll.lines.0.earningAmount');
  });

  it('produce le quattro evidenze richieste e una ruleSource confermata', async () => {
    const result = await execute({
      payroll: observedSnapshot([line('earning', 100), line('deduction', 20)]),
    });

    expect(result.evidence.map((item) => item.id)).toEqual([
      'reconstructed-earnings',
      'reconstructed-deductions',
      'considered-line-count',
      'summary-consistency-formula',
    ]);
    expect(result.ruleSource).toMatchObject({
      id: 'calculation.summary-equals-economic-lines',
      version: '1.0.0',
      sourceType: 'CALCULATION',
      status: 'CONFIRMED',
      confidence: 100,
    });
    expect(SUMMARY_CONSISTENCY_TOLERANCE_CENTS).toBe(2);
  });

  it('usa la confidence minima dei totali e delle righe economiche', async () => {
    const result = await execute({
      payroll: observedSnapshot(
        [line('earning', 100, 80), line('deduction', 20, 55), line('informational', 10, 20)],
        {
          totalEarnings: 100,
          totalDeductions: 20,
          fieldConfidence: { totalEarnings: 90, totalDeductions: 70 },
        },
        95
      ),
    });

    expect(result.confidence).toBe(55);
  });

  it('usa la confidence generale e il fallback 50 se quelle dei totali non sono complete', async () => {
    const general = await execute({
      payroll: observedSnapshot(
        [line('earning', 100), line('deduction', 20)],
        { totalEarnings: 100, totalDeductions: 20 },
        72
      ),
    });
    const fallback = await execute({
      payroll: observedSnapshot(
        [line('earning', 100), line('deduction', 20)],
        { totalEarnings: 100, totalDeductions: 20 },
        Number.NaN
      ),
    });

    expect(general.confidence).toBe(72);
    expect(fallback.confidence).toBe(50);
  });

  it('non modifica context o snapshot e produce JSON serializzabile', async () => {
    const context: PayrollValidationContext = {
      payroll: observedSnapshot([line('earning', 100), line('deduction', 20)]),
    };
    const before = JSON.stringify(context);
    const restored = JSON.parse(JSON.stringify(await execute(context)));

    expect(JSON.stringify(context)).toBe(before);
    expect(restored).toMatchObject({
      id: SUMMARY_CONSISTENCY_CHECK_ID,
      status: 'PASS',
      executedAt: FIXED_EXECUTED_AT,
    });
  });

  it('non dipende da parser, UI, storage, Runner o flusso applicativo', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/lib/payrollValidationEngine/checks/summaryConsistencyCheck.ts'),
      'utf8'
    );

    [
      'driverPayrollParser',
      'logisticsLayoutV1',
      'validationRunner',
      'react',
      'localStorage',
      'Capacitor',
      'driverPayrollStorage',
      'pages/',
    ].forEach((dependency) => expect(source).not.toContain(dependency));
  });

  it('restituisce INFO sulla fixture reale gennaio 2026 priva di righe', async () => {
    const snapshot = adaptPayrollToObservedSnapshot(
      parsePayslip(january2026SummaryAnonymizedFixture())
    );
    const result = await execute({ payroll: snapshot });

    expect(snapshot.lines).toHaveLength(0);
    expect(result.status).toBe('INFO');
    expect(result.missingInputs.map((item) => item.id)).toContain('payroll.lines');
  });

  it.each([
    [
      'ottobre 2025',
      october2025AnonymizedFixture,
      {
        reconstructedEarnings: 2521.7,
        reconstructedDeductions: 659.54,
        observedEarnings: 2521.7,
        observedDeductions: 971.49,
        earningsDifference: 0,
        deductionsDifference: 311.95,
      },
    ],
    [
      'settembre 2025',
      september2025AnonymizedFixture,
      {
        reconstructedEarnings: 2194.51,
        reconstructedDeductions: 45.22,
        observedEarnings: 2194.51,
        observedDeductions: 382.44,
        earningsDifference: 0,
        deductionsDifference: 337.22,
      },
    ],
  ] as const)('restituisce FAIL sulla regressione reale %s con lo scostamento osservato', async (
    _label,
    fixtureFactory,
    expectedMetadata
  ) => {
    const payslip = parsePayslip(fixtureFactory());
    const snapshot = adaptPayrollToObservedSnapshot(payslip);
    const result = await execute({ payroll: snapshot });

    expect(snapshot.lines.map((item) => item.economicType)).toEqual(
      payslip.parsedLines.map((item) => item.economicType)
    );
    expect(result.status).toBe('FAIL');
    expect(result.missingInputs).toEqual([]);
    expect(result.metadata).toMatchObject(expectedMetadata);
  });
});
