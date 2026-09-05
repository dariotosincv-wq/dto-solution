import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizePayslipFiscalData } from '../driverPayrollFiscalNormalizer';
import { october2025AnonymizedFixture } from '../driverPayrollParsers/fixtures/october2025AnonymizedFixture';
import { parsePayslip } from '../driverPayrollParsers/payslipParserRegistry';
import { adaptPayrollToObservedSnapshot } from './payrollObservedAdapter';
import {
  PayrollValidationPipelineError,
  runDriverPayrollValidationPipeline,
  type PayrollValidationPipelineInput,
} from './payrollValidationPipeline';
import { createRuleResolver } from './ruleEngine/ruleResolver';
import {
  getAllChecks,
  PayrollValidationRegistryStatus,
} from './validationRegistry';
import type { PayrollObservedSnapshot } from './types';

const NOW = '2026-07-31T17:00:00.000Z';
const payroll = (): PayrollObservedSnapshot => ({
  period: { year: 2026, month: 7 },
  lines: [],
  economicSummary: { totalEarnings: 1000, totalDeductions: 200, netAmount: 800 },
  confidence: 90,
  provenance: [],
});
const input = (
  overrides: Partial<PayrollValidationPipelineInput> = {}
): PayrollValidationPipelineInput => ({
  payroll: payroll(),
  period: { year: 2026, month: 7 },
  profile: 'PRODUCTION',
  clock: () => NOW,
  ...overrides,
});

