import { describe, expect, it } from 'vitest';
import { getPayslipLineEconomicAmount, getPayslipLineQuantity } from './driverPayrollLineValues';
import { normalizePayslipLine, normalizePayslipLines } from './driverPayrollPayslipNormalizer';

describe('driverPayrollPayslipNormalizer valori semantici', () => {
  it('converte una vecchia riga informativa 0169 senza trattarla come denaro', () => {
    const line = normalizePayslipLine({ code: '0169', label: 'ORE LAVORATE MESE', amount: 142.8 });
    const normalized = normalizePayslipLines([line])[0];

    expect(normalized).toMatchObject({
      type: 'informational',
      informationalValue: 142.8,
      quantityUnit: 'hours',
      sourceColumn: 'informational',
    });
    expect(normalized.amount).toBeUndefined();
    expect(normalized.earningAmount).toBeUndefined();
    expect(normalized.deductionAmount).toBeUndefined();
  });

  it('mantiene leggibile uno storico legacy con amount economico', () => {
    const legacyEarning = { code: '2310', label: 'TRASFERTA', type: 'earning' as const, quantity: 17, amount: 382.5 };

    expect(getPayslipLineQuantity(legacyEarning)).toBe(17);
    expect(getPayslipLineEconomicAmount(legacyEarning)).toBe(382.5);
  });

  it('mantiene una canonicalKey storica ma usa la nuova semantica tramite il codice', () => {
    const normalized = normalizePayslipLine({
      code: '2310',
      label: 'TRASFERTA',
      canonicalKey: 'payroll.allowance.2310',
      amount: 225,
    });

    expect(normalized.canonicalKey).toBe('payroll.allowance.2310');
    expect(normalized.category).toBe('travel_allowance');
    expect(normalized.type).toBe('earning');
    expect(normalized.calculationRule).toBe('unit_times_quantity');
  });

  it('conserva 8128 come valore informativo anche se la geometria lo colloca nelle competenze', () => {
    const normalized = normalizePayslipLine({
      code: '8128',
      label: 'ULT. DETRAZIONE',
      earningAmount: 84.93,
      sourceColumn: 'earnings',
    });

    expect(normalized).toMatchObject({
      canonicalKey: 'payroll.tax.last_deduction',
      category: 'tax_deduction',
      type: 'informational',
      informationalValue: 84.93,
    });
    expect(normalized.amount).toBeUndefined();
    expect(normalized.earningAmount).toBeUndefined();
    expect(normalized.deductionAmount).toBeUndefined();
  });
});
