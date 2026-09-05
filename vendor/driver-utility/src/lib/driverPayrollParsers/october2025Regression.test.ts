import { describe, expect, it } from 'vitest';
import { normalizePayslipFiscalData } from '../driverPayrollFiscalNormalizer';
import { validatePayslipFiscalData } from '../driverPayrollFiscalValidation';
import { validatePayrollConsistency } from '../driverPayrollValidation';
import { october2025AnonymizedFixture } from './fixtures/october2025AnonymizedFixture';
import { parsePayslip } from './payslipParserRegistry';

const expectedPayCodes = [
  '0169', '0170', '0779', '0785', '1000', '1052', '1989', '2310', '2700', '2850',
  '6633', '7033', '8128', '8146', '8320', '8420', '8460', '8580', '8582', '9300', '9531',
];

describe('regressione cedolino reale anonimizzato ottobre 2025', () => {
  it('limita le payLines alla tabella e conserva tutte le righe vere', () => {
    const payslip = parsePayslip(october2025AnonymizedFixture());
    const codes = payslip.parsedLines.map((line) => line.code);

    expectedPayCodes.forEach((code) => expect(codes).toContain(code));
    expect(payslip.parsedLines).toHaveLength(expectedPayCodes.length);
    expect(codes).not.toContain('2000');
    expect(payslip.parsedLines.some((line) => /31\/12\/2000/.test(line.rawLine ?? ''))).toBe(false);
    expect(payslip.parsedLines.find((line) => line.code === '1000')).toMatchObject({
      unitValue: 85.68,
      quantity: 22,
      earningAmount: 1885.06,
    });
    expect(payslip.parsedLines.find((line) => line.code === '2310')).toMatchObject({
      unitValue: 20.5,
      quantity: 18,
      earningAmount: 369,
    });
  });

  it('mantiene il riepilogo ufficiale e valida la formula del netto', () => {
    const payslip = parsePayslip(october2025AnonymizedFixture());
    const validation = validatePayrollConsistency(payslip);

    expect(payslip.summary.grossAmount).toBe(2521.7);
    expect(payslip.summary.totalEarnings).toBe(2521.7);
    expect(payslip.summary.totalDeductions).toBe(971.49);
    expect(payslip.summary.netAmount).toBe(1550.21);
    expect(payslip.warnings).not.toContain('Netto non riconosciuto con confidenza sufficiente.');
    expect(validation.overallStatus).not.toBe('insufficient_data');
    expect(validation.checks.find((check) => check.id === 'SUMMARY_EQUATION')?.status).toBe('passed');
  });

  it('classifica 8128, 8146 e 8582 conservandone i valori e riconciliando i totali', () => {
    const structured = october2025AnonymizedFixture();
    const payslip = parsePayslip(structured);
    const fiscal = normalizePayslipFiscalData(structured, payslip);
    const validation = validatePayrollConsistency(payslip, { fiscalData: fiscal });
    const lastDeduction = payslip.parsedLines.find((line) => line.code === '8128');
    const credit = payslip.parsedLines.find((line) => line.code === '8146');
    const regional730 = payslip.parsedLines.find((line) => line.code === '8582');

    expect(lastDeduction).toMatchObject({
      canonicalKey: 'payroll.tax.last_deduction',
      category: 'tax_deduction',
      informationalValue: 84.93,
    });
    expect(lastDeduction?.earningAmount).toBeUndefined();
    expect(lastDeduction?.deductionAmount).toBeUndefined();
    expect(credit).toMatchObject({
      canonicalKey: 'payroll.informational.credit_dl_3_2020',
      category: 'informational',
      informationalValue: 2097.33,
    });
    expect(credit?.earningAmount).toBeUndefined();
    expect(credit?.deductionAmount).toBeUndefined();
    expect(regional730).toMatchObject({
      canonicalKey: 'payroll.tax.adjustment.730.regional',
      category: 'tax_adjustment',
      deductionAmount: 21.5,
    });
    expect(regional730?.canonicalKey).not.toBe(
      payslip.parsedLines.find((line) => line.code === '8320')?.canonicalKey
    );
    expect(validation.checks.find((check) => check.id === 'EARNINGS_LINES_SUM')).toMatchObject({
      status: 'passed',
      expectedValue: 2521.7,
      actualValue: 2521.7,
      difference: 0,
    });
    expect(validation.checks.find((check) => check.id === 'DEDUCTIONS_COMPLETE_RECONCILIATION')).toMatchObject({
      status: 'passed',
      expectedValue: 971.49,
      actualValue: 971.49,
      difference: 0,
    });
    expect(payslip.parsedLines.filter((line) => line.category === 'unknown')).toHaveLength(0);
  });

  it('estrae azienda, livello e centro di costo', () => {
    const payslip = parsePayslip(october2025AnonymizedFixture());

    expect(payslip.companyName).toBe('VECTUM SRL');
    expect(payslip.level).toBe('G1');
    expect(payslip.siteCostCenter).toBe('03');
    expect(payslip.costCenterCode).toBe('03');
    expect(payslip.costCenterDescription).toBe('DL05 - AMAZON');
  });

  it('struttura dati fiscali mensili e progressivi e abilita i controlli di Livello 2', () => {
    const structured = october2025AnonymizedFixture();
    const payslip = parsePayslip(structured);
    const fiscal = normalizePayslipFiscalData(structured, payslip);
    const validation = validatePayslipFiscalData(fiscal, payslip);

    expect(fiscal.socialSecurity.monthlyTaxable?.value).toBe(1894);
    expect(fiscal.socialSecurity.employeeContributions?.value).toBe(179.74);
    expect(fiscal.incomeTax.monthlyTaxable?.value).toBe(1718.14);
    expect(fiscal.incomeTax.taxWithheld?.value).toBe(132.21);
    expect(fiscal.tfr.taxableBase?.value).toBe(1894.38);
    expect(fiscal.tfr.monthlyAccrual?.value).toBe(130.85);
    expect(fiscal.tfr.progressiveAccrual?.value).toBe(1428.28);

    expect(fiscal.annualProgressives.deductionDays?.value).toBe(304);
    expect(fiscal.annualProgressives.deductions?.value).toBe(2554.66);
    expect(fiscal.socialSecurity.progressiveTaxable?.value).toBe(22908);
    expect(fiscal.annualProgressives.employeeContributions?.value).toBe(2173.98);
    expect(fiscal.incomeTax.progressiveTaxable?.value).toBe(20740.48);
    expect(fiscal.annualProgressives.netTax?.value).toBe(2215.66);
    expect(payslip.summary.totalDeductions).toBe(971.49);
    expect(payslip.summary.totalEarnings).toBe(2521.7);

    expect(validation.overallStatus).not.toBe('insufficient_data');
    expect(validation.checks.find((check) => check.id === 'FISCAL_DATA_COMPLETENESS')?.status).not.toBe('skipped');
    expect(validation.checks.find((check) => check.id === 'FISCAL_TAXABLE_BASES_DIFFERENCE')?.status).not.toBe('skipped');
    expect(validation.checks.find((check) => check.id === 'FISCAL_REGIONAL_TAX_LINE')?.status).toBe('passed');
    expect(validation.checks.find((check) => check.id === 'FISCAL_MUNICIPAL_BALANCE_LINE')?.status).toBe('passed');
    expect(validation.checks.find((check) => check.id === 'FISCAL_MUNICIPAL_ADVANCE_LINE')?.status).toBe('passed');
    expect(validation.checks.find((check) => check.id === 'FISCAL_TFR_MONTHLY_PROGRESSIVE')?.status).toBe('passed');
    expect(validation.summary.passed + validation.summary.warnings + validation.summary.failed).toBeGreaterThan(1);
  });
});
