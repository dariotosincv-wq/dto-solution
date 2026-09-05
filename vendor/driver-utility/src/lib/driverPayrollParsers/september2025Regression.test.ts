import { describe, expect, it } from 'vitest';
import { normalizePayslipFiscalData } from '../driverPayrollFiscalNormalizer';
import { validatePayslipFiscalData } from '../driverPayrollFiscalValidation';
import { validatePayrollConsistency } from '../driverPayrollValidation';
import { september2025AnonymizedFixture } from './fixtures/september2025AnonymizedFixture';
import { parsePayslip } from './payslipParserRegistry';

const parsedSeptember = () => {
  const structured = september2025AnonymizedFixture();
  const payslip = parsePayslip(structured);
  const fiscal = normalizePayslipFiscalData(structured, payslip);
  return {
    structured,
    payslip,
    fiscal,
    level1: validatePayrollConsistency(payslip, { fiscalData: fiscal }),
    level2: validatePayslipFiscalData(fiscal, payslip),
  };
};

describe('regressione cedolino reale anonimizzato settembre 2025', () => {
  it('conserva le 18 payLines delimitate ed estrae i metadati geometrici', () => {
    const { payslip } = parsedSeptember();

    expect(payslip.parsedLines).toHaveLength(18);
    expect(payslip.parsedLines.map((line) => line.code)).not.toContain('2000');
    expect(payslip.companyName).toBe('VECTUM SRL');
    expect(payslip.level).toBe('G1');
    expect(payslip.siteCode).toBe('03');
    expect(payslip.costCenterCode).toBe('03');
    expect(payslip.costCenterDescription).toBe('DL05 - AMAZON');
    expect(payslip.activityCode).toBe('5500');
    expect(payslip.siteCostCenter).toBe('03');
    expect(payslip.parsedLines.find((line) => line.code === '1052')).toMatchObject({
      interpretationMethod: 'logisticsLayoutV1_geometric_columns',
      sourceColumn: 'earnings',
      geometricEconomicCertified: true,
      sourcePage: 1,
      sourceRowY: 510,
    });
    ['8320', '8420', '8460', '9300'].forEach((code) => {
      expect(payslip.parsedLines.find((line) => line.code === code)).toMatchObject({
        sourceColumn: 'deductions',
        geometricEconomicCertified: true,
      });
    });
  });

  it('mantiene i totali ufficiali e include EDR nella somma competenze', () => {
    const { payslip, level1 } = parsedSeptember();
    const earnings = level1.checks.find((check) => check.id === 'EARNINGS_LINES_SUM');

    expect(payslip.summary.totalEarnings).toBe(2194.51);
    expect(payslip.summary.grossAmount).toBe(2194.51);
    expect(payslip.summary.totalDeductions).toBe(382.44);
    expect(payslip.summary.netAmount).toBe(1812.07);
    expect(level1.checks.find((check) => check.id === 'SUMMARY_EQUATION')?.status).toBe('passed');
    expect(payslip.parsedLines.find((line) => line.code === '1052')?.earningAmount).toBe(9.32);
    expect(earnings).toMatchObject({ status: 'passed', expectedValue: 2194.51, actualValue: 2194.51, difference: 0 });
  });

  it('classifica 8128 e 8146 come valori informativi senza alterare le somme', () => {
    const { payslip, level1 } = parsedSeptember();
    const lastDeduction = payslip.parsedLines.find((line) => line.code === '8128');
    const credit = payslip.parsedLines.find((line) => line.code === '8146');

    expect(lastDeduction).toMatchObject({
      canonicalKey: 'payroll.tax.last_deduction',
      category: 'tax_deduction',
      informationalValue: 169.85,
    });
    expect(credit).toMatchObject({
      canonicalKey: 'payroll.informational.credit_dl_3_2020',
      category: 'informational',
      informationalValue: 1927.48,
    });
    [lastDeduction, credit].forEach((line) => {
      expect(line?.earningAmount).toBeUndefined();
      expect(line?.deductionAmount).toBeUndefined();
      expect(line?.category).not.toBe('unknown');
    });
    expect(level1.checks.find((check) => check.id === 'EARNINGS_LINES_SUM')?.status).toBe('passed');
  });

  it('struttura blocchi mensili INPS, IRPEF, detrazioni e TFR senza confondere i progressivi', () => {
    const { fiscal } = parsedSeptember();

    expect(fiscal.socialSecurity.monthlyTaxable?.value).toBe(1942);
    expect(fiscal.socialSecurity.employeeContributions?.value).toBe(184.3);
    expect(fiscal.incomeTax.monthlyTaxable?.value).toBe(1760.71);
    expect(fiscal.incomeTax.taxWithheld?.value).toBe(152.92);
    expect(fiscal.incomeTax.additionalDeductions?.value).toBe(169.85);
    expect(fiscal.incomeTax.deductionDays?.value).toBe(30);
    expect(fiscal.tfr.taxableBase?.value).toBe(1894.38);
    expect(fiscal.tfr.monthlyAccrual?.value).toBe(130.61);
    expect(fiscal.tfr.progressiveAccrual?.value).toBe(1297.43);
    expect(fiscal.unclassifiedValues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        field: 'tfr.accrualFrom2001',
        value: 1378.72,
        extractionMethod: 'geometric_column',
      }),
    ]));
  });

  it('mappa i progressivi annuali senza valori divergenti tra campi equivalenti', () => {
    const { fiscal } = parsedSeptember();

    expect(fiscal.annualProgressives.deductionDays?.value).toBe(273);
    expect(fiscal.annualProgressives.deductions?.value).toBe(2291.7);
    expect(fiscal.socialSecurity.progressiveTaxable?.value).toBe(21014);
    expect(fiscal.annualProgressives.socialSecurityTaxable?.value).toBe(21014);
    expect(fiscal.annualProgressives.employeeContributions?.value).toBe(1994.24);
    expect(fiscal.incomeTax.progressiveTaxable?.value).toBe(19022.34);
    expect(fiscal.annualProgressives.incomeTaxTaxable?.value).toBe(19022.34);
    expect(fiscal.annualProgressives.netTax?.value).toBe(2083.45);
  });

  it('riconcilia tutte le trattenute senza doppio conteggio ed esegue i controlli possibili', () => {
    const { level1, level2 } = parsedSeptember();
    const deductions = level1.checks.find((check) => check.id === 'DEDUCTIONS_COMPLETE_RECONCILIATION');

    expect(deductions).toMatchObject({
      status: 'passed',
      expectedValue: 382.44,
      actualValue: 382.44,
      difference: 0,
    });
    expect((deductions?.metadata?.components as unknown[])).toHaveLength(7);
    expect(level1.overallStatus).not.toBe('insufficient_data');
    expect(level2.overallStatus).not.toBe('insufficient_data');
    expect(level2.checks.find((check) => check.id === 'FISCAL_TAXABLE_BASES_DIFFERENCE')?.status).not.toBe('skipped');
    expect(level2.checks.find((check) => check.id === 'FISCAL_TFR_MONTHLY_PROGRESSIVE')?.status).toBe('passed');
  });
});
