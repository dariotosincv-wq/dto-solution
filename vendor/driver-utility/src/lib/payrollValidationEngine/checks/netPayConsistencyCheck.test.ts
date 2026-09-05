import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { adaptPayrollToObservedSnapshot } from '../payrollObservedAdapter';
import { january2026SummaryAnonymizedFixture } from '../../driverPayrollParsers/fixtures/january2026SummaryAnonymizedFixture';
import { october2025AnonymizedFixture } from '../../driverPayrollParsers/fixtures/october2025AnonymizedFixture';
import { september2025AnonymizedFixture } from '../../driverPayrollParsers/fixtures/september2025AnonymizedFixture';
import { parsePayslip } from '../../driverPayrollParsers/payslipParserRegistry';
import type {
  PayrollObservedEconomicSummary,
  PayrollObservedSnapshot,
  PayrollValidationContext,
  PayrollValidationResult as EnginePayrollValidationResult,
} from '../types';
import {
  createNetPayConsistencyCheck,
  NET_PAY_CONSISTENCY_CHECK_ID,
  NET_PAY_CONSISTENCY_CHECK_VERSION,
  NET_PAY_CONSISTENCY_TOLERANCE_CENTS,
} from './netPayConsistencyCheck';

const FIXED_EXECUTED_AT = '2026-07-31T12:00:00.000Z';

const observedSnapshot = (
  economicSummary: PayrollObservedEconomicSummary,
  confidence = 90
): PayrollObservedSnapshot => ({
  period: { year: 2026, month: 1 },
  lines: [],
  economicSummary,
  confidence,
  provenance: [],
});

const execute = async (
  context: PayrollValidationContext
): Promise<EnginePayrollValidationResult> => {
  const check = createNetPayConsistencyCheck({ clock: () => FIXED_EXECUTED_AT });
  return Promise.resolve(check.execute(context));
};

