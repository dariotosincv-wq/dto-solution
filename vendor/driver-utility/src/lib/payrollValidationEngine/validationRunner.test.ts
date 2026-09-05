import { describe, expect, it, vi } from 'vitest';
import type {
  PayrollValidationCheck,
  PayrollValidationContext,
  PayrollValidationResult as EnginePayrollValidationResult,
  PayrollValidationStatus,
} from './types';
import { runPayrollValidation } from './validationRunner';
import { createRuleResolver } from './ruleEngine/ruleResolver';

const FIXED_RUN_AT = '2026-07-31T14:00:00.000Z';

const result = (
  id: string,
  status: PayrollValidationStatus
): EnginePayrollValidationResult => ({
  id,
  checkVersion: '1.0.0',
  title: id,
  category: 'ECONOMIC',
  status,
  shortExplanation: `${id}: ${status}`,
  detailedExplanation: `Risultato fixture ${id}.`,
  confidence: 90,
  evidence: [],
  missingInputs: [],
  executedAt: FIXED_RUN_AT,
});

const check = (
  id: string,
  execute: PayrollValidationCheck['execute'],
  applicable = true
): PayrollValidationCheck => ({
  id,
  version: '1.0.0',
  title: id,
  category: 'ECONOMIC',
  requiredInputs: [],
  optionalInputs: [],
  applicability: {
    description: 'Applicabilità fixture.',
    evaluate: () => applicable,
  },
  execute,
});

const run = (
  context: PayrollValidationContext,
  checks: ReadonlyArray<PayrollValidationCheck>
) => runPayrollValidation(context, checks, { clock: () => FIXED_RUN_AT });

