import { describe, expect, it } from 'vitest';
import { mapPayrollFiscalValueKindToUnit } from './driverPayrollFiscalUnits';

describe('mapPayrollFiscalValueKindToUnit', () => {
  it.each([
    ['money', 'EUR'],
    ['percentage', 'PERCENT_POINTS'],
    ['fraction', 'FRACTION'],
    ['integer', 'UNSPECIFIED'],
    [undefined, 'UNSPECIFIED'],
  ] as const)('mappa %s in %s senza usare il valore numerico', (kind, unit) => {
    expect(mapPayrollFiscalValueKindToUnit(kind)).toBe(unit);
  });
});
