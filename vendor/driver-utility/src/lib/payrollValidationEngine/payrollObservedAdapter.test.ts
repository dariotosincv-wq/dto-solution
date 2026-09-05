import { describe, expect, it } from 'vitest';
import { normalizePayslipFiscalData } from '../driverPayrollFiscalNormalizer';
import type {
  PayslipFiscalData,
  PayrollFiscalValue,
} from '../driverPayrollFiscalTypes';
import type { PayslipImport } from '../driverPayrollTypes';
import { january2026SummaryAnonymizedFixture } from '../driverPayrollParsers/fixtures/january2026SummaryAnonymizedFixture';
import { october2025AnonymizedFixture } from '../driverPayrollParsers/fixtures/october2025AnonymizedFixture';
import { september2025AnonymizedFixture } from '../driverPayrollParsers/fixtures/september2025AnonymizedFixture';
import { parsePayslip } from '../driverPayrollParsers/payslipParserRegistry';
import {
  adaptPayrollToObservedSnapshot,
  mapObservedFieldConfidence,
  normalizePayrollValidationConfidence,
} from './payrollObservedAdapter';

const parseWithFiscalData = (
  fixture: ReturnType<typeof october2025AnonymizedFixture>
) => {
  const payslip = parsePayslip(fixture);
  const fiscalData = normalizePayslipFiscalData(fixture, payslip);
  return { payslip, fiscalData };
};

