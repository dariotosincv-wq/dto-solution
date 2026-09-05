import { describe, expect, it } from 'vitest';
import { buildAttendanceEvent, deriveAttendancePayrollStatus } from './driverPayrollAttendance';
import { normalizeDriverContractProfile } from './driverContractProfile';

describe('mapping Turni Driver verso payroll', () => {
  it('interpreta Lavorato in una festività come holiday_worked', () => {
    expect(buildAttendanceEvent('2026-04-06', { status: 'Lavorato' })?.status).toBe('holiday_worked');
  });

  it('mappa Festività non lavorata su holiday_not_worked', () => {
    expect(deriveAttendancePayrollStatus('Festività non lavorata', false, true)).toBe('holiday_not_worked');
  });

  it('mantiene Lavorato in un giorno normale come worked', () => {
    expect(buildAttendanceEvent('2026-04-07', { status: 'Lavorato' })?.status).toBe('worked');
  });

  it('mappa Lavorato sotto 4 ore come lavorato ed esclude la trasferta', () => {
    expect(buildAttendanceEvent('2026-04-07', { status: 'Lavorato < 4 ore' })).toMatchObject({
      status: 'worked', shortWorkedDay: true, eligibleForTravelAllowance: false,
    });
  });

  it('non crea un evento automatico per una festività senza stato', () => {
    expect(buildAttendanceEvent('2026-04-06', { status: '' })).toBeNull();
  });

  it('espone separatamente festività e giorno contrattuale', () => {
    const contractual = normalizeDriverContractProfile({
      contractType: 'part_time', weeklyHours: 32, contractualWeekdays: [2],
    });
    const nonContractual = normalizeDriverContractProfile({
      contractType: 'part_time', weeklyHours: 32, contractualWeekdays: [1],
    });
    expect(buildAttendanceEvent('2026-06-02', { status: 'Lavorato' }, 8, contractual)).toMatchObject({
      isHoliday: true, isContractualDay: true, status: 'holiday_worked',
    });
    expect(buildAttendanceEvent('2026-06-02', { status: 'Lavorato' }, 8, nonContractual)).toMatchObject({
      isHoliday: true, isContractualDay: false, status: 'holiday_worked',
    });
  });

  it('mantiene compatibili gli stati storici', () => {
    expect(deriveAttendancePayrollStatus('Ferie', false, false)).toBe('vacation');
    expect(deriveAttendancePayrollStatus('Malattia', false, false)).toBe('sickness');
    expect(deriveAttendancePayrollStatus('Riposo', false, false)).toBe('rest');
  });
});
