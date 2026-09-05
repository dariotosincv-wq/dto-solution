import { describe, expect, it } from 'vitest';
import { normalizePayslipFiscalData } from './driverPayrollFiscalNormalizer';
import type { PayslipFiscalData, PayrollFiscalValue } from './driverPayrollFiscalTypes';
import { validatePayslipFiscalData } from './driverPayrollFiscalValidation';
import { createStructuredTextFromPlainText } from './driverPayrollParsers/payslipParserHelpers';
import type { PayslipImport, PayslipLine } from './driverPayrollTypes';

const fiscalValue = (
  value: number,
  field: string,
  overrides: Partial<PayrollFiscalValue> = {}
): PayrollFiscalValue => ({
  field,
  value,
  source: 'fiscal_section',
  period: 'monthly',
  confidence: 95,
  extractionMethod: 'label_catalog',
  ...overrides,
});

const line = (overrides: Partial<PayslipLine>): PayslipLine => ({
  code: '1000',
  label: 'RETRIBUZIONE',
  canonicalKey: 'payroll.base_pay',
  category: 'base_pay',
  economicType: 'earning',
  earningAmount: 1000,
  sourceColumn: 'earnings',
  confidence: 95,
  classificationConfidence: 95,
  ...overrides,
});

const payslip = (lines: PayslipLine[] = []): PayslipImport => ({
  id: 'fiscal-validation',
  year: 2026,
  month: 1,
  importedAt: '2026-02-13T00:00:00.000Z',
  extractionMethod: 'pdf_text',
  parsedLines: lines,
  summary: { totalEarnings: 1000, totalDeductions: 200, netAmount: 800 },
  warnings: [],
});

const emptyData = (): PayslipFiscalData => ({
  schemaVersion: 'fiscal-v1',
  period: { month: 1, year: 2026 },
  socialSecurity: {},
  incomeTax: {},
  additionalTaxes: {},
  tfr: {},
  annualProgressives: {},
  unclassifiedValues: [],
  warnings: [],
});

const getCheck = (result: ReturnType<typeof validatePayslipFiscalData>, id: string) => {
  const found = result.checks.find((check) => check.id === id);
  expect(found).toBeDefined();
  return found!;
};

