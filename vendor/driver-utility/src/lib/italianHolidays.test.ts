import { describe, expect, it } from 'vitest';
import { getIsoWeekday, isContractualWeekday, normalizeDriverContractProfile } from './driverContractProfile';
import { formatLocalIsoDate, getItalianHoliday, getItalianHolidays, isItalianHoliday } from './italianHolidays';

const fixedHolidays = [
  ['01-01', 'Capodanno'],
  ['01-06', 'Epifania'],
  ['04-25', 'Festa della Liberazione'],
  ['05-01', 'Festa dei Lavoratori'],
  ['06-02', 'Festa della Repubblica'],
  ['08-15', 'Ferragosto'],
  ['11-01', 'Tutti i Santi'],
  ['12-08', 'Immacolata Concezione'],
  ['12-25', 'Natale'],
  ['12-26', 'Santo Stefano'],
] as const;

describe('festività italiane', () => {
  it.each([2024, 2025, 2026, 2028])('riconosce tutte le festività fisse nel %i', (year) => {
    for (const [date, name] of fixedHolidays) {
      const parsed = new Date(`${year}-${date}T12:00:00`);
      expect(formatLocalIsoDate(parsed)).toBe(`${year}-${date}`);
      expect(getItalianHoliday(parsed)?.name).toBe(name);
      expect(isItalianHoliday(parsed)).toBe(true);
      expect(getIsoWeekday(parsed)).toBe(parsed.getDay() === 0 ? 7 : parsed.getDay());
    }
  });

  it.each([
    [2024, '2024-04-01'],
    [2025, '2025-04-21'],
    [2026, '2026-04-06'],
    [2028, '2028-04-17'],
  ])('calcola Pasquetta nel %i', (year, expectedDate) => {
    expect(getItalianHolidays(year).find((holiday) => holiday.name === 'Lunedì dell’Angelo')?.date).toBe(expectedDate);
  });

  it('gestisce cambio mese, cambio anno e anno bisestile senza falsi positivi', () => {
    expect(isItalianHoliday(new Date(2024, 1, 29))).toBe(false);
    expect(isItalianHoliday(new Date(2025, 11, 31))).toBe(false);
    expect(isItalianHoliday(new Date(2026, 0, 1))).toBe(true);
  });

  it('distingue giorni part-time e considera sempre contrattuale il full-time', () => {
    const holiday = new Date(2026, 5, 2);
    const fullTime = normalizeDriverContractProfile({ contractType: 'full_time', weeklyHours: 40, contractualWeekdays: [] });
    const partTimeTuesday = normalizeDriverContractProfile({ contractType: 'part_time', weeklyHours: 32, contractualWeekdays: [2] });
    const partTimeMonday = normalizeDriverContractProfile({ contractType: 'part_time', weeklyHours: 32, contractualWeekdays: [1] });
    expect(isContractualWeekday(holiday, fullTime)).toBe(true);
    expect(isContractualWeekday(holiday, partTimeTuesday)).toBe(true);
    expect(isContractualWeekday(holiday, partTimeMonday)).toBe(false);
  });

  it('converte correttamente sabato e domenica nel sistema ISO', () => {
    expect(getIsoWeekday(new Date(2026, 5, 6))).toBe(6);
    expect(getIsoWeekday(new Date(2026, 5, 7))).toBe(7);
  });
});
