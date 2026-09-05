import { describe, expect, it } from 'vitest';
import { analyzeDriverPayrollHistory, createDriverPayrollComparisonBase } from './driverPayrollAnalysis';
import type { PayslipImport } from './driverPayrollTypes';

const makePayslip = (overrides: Partial<PayslipImport> = {}): PayslipImport => ({
  id: 'payslip_2026_01',
  year: 2026,
  month: 1,
  importedAt: '2026-02-10T10:00:00.000Z',
  extractionMethod: 'pdf_text',
  parsedLines: [
    { code: '2310', label: 'TRASFERTA', quantity: 10, amount: 225 },
    { code: '2030', label: 'STRAORDINARIO 30%', quantity: 2, amount: 40 },
    { code: '4009', label: 'PDR', amount: 100 },
    { code: '5000', label: 'FERIE', quantity: 1 },
    { code: '5050', label: 'PAR', quantity: 4 },
    { code: '2500', label: 'MALATTIA', quantity: 0 },
    { code: '3900', label: 'FESTIVITA', quantity: 1 },
  ],
  summary: {
    grossAmount: 2200,
    netAmount: 1700,
  },
  warnings: [],
  ...overrides,
});

describe('driverPayrollAnalysis', () => {
  it('calcola statistiche storico e trend usando solo payslip salvate', () => {
    const analysis = analyzeDriverPayrollHistory([
      makePayslip({ id: 'mar', month: 3, summary: { grossAmount: 2600, netAmount: 2000 }, parsedLines: [{ code: '2310', label: 'TRASFERTA', quantity: 18 }, { code: '2030', label: 'STRAORDINARIO', quantity: 8 }] }),
      makePayslip({ id: 'jan', month: 1, summary: { grossAmount: 2200, netAmount: 1700 }, parsedLines: [{ code: '2310', label: 'TRASFERTA', quantity: 10 }, { code: '2030', label: 'STRAORDINARIO', quantity: 2 }] }),
      makePayslip({ id: 'feb', month: 2, summary: { grossAmount: 2400, netAmount: 1800 }, parsedLines: [{ code: '2310', label: 'TRASFERTA', quantity: 12 }, { code: '2030', label: 'STRAORDINARIO', quantity: 4 }] }),
    ]);

    expect(analysis.totalPayslips).toBe(3);
    expect(analysis.periodCovered).toBe('Gennaio 2026 - Marzo 2026');
    expect(analysis.averages.netAmount).toBeCloseTo(1833.33, 2);
    expect(analysis.averages.travelDays).toBeCloseTo(13.33, 2);
    expect(analysis.trends.map((trend) => trend.message)).toContain('Netto medio in aumento');
    expect(analysis.trends.map((trend) => trend.message)).toContain('Trasferte in crescita');
    expect(analysis.trends.map((trend) => trend.message)).toContain('Straordinari in crescita');
  });

  it('lascia undefined i dati non disponibili senza errori', () => {
    const analysis = analyzeDriverPayrollHistory([
      makePayslip({
        parsedLines: [],
        summary: {},
      }),
    ]);

    expect(analysis.averages.netAmount).toBeUndefined();
    expect(analysis.averages.travelDays).toBeUndefined();
    expect(analysis.trends).toEqual([]);
  });

  it('prepara la base riutilizzabile per il confronto previsto reale', () => {
    const base = createDriverPayrollComparisonBase([makePayslip()]);

    expect(base).toEqual([
      {
        year: 2026,
        month: 1,
        predicted: {},
        actual: expect.objectContaining({
          netAmount: 1700,
          grossAmount: 2200,
          travelDays: 10,
          overtimeHours: 2,
          bonusAmount: 100,
          holidayDays: 1,
          vacationDays: 1,
          permitHours: 4,
          sicknessDays: 0,
        }),
        payslipImportId: 'payslip_2026_01',
      },
    ]);
  });

  it('aggrega per canonicalKey anche con un codice aziendale differente', () => {
    const analysis = analyzeDriverPayrollHistory([
      makePayslip({
        parsedLines: [
          {
            code: 'AZ01',
            label: 'INDENNITA TRASFERTA',
            canonicalKey: 'payroll.travel_allowance',
            category: 'travel_allowance',
            quantity: 14,
            earningAmount: 315,
          },
          {
            code: 'AZ02',
            label: 'SOLA MAGGIORAZIONE',
            canonicalKey: 'payroll.overtime_premium',
            category: 'overtime_premium',
            quantity: 3,
            earningAmount: 20,
          },
        ],
      }),
    ]);

    expect(analysis.averages.travelDays).toBe(14);
    expect(analysis.averages.overtimeHours).toBeUndefined();
  });
});
