import { describe, expect, it } from 'vitest';
import { resolvePayrollFiscalLabels } from './driverPayrollFiscalCatalog';

describe('driverPayrollFiscalCatalog', () => {
  it.each([
    ['Imponibile previdenziale mese', 'socialSecurity.taxable'],
    ['IMPONIBILE FISCALE', 'incomeTax.taxable'],
    ['IRPEF LORDA', 'incomeTax.grossTax'],
    ['DETRAZIONI LAVORO DIPENDENTE', 'incomeTax.workDeductions'],
    ['TRATTAMENTO INTEGRATIVO', 'incomeTax.supplementaryTreatment'],
    ['ADD.REG.: RATA A.P.', 'additionalTaxes.regionalBalance'],
    ['ADD.COM.: RATA A.P.', 'additionalTaxes.municipalBalance'],
    ['ADD.COM.: RATA ACCONTO A.C.', 'additionalTaxes.municipalAdvance'],
    ['MAT. MESE AL NETTO DELLO 0,5 %', 'tfr.monthlyAccrual'],
  ])('risolve %s come %s', (label, target) => {
    expect(resolvePayrollFiscalLabels(label)).toHaveLength(1);
    expect(resolvePayrollFiscalLabels(label)[0].target).toBe(target);
  });

  it('preferisce la definizione più specifica senza confondere rivalutazione e relativa imposta', () => {
    expect(resolvePayrollFiscalLabels('IMPOSTA RIVALUTAZIONE TFR 20,00')[0].target)
      .toBe('tfr.revaluationTax');
  });

  it('non assegna significati a etichette non documentate', () => {
    expect(resolvePayrollFiscalLabels('VALORE GENERICO 1.000,00')).toEqual([]);
  });
});
