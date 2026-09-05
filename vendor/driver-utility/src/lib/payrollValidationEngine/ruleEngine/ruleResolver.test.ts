import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRuleDefinition, createRuleResolver } from './ruleResolver';
import type { RuleDefinitionInput, RuleVersion } from './types';

const source = {
  id: 'law.inps.example',
  type: 'LAW',
  title: 'Fonte normativa di esempio',
  authority: 'INPS',
} satisfies RuleVersion['source'];

const payload = {
  kind: 'PARAMETER_SET',
  parameters: [{ key: 'exampleParameter', value: 10 }],
} satisfies RuleVersion['payload'];

const definition = (
  overrides: Partial<RuleDefinitionInput> = {}
): RuleDefinitionInput => ({
  id: 'inps.taxable.example',
  canonicalField: 'socialSecurity.taxable',
  fiscalCategory: 'INPS',
  versions: [
    {
      version: '1.0.0',
      validFrom: '2025-01-01',
      validTo: '2025-12-31',
      source,
      payload,
    },
  ],
  ...overrides,
});

const context = {
  canonicalField: 'socialSecurity.taxable',
  fiscalCategory: 'INPS',
  effectiveDate: '2025-07-01',
};

describe('Payroll Rule Engine', () => {
  it('crea RuleDefinition complete e indipendenti dall\u2019input', () => {
    const versions = [...definition().versions];
    const input = definition({ versions });
    const created = createRuleDefinition(input);

    expect(created).toEqual(input);
    expect(created).not.toBe(input);
    expect(created.versions).not.toBe(versions);
    expect(created.versions[0].source).not.toBe(source);
  });

  it('risolve la versione corretta per il periodo richiesto', () => {
    const resolver = createRuleResolver([
      definition({
        versions: [
          {
            version: '1.0.0',
            validFrom: '2025-01-01',
            validTo: '2025-06-30',
            source,
            payload,
          },
          {
            version: '2.0.0',
            validFrom: '2025-07-01',
            source,
            payload,
          },
        ],
      }),
    ]);

    expect(resolver.resolve(context)?.version.version).toBe('2.0.0');
    expect(
      resolver.resolve({ ...context, effectiveDate: '2025-05-01' })?.version.version
    ).toBe('1.0.0');
  });

  it('applica gli estremi del periodo in modo inclusivo', () => {
    const resolver = createRuleResolver([definition()]);

    expect(resolver.resolve({ ...context, effectiveDate: '2025-01-01' })).toBeDefined();
    expect(resolver.resolve({ ...context, effectiveDate: '2025-12-31' })).toBeDefined();
    expect(resolver.resolve({ ...context, effectiveDate: '2026-01-01' })).toBeUndefined();
  });

  it('risolve esclusivamente la categoria fiscale richiesta', () => {
    const resolver = createRuleResolver([
      definition(),
      definition({ id: 'irpef.taxable.example', fiscalCategory: 'IRPEF' }),
    ]);

    expect(resolver.resolve(context)?.definition.fiscalCategory).toBe('INPS');
    expect(
      resolver.resolve({ ...context, fiscalCategory: 'IRPEF' })?.definition.id
    ).toBe('irpef.taxable.example');
  });

  it('non restituisce regole quando campo, categoria o periodo non coincidono', () => {
    const resolver = createRuleResolver([definition()]);

    expect(
      resolver.resolve({ ...context, canonicalField: 'incomeTax.taxable' })
    ).toBeUndefined();
    expect(resolver.resolve({ ...context, fiscalCategory: 'TFR' })).toBeUndefined();
    expect(
      resolver.resolve({ ...context, effectiveDate: '2024-12-31' })
    ).toBeUndefined();
    expect(resolver.resolveAll({ ...context, fiscalCategory: 'TFR' })).toEqual([]);
    expect(resolver.resolveResult({ ...context, fiscalCategory: 'TFR' })).toEqual({
      kind: 'NOT_FOUND',
    });
  });

  it('restituisce un risultato risolto esplicito', () => {
    const result = createRuleResolver([definition()]).resolveResult(context);

    expect(result.kind).toBe('RESOLVED');
    if (result.kind === 'RESOLVED') {
      expect(result.rule.definition.id).toBe('inps.taxable.example');
    }
  });

  it('espone il conflitto equivalente senza scegliere tramite ID', () => {
    const resolver = createRuleResolver([
      definition({ id: 'rule.zeta' }),
      definition({ id: 'rule.alpha' }),
    ]);
    const result = resolver.resolveResult(context);

    expect(result.kind).toBe('CONFLICT');
    expect(resolver.resolve(context)).toBeUndefined();
    if (result.kind === 'CONFLICT') {
      expect(result.candidates.map((candidate) => candidate.definition.id)).toEqual([
        'rule.alpha',
        'rule.zeta',
      ]);
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.candidates)).toBe(true);
    }
  });

  it('mantiene deterministico l ordine diagnostico indipendentemente dal catalogo', () => {
    const ids = (inputs: ReadonlyArray<RuleDefinitionInput>) => {
      const result = createRuleResolver(inputs).resolveResult(context);
      return result.kind === 'CONFLICT'
        ? result.candidates.map((candidate) => candidate.definition.id)
        : [];
    };
    const alpha = definition({ id: 'rule.alpha' });
    const zeta = definition({ id: 'rule.zeta' });

    expect(ids([zeta, alpha])).toEqual(['rule.alpha', 'rule.zeta']);
    expect(ids([alpha, zeta])).toEqual(['rule.alpha', 'rule.zeta']);
  });

  it('risolve versioni sovrapposte privilegiando validFrom più recente e versione maggiore', () => {
    const resolver = createRuleResolver([
      definition({
        versions: [
          { version: '1.0.0', validFrom: '2025-01-01', source, payload },
          { version: '2.0.0', validFrom: '2025-04-01', source, payload },
          { version: '2.1.0', validFrom: '2025-04-01', source, payload },
        ],
      }),
    ]);

    expect(resolver.resolve(context)?.version.version).toBe('2.1.0');
    expect(resolver.resolveAll(context).map((match) => match.version.version)).toEqual([
      '2.1.0',
      '2.0.0',
      '1.0.0',
    ]);
  });

  it('privilegia azienda e CCNL senza incorporare questa conoscenza nei controlli', () => {
    const resolver = createRuleResolver([
      definition({
        versions: [
          { version: '1.0.0', validFrom: '2025-01-01', source, payload },
          {
            version: '1.1.0',
            validFrom: '2025-01-01',
            ccnlId: 'logistica',
            source,
            payload,
          },
          {
            version: '1.2.0',
            validFrom: '2025-01-01',
            ccnlId: 'logistica',
            companyId: 'company-a',
            source,
            payload,
          },
        ],
      }),
    ]);

    expect(
      resolver.resolve({ ...context, ccnlId: 'logistica', companyId: 'company-a' })
        ?.version.version
    ).toBe('1.2.0');
    expect(
      resolver.resolve({ ...context, ccnlId: 'logistica', companyId: 'company-b' })
        ?.version.version
    ).toBe('1.1.0');
    expect(resolver.resolve(context)?.version.version).toBe('1.0.0');
  });

  it('congela profondamente definizioni, versioni, fonti e risultati', () => {
    const created = createRuleDefinition(definition());
    const resolver = createRuleResolver([created]);
    const matches = resolver.resolveAll(context);

    expect(Object.isFrozen(created)).toBe(true);
    expect(Object.isFrozen(created.versions)).toBe(true);
    expect(Object.isFrozen(created.versions[0])).toBe(true);
    expect(Object.isFrozen(created.versions[0].source)).toBe(true);
    expect(Object.isFrozen(resolver)).toBe(true);
    expect(Object.isFrozen(resolver.definitions())).toBe(true);
    expect(Object.isFrozen(matches)).toBe(true);
    expect(Object.isFrozen(matches[0])).toBe(true);
  });

  it('non contiene formule o funzioni di calcolo nelle definizioni serializzate', () => {
    const resolver = createRuleResolver([definition()]);
    const restored = JSON.parse(JSON.stringify(resolver.definitions()));

    expect(restored).toEqual([definition()]);
    expect(JSON.stringify(restored)).not.toContain('formula');
    expect(JSON.stringify(restored)).not.toContain('rate');
  });

  it('rimane isolato da parser, adapter, runner, UI, storage e import PDF', () => {
    const sourceCode = [
      'types.ts',
      'ruleResolver.ts',
      'ruleCatalogValidation.ts',
      'index.ts',
    ]
      .map((fileName) =>
        readFileSync(
          resolve(
            process.cwd(),
            'src/lib/payrollValidationEngine/ruleEngine',
            fileName
          ),
          'utf8'
        )
      )
      .join('\n');

    [
      'payrollObservedAdapter',
      'validationRunner',
      'driverPayrollParser',
      'driverPayrollStorage',
      'pdfjs',
      'react',
      'localStorage',
      'fiscalObservations',
      'PayrollObservedSnapshot',
    ].forEach((dependency) => expect(sourceCode).not.toContain(dependency));
  });
});