describe('runPayrollValidation', () => {
  it('gestisce una collezione senza controlli', async () => {
    const output = await run({}, []);

    expect(output).toEqual({
      results: [],
      executedAt: FIXED_RUN_AT,
      executedChecks: 0,
      skippedChecks: 0,
      passCount: 0,
      warningCount: 0,
      failCount: 0,
      infoCount: 0,
      internalErrors: [],
    });
  });

  it('esegue un controllo PASS', async () => {
    const passResult = result('pass-check', 'PASS');
    const output = await run({}, [
      check('pass-check', () => passResult),
    ]);

    expect(output.results).toEqual([passResult]);
    expect(output.executedChecks).toBe(1);
    expect(output.passCount).toBe(1);
  });

  it('raccoglie più controlli e calcola i conteggi per ogni stato', async () => {
    const checks = [
      check('pass', () => result('pass', 'PASS')),
      check('warning', () => result('warning', 'WARNING')),
      check('fail', () => result('fail', 'FAIL')),
      check('info-one', () => result('info-one', 'INFO')),
      check('info-two', () => result('info-two', 'INFO')),
    ];
    const output = await run({}, checks);

    expect(output.results.map((item) => item.id)).toEqual([
      'pass',
      'warning',
      'fail',
      'info-one',
      'info-two',
    ]);
    expect(output).toMatchObject({
      executedChecks: 5,
      skippedChecks: 0,
      passCount: 1,
      warningCount: 1,
      failCount: 1,
      infoCount: 2,
    });
  });

  it('non esegue un controllo non applicabile e incrementa skipped', async () => {
    const execute = vi.fn(() => result('not-applicable', 'PASS'));
    const output = await run({}, [
      check('not-applicable', execute, false),
    ]);

    expect(execute).not.toHaveBeenCalled();
    expect(output.results).toEqual([]);
    expect(output.executedChecks).toBe(0);
    expect(output.skippedChecks).toBe(1);
    expect(output.internalErrors).toEqual([]);
  });

  it('cattura un’eccezione di esecuzione senza interrompere i controlli successivi', async () => {
    const output = await run({}, [
      check('broken', () => {
        throw new TypeError('Errore fixture');
      }),
      check('after-error', () => result('after-error', 'PASS')),
    ]);

    expect(output.results.map((item) => item.id)).toEqual(['after-error']);
    expect(output.executedChecks).toBe(2);
    expect(output.passCount).toBe(1);
    expect(output.internalErrors).toEqual([
      {
        checkId: 'broken',
        checkVersion: '1.0.0',
        stage: 'EXECUTION',
        errorName: 'TypeError',
        message: 'Errore fixture',
      },
    ]);
  });

  it('cattura un’eccezione durante l’applicabilità senza eseguire il controllo', async () => {
    const execute = vi.fn(() => result('broken-applicability', 'PASS'));
    const brokenApplicability: PayrollValidationCheck = {
      ...check('broken-applicability', execute),
      applicability: {
        description: 'Applicabilità non disponibile.',
        evaluate: () => {
          throw new Error('Applicabilità fixture');
        },
      },
    };
    const output = await run({}, [brokenApplicability]);

    expect(execute).not.toHaveBeenCalled();
    expect(output.executedChecks).toBe(0);
    expect(output.skippedChecks).toBe(0);
    expect(output.internalErrors[0]).toMatchObject({
      checkId: 'broken-applicability',
      stage: 'APPLICABILITY',
      message: 'Applicabilità fixture',
    });
  });

  it('supporta un controllo asincrono', async () => {
    const output = await run({}, [
      check('async', async () => Promise.resolve(result('async', 'INFO'))),
    ]);

    expect(output.results).toHaveLength(1);
    expect(output.results[0].status).toBe('INFO');
    expect(output.infoCount).toBe(1);
  });

  it('mantiene un ordine sequenziale e deterministico', async () => {
    const events: string[] = [];
    const first = check('first', async () => {
      events.push('first:start');
      await Promise.resolve();
      events.push('first:end');
      return result('first', 'PASS');
    });
    const second = check('second', async () => {
      events.push('second:start');
      await Promise.resolve();
      events.push('second:end');
      return result('second', 'PASS');
    });
    const output = await run({}, [first, second]);

    expect(events).toEqual([
      'first:start',
      'first:end',
      'second:start',
      'second:end',
    ]);
    expect(output.results.map((item) => item.id)).toEqual(['first', 'second']);
  });

  it('non modifica il context o il risultato restituito dal controllo', async () => {
    const context: PayrollValidationContext = {
      payroll: {
        period: { year: 2026, month: 1 },
        lines: [],
        economicSummary: {
          totalEarnings: 100,
          totalDeductions: 20,
          netAmount: 80,
        },
        confidence: 90,
        provenance: [],
      },
    };
    const passResult = Object.freeze(result('immutable', 'PASS'));
    const contextBefore = JSON.stringify(context);
    const output = await run(context, [
      check('immutable', () => passResult),
    ]);

    expect(JSON.stringify(context)).toBe(contextBefore);
    expect(output.results[0]).toBe(passResult);
  });

  it('produce un risultato tecnico serializzabile tramite JSON', async () => {
    const output = await run({}, [
      check('pass', () => result('pass', 'PASS')),
      check('info', () => result('info', 'INFO')),
    ]);
    const restored = JSON.parse(JSON.stringify(output));

    expect(restored).toMatchObject({
      executedAt: FIXED_RUN_AT,
      executedChecks: 2,
      skippedChecks: 0,
      passCount: 1,
      infoCount: 1,
      internalErrors: [],
    });
    expect(restored.results).toHaveLength(2);
  });

  it('rende opzionale il RuleResolver nel contesto senza cambiare il runner', async () => {
    const resolver = createRuleResolver([]);
    const withoutResolver = vi.fn(() => result('legacy', 'PASS'));
    const withResolver = vi.fn((context: PayrollValidationContext) => {
      expect(context.services?.ruleResolver).toBe(resolver);
      return result('future', 'INFO');
    });

    const legacyOutput = await run({}, [check('legacy', withoutResolver)]);
    const futureOutput = await run(
      { services: { ruleResolver: resolver } },
      [check('future', withResolver)]
    );

    expect(legacyOutput.passCount).toBe(1);
    expect(futureOutput.infoCount).toBe(1);
  });
});
