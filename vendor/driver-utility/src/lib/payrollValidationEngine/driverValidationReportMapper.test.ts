import { describe, expect, it } from 'vitest';
import { createInpsObservedCalculationConsistencyCheck } from './checks/inpsObservedCalculationConsistencyCheck';
import { createNetPayConsistencyCheck } from './checks/netPayConsistencyCheck';
import {
  formatPayrollValidationValueForDriver,
  mapPayrollValidationRunToDriverReport,
} from './driverValidationReportMapper';
import type {
  PayrollObservedFiscalValue,
  PayrollValidationResult,
  PayrollValidationRunResult,
  PayrollValidationStatus,
  PayrollValidationValue,
} from './types';
import { runPayrollValidation } from './validationRunner';

const NOW = '2026-07-31T16:00:00.000Z';

const result = (
  status: PayrollValidationStatus,
  overrides: Partial<PayrollValidationResult> = {}
): PayrollValidationResult => ({
  id: `technical.${status.toLowerCase()}`,
  checkVersion: '1.0.0',
  title: `Controllo ${status}`,
  category: 'FISCAL',
  status,
  shortExplanation: `Spiegazione ${status}`,
  detailedExplanation: `Dettaglio ${status}`,
  confidence: 85,
  evidence: [{ id: 'source', source: 'PAYROLL', description: 'Cedolino', confidence: 85 }],
  missingInputs: [],
  executedAt: NOW,
  metadata: { trace: 'technical-only' },
  ...overrides,
});

const run = (
  results: ReadonlyArray<PayrollValidationResult>,
  internalErrors: PayrollValidationRunResult['internalErrors'] = []
): PayrollValidationRunResult => ({
  results,
  executedAt: NOW,
  executedChecks: results.length + internalErrors.length,
  skippedChecks: 0,
  passCount: results.filter((item) => item.status === 'PASS').length,
  warningCount: results.filter((item) => item.status === 'WARNING').length,
  failCount: results.filter((item) => item.status === 'FAIL').length,
  infoCount: results.filter((item) => item.status === 'INFO').length,
  internalErrors,
});

