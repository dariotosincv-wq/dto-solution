import { describe, expect, it } from 'vitest';
import type { PayrollFiscalValue, PayslipFiscalData } from './driverPayrollFiscalTypes';
import {
  aggregateHistoricalLines,
  identifyHistoricalPayrollPeriod,
  validatePayrollHistory,
} from './driverPayrollHistoricalValidation';
import type { PayslipImport, PayslipLine } from './driverPayrollTypes';

const fiscalValue = (value: number, period: PayrollFiscalValue['period']): PayrollFiscalValue => ({
  value,
  source: period === 'monthly' ? 'fiscal_section' : 'progressive_section',
  period,
  confidence: 95,
  extractionMethod: 'label_catalog',
});

type FiscalNumbers = {
  socialMonthly?: number;
  socialProgressive?: number;
  incomeMonthly?: number;
  incomeProgressive?: number;
  taxMonthly?: number;
  taxProgressive?: number;
  contributionMonthly?: number;
  contributionProgressive?: number;
  tfrMonthly?: number;
  tfrProgressive?: number;
  tfrRevaluation?: number;
};

const fiscal = (numbers: FiscalNumbers = {}): PayslipFiscalData => ({
  schemaVersion: 'fiscal-v1',
  socialSecurity: {
    monthlyTaxable: numbers.socialMonthly === undefined ? undefined : fiscalValue(numbers.socialMonthly, 'monthly'),
    progressiveTaxable: numbers.socialProgressive === undefined ? undefined : fiscalValue(numbers.socialProgressive, 'progressive'),
    employeeContributions: numbers.contributionMonthly === undefined ? undefined : fiscalValue(numbers.contributionMonthly, 'monthly'),
  },
  incomeTax: {
    monthlyTaxable: numbers.incomeMonthly === undefined ? undefined : fiscalValue(numbers.incomeMonthly, 'monthly'),
    progressiveTaxable: numbers.incomeProgressive === undefined ? undefined : fiscalValue(numbers.incomeProgressive, 'progressive'),
    taxWithheld: numbers.taxMonthly === undefined ? undefined : fiscalValue(numbers.taxMonthly, 'monthly'),
  },
  additionalTaxes: {},
  tfr: {
    monthlyAccrual: numbers.tfrMonthly === undefined ? undefined : fiscalValue(numbers.tfrMonthly, 'monthly'),
    progressiveAccrual: numbers.tfrProgressive === undefined ? undefined : fiscalValue(numbers.tfrProgressive, 'progressive'),
    revaluation: numbers.tfrRevaluation === undefined ? undefined : fiscalValue(numbers.tfrRevaluation, 'monthly'),
  },
  annualProgressives: {
    employeeContributions: numbers.contributionProgressive === undefined
      ? undefined : fiscalValue(numbers.contributionProgressive, 'progressive'),
    netTax: numbers.taxProgressive === undefined ? undefined : fiscalValue(numbers.taxProgressive, 'progressive'),
  },
  unclassifiedValues: [],
  warnings: [],
});

const baseLine = (overrides: Partial<PayslipLine> = {}): PayslipLine => ({
  code: '1000',
  canonicalKey: 'payroll.base_pay',
  label: 'Retribuzione base',
  earningAmount: 1800,
  quantity: 26,
  quantityUnit: 'days',
  unitValue: 69.23,
  ...overrides,
});

const payslip = (
  month: number,
  year: number,
  fiscalNumbers: FiscalNumbers = {},
  overrides: Partial<PayslipImport> = {}
): PayslipImport => ({
  id: overrides.id ?? `p-${year}-${month}-${Math.random()}`,
  driverProfileId: 'driver-1',
  companyName: 'Logistica Uno',
  payrollPeriodLabel: `${month}/${year}`,
  year,
  month,
  importedAt: `${year}-${String(month).padStart(2, '0')}-20T10:00:00.000Z`,
  extractionMethod: 'pdf_text',
  parsedLines: [baseLine()],
  summary: { grossAmount: 2000, totalDeductions: 400, netAmount: 1600 },
  warnings: [],
  fiscalDataVersion: 'fiscal-v1',
  fiscalData: fiscal(fiscalNumbers),
  ...overrides,
});

const findCheck = (result: ReturnType<typeof validatePayrollHistory>, id: string) =>
  result.checks.find((check) => check.id.startsWith(id));