describe('validatePayslipFiscalData', () => {
  it('F valida imponibile 2.000 × aliquota esposta 9,19% = 183,80', () => {
    const data = emptyData();
    data.socialSecurity.monthlyTaxable = fiscalValue(2000, 'socialSecurity.taxable');
    data.socialSecurity.contributionRate = fiscalValue(9.19, 'socialSecurity.contributionRate');
    data.socialSecurity.employeeContributions = fiscalValue(183.8, 'socialSecurity.employeeContributions');
    expect(getCheck(validatePayslipFiscalData(data, payslip()), 'FISCAL_SOCIAL_RATE')).toMatchObject({
      status: 'passed',
      expectedValue: 183.8,
      actualValue: 183.8,
    });
  });

  it('G salta il controllo quando l’aliquota non è disponibile', () => {
    const data = emptyData();
    data.socialSecurity.monthlyTaxable = fiscalValue(2000, 'socialSecurity.taxable');
    data.socialSecurity.employeeContributions = fiscalValue(183.8, 'socialSecurity.employeeContributions');
    expect(getCheck(validatePayslipFiscalData(data, payslip()), 'FISCAL_SOCIAL_RATE').status).toBe('skipped');
  });

  it('H salta il calcolo lineare con più aliquote o aliquota ambigua', () => {
    const data = emptyData();
    data.socialSecurity.monthlyTaxable = fiscalValue(2000, 'socialSecurity.taxable');
    data.socialSecurity.contributionRate = fiscalValue(9.19, 'socialSecurity.contributionRate', { ambiguous: true });
    data.socialSecurity.employeeContributions = fiscalValue(183.8, 'socialSecurity.employeeContributions');
    const check = getCheck(validatePayslipFiscalData(data, payslip()), 'FISCAL_SOCIAL_RATE');
    expect(check.status).toBe('skipped');
    expect(check.explanation).toContain('aliquote');
  });

  it('I valida imposta lorda meno detrazioni uguale imposta netta', () => {
    const data = emptyData();
    data.incomeTax.grossTax = fiscalValue(400, 'incomeTax.grossTax');
    data.incomeTax.workDeductions = fiscalValue(120, 'incomeTax.workDeductions');
    data.incomeTax.netTax = fiscalValue(280, 'incomeTax.netTax');
    expect(getCheck(validatePayslipFiscalData(data, payslip()), 'FISCAL_INCOME_TAX_EQUATION')).toMatchObject({
      status: 'passed',
      expectedValue: 280,
      actualValue: 280,
    });
  });

  it('J conserva il credito fiscale separato e non lo somma alle detrazioni', () => {
    const data = emptyData();
    data.incomeTax.grossTax = fiscalValue(400, 'incomeTax.grossTax');
    data.incomeTax.workDeductions = fiscalValue(120, 'incomeTax.workDeductions');
    data.incomeTax.taxCredits = fiscalValue(100, 'incomeTax.taxCredits');
    data.incomeTax.netTax = fiscalValue(280, 'incomeTax.netTax');
    const check = getCheck(validatePayslipFiscalData(data, payslip()), 'FISCAL_INCOME_TAX_EQUATION');
    expect(check.status).toBe('passed');
    expect(check.metadata).toMatchObject({ taxCreditsExcluded: { value: 100 } });
  });

  it('K mantiene il conguaglio distinto e salta la formula se il segno non è certificato', () => {
    const data = emptyData();
    data.incomeTax.grossTax = fiscalValue(400, 'incomeTax.grossTax');
    data.incomeTax.workDeductions = fiscalValue(120, 'incomeTax.workDeductions');
    data.incomeTax.netTax = fiscalValue(280, 'incomeTax.netTax');
    data.incomeTax.taxAdjustment = fiscalValue(30, 'incomeTax.taxAdjustment', { period: 'adjustment' });
    const check = getCheck(validatePayslipFiscalData(data, payslip()), 'FISCAL_INCOME_TAX_EQUATION');
    expect(check.status).toBe('skipped');
    expect(check.explanation).toContain('conguaglio');
  });

  it('N non fallisce una riconciliazione incompleta con trattamento unknown', () => {
    const data = emptyData();
    data.incomeTax.monthlyTaxable = fiscalValue(1100, 'incomeTax.taxable');
    const result = validatePayslipFiscalData(data, payslip([
      line({ earningAmount: 1000 }),
      line({
        code: 'AZIENDA',
        label: 'VOCE AZIENDALE NON CLASSIFICATA',
        canonicalKey: 'payroll.unknown',
        category: 'unknown',
        earningAmount: 100,
      }),
    ]));
    expect(getCheck(result, 'FISCAL_TAXABLE_RECONCILIATION').status).toBe('warning');
  });

  it('O esclude un rimborso solo quando il catalogo lo dichiara esente', () => {
    const data = emptyData();
    data.incomeTax.monthlyTaxable = fiscalValue(1000, 'incomeTax.taxable');
    const result = validatePayslipFiscalData(data, payslip([
      line({ earningAmount: 1000 }),
      line({
        code: '4301',
        label: 'RIMBORSO SPESE',
        canonicalKey: 'payroll.expense_reimbursement',
        category: 'expense_reimbursement',
        earningAmount: 50,
      }),
    ]));
    const check = getCheck(result, 'FISCAL_TAXABLE_RECONCILIATION');
    expect(check.status).toBe('passed');
    expect(JSON.stringify(check.metadata)).toContain('trattamento esplicitamente esente');
  });

  it('P controlla prudentemente TFR mensile e progressivo senza formula normativa', () => {
    const data = emptyData();
    data.tfr.monthlyAccrual = fiscalValue(130.61, 'tfr.monthlyAccrual');
    data.tfr.progressiveAccrual = fiscalValue(1306.1, 'tfr.progressiveAccrual', { period: 'progressive' });
    const result = validatePayslipFiscalData(data, payslip());
    expect(getCheck(result, 'FISCAL_TFR_MONTHLY_PROGRESSIVE').status).toBe('passed');
    expect(getCheck(result, 'FISCAL_TFR_THEORETICAL_FORMULA').status).toBe('skipped');
  });

  it('Q non usa un valore fiscale ambiguo nei controlli certificati', () => {
    const data = emptyData();
    data.socialSecurity.monthlyTaxable = fiscalValue(2000, 'socialSecurity.taxable');
    data.socialSecurity.contributionRate = fiscalValue(9.19, 'socialSecurity.contributionRate', { ambiguous: true });
    data.socialSecurity.employeeContributions = fiscalValue(183.8, 'socialSecurity.employeeContributions');
    expect(getCheck(validatePayslipFiscalData(data, payslip()), 'FISCAL_SOCIAL_RATE').status).toBe('skipped');
  });

  it('S non modifica dati fiscali, righe, riepilogo o netto', () => {
    const inputPayslip = payslip([line({ earningAmount: 1000 })]);
    const data = normalizePayslipFiscalData(
      createStructuredTextFromPlainText('IMPONIBILE FISCALE MENSILE 1.000,00'),
      inputPayslip
    );
    const beforePayslip = structuredClone(inputPayslip);
    const beforeData = structuredClone(data);
    validatePayslipFiscalData(data, inputPayslip);
    expect(inputPayslip).toEqual(beforePayslip);
    expect(data).toEqual(beforeData);
  });
});
