import { describe, expect, it } from 'vitest';
import { createRuleDefinition, createRuleResolver } from './ruleResolver';
import { assertRulePayload } from './rulePayload';
import type { RuleDefinitionInput, RulePayload } from './types';

const source = {
  id: 'source.example',
  type: 'MANUAL',
  title: 'Sorgente architetturale di esempio',
} satisfies RuleDefinitionInput['versions'][number]['source'];

const definitionWith = (payload: RulePayload): RuleDefinitionInput => ({
  id: 'architecture.payload.example',
  canonicalField: 'example.canonicalField',
  fiscalCategory: 'EXAMPLE',
  versions: [
    {
      version: '1.0.0',
      validFrom: '2025-01-01',
      source,
      payload,
    },
  ],
});

describe('Rule Payload Architecture', () => {
  it.each<RulePayload>([
    {
      kind: 'PARAMETER_SET',
      parameters: [
        { key: 'text', value: 'example' },
        { key: 'number', value: 10 },
        { key: 'flag', value: true },
      ],
    },
    { kind: 'THRESHOLD', comparison: 'MINIMUM', value: 10 },
    {
      kind: 'RANGE',
      minimum: 10,
      maximum: 20,
      includeMinimum: true,
      includeMaximum: false,
    },
  ])('accetta e discrimina il payload $kind', (payload) => {
    const created = createRuleDefinition(definitionWith(payload));

    expect(created.versions[0].payload.kind).toBe(payload.kind);
  });

  it('restituisce il payload della RuleVersion selezionata', () => {
    const older: RulePayload = {
      kind: 'PARAMETER_SET',
      parameters: [{ key: 'revision', value: 'older' }],
    };
    const newer: RulePayload = {
      kind: 'PARAMETER_SET',
      parameters: [{ key: 'revision', value: 'newer' }],
    };
    const resolver = createRuleResolver([
      {
        ...definitionWith(older),
        versions: [
          {
            version: '1.0.0',
            validFrom: '2025-01-01',
            source,
            payload: older,
          },
          {
            version: '2.0.0',
            validFrom: '2026-01-01',
            source,
            payload: newer,
          },
        ],
      },
    ]);

    const resolved = resolver.resolve({
      canonicalField: 'example.canonicalField',
      fiscalCategory: 'EXAMPLE',
      effectiveDate: '2026-07-01',
    });

    expect(resolved?.version.version).toBe('2.0.0');
    expect(resolved?.version.payload).toEqual(newer);
  });

  it.each([
    ['discriminante assente', '{"parameters":[]}'],
    [
      'struttura incompatibile',
      '{"kind":"THRESHOLD","comparison":"MINIMUM","parameters":[]}',
    ],
    [
      'discriminante sconosciuto',
      '{"kind":"UNSUPPORTED","value":10}',
    ],
  ])('rifiuta un payload con %s', (_label, serialized) => {
    expect(() => assertRulePayload(JSON.parse(serialized))).toThrow(TypeError);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rifiuta il valore numerico non finito %s',
    (value) => {
      expect(() =>
        assertRulePayload({ kind: 'THRESHOLD', comparison: 'MAXIMUM', value })
      ).toThrow(TypeError);
    }
  );

  it('rifiuta un intervallo invertito o privo di estremi', () => {
    expect(() =>
      assertRulePayload({
        kind: 'RANGE',
        minimum: 20,
        maximum: 10,
        includeMinimum: true,
        includeMaximum: true,
      })
    ).toThrow(TypeError);
    expect(() =>
      assertRulePayload({
        kind: 'RANGE',
        includeMinimum: true,
        includeMaximum: true,
      })
    ).toThrow(TypeError);
  });

  it('rifiuta funzioni e strutture non supportate', () => {
    expect(() =>
      assertRulePayload({
        kind: 'PARAMETER_SET',
        parameters: [{ key: 'callback', value: () => 10 }],
      })
    ).toThrow(TypeError);
    expect(() =>
      assertRulePayload({
        kind: 'PARAMETER_SET',
        parameters: new Map(),
      })
    ).toThrow(TypeError);
  });

  it('rifiuta proprieta accessor e array sparsi', () => {
    const accessorPayload = {
      kind: 'THRESHOLD',
      comparison: 'MINIMUM',
      get value() {
        return 10;
      },
    };
    const sparseParameters = new Array(1);

    expect(() => assertRulePayload(accessorPayload)).toThrow(TypeError);
    expect(() =>
      assertRulePayload({
        kind: 'PARAMETER_SET',
        parameters: sparseParameters,
      })
    ).toThrow(TypeError);
  });

  it('fa rifiutare al catalogo un payload runtime invalido', () => {
    const invalidDefinition = JSON.parse(JSON.stringify(definitionWith({
      kind: 'THRESHOLD',
      comparison: 'MINIMUM',
      value: 10,
    })));
    invalidDefinition.versions[0].payload.value = 'not-a-number';

    expect(() => createRuleDefinition(invalidDefinition)).toThrow(TypeError);
  });

  it('è serializzabile e profondamente immutabile', () => {
    const created = createRuleDefinition(definitionWith({
      kind: 'PARAMETER_SET',
      parameters: [{ key: 'example', value: 10 }],
    }));
    const payload = created.versions[0].payload;

    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);
    expect(Object.isFrozen(payload)).toBe(true);
    if (payload.kind === 'PARAMETER_SET') {
      expect(Object.isFrozen(payload.parameters)).toBe(true);
      expect(Object.isFrozen(payload.parameters[0])).toBe(true);
    }
  });

  it('mantiene indipendenti i payload di versioni diverse', () => {
    const shared: RulePayload = {
      kind: 'PARAMETER_SET',
      parameters: [{ key: 'example', value: 10 }],
    };
    const created = createRuleDefinition({
      ...definitionWith(shared),
      versions: [
        { version: '1.0.0', source, payload: shared },
        { version: '2.0.0', source, payload: shared },
      ],
    });

    expect(created.versions[0].payload).not.toBe(created.versions[1].payload);
    expect(created.versions[0].payload).toEqual(created.versions[1].payload);
  });

  it('non introduce formule o valori fiscali reali', () => {
    const catalog = createRuleResolver([
      definitionWith({
        kind: 'PARAMETER_SET',
        parameters: [{ key: 'example', value: 10 }],
      }),
    ]).definitions();
    const serialized = JSON.stringify(catalog);

    ['INPS', 'IRPEF', 'aliquota', 'contributo', 'formula'].forEach((term) =>
      expect(serialized).not.toContain(term)
    );
  });
});
