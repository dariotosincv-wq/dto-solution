import { describe, expect, it } from 'vitest';
import {
  createDriverPayrollSimulation,
  readDriverAttendanceFromLocalStorage,
  readDriverContractProfileFromLocalStorage,
} from './driverPayrollSimulator';

const simulate = (attendance: Record<string, { status: string; notes?: string }>, extra = {}) =>
  createDriverPayrollSimulation({
    year: 2026,
    month: 1,
    attendance,
    ...extra,
  });

describe('driverPayrollSimulator', () => {
  it('calcola un mese con soli giorni lavorati', () => {
    const result = simulate({
      '2026-02-02': { status: 'Lavorato' },
      '2026-02-03': { status: 'Lavorato' },
    });

    expect(result.eventSummary.workedDays).toBe(2);
    expect(result.estimate.summary.eligibleTravelDays).toBe(2);
    expect(result.estimate.summary.grossAmount).toBe(45);
  });

  it('gestisce ferie retribuite senza trasferta', () => {
    const result = simulate({ '2026-02-02': { status: 'Ferie' } });

    expect(result.eventSummary.vacationDays).toBe(1);
    expect(result.estimate.summary.eligibleTravelDays).toBe(0);
    expect(result.estimate.predictedLines.some((line) => line.code === '5000')).toBe(true);
  });

  it('gestisce permessi senza trasferta', () => {
    const result = simulate({ '2026-02-02': { status: 'Permesso' } });

    expect(result.eventSummary.permitHours).toBe(8);
    expect(result.eventSummary.permitDays).toBe(1);
    expect(result.estimate.summary.eligibleTravelDays).toBe(0);
    expect(result.estimate.predictedLines.some((line) => line.code === '5050')).toBe(true);
  });

  it('mantiene separati i componenti noti nel riepilogo mensile', () => {
    const attendance = Object.fromEntries([
      '01', '02', '03', '06', '07', '08', '09', '10', '13', '14', '15',
      '16', '17', '20', '21', '22', '23', '24', '27', '28', '29',
    ].map((day) => [`2026-07-${day}`, { status: 'Lavorato' }]));
    attendance['2026-07-30'] = { status: 'Permesso' };

    const result = createDriverPayrollSimulation({ year: 2026, month: 6, attendance });
    const travel = result.estimate.predictedLines.find((line) => line.code === '2310');

    expect(result.eventSummary).toEqual(expect.objectContaining({ workedDays: 21, permitDays: 1, permitHours: 8 }));
    expect(travel).toEqual(expect.objectContaining({ quantity: 21, unitValue: 22.5, amount: 472.5 }));
  });

  it('gestisce malattia con previsione parziale', () => {
    const result = simulate({ '2026-02-02': { status: 'Malattia' } });

    expect(result.eventSummary.sicknessDays).toBe(1);
    expect(result.estimate.warnings.join(' ')).toContain('Malattia');
    expect(result.estimate.confidenceScore).toBeLessThan(85);
  });

  it('gestisce abort senza trasferta', () => {
    const result = simulate({ '2026-02-02': { status: 'Rotta abortita' } });

    expect(result.eventSummary.abortDays).toBe(1);
    expect(result.estimate.summary.eligibleTravelDays).toBe(0);
    expect(result.estimate.predictedLines.some((line) => line.linkedRuleId === 'rule_abort_paid_no_allowances')).toBe(true);
  });

  it('gestisce domeniche lavorate con maggiorazione disponibile', () => {
    const result = simulate({ '2026-02-01': { status: 'Lavorato' } });

    expect(result.eventSummary.sundaysWorked).toBe(1);
    expect(result.estimate.predictedLines.some((line) => line.code === '2315')).toBe(true);
  });

  it('applica una voce manuale positiva', () => {
    const result = simulate(
      {},
      {
        manualLines: [
          { id: 'bonus', kind: 'manual_bonus', description: 'Bonus manuale', amount: 100, type: 'earning' },
        ],
      }
    );

    expect(result.estimate.summary.manualEarnings).toBe(100);
    expect(result.estimate.summary.netAmount).toBe(100);
  });

  it('applica una voce manuale negativa', () => {
    const result = simulate(
      {},
      {
        manualLines: [
          { id: 'deduction', kind: 'manual_deduction', description: 'Trattenuta manuale', amount: 40, type: 'deduction' },
        ],
      }
    );

    expect(result.estimate.summary.manualDeductions).toBe(40);
    expect(result.estimate.summary.netAmount).toBe(-40);
  });

  it('non usa Cloud o Supabase e riusa le regole locali', () => {
    const result = simulate({});

    expect(result.rulesSnapshot.payrollRules).toBeGreaterThan(0);
    expect(result.rulesSnapshot.ccnlExplanationRules).toBeGreaterThan(0);
    expect(JSON.stringify(result).toLowerCase()).not.toContain('supabase');
    expect(JSON.stringify(result).toLowerCase()).not.toContain('cloud');
  });

  it('continua a leggere i vecchi dati attendance senza migrazione', () => {
    localStorage.setItem('attendance', JSON.stringify({
      '2026-02-02': { status: 'Lavorato' },
      '2026-02-03': { status: 'Ferie', notes: 'dato storico' },
    }));
    expect(readDriverAttendanceFromLocalStorage()).toEqual({
      '2026-02-02': { status: 'Lavorato' },
      '2026-02-03': { status: 'Ferie', notes: 'dato storico' },
    });
  });

  it('carica il profilo contrattuale salvato separatamente', () => {
    localStorage.setItem('driverContractProfile', JSON.stringify({
      contractType: 'part_time', weeklyHours: 32, contractualWeekdays: [1, 2, 4, 5],
    }));
    expect(readDriverContractProfileFromLocalStorage()).toEqual({
      contractType: 'part_time', weeklyHours: 32, contractualWeekdays: [1, 2, 4, 5],
    });
  });
});
