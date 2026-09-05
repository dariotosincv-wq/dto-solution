import { describe, expect, it } from 'vitest';
import type { PayslipImport, PayslipLine } from './driverPayrollTypes';
import { validatePayrollConsistency } from './driverPayrollValidation';

const line = (overrides: Partial<PayslipLine>): PayslipLine => ({
  code: 'TEST',
  label: 'Voce test',
  category: 'base_pay',
  canonicalKey: 'payroll.test',
  economicType: 'earning',
  sourceColumn: 'earnings',
  confidence: 95,
  classificationConfidence: 95,
  classificationAmbiguous: false,
  ...overrides,
});

const payslip = (
  summary: PayslipImport['summary'],
  parsedLines: PayslipLine[] = []
): PayslipImport => ({
  id: 'validation-test',
  year: 2026,
  month: 1,
  importedAt: '2026-02-13T00:00:00.000Z',
  extractionMethod: 'pdf_text',
  parsedLines,
  summary,
  warnings: [],
});

const check = (result: ReturnType<typeof validatePayrollConsistency>, id: string) => {
  const found = result.checks.find((item) => item.id === id);
  expect(found, `Controllo ${id} assente`).toBeDefined();
  return found!;
};

describe('validatePayrollConsistency', () => {
  it('include una competenza geometricamente certificata anche con confidence semantica bassa', () => {
    const result = validatePayrollConsistency(payslip(
      { totalEarnings: 9.32 },
      [line({
        code: '1052',
        label: 'E.D.R. EX ACCORDO',
        earningAmount: 9.32,
        confidence: 55,
        classificationConfidence: 55,
        sourceColumn: 'earnings',
        interpretationMethod: 'logisticsLayoutV1_geometric_columns',
        geometricEconomicCertified: true,
      })]
    ));

    expect(check(result, 'EARNINGS_LINES_SUM')).toMatchObject({
      status: 'passed',
      expectedValue: 9.32,
      actualValue: 9.32,
    });
  });

  it('include una trattenuta geometricamente certificata senza confondere la confidence semantica', () => {
    const result = validatePayrollConsistency(payslip(
      { totalDeductions: 26.7 },
      [line({
        code: '8320',
        label: 'ADDIZIONALE REGIONALE',
        earningAmount: undefined,
        deductionAmount: 26.7,
        economicType: 'deduction',
        confidence: 55,
        classificationConfidence: 55,
        sourceColumn: 'deductions',
        interpretationMethod: 'logisticsLayoutV1_geometric_columns',
        geometricEconomicCertified: true,
      })]
    ));

    expect(check(result, 'DEDUCTIONS_LINES_SUM')).toMatchObject({
      status: 'passed',
      expectedValue: 26.7,
      actualValue: 26.7,
    });
  });

  it('A/O valida il riepilogo reale di gennaio 2026 senza modificare i valori ufficiali', () => {
    const input = payslip({
      grossAmount: 2896.57,
      totalEarnings: 2896.57,
      totalDeductions: 986.93,
      netAmount: 1909.64,
      paymentDate: '2026-02-13',
    });
    const before = structuredClone(input);
    const result = validatePayrollConsistency(input);

    expect(check(result, 'SUMMARY_EQUATION')).toMatchObject({
      status: 'passed',
      expectedValue: 1909.64,
      actualValue: 1909.64,
      difference: 0,
    });
    expect(result.overallStatus).not.toBe('inconsistent');
    expect(input).toEqual(before);
  });

  it('B conserva una differenza entro 0,02 come passed', () => {
    const result = validatePayrollConsistency(payslip({
      totalEarnings: 1000,
      totalDeductions: 200,
      netAmount: 799.99,
    }));
    expect(check(result, 'SUMMARY_EQUATION')).toMatchObject({ status: 'passed', difference: 0.01 });
  });

  it('C segnala come warning una differenza tra 0,03 e 0,10 senza correggere il netto', () => {
    const input = payslip({ totalEarnings: 1000, totalDeductions: 200, netAmount: 799.95 });
    const result = validatePayrollConsistency(input);
    expect(check(result, 'SUMMARY_EQUATION')).toMatchObject({ status: 'warning', difference: 0.05 });
    expect(input.summary.netAmount).toBe(799.95);
  });

  it('D considera inconsistente una differenza fondamentale oltre 0,10', () => {
    const result = validatePayrollConsistency(payslip({
      totalEarnings: 1000,
      totalDeductions: 200,
      netAmount: 790,
    }, [line({ earningAmount: 1000 })]));
    expect(check(result, 'SUMMARY_EQUATION')).toMatchObject({ status: 'failed', severity: 'high' });
    expect(result.overallStatus).toBe('inconsistent');
  });

  it('E somma competenze complete e certificate', () => {
    const result = validatePayrollConsistency(payslip(
      { totalEarnings: 300, totalDeductions: 0, netAmount: 300 },
      [line({ code: 'A', earningAmount: 100 }), line({ code: 'B', earningAmount: 200 })]
    ));
    expect(check(result, 'EARNINGS_LINES_SUM')).toMatchObject({
      status: 'passed',
      expectedValue: 300,
      actualValue: 300,
    });
  });

  it('F non fallisce automaticamente quando la somma competenze è incompleta', () => {
    const result = validatePayrollConsistency(payslip(
      { totalEarnings: 300, totalDeductions: 0, netAmount: 300 },
      [
        line({ code: 'A', earningAmount: 100 }),
        line({ code: 'B', earningAmount: 200, classificationAmbiguous: true }),
      ]
    ));
    expect(check(result, 'EARNINGS_LINES_SUM').status).toBe('warning');
  });

  it('G somma le trattenute certificate', () => {
    const result = validatePayrollConsistency(payslip(
      { totalEarnings: 500, totalDeductions: 100, netAmount: 400 },
      [
        line({
          code: 'D1',
          category: 'income_tax',
          economicType: 'deduction',
          sourceColumn: 'deductions',
          earningAmount: undefined,
          deductionAmount: 60,
        }),
        line({
          code: 'D2',
          category: 'employee_social_contribution',
          economicType: 'deduction',
          sourceColumn: 'deductions',
          earningAmount: undefined,
          deductionAmount: 40,
        }),
      ]
    ));
    expect(check(result, 'DEDUCTIONS_LINES_SUM')).toMatchObject({ status: 'passed', expectedValue: 100 });
  });

  it('H esclude i contributi aziendali dalle trattenute del dipendente', () => {
    const result = validatePayrollConsistency(payslip(
      { totalEarnings: 500, totalDeductions: 100, netAmount: 400 },
      [
        line({
          code: 'EMPLOYEE',
          category: 'employee_social_contribution',
          economicType: 'deduction',
          sourceColumn: 'deductions',
          earningAmount: undefined,
          deductionAmount: 100,
        }),
        line({
          code: 'EMPLOYER',
          category: 'employer_social_contribution',
          economicType: 'deduction',
          sourceColumn: 'deductions',
          earningAmount: undefined,
          deductionAmount: 50,
        }),
      ]
    ));
    const deductionCheck = check(result, 'DEDUCTIONS_LINES_SUM');
    expect(deductionCheck.expectedValue).toBe(100);
    expect(JSON.stringify(deductionCheck.metadata)).toContain('EMPLOYER');
    expect(JSON.stringify(deductionCheck.metadata)).toContain('voce non economica');
  });

  it('I applica le soglie monetarie alla formula tariffa per quantità', () => {
    const result = validatePayrollConsistency(payslip(
      { totalEarnings: 124.95, totalDeductions: 0, netAmount: 124.95 },
      [line({
        code: 'OVERTIME',
        unitValue: 14.88,
        quantity: 8.4,
        quantityUnit: 'hours',
        earningAmount: 124.95,
        calculationRule: 'unit_times_quantity',
      })]
    ));
    expect(check(result, 'LINE_CALCULATION_1')).toMatchObject({
      status: 'warning',
      expectedValue: 124.99,
      actualValue: 124.95,
      difference: 0.04,
    });
  });

  it('J valida la trasferta 22,50 × 17', () => {
    const result = validatePayrollConsistency(payslip(
      { totalEarnings: 382.5, totalDeductions: 0, netAmount: 382.5 },
      [line({
        code: '2310',
        canonicalKey: 'payroll.travel_allowance',
        category: 'travel_allowance',
        unitValue: 22.5,
        quantity: 17,
        quantityUnit: 'days',
        earningAmount: 382.5,
        calculationRule: 'unit_times_quantity',
      })]
    ));
    expect(check(result, 'LINE_CALCULATION_1').status).toBe('passed');
  });

  it('K salta una riga con calcolo esterno', () => {
    const result = validatePayrollConsistency(payslip(
      { totalEarnings: 50, totalDeductions: 0, netAmount: 50 },
      [line({
        earningAmount: 50,
        unitValue: 10,
        quantity: 10,
        quantityUnit: 'units',
        calculationRule: 'external_calculation',
      })]
    ));
    expect(check(result, 'LINE_CALCULATION_1')).toMatchObject({ status: 'skipped' });
  });

  it('L usa insufficient_data con riepilogo valido ma nessuna riga dettagliata', () => {
    const result = validatePayrollConsistency(payslip({
      totalEarnings: 1000,
      totalDeductions: 200,
      netAmount: 800,
    }));
    expect(check(result, 'SUMMARY_EQUATION').status).toBe('passed');
    expect(check(result, 'EARNINGS_LINES_SUM').status).toBe('skipped');
    expect(result.overallStatus).toBe('insufficient_data');
  });

  it('M esclude una riga ambigua dalle somme certificate', () => {
    const result = validatePayrollConsistency(payslip(
      { totalEarnings: 100, totalDeductions: 0, netAmount: 100 },
      [line({ code: 'AMB', earningAmount: 100, classificationAmbiguous: true })]
    ));
    expect(check(result, 'EARNINGS_LINES_SUM').status).toBe('skipped');
    expect(JSON.stringify(check(result, 'EARNINGS_LINES_SUM').metadata)).toContain('classificazione ambigua');
  });

  it('N include un codice sconosciuto quando colonna e importo sono certi abbassando la confidence', () => {
    const result = validatePayrollConsistency(payslip(
      { totalEarnings: 75, totalDeductions: 0, netAmount: 75 },
      [line({
        code: 'AZIENDA-NUOVO',
        canonicalKey: undefined,
        classification: 'unknown',
        category: 'unknown',
        earningAmount: 75,
        sourceColumn: 'earnings',
      })]
    ));
    expect(check(result, 'EARNINGS_LINES_SUM')).toMatchObject({ status: 'passed', expectedValue: 75 });
    expect(check(result, 'EARNINGS_LINES_SUM').confidence).toBeLessThan(95);
  });

  it('gestisce il segno alternativo dell’arrotondamento scegliendo la formula coerente', () => {
    const result = validatePayrollConsistency(
      payslip({ totalEarnings: 100, totalDeductions: 20, netAmount: 79.99 }),
      { rounding: 0.01 }
    );
    expect(check(result, 'SUMMARY_EQUATION')).toMatchObject({ status: 'passed', expectedValue: 79.99 });
    expect(check(result, 'SUMMARY_EQUATION').metadata).toMatchObject({ roundingSign: 'subtract' });
  });
});