describe('mapPayrollValidationRunToDriverReport', () => {
  it.each([
    [['PASS'], 'OK'],
    [['WARNING'], 'ATTENTION'],
    [['FAIL'], 'ISSUE'],
    [['INFO'], 'INCOMPLETE'],
    [[], 'INCOMPLETE'],
  ] as const)('determina lo stato per %j come %s', (statuses, expected) => {
    const report = mapPayrollValidationRunToDriverReport(
      run(statuses.map((status) => result(status)))
    );
    expect(report.summary.overallStatus).toBe(expected);
  });

  it('applica precedenza deterministica FAIL, WARNING, INFO, PASS', () => {
    const report = mapPayrollValidationRunToDriverReport(run([
      result('INFO'), result('PASS'), result('WARNING'), result('FAIL'),
    ]));
    expect(report.summary.overallStatus).toBe('ISSUE');
  });

  it('calcola i conteggi dai risultati e mantiene il loro ordine', () => {
    const input = [result('PASS'), result('WARNING'), result('FAIL'), result('INFO')];
    const report = mapPayrollValidationRunToDriverReport(run(input));

    expect(report.summary).toMatchObject({
      totalResults: 4,
      correctCount: 1,
      checkCount: 1,
      problemCount: 1,
      informationCount: 1,
    });
    expect(report.items.map((item) => item.title)).toEqual(input.map((item) => item.title));
  });

  it.each([
    ['PASS', 'CORRECT', 'GREEN'],
    ['WARNING', 'CHECK', 'YELLOW'],
    ['FAIL', 'PROBLEM', 'RED'],
    ['INFO', 'INFORMATION', 'BLUE'],
  ] as const)('mappa %s in %s/%s senza cambiare il tecnico', (technical, user, indicator) => {
    const source = result(technical);
    const report = mapPayrollValidationRunToDriverReport(run([source]));

    expect(report.items[0]).toMatchObject({ userStatus: user, indicator });
    expect(source.status).toBe(technical);
  });

  it.each([
    [{ kind: 'NUMBER', value: 1234.5, unit: 'EUR' }, '€ 1234,50', 'euro'],
    [{ kind: 'NUMBER', value: 8.5, unit: 'HOURS' }, '8,50 ore', 'ore'],
    [{ kind: 'NUMBER', value: 22, unit: 'DAYS' }, '22,00 giorni', 'giorni'],
    [{ kind: 'NUMBER', value: 9.19, unit: 'PERCENT' }, '9,19%', 'percentuale'],
    [{ kind: 'NUMBER', value: 3, unit: 'QUANTITY' }, '3,00', 'quantità'],
    [{ kind: 'TEXT', value: 'Testo' }, 'Testo', undefined],
    [{ kind: 'BOOLEAN', value: true }, 'Sì', undefined],
  ] as const)('formatta deterministicamente %j', (value, text, unit) => {
    expect(formatPayrollValidationValueForDriver(value as PayrollValidationValue)).toEqual(
      unit ? { text, unit } : { text }
    );
  });

  it('non trasforma UNAVAILABLE in zero', () => {
    expect(formatPayrollValidationValueForDriver({
      kind: 'UNAVAILABLE', reason: 'MISSING', description: 'Aliquota non disponibile',
    })).toEqual({ text: 'Aliquota non disponibile' });
  });

  it('rende leggibili expected, actual, difference e tolerance senza ricalcolarli', () => {
    const source = result('FAIL', {
      expectedValue: { kind: 'NUMBER', value: 100, unit: 'EUR' },
      actualValue: { kind: 'NUMBER', value: 100.03, unit: 'EUR' },
      difference: { kind: 'NUMBER', value: 0.03, unit: 'EUR' },
      tolerance: { kind: 'NUMBER', value: 0.02, unit: 'EUR' },
    });
    const item = mapPayrollValidationRunToDriverReport(run([source])).items[0];

    expect(item).toMatchObject({
      expected: { text: '€ 100,00' },
      actual: { text: '€ 100,03' },
      difference: { text: '€ 0,03' },
      tolerance: { text: '€ 0,02' },
    });
  });

  it('espone descrizioni dei dati mancanti senza ID tecnici', () => {
    const report = mapPayrollValidationRunToDriverReport(run([result('INFO', {
      missingInputs: [{
        id: 'payroll.secret.field',
        description: 'Aliquota contributiva osservata',
        required: true,
        effect: 'BLOCKS_CHECK',
      }],
    })]));

    expect(report.items[0].missingInformation).toEqual(['Aliquota contributiva osservata']);
    expect(JSON.stringify(report.items)).not.toContain('payroll.secret.field');
  });

  it('conserva il dettaglio tecnico completo soltanto nel livello 3', () => {
    const source = result('PASS', {
      expectedValue: { kind: 'TEXT', value: 'atteso' },
      actualValue: { kind: 'TEXT', value: 'rilevato' },
      difference: { kind: 'TEXT', value: 'differenza' },
      tolerance: { kind: 'TEXT', value: 'tolleranza' },
      ruleSource: { id: 'rule.id', version: '1', sourceType: 'CALCULATION', status: 'CONFIRMED', confidence: 100 },
    });
    const report = mapPayrollValidationRunToDriverReport(run([source]));
    const publicLevels = JSON.stringify({ summary: report.summary, items: report.items });

    expect(publicLevels).not.toContain(source.id);
    expect(publicLevels).not.toContain('technical-only');
    expect(report.technical.items[0]).toMatchObject({
      checkId: source.id,
      version: source.checkVersion,
      category: source.category,
      confidence: source.confidence,
      expected: source.expectedValue,
      actual: source.actualValue,
      difference: source.difference,
      tolerance: source.tolerance,
      executedAt: source.executedAt,
      metadata: source.metadata,
      ruleSource: source.ruleSource,
    });
    expect(report.technical.items[0].evidence).toEqual(source.evidence);
  });

  it('segnala internalErrors separatamente senza trasformarli in FAIL', () => {
    const error = {
      checkId: 'broken.check', checkVersion: '1', stage: 'EXECUTION' as const,
      errorName: 'Error', message: 'errore interno',
    };
    const report = mapPayrollValidationRunToDriverReport(run([result('PASS')], [error]));

    expect(report.summary).toMatchObject({ overallStatus: 'INCOMPLETE', problemCount: 0, technicalProblemCount: 1 });
    expect(report.technicalProblems).toEqual([{ message: 'Un controllo tecnico non è stato completato.' }]);
    expect(report.technical.internalErrors).toEqual([error]);
  });

  it('gestisce insieme PASS, WARNING, FAIL, INFO e internalError', () => {
    const mixed = mapPayrollValidationRunToDriverReport(run(
      [result('PASS'), result('WARNING'), result('FAIL'), result('INFO')],
      [{ checkId: 'broken', checkVersion: '1', stage: 'APPLICABILITY', errorName: 'Error', message: 'x' }]
    ));
    expect(mixed.summary).toMatchObject({ overallStatus: 'ISSUE', totalResults: 4, technicalProblemCount: 1 });
    expect(mixed.items).toHaveLength(4);
  });

  it('non modifica o congela input e restituisce un report readonly congelato profondamente', () => {
    const input = run([result('PASS')]);
    const before = JSON.stringify(input);
    const report = mapPayrollValidationRunToDriverReport(input);

    expect(JSON.stringify(input)).toBe(before);
    expect(Object.isFrozen(input)).toBe(false);
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.summary)).toBe(true);
    expect(Object.isFrozen(report.items)).toBe(true);
    expect(Object.isFrozen(report.technical.items[0].evidence)).toBe(true);
  });

  it('produce JSON serializzabile', () => {
    const restored = JSON.parse(JSON.stringify(mapPayrollValidationRunToDriverReport(run([result('PASS')]))));
    expect(restored).toMatchObject({ summary: { overallStatus: 'OK' }, items: [{ userStatus: 'CORRECT' }] });
  });

  it('mappa risultati reali dei controlli economici e INPS eseguiti dal Runner', async () => {
    const fiscalValue = (
      canonicalField: string, value: number, unit: PayrollObservedFiscalValue['unit']
    ): PayrollObservedFiscalValue => ({
      canonicalField, value, unit, classificationStatus: 'CLASSIFIED', fiscalPeriod: 'monthly',
      source: 'fiscal_section', confidence: 90, extractionMethod: 'label_catalog', provenance: [],
    });
    const context = {
      payroll: {
        period: { year: 2026, month: 7 }, lines: [],
        economicSummary: { totalEarnings: 1000, totalDeductions: 200, netAmount: 800 },
        fiscalObservations: {
          schemaVersion: 'fiscal-v1' as const,
          values: [
            fiscalValue('socialSecurity.taxable', 2000, 'EUR'),
            fiscalValue('socialSecurity.contributionRate', 9.19, 'PERCENT_POINTS'),
            fiscalValue('socialSecurity.employeeContributions', 183.8, 'EUR'),
          ],
          warnings: [],
        },
        confidence: 90, provenance: [],
      },
    };
    const technicalRun = await runPayrollValidation(context, [
      createNetPayConsistencyCheck({ clock: () => NOW }),
      createInpsObservedCalculationConsistencyCheck({ clock: () => NOW }),
    ], { clock: () => NOW });
    const report = mapPayrollValidationRunToDriverReport(technicalRun);

    expect(report.items.map((item) => item.title)).toEqual([
      'Coerenza del netto',
      'Coerenza matematica dei contributi INPS osservati',
    ]);
    expect(report.summary.correctCount).toBe(1);
    expect(report.summary.checkCount).toBe(1);
  });
});
