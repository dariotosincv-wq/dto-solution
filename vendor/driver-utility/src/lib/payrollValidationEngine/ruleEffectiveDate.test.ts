import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { payrollPeriodToRuleEffectiveDate } from './ruleEffectiveDate';

describe('payrollPeriodToRuleEffectiveDate', () => {
  it.each([
    [{ year: 2023, month: 2 }, '2023-02-28'],
    [{ year: 2024, month: 2 }, '2024-02-29'],
    [{ year: 2026, month: 4 }, '2026-04-30'],
    [{ year: 2026, month: 1 }, '2026-01-31'],
  ] as const)('usa l ultimo giorno di competenza per %o', (period, expected) => {
    expect(payrollPeriodToRuleEffectiveDate(period)).toBe(expected);
  });

  it('applica integralmente la regola gregoriana degli anni bisestili', () => {
    expect(payrollPeriodToRuleEffectiveDate({ year: 2000, month: 2 })).toBe('2000-02-29');
    expect(payrollPeriodToRuleEffectiveDate({ year: 2100, month: 2 })).toBe('2100-02-28');
  });

  it.each([
    {},
    { year: 2026 },
    { year: 0, month: 1 },
    { year: 10000, month: 1 },
    { year: 2026.5, month: 1 },
    { year: 2026, month: 0 },
    { year: 2026, month: 13 },
    { year: 2026, month: 1.5 },
  ])('rifiuta il periodo invalido %o', (period) => {
    expect(() => payrollPeriodToRuleEffectiveDate(period)).toThrow(RangeError);
  });

  it('rimane isolata da parser, UI e storage', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/lib/payrollValidationEngine/ruleEffectiveDate.ts'),
      'utf8'
    );

    ['Parser', 'React', 'Storage', 'localStorage', 'pdfjs'].forEach((dependency) =>
      expect(source).not.toContain(dependency)
    );
  });
});
