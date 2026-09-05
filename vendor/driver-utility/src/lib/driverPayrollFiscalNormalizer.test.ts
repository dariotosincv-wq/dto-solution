import { describe, expect, it } from 'vitest';
import { normalizePayslipFiscalData } from './driverPayrollFiscalNormalizer';
import { createStructuredTextFromPlainText } from './driverPayrollParsers/payslipParserHelpers';
import { reconstructPdfLines, type PdfTextItem } from './driverPayrollPdfLayout';
import type { PayslipImport, PayslipLine } from './driverPayrollTypes';

const line = (overrides: Partial<PayslipLine>): PayslipLine => ({
  code: '1000',
  label: 'RETRIBUZIONE',
  earningAmount: 1000,
  sourceColumn: 'earnings',
  confidence: 95,
  ...overrides,
});

const payslip = (lines: PayslipLine[] = []): PayslipImport => ({
  id: 'fiscal-normalizer',
  year: 2026,
  month: 1,
  importedAt: '2026-02-13T00:00:00.000Z',
  extractionMethod: 'pdf_text',
  parsedLines: lines,
  summary: {},
  warnings: [],
});

describe('normalizePayslipFiscalData', () => {
  it('propaga valueKind percentage come PERCENT_POINTS senza convertire il valore', () => {
    const data = normalizePayslipFiscalData(
      createStructuredTextFromPlainText(
        'ALIQUOTA INPS DIPENDENTE MENSILE 9,19 %'
      ),
      payslip()
    );

    expect(data.socialSecurity.contributionRate).toMatchObject({
      field: 'socialSecurity.contributionRate',
      value: 9.19,
      valueKind: 'percentage',
      unit: 'PERCENT_POINTS',
      period: 'monthly',
    });
  });

  it('A/B distingue imponibile previdenziale e fiscale anche quando coincidono', () => {
    const data = normalizePayslipFiscalData(createStructuredTextFromPlainText([
      'IMPONIBILE PREVIDENZIALE MENSILE 2.000,00',
      'IMPONIBILE FISCALE MENSILE 2.000,00',
    ].join('\n')), payslip());

    expect(data.socialSecurity.monthlyTaxable?.value).toBe(2000);
    expect(data.incomeTax.monthlyTaxable?.value).toBe(2000);
    expect(data.socialSecurity.monthlyTaxable?.field).toBe('socialSecurity.taxable');
    expect(data.incomeTax.monthlyTaxable?.field).toBe('incomeTax.taxable');
  });

  it('C separa valori mensili e progressivi', () => {
    const data = normalizePayslipFiscalData(createStructuredTextFromPlainText([
      'IMPONIBILE PREVIDENZIALE MENSILE 2.000,00',
      'IMPONIBILE PREVIDENZIALE PROGRESSIVO 12.000,00',
      'IMPONIBILE FISCALE MENSILE 1.800,00',
      'IMPONIBILE FISCALE PROGRESSIVO 10.800,00',
    ].join('\n')), payslip());

    expect(data.socialSecurity.monthlyTaxable?.value).toBe(2000);
    expect(data.socialSecurity.progressiveTaxable?.value).toBe(12000);
    expect(data.incomeTax.monthlyTaxable?.value).toBe(1800);
    expect(data.incomeTax.progressiveTaxable?.value).toBe(10800);
  });

  it('ricostruisce geometricamente gli imponibili progressivi documentati nel layout reale', () => {
    const item = (text: string, x: number, y: number): PdfTextItem => ({
      text,
      x,
      y,
      page: 1,
      width: Math.max(12, text.length * 4),
      height: 8,
    });
    const items = [
      item('PROGRESSIVI', 20, 260),
      item('IMPONIBILE SOCIALE', 235, 78.93),
      item('IMP.LE FISCALE', 325, 78.93),
      item('IMPOSTA VERSATA', 352.6445, 78.93),
      item('1.994,24', 240, 72.42),
      item('19.022,34', 315, 72.42),
      item('2.083,45', 374.51, 72.42),
    ];
    const reconstructedLines = reconstructPdfLines(items);
    const data = normalizePayslipFiscalData({
      pages: 1,
      items,
      reconstructedLines,
      plainText: reconstructedLines.map((row) => row.text).join('\n'),
    }, payslip());

    expect(data.socialSecurity.progressiveTaxable?.value).toBe(1994.24);
    expect(data.incomeTax.progressiveTaxable?.value).toBe(19022.34);
    expect(data.annualProgressives.netTax?.value).toBe(2083.45);
    expect(data.incomeTax.taxWithheld).toBeUndefined();
    expect(data.socialSecurity.monthlyTaxable).toBeUndefined();
  });

  it('D/E distingue contributi dipendente, azienda ed enti bilaterali', () => {
    const data = normalizePayslipFiscalData(
      createStructuredTextFromPlainText(''),
      payslip([
        line({
          code: '8001',
          canonicalKey: 'payroll.social_contribution.employee',
          earningAmount: undefined,
          deductionAmount: 183.8,
          sourceColumn: 'deductions',
        }),
        line({
          code: '7033',
          canonicalKey: 'payroll.bilateral_body.employer_contribution',
          earningAmount: undefined,
          informationalValue: 8,
          economicType: 'informational',
          sourceColumn: 'informational',
        }),
        line({
          code: '6633',
          canonicalKey: 'payroll.bilateral_body.employee_contribution',
          earningAmount: undefined,
          deductionAmount: 0.5,
          sourceColumn: 'deductions',
        }),
      ])
    );

    expect(data.socialSecurity.employeeContributions?.value).toBe(183.8);
    expect(data.socialSecurity.employerContributions).toBeUndefined();
    expect(data.socialSecurity.bilateralEmployeeContributions?.value).toBe(0.5);
    expect(data.socialSecurity.bilateralEmployerContributions?.value).toBe(8);
    expect(data.socialSecurity.employeeContributions?.unit).toBe('UNSPECIFIED');
  });

  it('K/L/M conserva conguaglio e addizionali in campi distinti', () => {
    const data = normalizePayslipFiscalData(
      createStructuredTextFromPlainText(''),
      payslip([
        line({ code: '8580', canonicalKey: 'payroll.tax.adjustment.730', earningAmount: undefined, deductionAmount: 50 }),
        line({ code: '8320', canonicalKey: 'payroll.tax.regional', earningAmount: undefined, deductionAmount: 30 }),
        line({ code: '8420', canonicalKey: 'payroll.tax.municipal.balance', earningAmount: undefined, deductionAmount: 10 }),
        line({ code: '8460', canonicalKey: 'payroll.tax.municipal.advance', earningAmount: undefined, deductionAmount: 5 }),
      ])
    );

    expect(data.incomeTax.taxAdjustment?.value).toBe(50);
    expect(data.incomeTax.taxAdjustment?.period).toBe('adjustment');
    expect(data.additionalTaxes.regionalBalance?.value).toBe(30);
    expect(data.additionalTaxes.municipalBalance?.value).toBe(10);
    expect(data.additionalTaxes.municipalAdvance?.value).toBe(5);
  });

  it('P distingue TFR mensile e progressivo', () => {
    const data = normalizePayslipFiscalData(createStructuredTextFromPlainText([
      'QUOTA TFR MESE 130,61',
      'TFR PROGRESSIVO 1.306,10',
    ].join('\n')), payslip());
    expect(data.tfr.monthlyAccrual?.value).toBe(130.61);
    expect(data.tfr.progressiveAccrual?.value).toBe(1306.1);
  });

  it('Q conserva conflitti sullo stesso campo come ambigui', () => {
    const data = normalizePayslipFiscalData(createStructuredTextFromPlainText([
      'IMPOSTA NETTA MENSILE 280,00',
      'IMPOSTA NETTA MENSILE 281,00',
    ].join('\n')), payslip());
    expect(data.incomeTax.netTax?.value).toBe(280);
    expect(data.incomeTax.netTax?.ambiguous).toBe(true);
    expect(data.incomeTax.netTax?.alternatives).toContain('incomeTax.netTax:281');
  });

  it('R non trasforma i dati mancanti in zero e conserva periodi non dimostrati', () => {
    const data = normalizePayslipFiscalData(
      createStructuredTextFromPlainText('IMPONIBILE FISCALE 2.000,00'),
      payslip()
    );
    expect(data.incomeTax.monthlyTaxable).toBeUndefined();
    expect(data.incomeTax.progressiveTaxable).toBeUndefined();
    expect(data.unclassifiedValues[0]).toMatchObject({
      value: 2000,
      period: 'unknown_period',
      field: 'incomeTax.taxable',
    });
    expect(data.socialSecurity.monthlyTaxable).toBeUndefined();
  });
});
