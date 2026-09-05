import { describe, expect, it } from 'vitest';
import { createRuleResolver } from './ruleEngine/ruleResolver';
import type { ParameterSetRulePayload, RulePayload } from './ruleEngine/types';
import {
  interpretRulePayload,
  RulePayloadInterpretationError,
} from './rulePayloadInterpreter';
import { createInpsTaxableRuleAvailabilityCheck } from './checks/inpsTaxableRuleAvailabilityCheck';

const parameterSet = (): ParameterSetRulePayload => ({
  kind: 'PARAMETER_SET',
  parameters: [
    { key: 'fixtureText', value: 'synthetic' },
    { key: 'fixtureNumber', value: 7 },
    { key: 'fixtureFlag', value: true },
  ],
});

describe('Rule Payload Interpreter v1', () => {
  it('interpreta PARAMETER_SET conservando i tipi dei parametri', () => {
    const interpreted = interpretRulePayload(parameterSet());

    expect(interpreted).toEqual(parameterSet());
    expect(typeof interpreted.parameters[0].value).toBe('string');
    expect(typeof interpreted.parameters[1].value).toBe('number');
    expect(typeof interpreted.parameters[2].value).toBe('boolean');
  });

  it.each<RulePayload>([
    { kind: 'THRESHOLD', comparison: 'MINIMUM', value: 7 },
    {
      kind: 'RANGE',
      minimum: 1,
      maximum: 2,
      includeMinimum: true,
      includeMaximum: true,
    },
  ])('rifiuta il payload incompatibile $kind', (payload) => {
    expect(() => interpretRulePayload(payload)).toThrow(
      RulePayloadInterpretationError
    );
    try {
      interpretRulePayload(payload);
    } catch (error) {
      expect(error).toMatchObject({
        code: 'UNSUPPORTED_PAYLOAD_KIND',
        payloadKind: payload.kind,
      });
    }
  });

  it.each([null, undefined])('rifiuta il payload mancante %s', (payload) => {
    expect(() => interpretRulePayload(payload)).toThrow(
      RulePayloadInterpretationError
    );
  });

  it('rifiuta un PARAMETER_SET strutturalmente invalido senza correggerlo', () => {
    const invalidPayload = JSON.parse(
      '{"kind":"PARAMETER_SET","parameters":[{"key":"fixture","value":null}]}'
    );

    expect(() => interpretRulePayload(invalidPayload)).toThrow(
      RulePayloadInterpretationError
    );
    try {
      interpretRulePayload(invalidPayload);
    } catch (error) {
      expect(error).toMatchObject({ code: 'INVALID_PAYLOAD' });
    }
  });

  it('restituisce una copia indipendente e profondamente immutabile', () => {
    const payload = parameterSet();
    const interpreted = interpretRulePayload(payload);

    expect(interpreted).not.toBe(payload);
    expect(interpreted.parameters).not.toBe(payload.parameters);
    expect(interpreted.parameters[0]).not.toBe(payload.parameters[0]);
    expect(Object.isFrozen(interpreted)).toBe(true);
    expect(Object.isFrozen(interpreted.parameters)).toBe(true);
    expect(interpreted.parameters.every(Object.isFrozen)).toBe(true);
  });

  it('non modifica ne congela il payload originale', () => {
    const payload = parameterSet();
    const before = JSON.stringify(payload);

    interpretRulePayload(payload);

    expect(JSON.stringify(payload)).toBe(before);
    expect(Object.isFrozen(payload)).toBe(false);
    expect(Object.isFrozen(payload.parameters)).toBe(false);
    expect(Object.isFrozen(payload.parameters[0])).toBe(false);
  });

  it('si integra col payload risolto senza cambiare il controllo della Fase 15', () => {
    const resolver = createRuleResolver([
      {
        id: 'fixture.interpreter.integration',
        canonicalField: 'socialSecurity.taxable',
        fiscalCategory: 'INPS',
        versions: [
          {
            version: 'fixture-v1',
            validFrom: '2026-01-01',
            source: {
              id: 'fixture.interpreter.source',
              type: 'MANUAL',
              title: 'Fixture tecnica non normativa',
            },
            payload: parameterSet(),
          },
        ],
      },
    ]);
    const resolution = resolver.resolveResult({
      canonicalField: 'socialSecurity.taxable',
      fiscalCategory: 'INPS',
      effectiveDate: '2026-01-31',
    });
    expect(resolution.kind).toBe('RESOLVED');
    if (resolution.kind !== 'RESOLVED') return;

    const interpreted = interpretRulePayload(resolution.rule.version.payload);
    const check = createInpsTaxableRuleAvailabilityCheck({
      clock: () => '2026-01-31T00:00:00.000Z',
    });
    const checkResult = check.execute({
      period: { year: 2026, month: 1 },
      services: { ruleResolver: resolver },
    });

    expect(interpreted.kind).toBe('PARAMETER_SET');
    expect(checkResult).toMatchObject({
      status: 'PASS',
      metadata: { payloadKind: 'PARAMETER_SET', resolution: 'RESOLVED' },
    });
  });
});
