import { describe, expect, it } from 'vitest';
import { resolvePayrollCodeDefinition } from './driverPayrollCodeCatalog';
import { normalizePayslipLine } from './driverPayrollPayslipNormalizer';
import type { PayrollCodeDefinition } from './driverPayrollTypes';

const definition = (
  overrides: Partial<PayrollCodeDefinition> = {}
): PayrollCodeDefinition => ({
  code: 'A100',
  canonicalKey: 'allowance.company_custom',
  canonicalDescription: 'Indennità aziendale',
  aliases: ['premio presenza'],
  category: 'allowance',
  economicType: 'earning',
  quantityUnit: 'days',
  taxTreatment: 'unknown',
  socialSecurityTreatment: 'unknown',
  affectsTfr: 'unknown',
  source: 'company_profile',
  ...overrides,
});

describe('resolvePayrollCodeDefinition', () => {
  it('preferisce il codice esatto del profilo aziendale rispetto al generico', () => {
    const generic = definition({
      canonicalKey: 'generic.a100',
      canonicalDescription: 'Voce generica',
      source: 'builtin',
    });
    const company = definition({
      canonicalKey: 'company.a100',
      companyId: 'company-1',
      priority: 10,
    });

    const result = resolvePayrollCodeDefinition({
      code: 'A100',
      context: { companyId: 'company-1' },
      definitions: [generic, company],
    });

    expect(result).toMatchObject({
      definition: company,
      method: 'exact_company_code',
      confidence: 100,
      ambiguous: false,
    });
  });

  it('risolve un alias descrittivo solo quando è univoco', () => {
    const result = resolvePayrollCodeDefinition({
      description: 'Premio presenza',
      definitions: [definition()],
    });

    expect(result.definition?.canonicalKey).toBe('allowance.company_custom');
    expect(result.method).toBe('description_alias');
    expect(result.ambiguous).toBe(false);
  });

  it('non classifica una descrizione compatibile con più definizioni equivalenti', () => {
    const result = resolvePayrollCodeDefinition({
      description: 'Premio presenza',
      definitions: [
        definition({ canonicalKey: 'allowance.first' }),
        definition({ code: 'B200', canonicalKey: 'bonus.second', category: 'bonus' }),
      ],
    });

    expect(result.definition).toBeUndefined();
    expect(result.ambiguous).toBe(true);
    expect(result.confidence).toBeLessThan(50);
    expect(result.alternatives).toHaveLength(2);
  });

  it('normalizza una voce tramite una definizione configurata senza modificare il parser', () => {
    const line = normalizePayslipLine(
      {
        code: 'A100',
        label: 'PREMIO PRESENZA',
        quantity: 4,
        earningAmount: 80,
        sourceColumn: 'earnings',
      },
      { definitions: [definition()] }
    );

    expect(line).toMatchObject({
      canonicalKey: 'allowance.company_custom',
      category: 'allowance',
      section: 'allowance',
      type: 'earning',
      economicType: 'earning',
      quantityUnit: 'days',
      classificationMethod: 'exact_generic_code',
      classificationConfidence: 96,
      earningAmount: 80,
    });
  });

  it('lascia unknown una voce senza corrispondenze', () => {
    const result = resolvePayrollCodeDefinition({
      code: 'ZZ99',
      description: 'VOCE NON CONFIGURATA',
      definitions: [definition()],
    });

    expect(result).toEqual({
      method: 'unknown',
      confidence: 0,
      ambiguous: false,
      alternatives: [],
    });
  });

  it.each([
    ['1000', 'payroll.base_pay', 'base_pay', 'earning'],
    ['1052', 'payroll.edr', 'edr', 'earning'],
    ['2030', 'payroll.overtime', 'overtime', 'earning'],
    ['2250', 'payroll.overtime_premium', 'overtime_premium', 'earning'],
    ['2310', 'payroll.travel_allowance', 'travel_allowance', 'earning'],
    ['5000', 'payroll.vacation', 'vacation', 'neutral'],
    ['5050', 'payroll.permission', 'permission', 'neutral'],
    ['5100', 'payroll.former_holiday_leave', 'former_holiday_leave', 'neutral'],
    ['5340', 'payroll.thirteenth_month', 'thirteenth_month', 'earning'],
    ['5390', 'payroll.fourteenth_month', 'fourteenth_month', 'earning'],
    ['5963', 'payroll.fringe_benefit', 'fringe_benefit', 'earning'],
    ['6633', 'payroll.bilateral_body.employee_contribution', 'bilateral_body_employee_contribution', 'deduction'],
    ['7033', 'payroll.bilateral_body.employer_contribution', 'bilateral_body_employer_contribution', 'informational'],
    ['8001', 'payroll.social_contribution.employee', 'employee_social_contribution', 'deduction'],
    ['8128', 'payroll.tax.last_deduction', 'tax_deduction', 'informational'],
    ['8146', 'payroll.informational.credit_dl_3_2020', 'informational', 'informational'],
    ['8320', 'payroll.tax.regional', 'regional_tax', 'deduction'],
    ['8420', 'payroll.tax.municipal.balance', 'municipal_tax_balance', 'deduction'],
    ['8460', 'payroll.tax.municipal.advance', 'municipal_tax_advance', 'deduction'],
    ['8582', 'payroll.tax.adjustment.730.regional', 'tax_adjustment', 'deduction'],
    ['9300', 'payroll.union_fee', 'union_fee', 'deduction'],
  ])('classifica semanticamente %s', (code, canonicalKey, category, economicType) => {
    const result = resolvePayrollCodeDefinition({ code });

    expect(result.definition).toMatchObject({ canonicalKey, category, economicType });
  });

  it('distingue malattia e infortunio per natura economica', () => {
    expect(resolvePayrollCodeDefinition({ code: '1981' }).definition).toMatchObject({
      canonicalKey: 'payroll.sickness.hours',
      economicType: 'informational',
    });
    expect(resolvePayrollCodeDefinition({ code: '2500' }).definition).toMatchObject({
      canonicalKey: 'payroll.sickness.waiting_period',
      category: 'sickness_waiting_period',
      economicType: 'earning',
    });
    expect(resolvePayrollCodeDefinition({ code: '2600' }).definition).toMatchObject({
      canonicalKey: 'payroll.sickness.employer_supplement',
      category: 'sickness_employer_supplement',
    });
    expect(resolvePayrollCodeDefinition({ code: '2650' }).definition).toMatchObject({
      canonicalKey: 'payroll.sickness.absence_deduction',
      economicType: 'deduction',
    });
    expect(resolvePayrollCodeDefinition({ code: '1989' }).definition).toMatchObject({
      canonicalKey: 'payroll.accident.hours',
      economicType: 'informational',
    });
    expect(resolvePayrollCodeDefinition({ code: '2800' }).definition).toMatchObject({
      canonicalKey: 'payroll.accident.employer_supplement',
      category: 'accident_employer_supplement',
    });
    expect(resolvePayrollCodeDefinition({ code: '2850' }).definition).toMatchObject({
      canonicalKey: 'payroll.accident.absence_deduction',
      economicType: 'deduction',
    });
  });

  it('dichiara esplicitamente solo le formule lineari documentate dal catalogo', () => {
    expect(resolvePayrollCodeDefinition({ code: '2310' }).definition?.calculationRule)
      .toBe('unit_times_quantity');
    expect(resolvePayrollCodeDefinition({ code: '2030' }).definition?.calculationRule)
      .toBe('unit_times_quantity');
    expect(resolvePayrollCodeDefinition({ code: '1000' }).definition?.calculationRule)
      .toBe('unknown');
  });

  it('supporta EPA e scatti solo per descrizione senza inventare codici', () => {
    expect(resolvePayrollCodeDefinition({ description: 'EPA CCNL' }).definition).toMatchObject({
      code: '',
      canonicalKey: 'payroll.epa',
      category: 'epa',
    });
    expect(resolvePayrollCodeDefinition({ description: 'Scatti di anzianità' }).definition).toMatchObject({
      code: '',
      canonicalKey: 'payroll.seniority_increment',
      category: 'seniority_increment',
    });
  });

  it('permette a codici aziendali diversi di convergere sulla stessa canonicalKey', () => {
    const definitions = [
      definition({ code: 'A100', canonicalKey: 'payroll.travel_allowance' }),
      definition({ code: 'B200', canonicalKey: 'payroll.travel_allowance' }),
    ];

    expect(resolvePayrollCodeDefinition({ code: 'A100', definitions }).definition?.canonicalKey)
      .toBe('payroll.travel_allowance');
    expect(resolvePayrollCodeDefinition({ code: 'B200', definitions }).definition?.canonicalKey)
      .toBe('payroll.travel_allowance');
  });

  it('segnala il conflitto tra codice e descrizione', () => {
    const result = resolvePayrollCodeDefinition({
      code: 'A100',
      description: 'Premio presenza',
      definitions: [
        definition({ canonicalKey: 'payroll.travel_allowance', aliases: [] }),
        definition({ code: 'B200', canonicalKey: 'payroll.performance_bonus' }),
      ],
    });

    expect(result.definition).toBeUndefined();
    expect(result.ambiguous).toBe(true);
    expect(result.alternatives.map((item) => item.canonicalKey)).toEqual([
      'payroll.travel_allowance',
      'payroll.performance_bonus',
    ]);
  });
});