describe('adaptPayrollToObservedSnapshot', () => {
  it('trasferisce fedelmente EUR, PERCENT_POINTS, FRACTION e UNSPECIFIED', () => {
    const fiscalValue = (
      field: string,
      value: number,
      unit: PayrollFiscalValue['unit']
    ): PayrollFiscalValue => ({
      field,
      value,
      unit,
      source: 'fiscal_section',
      period: 'monthly',
      confidence: 90,
      extractionMethod: 'label_catalog',
    });
    const fiscalData: PayslipFiscalData = {
      schemaVersion: 'fiscal-v1',
      period: { year: 2026, month: 1 },
      socialSecurity: {
        monthlyTaxable: fiscalValue('fixture.eur', 100, 'EUR'),
        contributionRate: fiscalValue('fixture.points', 9.19, 'PERCENT_POINTS'),
        employeeContributions: fiscalValue('fixture.fraction', 0.0919, 'FRACTION'),
        totalContributions: fiscalValue('fixture.unspecified', 7, 'UNSPECIFIED'),
      },
      incomeTax: {},
      additionalTaxes: {},
      tfr: {},
      annualProgressives: {},
      unclassifiedValues: [],
      warnings: [],
    };
    const payslip: PayslipImport = {
      id: 'fiscal-units',
      year: 2026,
      month: 1,
      importedAt: '2026-02-01T00:00:00.000Z',
      extractionMethod: 'pdf_text',
      parsedLines: [],
      summary: {},
      warnings: [],
    };

    const values = adaptPayrollToObservedSnapshot(payslip, { fiscalData })
      .fiscalObservations?.values;

    expect(values?.map(({ value, unit }) => ({ value, unit }))).toEqual([
      { value: 100, unit: 'EUR' },
      { value: 9.19, unit: 'PERCENT_POINTS' },
      { value: 0.0919, unit: 'FRACTION' },
      { value: 7, unit: 'UNSPECIFIED' },
    ]);
  });

  it('mantiene UNSPECIFIED per valori legacy privi di unit e non usa euristiche', () => {
    const legacyValue: PayrollFiscalValue = {
      field: 'socialSecurity.contributionRate',
      value: 9.19,
      source: 'fiscal_section',
      period: 'monthly',
      confidence: 90,
      rawText: 'ALIQUOTA 9,19 %',
      extractionMethod: 'label_catalog',
    };
    const fiscalData: PayslipFiscalData = {
      schemaVersion: 'fiscal-v1',
      socialSecurity: { contributionRate: legacyValue },
      incomeTax: {},
      additionalTaxes: {},
      tfr: {},
      annualProgressives: {},
      unclassifiedValues: [],
      warnings: [],
    };
    const payslip: PayslipImport = {
      id: 'legacy-unit',
      year: 2026,
      month: 1,
      importedAt: '2026-02-01T00:00:00.000Z',
      extractionMethod: 'pdf_text',
      parsedLines: [],
      summary: {},
      warnings: [],
    };

    const observation = adaptPayrollToObservedSnapshot(payslip, { fiscalData })
      .fiscalObservations?.values[0];

    expect(observation).toMatchObject({ value: 9.19, unit: 'UNSPECIFIED' });
    expect(legacyValue).not.toHaveProperty('unit');
  });

  it('adatta un cedolino completo senza modificare input, righe o semantica numerica', () => {
    const { payslip, fiscalData } = parseWithFiscalData(october2025AnonymizedFixture());
    const inputBefore = JSON.stringify(payslip);
    const snapshot = adaptPayrollToObservedSnapshot(payslip, { fiscalData });
    const salary = snapshot.lines.find((line) => line.originalCode === '1000');
    const travel = snapshot.lines.find((line) => line.originalCode === '2310');
    const regional730 = snapshot.lines.find((line) => line.originalCode === '8582');

    expect(snapshot.period).toEqual({ year: 2025, month: 10, label: 'OTTOBRE 2025' });
    expect(snapshot.level).toBe('G1');
    expect(snapshot.relationship).toMatchObject({
      companyName: 'VECTUM SRL',
      siteCostCenter: '03',
      costCenterCode: '03',
      costCenterDescription: 'DL05 - AMAZON',
    });
    expect(snapshot.lines).toHaveLength(21);
    expect(salary).toMatchObject({
      canonicalKey: 'payroll.base_pay',
      originalCode: '1000',
      originalDescription: 'RETRIBUZIONE/STIPENDIO',
      economicType: 'earning',
      quantity: 22,
      unitValue: 85.68,
      earningAmount: 1885.06,
    });
    expect(travel).toMatchObject({
      canonicalKey: 'payroll.travel_allowance',
      economicType: 'earning',
      quantity: 18,
      quantityUnit: 'DAYS',
      unitValue: 20.5,
      earningAmount: 369,
    });
    expect(regional730).toMatchObject({
      canonicalKey: 'payroll.tax.adjustment.730.regional',
      economicType: 'deduction',
      deductionAmount: 21.5,
    });
    expect(JSON.stringify(payslip)).toBe(inputBefore);
    expect(
      snapshot.fiscalObservations?.values.every(
        (value) => value.unit === 'UNSPECIFIED'
      )
    ).toBe(true);
  });

  it('preserva riepilogo economico, dati fiscali e TFR di ottobre 2025', () => {
    const fixture = october2025AnonymizedFixture();
    const payslip = parsePayslip(fixture);
    const fiscalData = normalizePayslipFiscalData(fixture, payslip);
    const snapshot = adaptPayrollToObservedSnapshot(payslip, { fiscalData });

    expect(snapshot.economicSummary).toMatchObject({
      totalEarnings: 2521.7,
      grossAmount: 2521.7,
      totalDeductions: 971.49,
      netAmount: 1550.21,
      paymentDate: '2025-11-14',
    });
    expect(snapshot.fiscalSummary).toMatchObject({
      socialSecurityTaxable: 1894,
      employeeSocialContributions: 179.74,
      incomeTaxTaxable: 1718.14,
      incomeTaxWithheld: 132.21,
      tfrUsefulSalary: 1894.38,
      tfrMonthlyAccrual: 130.85,
      tfrProgressiveAccrual: 1428.28,
    });
    const classifiedSourceCount = [
      fiscalData.socialSecurity,
      fiscalData.incomeTax,
      fiscalData.additionalTaxes,
      fiscalData.tfr,
      fiscalData.annualProgressives,
    ].reduce(
      (count, section) =>
        count + Object.values(section).filter((value) => value !== undefined).length,
      0
    );
    expect(snapshot.fiscalObservations?.values).toHaveLength(
      classifiedSourceCount + fiscalData.unclassifiedValues.length
    );
    expect(snapshot.fiscalObservations).toMatchObject({
      schemaVersion: fiscalData.schemaVersion,
      period: fiscalData.period,
      warnings: fiscalData.warnings,
    });
  });

  it('preserva fiscalità, detrazioni e TFR disponibili a settembre 2025', () => {
    const fixture = september2025AnonymizedFixture();
    const payslip = parsePayslip(fixture);
    const fiscalData = normalizePayslipFiscalData(fixture, payslip);
    const snapshot = adaptPayrollToObservedSnapshot(payslip, { fiscalData });

    expect(snapshot.lines).toHaveLength(18);
    expect(snapshot.economicSummary).toMatchObject({
      totalEarnings: 2194.51,
      totalDeductions: 382.44,
      netAmount: 1812.07,
    });
    expect(snapshot.fiscalSummary).toMatchObject({
      socialSecurityTaxable: 1942,
      incomeTaxWithheld: 152.92,
      additionalDeductions: 169.85,
      fiscalDays: 30,
      tfrMonthlyAccrual: 130.61,
      tfrProgressiveAccrual: 1297.43,
      tfrOverallAccrual: 1378.72,
    });
    expect(
      snapshot.fiscalObservations?.values.every(
        (value) => value.unit === 'UNSPECIFIED'
      )
    ).toBe(true);
  });

  it('conserva integralmente valori fiscali classificati e non classificati', () => {
    const monthlyTaxable: PayrollFiscalValue = {
      field: 'socialSecurity.taxable',
      value: 1942,
      source: 'fiscal_section',
      period: 'monthly',
      confidence: 98,
      ambiguous: false,
      rawText: 'IMPONIBILE INPS 1.942,00',
      page: 1,
      section: 'SOCIALI_INPS',
      extractionMethod: 'geometric_column',
      alternatives: ['socialSecurity.progressiveTaxable'],
    };
    const derivedTax: PayrollFiscalValue = {
      field: 'incomeTax.grossTax',
      value: 320.5,
      source: 'derived',
      period: 'adjustment',
      confidence: 65,
      ambiguous: true,
      rawText: 'IMPOSTA LORDA 320,50',
      page: 2,
      section: 'FISCALE',
      extractionMethod: 'derived',
      alternatives: ['incomeTax.netTax'],
    };
    const destination: PayrollFiscalValue<string> = {
      field: 'tfr.destination',
      value: 'FONDO PENSIONE',
      source: 'fiscal_section',
      period: 'annual',
      confidence: 88,
      rawText: 'DESTINAZIONE TFR FONDO PENSIONE',
      page: 2,
      section: 'TFR',
      extractionMethod: 'label_catalog',
    };
    const progressiveTax: PayrollFiscalValue = {
      field: 'incomeTax.progressiveTaxable',
      value: 19022.34,
      source: 'progressive_section',
      period: 'progressive',
      confidence: 96,
      extractionMethod: 'geometric_column',
    };
    const unclassified: PayrollFiscalValue = {
      field: 'fiscal.unclassified.test',
      value: 77.7,
      source: 'unknown',
      period: 'unknown_period',
      confidence: 35,
      ambiguous: true,
      rawText: 'VALORE NON CLASSIFICATO 77,70',
      page: 3,
      section: 'ALTRO',
      extractionMethod: 'unknown',
      alternatives: ['additionalTaxes.other', 'incomeTax.taxAdjustment'],
    };
    const fiscalData: PayslipFiscalData = {
      schemaVersion: 'fiscal-v1',
      period: { month: 9, year: 2025 },
      socialSecurity: { monthlyTaxable },
      incomeTax: { grossTax: derivedTax },
      additionalTaxes: {},
      tfr: { destination },
      annualProgressives: { incomeTaxTaxable: progressiveTax },
      unclassifiedValues: [unclassified],
      warnings: [
        '1 valore fiscale conservato con periodo o significato ambiguo.',
      ],
    };
    const payslip: PayslipImport = {
      id: 'fiscal-observations',
      year: 2025,
      month: 9,
      importedAt: '2025-10-01T10:00:00.000Z',
      extractionMethod: 'pdf_text',
      parsedLines: [],
      summary: {
        inpsTaxable: 1942,
        irpefAmount: 320.5,
      },
      warnings: [],
    };

    const snapshot = adaptPayrollToObservedSnapshot(payslip, { fiscalData });
    const observations = snapshot.fiscalObservations;

    expect(observations).toMatchObject({
      schemaVersion: 'fiscal-v1',
      period: { month: 9, year: 2025 },
      warnings: [
        '1 valore fiscale conservato con periodo o significato ambiguo.',
      ],
    });
    expect(observations?.values).toHaveLength(5);
    expect(observations?.values.map((item) => item.canonicalField)).toEqual([
      'socialSecurity.taxable',
      'incomeTax.grossTax',
      'tfr.destination',
      'incomeTax.progressiveTaxable',
      'fiscal.unclassified.test',
    ]);
    expect(observations?.values[0]).toMatchObject({
      value: 1942,
      unit: 'UNSPECIFIED',
      classificationStatus: 'CLASSIFIED',
      fiscalPeriod: 'monthly',
      source: 'fiscal_section',
      confidence: 98,
      ambiguous: false,
      rawText: 'IMPONIBILE INPS 1.942,00',
      page: 1,
      section: 'SOCIALI_INPS',
      extractionMethod: 'geometric_column',
      alternatives: ['socialSecurity.progressiveTaxable'],
    });
    expect(observations?.values[1]).toMatchObject({
      source: 'derived',
      fiscalPeriod: 'adjustment',
      confidence: 65,
      ambiguous: true,
      extractionMethod: 'derived',
    });
    expect(observations?.values[2]).toMatchObject({
      value: 'FONDO PENSIONE',
      fiscalPeriod: 'annual',
    });
    expect(observations?.values[4]).toMatchObject({
      classificationStatus: 'UNCLASSIFIED',
      source: 'unknown',
      fiscalPeriod: 'unknown_period',
      confidence: 35,
      ambiguous: true,
      alternatives: ['additionalTaxes.other', 'incomeTax.taxAdjustment'],
    });
  });

  it('costruisce la provenienza fiscale dai soli metadata osservati', () => {
    const fiscalValue: PayrollFiscalValue = {
      field: 'incomeTax.taxWithheld',
      value: 152.92,
      source: 'payroll_line',
      period: 'monthly',
      confidence: 82,
      rawText: 'IRPEF 152,92',
      page: 1,
      section: 'VOCI_PAGA',
      extractionMethod: 'payroll_line',
    };
    const fiscalData: PayslipFiscalData = {
      schemaVersion: 'fiscal-v1',
      period: { month: 9, year: 2025 },
      socialSecurity: {},
      incomeTax: { taxWithheld: fiscalValue },
      additionalTaxes: {},
      tfr: {},
      annualProgressives: {},
      unclassifiedValues: [],
      warnings: [],
    };
    const payslip: PayslipImport = {
      id: 'fiscal-provenance',
      year: 2025,
      month: 9,
      importedAt: '2025-10-01T10:00:00.000Z',
      extractionMethod: 'pdf_text',
      parsedLines: [],
      summary: {},
      warnings: [],
    };

    const observation = adaptPayrollToObservedSnapshot(
      payslip,
      { fiscalData }
    ).fiscalObservations?.values[0];

    expect(observation?.provenance).toEqual([
      {
        id: 'payroll-fiscal:fiscal-provenance:0',
        source: 'PAYROLL',
        description: 'Valore fiscale osservato: incomeTax.taxWithheld',
        period: { year: 2025, month: 9, label: undefined },
        confidence: 82,
        technicalReference:
          'field=incomeTax.taxWithheld; source=payroll_line; period=monthly; page=1; section=VOCI_PAGA; method=payroll_line',
      },
    ]);
  });

  it('preserva il riepilogo ufficiale di gennaio 2026 senza inventare righe o dati fiscali', () => {
    const payslip = parsePayslip(january2026SummaryAnonymizedFixture());
    const snapshot = adaptPayrollToObservedSnapshot(payslip);

    expect(snapshot.period).toEqual({ year: 2026, month: 1, label: 'GENNAIO 2026' });
    expect(snapshot.economicSummary).toMatchObject({
      totalEarnings: 2896.57,
      grossAmount: 2896.57,
      totalDeductions: 986.93,
      netAmount: 1909.64,
      paymentDate: '2026-02-13',
    });
    expect(snapshot.lines).toHaveLength(0);
    expect(snapshot.fiscalSummary).toBeUndefined();
    expect(snapshot.fiscalObservations).toBeUndefined();
  });

  it('conserva una riga unknown senza riclassificarla o eliminarla', () => {
    const payslip: PayslipImport = {
      id: 'partial-unknown',
      year: 2026,
      month: 2,
      importedAt: '2026-03-01T10:00:00.000Z',
      extractionMethod: 'pdf_text',
      parsedLines: [
        {
          code: 'ZZ99',
          label: 'VOCE NON CONFIGURATA',
          category: 'unknown',
          quantity: 2,
          quantityUnit: 'units',
          earningAmount: 25,
        },
      ],
      summary: {},
      warnings: [],
    };

    const snapshot = adaptPayrollToObservedSnapshot(payslip);

    expect(snapshot.lines).toHaveLength(1);
    expect(snapshot.lines[0]).toMatchObject({
      canonicalKey: 'unknown',
      originalCode: 'ZZ99',
      originalDescription: 'VOCE NON CONFIGURATA',
      category: 'unknown',
      economicType: undefined,
      quantity: 2,
      quantityUnit: 'QUANTITY',
      earningAmount: 25,
    });
  });

  it('trasferisce fedelmente tutti gli economicType sorgente senza usare category o importi', () => {
    const payslip: PayslipImport = {
      id: 'economic-types',
      year: 2026,
      month: 2,
      importedAt: '2026-03-01T10:00:00.000Z',
      extractionMethod: 'pdf_text',
      parsedLines: [
        { label: 'COMPETENZA', category: 'unknown', economicType: 'earning' },
        { label: 'TRATTENUTA', category: 'base_pay', economicType: 'deduction' },
        { label: 'NEUTRA', category: 'travel_allowance', economicType: 'neutral' },
        { label: 'INFORMATIVA', category: 'tax_deduction', economicType: 'informational' },
        { label: 'SENZA TIPO', category: 'base_pay', earningAmount: 100 },
      ],
      summary: {},
      warnings: [],
    };

    const snapshot = adaptPayrollToObservedSnapshot(payslip);

    expect(snapshot.lines.map((item) => item.economicType)).toEqual([
      'earning',
      'deduction',
      'neutral',
      'informational',
      undefined,
    ]);
    expect(snapshot.lines.map((item) => item.category)).toEqual([
      'unknown',
      'base_pay',
      'travel_allowance',
      'tax_deduction',
      'base_pay',
    ]);
  });

  it('gestisce un risultato parziale senza errori e senza inventare valori zero', () => {
    const payslip: PayslipImport = {
      id: 'partial',
      year: undefined,
      month: undefined,
      importedAt: '2026-03-01T10:00:00.000Z',
      extractionMethod: 'manual',
      parsedLines: [],
      summary: {},
      warnings: [],
    };

    const snapshot = adaptPayrollToObservedSnapshot(payslip);

    expect(snapshot.period.year).toBeUndefined();
    expect(snapshot.period.month).toBeUndefined();
    expect(snapshot.economicSummary).toEqual({
      totalEarnings: undefined,
      totalDeductions: undefined,
      netAmount: undefined,
      grossAmount: undefined,
      rounding: undefined,
      paymentDate: undefined,
      fieldConfidence: {
        totalEarnings: undefined,
        totalDeductions: undefined,
        netAmount: undefined,
      },
    });
    expect(snapshot.confidence).toBe(50);
    expect(snapshot.lines).toEqual([]);
  });

  it('normalizza tutte le confidence nel range ufficiale 0-100', () => {
    expect(normalizePayrollValidationConfidence(-10)).toBe(0);
    expect(normalizePayrollValidationConfidence(42)).toBe(42);
    expect(normalizePayrollValidationConfidence(140)).toBe(100);
    expect(normalizePayrollValidationConfidence(undefined)).toBe(50);

    const payslip: PayslipImport = {
      id: 'confidence',
      year: 2026,
      month: 1,
      importedAt: '2026-02-01T10:00:00.000Z',
      extractionMethod: 'pdf_text',
      confidence: 140,
      parsedLines: [{ label: 'RIGA', confidence: -20 }],
      summary: {},
      warnings: [],
    };
    const snapshot = adaptPayrollToObservedSnapshot(payslip);

    expect(snapshot.confidence).toBe(100);
    expect(snapshot.lines[0].confidence).toBe(0);
    expect(snapshot.provenance[0].confidence).toBe(100);
    expect(snapshot.lines[0].provenance[0].confidence).toBe(0);
  });

  it('trasferisce le confidence qualitative dei totali nel riepilogo osservato', () => {
    const payslip = parsePayslip(october2025AnonymizedFixture());
    const snapshot = adaptPayrollToObservedSnapshot(payslip);

    expect(mapObservedFieldConfidence('confirmed')).toBe(100);
    expect(mapObservedFieldConfidence('probable')).toBe(75);
    expect(mapObservedFieldConfidence('uncertain')).toBe(40);
    expect(mapObservedFieldConfidence('missing')).toBe(0);
    expect(snapshot.economicSummary.fieldConfidence).toEqual({
      totalEarnings: 100,
      totalDeductions: 100,
      netAmount: 100,
    });
  });

  it('produce uno snapshot JSON serializzabile con provenienza ma senza geometria grezza', () => {
    const { payslip, fiscalData } = parseWithFiscalData(october2025AnonymizedFixture());
    const snapshot = adaptPayrollToObservedSnapshot(payslip, { fiscalData });
    const serialized = JSON.stringify(snapshot);
    const restored = JSON.parse(serialized);

    expect(restored.period).toEqual({ year: 2025, month: 10, label: 'OTTOBRE 2025' });
    expect(restored.lines).toHaveLength(21);
    expect(restored.provenance[0].technicalReference).toContain('parser=');
    expect(serialized).not.toContain('sourceGeometry');
    expect(serialized).not.toContain('rawLine');
  });
});
