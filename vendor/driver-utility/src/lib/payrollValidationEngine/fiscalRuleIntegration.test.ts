import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  INPS_TAXABLE_RULE_AVAILABILITY_CHECK_ID,
  createInpsTaxableRuleAvailabilityCheck,
} from './checks/inpsTaxableRuleAvailabilityCheck';
import {
  SOCIAL_SECURITY_TAXABLE_CANONICAL_FIELD,
  SOCIAL_SECURITY_TAXABLE_FISCAL_CATEGORY,
  SOCIAL_SECURITY_TAXABLE_RULE_ID,
  SOCIAL_SECURITY_TAXABLE_RULE_VERSION,
} from './fiscalRuleCatalog';
import { createFiscalRuleIntegrationV1 } from './fiscalRuleIntegration';
import { runPayrollValidation } from './validationRunner';

const EXECUTED_AT = '2026-07-31T12:00:00.000Z';
const check = createInpsTaxableRuleAvailabilityCheck({
  clock: () => EXECUTED_AT,
});

describe('Real Fiscal Rule Availability Integration', () => {
  it('costruisce catalogo, RuleResolver e PayrollValidationServices reali', () => {
    const integration = createFiscalRuleIntegrationV1();

    expect(integration.catalog).toHaveLength(1);
    expect(integration.catalog[0].id).toBe(SOCIAL_SECURITY_TAXABLE_RULE_ID);
    expect(integration.services.ruleResolver).toBe(integration.ruleResolver);
    expect(integration.ruleResolver.definitions()).toEqual(integration.catalog);
  });

  it('crea grafi indipendenti senza singleton', () => {
    const first = createFiscalRuleIntegrationV1();
    const second = createFiscalRuleIntegrationV1();

    expect(first).not.toBe(second);
    expect(first.catalog).not.toBe(second.catalog);
    expect(first.catalog[0]).not.toBe(second.catalog[0]);
    expect(first.ruleResolver).not.toBe(second.ruleResolver);
    expect(first.services).not.toBe(second.services);
    expect(first.services.ruleResolver).not.toBe(second.services.ruleResolver);
  });

  it('restituisce INFO e NOT_FOUND prima della decorrenza', () => {
    const { services } = createFiscalRuleIntegrationV1();
    const result = check.execute({
      period: { year: 1997, month: 12 },
      services,
    });

    expect(result).toMatchObject({
      id: INPS_TAXABLE_RULE_AVAILABILITY_CHECK_ID,
      status: 'INFO',
      metadata: {
        canonicalField: SOCIAL_SECURITY_TAXABLE_CANONICAL_FIELD,
        fiscalCategory: SOCIAL_SECURITY_TAXABLE_FISCAL_CATEGORY,
        effectiveDate: '1997-12-31',
        resolution: 'NOT_FOUND',
      },
    });
  });

  it('restituisce PASS dalla decorrenza con tracciabilita completa', async () => {
    const { services } = createFiscalRuleIntegrationV1();
    const result = await check.execute({
      period: { year: 1998, month: 1 },
      services,
    });

    expect(result).toMatchObject({
      id: INPS_TAXABLE_RULE_AVAILABILITY_CHECK_ID,
      checkVersion: '1.0.0',
      status: 'PASS',
      actualValue: { kind: 'TEXT', value: 'PARAMETER_SET' },
      metadata: {
        canonicalField: SOCIAL_SECURITY_TAXABLE_CANONICAL_FIELD,
        fiscalCategory: SOCIAL_SECURITY_TAXABLE_FISCAL_CATEGORY,
        effectiveDate: '1998-01-31',
        resolution: 'RESOLVED',
        ruleDefinitionId: SOCIAL_SECURITY_TAXABLE_RULE_ID,
        ruleVersion: SOCIAL_SECURITY_TAXABLE_RULE_VERSION,
        ruleSourceId: 'italy.dlgs-314-1997.article-6',
        ruleSourceType: 'LAW',
        payloadKind: 'PARAMETER_SET',
      },
    });
    expect(result.detailedExplanation).toContain('non verifica imponibile');
  });

  it('espone versione, sorgente e PARAMETER_SET attraverso il resolver reale', () => {
    const { ruleResolver } = createFiscalRuleIntegrationV1();
    const resolution = ruleResolver.resolveResult({
      canonicalField: SOCIAL_SECURITY_TAXABLE_CANONICAL_FIELD,
      fiscalCategory: SOCIAL_SECURITY_TAXABLE_FISCAL_CATEGORY,
      effectiveDate: '2026-01-31',
    });

    expect(resolution.kind).toBe('RESOLVED');
    if (resolution.kind === 'RESOLVED') {
      expect(resolution.rule.definition.id).toBe(SOCIAL_SECURITY_TAXABLE_RULE_ID);
      expect(resolution.rule.version.version).toBe(SOCIAL_SECURITY_TAXABLE_RULE_VERSION);
      expect(resolution.rule.version.source).toMatchObject({
        id: 'italy.dlgs-314-1997.article-6',
        type: 'LAW',
      });
      expect(resolution.rule.version.payload.kind).toBe('PARAMETER_SET');
    }
  });

  it('esegue la catena reale tramite Validation Runner con conteggi corretti', async () => {
    const { services } = createFiscalRuleIntegrationV1();
    const output = await runPayrollValidation(
      { period: { year: 2026, month: 1 }, services },
      [check],
      { clock: () => EXECUTED_AT }
    );

    expect(output).toMatchObject({
      executedChecks: 1,
      skippedChecks: 0,
      passCount: 1,
      infoCount: 0,
      warningCount: 0,
      failCount: 0,
      internalErrors: [],
    });
    expect(output.results).toHaveLength(1);
    expect(output.results[0]).toMatchObject({
      status: 'PASS',
      metadata: {
        ruleDefinitionId: SOCIAL_SECURITY_TAXABLE_RULE_ID,
        ruleVersion: SOCIAL_SECURITY_TAXABLE_RULE_VERSION,
        ruleSourceId: 'italy.dlgs-314-1997.article-6',
        payloadKind: 'PARAMETER_SET',
      },
    });
  });

  it('produce un run result JSON serializzabile', async () => {
    const { services } = createFiscalRuleIntegrationV1();
    const output = await runPayrollValidation(
      { period: { year: 2026, month: 1 }, services },
      [check],
      { clock: () => EXECUTED_AT }
    );

    expect(JSON.parse(JSON.stringify(output))).toEqual(output);
  });

  it('mantiene helper e controllo isolati da fallback, UI e storage', () => {
    const integrationSource = readFileSync(
      resolve(process.cwd(), 'src/lib/payrollValidationEngine/fiscalRuleIntegration.ts'),
      'utf8'
    );
    const checkSource = readFileSync(
      resolve(
        process.cwd(),
        'src/lib/payrollValidationEngine/checks/inpsTaxableRuleAvailabilityCheck.ts'
      ),
      'utf8'
    );

    ['payrollObservedAdapter', 'Parser', 'React', 'Storage', 'localStorage',
      'pdfjs', 'fiscalSummary', 'payLines']
      .forEach((term) => expect(integrationSource).not.toContain(term));
    expect(checkSource).not.toContain('createFiscalRuleCatalogV1');
    expect(checkSource).not.toContain('fiscalRuleCatalog');
  });

  it('non introduce dati quantitativi nel catalogo o logica di calcolo', () => {
    const { catalog } = createFiscalRuleIntegrationV1();
    const payload = catalog[0].versions[0].payload;

    expect(payload.kind).toBe('PARAMETER_SET');
    if (payload.kind === 'PARAMETER_SET') {
      expect(payload.parameters.every((parameter) => typeof parameter.value === 'string')).toBe(true);
    }
  });
});