describe('runDriverPayrollValidationPipeline', () => {
  it('PRODUCTION seleziona soltanto i controlli STABLE', async () => {
    const output = await runDriverPayrollValidationPipeline(input());
    const stableIds = getAllChecks()
      .filter((entry) => entry.status === PayrollValidationRegistryStatus.STABLE)
      .map((entry) => entry.id);

    expect(output.profile).toBe('PRODUCTION');
    expect(output.selectedCheckIds).toEqual(stableIds);
    expect(output.selectedCheckIds).not.toContain('fiscal.inps-observed-calculation-consistency');
  });

  it('DIAGNOSTIC include STABLE ed EXPERIMENTAL ed esclude sempre DISABLED', async () => {
    const output = await runDriverPayrollValidationPipeline(input({ profile: 'DIAGNOSTIC' }));
    const expected = getAllChecks()
      .filter((entry) => entry.status !== PayrollValidationRegistryStatus.DISABLED)
      .map((entry) => entry.id);

    expect(output.selectedCheckIds).toEqual(expected);
    expect(output.selectedCheckIds).toContain('fiscal.inps-observed-calculation-consistency');
    expect(getAllChecks().filter((entry) =>
      entry.status === PayrollValidationRegistryStatus.DISABLED &&
      output.selectedCheckIds.includes(entry.id)
    )).toEqual([]);
  });

  it.each(['PRODUCTION', 'DIAGNOSTIC'] as const)(
    'mantiene per %s lo stesso ordine dichiarato nel Registry',
    async (profile) => {
      const output = await runDriverPayrollValidationPipeline(input({ profile }));
      const positions = output.selectedCheckIds.map((id) =>
        getAllChecks().findIndex((entry) => entry.id === id)
      );
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
    }
  );

  it('costruisce il context con periodo e servizi espliciti', async () => {
    const services = Object.freeze({ ruleResolver: createRuleResolver([]) });
    const output = await runDriverPayrollValidationPipeline(input({
      profile: 'DIAGNOSTIC',
      services,
      useFiscalRuleIntegrationV1: true,
    }));
    const ruleResult = output.technicalRun.results.find(
      (result) => result.id === 'fiscal.inps-taxable-rule-availability'
    );

    expect(output.serviceSource).toBe('EXPLICIT');
    expect(ruleResult).toMatchObject({
      status: 'INFO',
      metadata: { effectiveDate: '2026-07-31', resolution: 'NOT_FOUND' },
    });
  });

  it('crea Fiscal Rule Integration v1 soltanto su richiesta esplicita', async () => {
    const without = await runDriverPayrollValidationPipeline(input({ profile: 'DIAGNOSTIC' }));
    const withFiscal = await runDriverPayrollValidationPipeline(input({
      profile: 'DIAGNOSTIC', useFiscalRuleIntegrationV1: true,
    }));
    const status = (output: typeof withFiscal) => output.technicalRun.results.find(
      (result) => result.id === 'fiscal.inps-taxable-rule-availability'
    )?.status;

    expect(without.serviceSource).toBe('NONE');
    expect(status(without)).toBe('INFO');
    expect(withFiscal.serviceSource).toBe('FISCAL_V1');
    expect(status(withFiscal)).toBe('PASS');
  });

  it('crea esecuzioni e risultati indipendenti senza singleton', async () => {
    const first = await runDriverPayrollValidationPipeline(input({ useFiscalRuleIntegrationV1: true }));
    const second = await runDriverPayrollValidationPipeline(input({ useFiscalRuleIntegrationV1: true }));

    expect(first).not.toBe(second);
    expect(first.technicalRun).not.toBe(second.technicalRun);
    expect(first.driverReport).not.toBe(second.driverReport);
    expect(first.selectedCheckIds).not.toBe(second.selectedCheckIds);
  });

  it('restituisce risultato tecnico e i tre livelli del report driver', async () => {
    const output = await runDriverPayrollValidationPipeline(input({ profile: 'DIAGNOSTIC' }));

    expect(output.technicalRun.results.length).toBeGreaterThan(0);
    expect(output.driverReport.summary.totalResults).toBe(output.technicalRun.results.length);
    expect(output.driverReport.items).toHaveLength(output.technicalRun.results.length);
    expect(output.driverReport.technical.items).toHaveLength(output.technicalRun.results.length);
    expect(output.driverReport.summary.correctCount).toBe(output.technicalRun.passCount);
    expect(output.driverReport.summary.checkCount).toBe(output.technicalRun.warningCount);
    expect(output.driverReport.summary.problemCount).toBe(output.technicalRun.failCount);
    expect(output.driverReport.summary.informationCount).toBe(output.technicalRun.infoCount);
  });

  it('conserva gli internalErrors del Runner senza trasformarli in FAIL', async () => {
    const broken = payroll();
    Object.defineProperty(broken.economicSummary, 'netAmount', {
      enumerable: true,
      get: () => { throw new Error('fixture getter failure'); },
    });
    const output = await runDriverPayrollValidationPipeline(input({ payroll: broken }));

    expect(output.technicalRun.internalErrors).toEqual(expect.arrayContaining([
      expect.objectContaining({ stage: 'EXECUTION', errorName: 'Error', message: 'fixture getter failure' }),
    ]));
    expect(output.driverReport.summary.technicalProblemCount).toBeGreaterThan(0);
    expect(output.driverReport.summary.problemCount).toBe(0);
  });

  it('usa un unico clock deterministico per Runner e pipeline', async () => {
    let calls = 0;
    const output = await runDriverPayrollValidationPipeline(input({
      clock: () => { calls += 1; return NOW; },
    }));

    expect(calls).toBe(1);
    expect(output.executedAt).toBe(NOW);
    expect(output.technicalRun.executedAt).toBe(NOW);
    expect(output.driverReport.technical.runExecutedAt).toBe(NOW);
  });

  it('è JSON serializzabile, congelata profondamente e non modifica input', async () => {
    const source = input({ profile: 'DIAGNOSTIC' });
    const before = JSON.stringify({ ...source, clock: undefined });
    const output = await runDriverPayrollValidationPipeline(source);

    expect(JSON.stringify({ ...source, clock: undefined })).toBe(before);
    expect(Object.isFrozen(source)).toBe(false);
    expect(Object.isFrozen(output)).toBe(true);
    expect(Object.isFrozen(output.selectedCheckIds)).toBe(true);
    expect(Object.isFrozen(output.technicalRun.results)).toBe(true);
    expect(Object.isFrozen(output.driverReport.summary)).toBe(true);
    expect(JSON.parse(JSON.stringify(output))).toMatchObject({ profile: 'DIAGNOSTIC', executedAt: NOW });
  });

  it.each([
    [{ payroll: undefined }, 'SNAPSHOT_MISSING'],
    [{ period: { year: 2026, month: 13 } }, 'PERIOD_INVALID'],
    [{ profile: 'UNKNOWN' }, 'PROFILE_INVALID'],
  ] as const)('rifiuta input invalido con errore tipizzato %s', async (override, code) => {
    await expect(runDriverPayrollValidationPipeline(input(
      override as Partial<PayrollValidationPipelineInput>
    ))).rejects.toMatchObject({
      name: 'PayrollValidationPipelineError',
      code,
    });
  });

  it('espone una classe di errore testabile', () => {
    const error = new PayrollValidationPipelineError('PERIOD_INVALID', 'periodo invalido');
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ name: 'PayrollValidationPipelineError', code: 'PERIOD_INVALID' });
  });

  it('mantiene compatibilità con il controllo economico STABLE', async () => {
    const output = await runDriverPayrollValidationPipeline(input());
    expect(output.technicalRun.results.find((result) =>
      result.id === 'economic.net-pay-consistency'
    )).toMatchObject({ status: 'PASS' });
  });

  it('esegue il controllo rule-driven in diagnostica con resolver fiscale esplicito', async () => {
    const output = await runDriverPayrollValidationPipeline(input({
      profile: 'DIAGNOSTIC', useFiscalRuleIntegrationV1: true,
    }));
    expect(output.technicalRun.results.find((result) =>
      result.id === 'fiscal.inps-taxable-rule-availability'
    )).toMatchObject({ status: 'PASS', metadata: { ruleVersion: '1.0.0' } });
  });

  it('la fixture reale senza aliquota produce INFO in DIAGNOSTIC', async () => {
    const fixture = october2025AnonymizedFixture();
    const payslip = parsePayslip(fixture);
    const fiscalData = normalizePayslipFiscalData(fixture, payslip);
    const snapshot = adaptPayrollToObservedSnapshot(payslip, { fiscalData });
    const output = await runDriverPayrollValidationPipeline(input({
      payroll: snapshot,
      period: snapshot.period,
      profile: 'DIAGNOSTIC',
    }));

    expect(output.technicalRun.results.find((result) =>
      result.id === 'fiscal.inps-observed-calculation-consistency'
    )).toMatchObject({ status: 'INFO' });
  });

  it('non dipende da React, Capacitor, parser, PDF, UI o storage', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/lib/payrollValidationEngine/payrollValidationPipeline.ts'),
      'utf8'
    );
    ['react', '@capacitor', 'Parser', 'pdf', 'localStorage', 'Storage', 'payrollObservedAdapter']
      .forEach((term) => expect(source).not.toContain(term));
  });
});