describe('validazione storica multi-mese Livello 3', () => {
  it('A-B: valida il delta previdenziale esatto o entro tolleranza ordinaria', () => {
    const exact = validatePayrollHistory([
      payslip(1, 2026, { socialMonthly: 1000, socialProgressive: 1000 }),
      payslip(2, 2026, { socialMonthly: 1200, socialProgressive: 2200 }),
    ]);
    expect(findCheck(exact, 'HIST_SOCIAL_TAXABLE')?.status).toBe('passed');

    const cents = validatePayrollHistory([
      payslip(1, 2026, { socialMonthly: 1000, socialProgressive: 1000 }),
      payslip(2, 2026, { socialMonthly: 1200, socialProgressive: 2200.01 }),
    ]);
    expect(findCheck(cents, 'HIST_SOCIAL_TAXABLE')?.status).toBe('passed');
  });

  it('C-D-E: distingue warning, errore e progressivo decrescente', () => {
    const warning = validatePayrollHistory([
      payslip(1, 2026, { socialMonthly: 1000, socialProgressive: 1000 }),
      payslip(2, 2026, { socialMonthly: 1200, socialProgressive: 2200.05 }),
    ]);
    expect(findCheck(warning, 'HIST_SOCIAL_TAXABLE')?.status).toBe('warning');

    const failed = validatePayrollHistory([
      payslip(1, 2026, { socialMonthly: 1000, socialProgressive: 1000 }),
      payslip(2, 2026, { socialMonthly: 1200, socialProgressive: 2300 }),
    ]);
    expect(findCheck(failed, 'HIST_SOCIAL_TAXABLE')?.status).toBe('failed');
    expect(failed.overallStatus).toBe('inconsistent');

    const decreasing = validatePayrollHistory([
      payslip(1, 2026, { socialMonthly: 1000, socialProgressive: 2000 }),
      payslip(2, 2026, { socialMonthly: 1200, socialProgressive: 1900 }),
    ]);
    expect(findCheck(decreasing, 'HIST_SOCIAL_TAXABLE')?.status).toBe('failed');
  });

  it('F: considera il cambio anno come reset prudente', () => {
    const result = validatePayrollHistory([
      payslip(12, 2025, { socialMonthly: 1000, socialProgressive: 12000 }),
      payslip(1, 2026, { socialMonthly: 1100, socialProgressive: 1100 }),
    ]);
    expect(findCheck(result, 'HIST_SOCIAL_TAXABLE')?.status).toBe('skipped');
    expect(result.errors).toHaveLength(0);
  });

  it('G-H: valida progressivi fiscali e imposta trattenuta', () => {
    const result = validatePayrollHistory([
      payslip(1, 2026, { incomeMonthly: 900, incomeProgressive: 900, taxMonthly: 150, taxProgressive: 150 }),
      payslip(2, 2026, { incomeMonthly: 1100, incomeProgressive: 2000, taxMonthly: 190, taxProgressive: 340 }),
    ]);
    expect(findCheck(result, 'HIST_INCOME_TAXABLE')?.status).toBe('passed');
    expect(findCheck(result, 'HIST_TAX_WITHHELD')?.status).toBe('passed');
  });

  it('I-J: valida il TFR mensile e include la rivalutazione quando disponibile', () => {
    const normal = validatePayrollHistory([
      payslip(1, 2026, { tfrMonthly: 120, tfrProgressive: 120 }),
      payslip(2, 2026, { tfrMonthly: 130, tfrProgressive: 250 }),
    ]);
    expect(findCheck(normal, 'HIST_TFR')?.status).toBe('passed');

    const revalued = validatePayrollHistory([
      payslip(1, 2026, { tfrMonthly: 120, tfrProgressive: 1000 }),
      payslip(2, 2026, { tfrMonthly: 130, tfrRevaluation: 10, tfrProgressive: 1140 }),
    ]);
    expect(findCheck(revalued, 'HIST_TFR')?.status).toBe('passed');
    expect(findCheck(revalued, 'HIST_TFR')?.expectedDelta).toBe(140);
  });

  it('K-L: segnala un singolo mese mancante ma resta prudente su storico molto parziale', () => {
    const gap = validatePayrollHistory([payslip(1, 2026), payslip(2, 2026), payslip(4, 2026)]);
    expect(findCheck(gap, 'HIST_MISSING')?.status).toBe('warning');
    expect(findCheck(gap, 'HIST_MISSING')?.metadata).toEqual({ missingPeriods: ['2026-03'] });

    const sparse = validatePayrollHistory([payslip(3, 2026), payslip(6, 2026)]);
    expect(findCheck(sparse, 'HIST_MISSING')?.status).toBe('skipped');
  });

  it('M-N: distingue duplicati esatti da cedolini aggiuntivi nello stesso mese', () => {
    const original = payslip(1, 2026, {}, { id: 'ordinary' });
    const duplicate = { ...original, id: 'copy', importedAt: '2026-01-21T10:00:00.000Z' };
    expect(findCheck(validatePayrollHistory([original, duplicate]), 'HIST_DUPLICATE')?.status).toBe('warning');

    const thirteenth = payslip(1, 2026, {}, {
      id: 'thirteenth',
      parsedLines: [{ code: '5340', canonicalKey: 'payroll.thirteenth_month', label: 'Tredicesima', earningAmount: 1800 }],
    });
    const additional = findCheck(validatePayrollHistory([original, thirteenth]), 'HIST_DUPLICATE');
    expect(additional?.status).toBe('passed');
    expect(additional?.metadata?.duplicateKind).toBe('different_document_type');
  });

  it('O-P-Q: esclude periodo ambiguo, cambio azienda e cambio rapporto', () => {
    const ambiguous = payslip(0, 0, { socialMonthly: 100, socialProgressive: 100 }, {
      year: 0,
      month: 0,
      payrollPeriodLabel: undefined,
      summary: {},
    });
    expect(identifyHistoricalPayrollPeriod(ambiguous).ambiguous).toBe(true);
    expect(findCheck(validatePayrollHistory([ambiguous, payslip(2, 2026)]), 'HIST_AMBIGUOUS_PERIODS')?.status).toBe('warning');

    const jan = payslip(1, 2026, { socialMonthly: 100, socialProgressive: 100 });
    const otherCompany = payslip(2, 2026, { socialMonthly: 100, socialProgressive: 200 }, { companyName: 'Altra azienda' });
    expect(findCheck(validatePayrollHistory([jan, otherCompany]), 'HIST_SOCIAL_TAXABLE')?.status).toBe('skipped');

    const otherRelationship = payslip(2, 2026, { socialMonthly: 100, socialProgressive: 200 }, { driverProfileId: 'driver-2' });
    expect(findCheck(validatePayrollHistory([jan, otherRelationship]), 'HIST_SOCIAL_TAXABLE')?.status).toBe('skipped');
  });

  it('R-S-T: controlla voci strutturali e tratta le variabili come informative', () => {
    const stable = validatePayrollHistory([payslip(1, 2026), payslip(2, 2026), payslip(3, 2026)]);
    expect(findCheck(stable, 'HIST_LINE_STRUCTURAL:payroll.base_pay')?.status).toBe('passed');

    const missing = validatePayrollHistory([
      payslip(1, 2026),
      payslip(2, 2026, {}, { parsedLines: [baseLine({ code: '2030', canonicalKey: 'payroll.overtime', label: 'Straordinario', earningAmount: 400 })] }),
      payslip(3, 2026),
    ]);
    expect(findCheck(missing, 'HIST_LINE_STRUCTURAL:payroll.base_pay')?.status).toBe('warning');

    const variable = validatePayrollHistory([
      payslip(1, 2026, {}, { parsedLines: [baseLine(), baseLine({ code: '2030', canonicalKey: 'payroll.overtime', label: 'Straordinario', earningAmount: 20 })] }),
      payslip(2, 2026, {}, { parsedLines: [baseLine(), baseLine({ code: '2030', canonicalKey: 'payroll.overtime', label: 'Straordinario', earningAmount: 900 })] }),
    ]);
    expect(findCheck(variable, 'HIST_LINE_VARIABLE:payroll.overtime')?.status).toBe('passed');
  });

  it('U-V-W: segnala cambi tariffa/unità ed esclude unknown dalle aggregazioni', () => {
    const result = validatePayrollHistory([
      payslip(1, 2026, {}, { parsedLines: [baseLine({ unitValue: 10, quantityUnit: 'hours' }), baseLine({ code: 'X1', canonicalKey: undefined, label: 'Voce sconosciuta' })] }),
      payslip(2, 2026, {}, { parsedLines: [baseLine({ unitValue: 11, quantityUnit: 'days' })] }),
    ]);
    expect(findCheck(result, 'HIST_RATE:payroll.base_pay')?.status).toBe('warning');
    expect(findCheck(result, 'HIST_UNIT:payroll.base_pay')?.status).toBe('warning');
    expect(aggregateHistoricalLines(result.timeline).some((series) => series.canonicalKey === 'unknown')).toBe(false);
  });

  it('X-Y: un cedolino aggiuntivo non altera i progressivi ordinari né i valori ufficiali', () => {
    const jan = payslip(1, 2026, { socialMonthly: 1000, socialProgressive: 1000 });
    const additional = payslip(2, 2026, { socialMonthly: 9999, socialProgressive: 9999 }, {
      id: 'bonus',
      parsedLines: [{ code: '4009', canonicalKey: 'payroll.performance_bonus', label: 'Premio', earningAmount: 500 }],
    });
    const feb = payslip(2, 2026, { socialMonthly: 1200, socialProgressive: 2200 });
    const before = JSON.stringify([jan, additional, feb]);
    const result = validatePayrollHistory([jan, additional, feb]);
    expect(findCheck(result, 'HIST_SOCIAL_TAXABLE')?.status).toBe('passed');
    expect(JSON.stringify([jan, additional, feb])).toBe(before);
    expect(feb.summary).toEqual({ grossAmount: 2000, totalDeductions: 400, netAmount: 1600 });
  });
});
