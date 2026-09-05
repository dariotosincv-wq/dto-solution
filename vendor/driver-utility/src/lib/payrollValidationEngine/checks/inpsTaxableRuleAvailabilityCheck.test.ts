import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createRuleResolver } from '../ruleEngine/ruleResolver';
import type {
  RuleContext,
  RuleDefinitionInput,
  RuleResolver,
} from '../ruleEngine/types';
import { runPayrollValidation } from '../validationRunner';
import {
  createInpsTaxableRuleAvailabilityCheck,
  INPS_TAXABLE_RULE_AVAILABILITY_CHECK_ID,
  INPS_TAXABLE_RULE_CANONICAL_FIELD,
  INPS_TAXABLE_RULE_FISCAL_CATEGORY,
} from './inpsTaxableRuleAvailabilityCheck';

const EXECUTED_AT = '2026-07-31T12:00:00.000Z';
const check = createInpsTaxableRuleAvailabilityCheck({ clock: () => EXECUTED_AT });

const definition = (id = 'fixture.rule.alpha'): RuleDefinitionInput => ({
  id,
  canonicalField: INPS_TAXABLE_RULE_CANONICAL_FIELD,
  fiscalCategory: INPS_TAXABLE_RULE_FISCAL_CATEGORY,
  versions: [
    {
      version: 'fixture-v1',
      validFrom: '2024-01-01',
      source: {
        id: 'fixture.source.synthetic',
        type: 'MANUAL',
        title: 'Sorgente tecnica sintetica non normativa',
      },
      payload: {
        kind: 'PARAMETER_SET',
        parameters: [{ key: 'fixtureMarker', value: 'synthetic-only' }],
      },
    },
  ],
});

describe('inpsTaxableRuleAvailabilityCheck', () => {
  it('restituisce INFO quando il RuleResolver non e disponibile', () => {
    const result = check.execute({ period: { year: 2026, month: 1 } });

    expect(result).toMatchObject({
      status: 'INFO',
      metadata: { resolution: 'SERVICE_UNAVAILABLE' },
    });
  });

  it.each([
    undefined,
    {},
    { year: 2026, month: 13 },
  ])('restituisce INFO per periodo assente o invalido %o', (period) => {
    const result = check.execute({
      period,
      services: { ruleResolver: createRuleResolver([]) },
    });

    expect(result).toMatchObject({
      status: 'INFO',
      metadata: { resolution: 'INVALID_PERIOD' },
    });
  });

  it('mappa NOT_FOUND su INFO', () => {
    const result = check.execute({
      period: { year: 2026, month: 1 },
      services: { ruleResolver: createRuleResolver([]) },
    });

    expect(result).toMatchObject({
      status: 'INFO',
      metadata: { resolution: 'NOT_FOUND', effectiveDate: '2026-01-31' },
    });
  });

  it('mappa CONFLICT su WARNING senza chiamare resolve', () => {
    const actual = createRuleResolver([
      definition('fixture.rule.zeta'),
      definition('fixture.rule.alpha'),
    ]);
    const resolver: RuleResolver = {
      resolveResult: vi.fn((context) => actual.resolveResult(context)),
      resolve: vi.fn(() => {
        throw new Error('resolve non deve essere usato');
      }),
      resolveAll: (context) => actual.resolveAll(context),
      definitions: () => actual.definitions(),
    };
    const result = check.execute({
      period: { year: 2026, month: 1 },
      services: { ruleResolver: resolver },
    });

    expect(result).toMatchObject({
      status: 'WARNING',
      metadata: {
        resolution: 'CONFLICT',
        conflictCount: 2,
        conflictingRuleIds: ['fixture.rule.alpha', 'fixture.rule.zeta'],
      },
    });
    expect(resolver.resolve).not.toHaveBeenCalled();
  });

  it('mappa RESOLVED con PARAMETER_SET su PASS e traccia regola e payload', async () => {
    const result = await check.execute({
      period: { year: 2026, month: 1 },
      services: { ruleResolver: createRuleResolver([definition()]) },
    });

    expect(result).toMatchObject({
      id: INPS_TAXABLE_RULE_AVAILABILITY_CHECK_ID,
      status: 'PASS',
      actualValue: { kind: 'TEXT', value: 'PARAMETER_SET' },
      metadata: {
        resolution: 'RESOLVED',
        ruleDefinitionId: 'fixture.rule.alpha',
        ruleVersion: 'fixture-v1',
        ruleSourceId: 'fixture.source.synthetic',
        payloadKind: 'PARAMETER_SET',
      },
    });
    expect(result.detailedExplanation).toContain('non verifica imponibile');
  });

  it.each([
    [{ year: 2026, month: 4 }, '2026-04-30'],
    [{ year: 2024, month: 2 }, '2024-02-29'],
  ] as const)('usa l ultimo giorno del mese %o', (period, expectedDate) => {
    const resolveResult = vi.fn((_context: RuleContext) => ({ kind: 'NOT_FOUND' as const }));
    const resolver: RuleResolver = {
      resolveResult,
      resolve: () => undefined,
      resolveAll: () => [],
      definitions: () => [],
    };

    check.execute({ period, services: { ruleResolver: resolver } });

    expect(resolveResult).toHaveBeenCalledWith({
      canonicalField: INPS_TAXABLE_RULE_CANONICAL_FIELD,
      fiscalCategory: INPS_TAXABLE_RULE_FISCAL_CATEGORY,
      effectiveDate: expectedDate,
    });
    const passedContext: RuleContext = resolveResult.mock.calls[0][0];
    expect(passedContext).not.toHaveProperty('companyId');
    expect(passedContext).not.toHaveProperty('ccnlId');
  });

  it('ignora payroll, fiscalSummary e companyName senza inventare scope', () => {
    const resolveResult = vi.fn(() => ({ kind: 'NOT_FOUND' as const }));
    const resolver: RuleResolver = {
      resolveResult,
      resolve: () => undefined,
      resolveAll: () => [],
      definitions: () => [],
    };
    check.execute({
      period: { year: 2026, month: 1 },
      payroll: {
        period: { year: 1999, month: 1 },
        relationship: { companyName: 'Nome non canonico' },
        lines: [],
        economicSummary: {},
        fiscalSummary: { socialSecurityTaxable: 123456 },
        confidence: 100,
        provenance: [],
      },
      services: { ruleResolver: resolver },
    });

    expect(resolveResult).toHaveBeenCalledWith({
      canonicalField: INPS_TAXABLE_RULE_CANONICAL_FIELD,
      fiscalCategory: INPS_TAXABLE_RULE_FISCAL_CATEGORY,
      effectiveDate: '2026-01-31',
    });
  });

  it('e compatibile con il runner', async () => {
    const output = await runPayrollValidation(
      {
        period: { year: 2026, month: 1 },
        services: { ruleResolver: createRuleResolver([definition()]) },
      },
      [check],
      { clock: () => EXECUTED_AT }
    );

    expect(output).toMatchObject({ executedChecks: 1, passCount: 1 });
  });

  it('non contiene formule, valori fiscali o dipendenze vietate', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/lib/payrollValidationEngine/checks/inpsTaxableRuleAvailabilityCheck.ts'
      ),
      'utf8'
    );

    ['createRuleResolver', 'payrollObservedAdapter', 'Parser', 'React', 'Storage',
      'localStorage', 'pdfjs', 'fiscalSummary', 'payLines', 'aliquota', 'formula:']
      .forEach((term) => expect(source).not.toContain(term));
  });
});
