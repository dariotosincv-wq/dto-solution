import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createFiscalRuleCatalogV1,
  SOCIAL_SECURITY_TAXABLE_CANONICAL_FIELD,
  SOCIAL_SECURITY_TAXABLE_FISCAL_CATEGORY,
  SOCIAL_SECURITY_TAXABLE_RULE_ID,
  SOCIAL_SECURITY_TAXABLE_RULE_VERSION,
} from './fiscalRuleCatalog';
import { interpretRulePayload } from './rulePayloadInterpreter';
import { createRuleResolver } from './ruleEngine/ruleResolver';
import { assertValidRuleCatalog } from './ruleEngine/ruleCatalogValidation';

describe('Fiscal Rule Catalog v1', () => {
  it('contiene esclusivamente la prima regola fiscale reale', () => {
    const catalog = createFiscalRuleCatalogV1();

    expect(catalog).toHaveLength(1);
    expect(catalog[0]).toMatchObject({
      id: SOCIAL_SECURITY_TAXABLE_RULE_ID,
      canonicalField: SOCIAL_SECURITY_TAXABLE_CANONICAL_FIELD,
      fiscalCategory: SOCIAL_SECURITY_TAXABLE_FISCAL_CATEGORY,
    });
  });

  it('crea istanze indipendenti senza esporre un singleton globale', () => {
    const first = createFiscalRuleCatalogV1();
    const second = createFiscalRuleCatalogV1();

    expect(first).not.toBe(second);
    expect(first[0]).not.toBe(second[0]);
    expect(first).toEqual(second);
  });

  it('e compatibile con la validazione ufficiale del catalogo', () => {
    const catalog = createFiscalRuleCatalogV1();

    expect(() => assertValidRuleCatalog(catalog)).not.toThrow();
  });

  it('risolve la RuleVersion corretta dalla decorrenza inclusiva', () => {
    const resolver = createRuleResolver(createFiscalRuleCatalogV1());
    const before = resolver.resolveResult({
      canonicalField: SOCIAL_SECURITY_TAXABLE_CANONICAL_FIELD,
      fiscalCategory: SOCIAL_SECURITY_TAXABLE_FISCAL_CATEGORY,
      effectiveDate: '1997-12-31',
    });
    const applicable = resolver.resolveResult({
      canonicalField: SOCIAL_SECURITY_TAXABLE_CANONICAL_FIELD,
      fiscalCategory: SOCIAL_SECURITY_TAXABLE_FISCAL_CATEGORY,
      effectiveDate: '1998-01-01',
    });

    expect(before.kind).toBe('NOT_FOUND');
    expect(applicable.kind).toBe('RESOLVED');
    expect(applicable.kind).not.toBe('CONFLICT');
    if (applicable.kind === 'RESOLVED') {
      expect(applicable.rule.version.version).toBe(
        SOCIAL_SECURITY_TAXABLE_RULE_VERSION
      );
      expect(applicable.rule.version.validFrom).toBe('1998-01-01');
    }
  });

  it('espone una RuleSource normativa completamente identificabile', () => {
    const source = createFiscalRuleCatalogV1()[0].versions[0].source;

    expect(source).toEqual({
      id: 'italy.dlgs-314-1997.article-6',
      type: 'LAW',
      title:
        'Decreto legislativo 2 settembre 1997, n. 314, articolo 6; Legge 30 aprile 1969, n. 153, articolo 12',
      authority: 'Repubblica Italiana',
      documentReference:
        'https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:1997;314~art6=',
      publishedAt: '1997-09-19',
    });
  });

  it('espone e interpreta il payload PARAMETER_SET descrittivo', () => {
    const payload = createFiscalRuleCatalogV1()[0].versions[0].payload;
    const interpreted = interpretRulePayload(payload);

    expect(payload.kind).toBe('PARAMETER_SET');
    expect(interpreted).toEqual(payload);
    expect(interpreted.parameters.map((parameter) => parameter.key)).toEqual([
      'fieldName',
      'description',
      'validationScope',
      'sourceType',
    ]);
    expect(interpreted.parameters.every((parameter) => typeof parameter.value === 'string')).toBe(true);
  });

  it('rimane JSON serializzabile e profondamente immutabile', () => {
    const catalog = createFiscalRuleCatalogV1();
    const restored = JSON.parse(JSON.stringify(catalog));
    const definition = catalog[0];
    const version = definition.versions[0];

    expect(restored).toEqual(catalog);
    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(definition)).toBe(true);
    expect(Object.isFrozen(definition.versions)).toBe(true);
    expect(Object.isFrozen(version)).toBe(true);
    expect(Object.isFrozen(version.source)).toBe(true);
    expect(Object.isFrozen(version.payload)).toBe(true);
  });

  it('non contiene quantita normative, codice eseguibile o dipendenze applicative', () => {
    const catalog = createFiscalRuleCatalogV1();
    const payload = catalog[0].versions[0].payload;
    const sourceCode = readFileSync(
      resolve(process.cwd(), 'src/lib/payrollValidationEngine/fiscalRuleCatalog.ts'),
      'utf8'
    );

    expect(payload.kind).toBe('PARAMETER_SET');
    if (payload.kind === 'PARAMETER_SET') {
      expect(payload.parameters.every((parameter) => typeof parameter.value === 'string')).toBe(true);
    }
    ['eval(', 'function(', 'payrollObservedAdapter', 'validationRunner', 'Parser',
      'React', 'Storage', 'localStorage', 'pdfjs', 'fiscalSummary', 'payLines']
      .forEach((term) => expect(sourceCode).not.toContain(term));
  });
});
