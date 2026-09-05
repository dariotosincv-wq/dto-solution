import { describe, expect, it } from 'vitest';
import {
  compareDriverPayrollMonth,
  createDriverPayrollComparisonBaseFromLocalData,
  extractDriverPayrollPredictedValues,
} from './driverPayrollComparison';
import type { PayrollPrediction, PayslipImport } from './driverPayrollTypes';

const makePayslip = (overrides: Partial<PayslipImport> = {}): PayslipImport => ({
  id: 'payslip_2026_01',
  year: 2026,
  month: 1,
  importedAt: '2026-02-10T10:00:00.000Z',
  extractionMethod: 'pdf_text',
  parsedLines: [
    { code: '2310', label: 'TRASFERTA', quantity: 17 },
    { code: '2030', label: 'STRAORDINARIO', quantity: 3 },
    { code: '4009', label: 'PDR', amount: 100 },
    { code: '3900', label: 'FESTIVITA', quantity: 1 },
    { code: '5000', label: 'FERIE', quantity: 1 },
    { code: '5050', label: 'PAR', quantity: 4 },
    { code: '2500', label: 'MALATTIA', quantity: 0 },
  ],
  summary: {
    grossAmount: 2300,
    netAmount: 1800,
  },
  warnings: [],
  ...overrides,
});

const makePrediction = (overrides: Partial<PayrollPrediction> = {}): PayrollPrediction => ({
  id: 'prediction_2026_01',
  year: 2026,
  month: 1,
  createdAt: '2026-02-01T10:00:00.000Z',
  inputSnapshot: {
    year: 2026,
    month: 1,
    attendanceEvents: [],
    workedDays: 22,
    eligibleTravelDays: 17,
    sundaysWorked: 0,
    holidaysWorked: 1,
    vacationDays: 1,
    parHours: 4,
    sicknessDays: 0,
    injuryDays: 0,
    strikeHours: 0,
    abortDays: 0,
    ordinaryHours: 168,
    effectiveHours: 171,
    theoreticalHours: 168,
    overtime30Hours: 3,
    overtime50Hours: 0,
  },
  predictedLines: [{ code: '4009', label: 'PDR', amount: 100 }],
  predictedSummary: {
    grossAmount: 2300,
    netAmount: 1800,
  },
  assumptions: [],
  missingData: [],
  ...overrides,
});

describe('driverPayrollComparison', () => {
  it('estrae i valori previsti dalle prediction locali', () => {
    expect(extractDriverPayrollPredictedValues(makePrediction())).toEqual({
      travelDays: 17,
      overtimeHours: 3,
      bonusAmount: 100,
      holidayDays: 1,
      vacationDays: 1,
      permitHours: 4,
      sicknessDays: 0,
    });
  });

  it('fonde busta reale e previsione nello stesso mese', () => {
    const base = createDriverPayrollComparisonBaseFromLocalData([makePayslip()], [makePrediction()]);

    expect(base).toHaveLength(1);
    expect(base[0]).toEqual(
      expect.objectContaining({
        year: 2026,
        month: 1,
        payslipImportId: 'payslip_2026_01',
        predictionId: 'prediction_2026_01',
        actual: expect.objectContaining({ netAmount: 1800, travelDays: 17 }),
        predicted: expect.objectContaining({ travelDays: 17 }),
      })
    );
    expect(base[0].predicted).not.toHaveProperty('grossAmount');
    expect(base[0].predicted).not.toHaveProperty('netAmount');
  });

  it('classifica match, differenze piccole e differenze importanti', () => {
    const result = compareDriverPayrollMonth(
      {
        year: 2026,
        month: 1,
        predicted: { netAmount: 1800, grossAmount: 2300, travelDays: 10 },
        actual: { netAmount: 1800, grossAmount: 2320, travelDays: 17 },
      },
      {
        grossAmount: { small: 25, large: 50 },
        travelDays: { small: 1, large: 2 },
      }
    );

    expect(result.rows.some((row) => row.key === 'netAmount')).toBe(false);
    expect(result.rows.some((row) => row.key === 'grossAmount')).toBe(false);
    const travelRow = result.rows.find((row) => row.key === 'travelDays');
    expect(travelRow?.severity).toBe('large');
    expect(travelRow?.explanationSeeds[0]).toEqual(
      expect.objectContaining({
        label: 'Trasferta diversa',
        ruleCategory: 'allowance',
        ccnlRuleCandidateIds: [],
      })
    );
  });
});
