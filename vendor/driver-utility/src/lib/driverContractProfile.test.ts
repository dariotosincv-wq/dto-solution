import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DRIVER_CONTRACT_PROFILE,
  isContractualWeekday,
  normalizeDriverContractProfile,
  toLegacySalaryContractSettings,
} from './driverContractProfile';

describe('profilo contrattuale driver', () => {
  it('usa un profilo full-time compatibile come predefinito', () => {
    expect(normalizeDriverContractProfile(null)).toEqual(DEFAULT_DRIVER_CONTRACT_PROFILE);
  });

  it('normalizza e conserva un profilo part-time con giorni ISO', () => {
    expect(normalizeDriverContractProfile({
      contractType: 'part_time',
      weeklyHours: 32,
      contractualWeekdays: [5, 1, 2, 4, 4, 9],
    })).toEqual({
      contractType: 'part_time',
      weeklyHours: 32,
      contractualWeekdays: [1, 2, 4, 5],
    });
  });

  it('distingue festività su giorno contrattuale e non contrattuale', () => {
    const profile = normalizeDriverContractProfile({
      contractType: 'part_time', weeklyHours: 32, contractualWeekdays: [1, 2, 4, 5],
    });
    expect(isContractualWeekday(new Date(2026, 5, 2), profile)).toBe(true);
    expect(isContractualWeekday(new Date(2026, 5, 3), profile)).toBe(false);
  });

  it('non inventa giorni non contrattuali per un full-time', () => {
    const profile = normalizeDriverContractProfile({
      contractType: 'full_time', weeklyHours: 40, contractualWeekdays: [1, 2, 3, 4, 5],
    });
    expect(isContractualWeekday(new Date(2026, 5, 2), profile)).toBe(true);
    expect(isContractualWeekday(new Date(2026, 5, 6), profile)).toBe(true);
    expect(isContractualWeekday(new Date(2026, 5, 7), profile)).toBe(true);
  });

  it('adatta il profilo ISO al calcolatore stipendio legacy senza cambiare il dato salvato', () => {
    const profile = normalizeDriverContractProfile({
      contractType: 'part_time', weeklyHours: 32, contractualWeekdays: [1, 2, 4, 5],
    });
    expect(toLegacySalaryContractSettings(profile)).toEqual({
      tipoContratto: 'part_time_32',
      oreSettimanali: 32,
      giorniContratto: ['lun', 'mar', 'gio', 'ven'],
    });
    expect(profile.contractualWeekdays).toEqual([1, 2, 4, 5]);
  });
});
