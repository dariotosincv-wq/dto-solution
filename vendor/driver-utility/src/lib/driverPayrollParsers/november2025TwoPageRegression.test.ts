import { describe, expect, it } from 'vitest';
import { normalizePayslipFiscalData } from '../driverPayrollFiscalNormalizer';
import { validatePayrollConsistency } from '../driverPayrollValidation';
import { november2025TwoPageAnonymizedFixture } from './fixtures/november2025TwoPageAnonymizedFixture';
import { parsePayslip } from './payslipParserRegistry';

describe('regressione logisticsLayoutV1 anonimizzata novembre 2025 su due pagine', () => {
  const parse = () => {
    const structured = november2025TwoPageAnonymizedFixture();
    const payslip = parsePayslip(structured);
    const fiscal = normalizePayslipFiscalData(structured, payslip);
    return { payslip, fiscal, level1: validatePayrollConsistency(payslip, { fiscalData: fiscal }) };
  };

  it('continua la tabella sulla seconda pagina senza duplicare le intestazioni', () => {
    const { payslip } = parse();
    expect(payslip.parsedLines.map((line) => line.code)).toEqual(['1000', '1052', '0169']);
    expect(payslip.parsedLines).toHaveLength(3);
    expect(payslip.siteCostCenter).toBe('03');
    expect(payslip.costCenterCode).toBe('03');
    expect(payslip.costCenterDescription).toBe('DL05 - AMAZON');
    expect(payslip.parsedLines.find((line) => line.code === '1052')?.earningAmount).toBe(9.32);
  });

  it('mantiene riepilogo e footer ufficiali sulla seconda pagina', () => {
    const { payslip } = parse();
    expect(payslip.summary).toMatchObject({
      totalEarnings: 1009.32,
      totalDeductions: 150,
      netAmount: 859.32,
      paymentDate: '2025-12-15',
    });
  });

  it('separa INPS, IRPEF ordinaria e IRPEF mensilità supplementare per geometria', () => {
    const { fiscal } = parse();
    expect(fiscal.socialSecurity.monthlyTaxable?.value).toBe(2000);
    expect(fiscal.socialSecurity.employeeContributions?.value).toBe(90);
    expect(fiscal.incomeTax.monthlyTaxable?.value).toBe(1800);
    expect(fiscal.incomeTax.ordinaryMonthlyTaxable?.value).toBe(1800);
    expect(fiscal.incomeTax.taxWithheld?.value).toBe(40);
    expect(fiscal.incomeTax.ordinaryTaxWithheld?.value).toBe(40);
    expect(fiscal.incomeTax.supplementaryMonthlyTaxable?.value).toBe(500);
    expect(fiscal.incomeTax.supplementaryTaxWithheld?.value).toBe(20);
  });

  it('riconcilia INPS e le due componenti IRPEF senza falsi errori', () => {
    const { level1 } = parse();
    expect(level1.checks.find((check) => check.id === 'DEDUCTIONS_COMPLETE_RECONCILIATION')).toMatchObject({
      status: 'passed',
      expectedValue: 150,
      actualValue: 150,
      difference: 0,
    });
  });
});
