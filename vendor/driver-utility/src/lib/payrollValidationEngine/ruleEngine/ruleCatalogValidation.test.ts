import { describe, expect, it } from 'vitest';
import { createRuleDefinition, createRuleResolver } from './ruleResolver';
import { RuleCatalogValidationError } from './ruleCatalogValidation';
import type { RuleDefinitionInput, RuleVersion } from './types';

const source = {
  id: 'source.example',
  type: 'MANUAL',
  title: 'Sorgente strutturale',
} satisfies RuleVersion['source'];

const payload = {
  kind: 'PARAMETER_SET',
  parameters: [{ key: 'example', value: 1 }],
} satisfies RuleVersion['payload'];

const definition = (
  overrides: Partial<RuleDefinitionInput> = {}
): RuleDefinitionInput => ({
  id: 'rule.example',
  canonicalField: 'example.field',
  fiscalCategory: 'EXAMPLE',
  versions: [{ version: '1.0.0', source, payload }],
  ...overrides,
});

const version = (overrides: Partial<RuleVersion> = {}): RuleVersion => ({
  version: '1.0.0',
  source,
  payload,
  ...overrides,
});

const expectIssue = (
  action: () => void,
  expected: Partial<RuleCatalogValidationError['issue']>
) => {
  try {
    action();
    throw new Error('Expected RuleCatalogValidationError');
  } catch (error) {
    expect(error).toBeInstanceOf(RuleCatalogValidationError);
    if (error instanceof RuleCatalogValidationError) {
      expect(error.issue).toMatchObject(expected);
      expect(error.message).toContain(expected.code ?? '');
    }
  }
};

describe('Rule Catalog Integrity', () => {
  it.each([
    '2024-02-29',
    '2025-02-28',
    '2026-04-30',
    '2026-12-31',
  ])('accetta la data ISO gregoriana valida %s', (validFrom) => {
    expect(() => createRuleDefinition(definition({ versions: [version({ validFrom })] }))).not.toThrow();
  });

  it.each([
    '',
    '2026-1-01',
    '26-01-01',
    '2026-01',
    '2026-01-01T00:00:00',
    '2026-01-01Z',
    '2026-13-01',
    '2026-04-31',
    '2025-02-29',
  ])('rifiuta la data invalida o non normalizzata %j', (validFrom) => {
    expectIssue(
      () => createRuleDefinition(definition({ versions: [version({ validFrom })] })),
      { code: 'INVALID_DATE', field: 'validFrom', value: validFrom }
    );
  });

  it('accetta intervalli ordinati, estremi uguali e versioni con un solo estremo', () => {
    expect(() =>
      createRuleDefinition(definition({
        versions: [
          version({ version: '1', validFrom: '2026-01-01', validTo: '2026-12-31' }),
          version({ version: '2', validFrom: '2026-06-30', validTo: '2026-06-30' }),
          version({ version: '3', validFrom: '2027-01-01' }),
          version({ version: '4', validTo: '2025-12-31' }),
        ],
      }))
    ).not.toThrow();
  });

  it('rifiuta un intervallo temporale invertito con diagnostica contestuale', () => {
    expectIssue(
      () => createRuleDefinition(definition({
        versions: [version({ validFrom: '2026-12-31', validTo: '2026-01-01' })],
      })),
      {
        code: 'INVERTED_VALIDITY_PERIOD',
        definitionId: 'rule.example',
        version: '1.0.0',
        field: 'validFrom/validTo',
        value: '2026-12-31/2026-01-01',
      }
    );
  });

  it.each([
    ['id', ''],
    ['id', '   '],
    ['id', ' rule.example'],
    ['canonicalField', 'example.field '],
    ['fiscalCategory', ' EXAMPLE'],
  ] as const)('rifiuta identificatore %s non normalizzato', (field, value) => {
    expectIssue(
      () => createRuleDefinition(definition({ [field]: value })),
      { code: 'INVALID_IDENTIFIER', field, value }
    );
  });

  it.each([
    ['version', ' '],
    ['companyId', ' company-a'],
    ['ccnlId', 'ccnl-a '],
  ] as const)('rifiuta identificatore di versione %s non normalizzato', (field, value) => {
    expectIssue(
      () => createRuleDefinition(definition({ versions: [version({ [field]: value })] })),
      { code: 'INVALID_IDENTIFIER', field, value }
    );
  });

  it('rifiuta identificatori sorgente vuoti', () => {
    expectIssue(
      () => createRuleDefinition(definition({
        versions: [version({ source: { ...source, id: '' } })],
      })),
      { code: 'INVALID_IDENTIFIER', field: 'source.id', value: '' }
    );
  });

  it('applica la convenzione ISO anche alla data pubblicazione della sorgente', () => {
    expectIssue(
      () => createRuleDefinition(definition({
        versions: [version({ source: { ...source, publishedAt: '2026-02-29' } })],
      })),
      { code: 'INVALID_DATE', field: 'source.publishedAt', value: '2026-02-29' }
    );
  });

  it('rifiuta RuleDefinition duplicate anche dopo normalizzazione degli spazi', () => {
    expectIssue(
      () => createRuleResolver([
        definition({ id: 'rule.example' }),
        definition({ id: ' rule.example ' }),
      ]),
      { code: 'DUPLICATE_DEFINITION', field: 'id', value: ' rule.example ' }
    );
  });

  it('rifiuta versioni strutturalmente indistinguibili', () => {
    expectIssue(
      () => createRuleDefinition(definition({ versions: [version(), version()] })),
      { code: 'DUPLICATE_VERSION', field: 'versions', version: '1.0.0' }
    );
  });

  it('rifiuta versioni equivalenti dopo normalizzazione degli identificatori', () => {
    expectIssue(
      () => createRuleDefinition(definition({
        versions: [version({ companyId: 'company-a' }), version({ companyId: ' company-a ' })],
      })),
      { code: 'DUPLICATE_VERSION', field: 'versions' }
    );
  });

  it('accetta sovrapposizioni distinguibili per decorrenza, versione o ambito', () => {
    expect(() => createRuleDefinition(definition({
      versions: [
        version({ version: '1', validFrom: '2026-01-01' }),
        version({ version: '2', validFrom: '2026-01-01' }),
        version({ version: '1', validFrom: '2026-02-01' }),
        version({ version: '1', validFrom: '2026-01-01', companyId: 'company-a' }),
      ],
    }))).not.toThrow();
  });

  it('mantiene i conflitti tra definizioni diverse nel resolver', () => {
    const resolver = createRuleResolver([
      definition({ id: 'rule.alpha' }),
      definition({ id: 'rule.beta' }),
    ]);
    const result = resolver.resolveResult({
      canonicalField: 'example.field',
      fiscalCategory: 'EXAMPLE',
      effectiveDate: '2026-01-31',
    });

    expect(result.kind).toBe('CONFLICT');
  });

  it('conserva copia indipendente e immutabilita profonda del catalogo valido', () => {
    const input = definition();
    const resolver = createRuleResolver([input]);
    const catalog = resolver.definitions();

    expect(catalog[0]).not.toBe(input);
    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog[0])).toBe(true);
    expect(Object.isFrozen(catalog[0].versions)).toBe(true);
    expect(Object.isFrozen(catalog[0].versions[0])).toBe(true);
    expect(Object.isFrozen(catalog[0].versions[0].payload)).toBe(true);
  });
});
