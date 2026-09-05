import { describe, expect, it } from 'vitest';
import type {
  PayrollObservedFiscalObservations,
  PayrollObservedFiscalValue,
} from './types';
import {
  FISCAL_OBSERVATION_MIN_CONFIDENCE,
  selectFiscalObservation,
} from './fiscalObservationSelector';

const field = 'socialSecurity.taxable';
const observation = (
  overrides: Partial<PayrollObservedFiscalValue> = {}
): PayrollObservedFiscalValue => ({
  canonicalField: field,
  value: 2000,
  unit: 'EUR',
  classificationStatus: 'CLASSIFIED',
  fiscalPeriod: 'monthly',
  source: 'fiscal_section',
  confidence: 90,
  extractionMethod: 'label_catalog',
  provenance: [],
  ...overrides,
});
const observations = (
  values: ReadonlyArray<PayrollObservedFiscalValue>
): PayrollObservedFiscalObservations => ({
  schemaVersion: 'fiscal-v1',
  values,
  warnings: [],
});

describe('selectFiscalObservation', () => {
  it('seleziona una sola osservazione affidabile', () => {
    const source = observation();
    const result = selectFiscalObservation(observations([source]), field);

    expect(result).toMatchObject({ status: 'SELECTED', canonicalField: field });
    if (result.status === 'SELECTED') expect(result.observation).toBe(source);
  });

  it('distingue osservazione assente', () => {
    expect(selectFiscalObservation(observations([]), field).status).toBe('MISSING');
    expect(selectFiscalObservation(undefined, field).status).toBe('MISSING');
  });

  it('distingue osservazione ambigua', () => {
    expect(selectFiscalObservation(observations([observation({ ambiguous: true })]), field).status)
      .toBe('AMBIGUOUS');
  });

  it('non sceglie tra candidati multipli', () => {
    const result = selectFiscalObservation(observations([observation(), observation({ value: 2100 })]), field);

    expect(result.status).toBe('MULTIPLE_CANDIDATES');
    expect(result.candidates).toHaveLength(2);
    expect(result).not.toHaveProperty('observation');
  });

  it('distingue il candidato mensile unico da uno progressivo', () => {
    const monthly = observation();
    const result = selectFiscalObservation(
      observations([observation({ fiscalPeriod: 'progressive' }), monthly]),
      field
    );

    expect(result.status).toBe('SELECTED');
    if (result.status === 'SELECTED') expect(result.observation).toBe(monthly);
  });

  it('usa la soglia ufficiale senza modificarla', () => {
    expect(FISCAL_OBSERVATION_MIN_CONFIDENCE).toBe(70);
    expect(selectFiscalObservation(observations([observation({ confidence: 69 })]), field).status)
      .toBe('LOW_CONFIDENCE');
    expect(selectFiscalObservation(observations([observation({ confidence: 70 })]), field).status)
      .toBe('SELECTED');
  });

  it('distingue periodo incoerente', () => {
    expect(selectFiscalObservation(observations([observation({ fiscalPeriod: 'progressive' })]), field).status)
      .toBe('PERIOD_MISMATCH');
  });

  it.each([
    ['socialSecurity.taxable', 'UNSPECIFIED'],
    ['socialSecurity.contributionRate', 'EUR'],
    ['socialSecurity.employeeContributions', 'FRACTION'],
  ] as const)('distingue unità non valida per %s', (canonicalField, unit) => {
    const result = selectFiscalObservation(
      observations([observation({ canonicalField, unit })]),
      canonicalField
    );
    expect(result.status).toBe('INVALID_UNIT');
  });

  it('non applica euristiche a canonical field non registrati', () => {
    expect(selectFiscalObservation(
      observations([observation({ canonicalField: 'custom.field', unit: 'UNSPECIFIED' })]),
      'custom.field'
    ).status).toBe('SELECTED');
  });

  it('non modifica input, congela il risultato ed è serializzabile', () => {
    const input = observations([observation()]);
    const before = JSON.stringify(input);
    const result = selectFiscalObservation(input, field);

    expect(JSON.stringify(input)).toBe(before);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.candidates)).toBe(true);
    expect(JSON.parse(JSON.stringify(result))).toMatchObject({ status: 'SELECTED' });
  });
});