describe('netPayConsistencyCheck', () => {
  it('restituisce PASS quando i valori sono esattamente coerenti', async () => {
    const result = await execute({
      payroll: observedSnapshot({
        totalEarnings: 100,
        totalDeductions: 20,
        netAmount: 80,
      }),
    });

    expect(result).toMatchObject({
      id: NET_PAY_CONSISTENCY_CHECK_ID,
      checkVersion: NET_PAY_CONSISTENCY_CHECK_VERSION,
      title: 'Coerenza del netto',
      category: 'ECONOMIC',
      status: 'PASS',
      expectedValue: { kind: 'NUMBER', value: 80, unit: 'EUR' },
      actualValue: { kind: 'NUMBER', value: 80, unit: 'EUR' },
      difference: { kind: 'NUMBER', value: 0, unit: 'EUR' },
      tolerance: { kind: 'NUMBER', value: 0.02, unit: 'EUR' },
    });
  });

  it.each([
    [80.01, 0.01],
    [80.02, 0.02],
  ])('restituisce PASS con uno scarto entro la tolleranza: %s', async (netAmount, difference) => {
    const result = await execute({
      payroll: observedSnapshot({
        totalEarnings: 100,
        totalDeductions: 20,
        netAmount,
      }),
    });

    expect(result.status).toBe('PASS');
    expect(result.difference).toEqual({ kind: 'NUMBER', value: difference, unit: 'EUR' });
  });

  it('restituisce FAIL con uno scarto di 0,03 euro', async () => {
    const result = await execute({
      payroll: observedSnapshot({
        totalEarnings: 100,
        totalDeductions: 20,
        netAmount: 80.03,
      }),
    });

    expect(result.status).toBe('FAIL');
    expect(result.difference).toEqual({ kind: 'NUMBER', value: 0.03, unit: 'EUR' });
  });

  it('mantiene il segno positivo quando il netto osservato supera quello calcolato', async () => {
    const result = await execute({
      payroll: observedSnapshot({
        totalEarnings: 200,
        totalDeductions: 50,
        netAmount: 151,
      }),
    });

    expect(result.status).toBe('FAIL');
    expect(result.difference).toEqual({ kind: 'NUMBER', value: 1, unit: 'EUR' });
  });

  it('mantiene il segno negativo quando il netto osservato è inferiore a quello calcolato', async () => {
    const result = await execute({
      payroll: observedSnapshot({
        totalEarnings: 200,
        totalDeductions: 50,
        netAmount: 149,
      }),
    });

    expect(result.status).toBe('FAIL');
    expect(result.difference).toEqual({ kind: 'NUMBER', value: -1, unit: 'EUR' });
  });

  it.each([
    ['competenze', { totalDeductions: 20, netAmount: 80 }, ['payroll.economicSummary.totalEarnings']],
    ['trattenute', { totalEarnings: 100, netAmount: 80 }, ['payroll.economicSummary.totalDeductions']],
    ['netto', { totalEarnings: 100, totalDeductions: 20 }, ['payroll.economicSummary.netAmount']],
    [
      'più valori',
      {},
      [
        'payroll.economicSummary.totalEarnings',
        'payroll.economicSummary.totalDeductions',
        'payroll.economicSummary.netAmount',
      ],
    ],
  ] as const)('restituisce INFO quando mancano %s', async (_label, summary, missingIds) => {
    const result = await execute({ payroll: observedSnapshot(summary) });

    expect(result.status).toBe('INFO');
    expect(result.expectedValue).toBeUndefined();
    expect(result.actualValue).toBeUndefined();
    expect(result.difference).toBeUndefined();
    expect(result.missingInputs.map((item) => item.id)).toEqual(missingIds);
    expect(result.missingInputs.every((item) => item.effect === 'BLOCKS_CHECK')).toBe(true);
  });

  it('restituisce INFO anche quando manca l’intero snapshot payroll', async () => {
    const result = await execute({});

    expect(result.status).toBe('INFO');
    expect(result.missingInputs).toHaveLength(3);
    expect(result.confidence).toBe(50);
  });

  it('espone le tre evidenze payroll e la formula come evidenza CALCULATION', async () => {
    const result = await execute({
      payroll: observedSnapshot({
        totalEarnings: 100,
        totalDeductions: 20,
        netAmount: 80,
      }),
    });

    expect(result.evidence).toHaveLength(4);
    expect(result.evidence.map((item) => item.id)).toEqual([
      'payroll-total-earnings',
      'payroll-total-deductions',
      'payroll-net-amount',
      'net-pay-calculation',
    ]);
    expect(result.evidence.at(-1)).toMatchObject({
      source: 'CALCULATION',
      value: { kind: 'NUMBER', value: 80, unit: 'EUR' },
    });
  });

  it('usa una ruleSource matematica confermata e versionata', async () => {
    const result = await execute({
      payroll: observedSnapshot({
        totalEarnings: 100,
        totalDeductions: 20,
        netAmount: 80,
      }),
    });

    expect(result.ruleSource).toMatchObject({
      id: 'calculation.net-equals-earnings-minus-deductions',
      version: '1.0.0',
      sourceType: 'CALCULATION',
      status: 'CONFIRMED',
      confidence: 100,
    });
    expect(NET_PAY_CONSISTENCY_TOLERANCE_CENTS).toBe(2);
  });

  it('usa la confidence minima quando tutte le confidence dei valori sono disponibili', async () => {
    const result = await execute({
      payroll: observedSnapshot({
        totalEarnings: 100,
        totalDeductions: 20,
        netAmount: 80,
        fieldConfidence: {
          totalEarnings: 90,
          totalDeductions: 65,
          netAmount: 80,
        },
      }, 95),
    });

    expect(result.confidence).toBe(65);
  });

  it('usa la confidence generale e il fallback 50 quando le confidence di campo non sono complete', async () => {
    const general = await execute({
      payroll: observedSnapshot({
        totalEarnings: 100,
        totalDeductions: 20,
        netAmount: 80,
      }, 72),
    });
    const fallback = await execute({
      payroll: observedSnapshot({
        totalEarnings: 100,
        totalDeductions: 20,
        netAmount: 80,
      }, Number.NaN),
    });

    expect(general.confidence).toBe(72);
    expect(fallback.confidence).toBe(50);
  });

  it('mantiene sempre confidence nel range 0-100', async () => {
    const low = await execute({
      payroll: observedSnapshot({
        totalEarnings: 100,
        totalDeductions: 20,
        netAmount: 80,
        fieldConfidence: {
          totalEarnings: -10,
          totalDeductions: 30,
          netAmount: 40,
        },
      }),
    });
    const high = await execute({
      payroll: observedSnapshot({
        totalEarnings: 100,
        totalDeductions: 20,
        netAmount: 80,
        fieldConfidence: {
          totalEarnings: 140,
          totalDeductions: 130,
          netAmount: 120,
        },
      }),
    });

    expect(low.confidence).toBe(0);
    expect(high.confidence).toBe(100);
  });

  it('non modifica context o snapshot e produce un risultato JSON serializzabile', async () => {
    const context: PayrollValidationContext = {
      payroll: observedSnapshot({
        totalEarnings: 100,
        totalDeductions: 20,
        netAmount: 80,
      }),
    };
    const before = JSON.stringify(context);
    const result = await execute(context);
    const restored = JSON.parse(JSON.stringify(result));

    expect(JSON.stringify(context)).toBe(before);
    expect(restored).toMatchObject({
      id: NET_PAY_CONSISTENCY_CHECK_ID,
      status: 'PASS',
      executedAt: FIXED_EXECUTED_AT,
    });
  });

  it('usa il clock iniettato per executedAt deterministico', async () => {
    const result = await execute({
      payroll: observedSnapshot({
        totalEarnings: 100,
        totalDeductions: 20,
        netAmount: 80,
      }),
    });

    expect(result.executedAt).toBe(FIXED_EXECUTED_AT);
  });

  it('non dipende da parser, Logistics V1, React, UI, storage o Capacitor', () => {
    const sourcePath = resolve(
      process.cwd(),
      'src/lib/payrollValidationEngine/checks/netPayConsistencyCheck.ts'
    );
    const source = readFileSync(sourcePath, 'utf8');

    [
      'driverPayrollParser',
      'logisticsLayoutV1',
      'react',
      'localStorage',
      'Capacitor',
      'driverPayrollStorage',
      'pages/',
    ].forEach((forbiddenDependency) => {
      expect(source).not.toContain(forbiddenDependency);
    });
  });

  it.each([
    ['gennaio 2026', january2026SummaryAnonymizedFixture],
    ['ottobre 2025', october2025AnonymizedFixture],
    ['settembre 2025', september2025AnonymizedFixture],
  ])('restituisce PASS sulla regressione reale %s', async (_label, fixtureFactory) => {
    const snapshot = adaptPayrollToObservedSnapshot(parsePayslip(fixtureFactory()));
    const result = await execute({ payroll: snapshot });

    expect(result.status).toBe('PASS');
    expect(result.difference).toEqual({ kind: 'NUMBER', value: 0, unit: 'EUR' });
  });
});
