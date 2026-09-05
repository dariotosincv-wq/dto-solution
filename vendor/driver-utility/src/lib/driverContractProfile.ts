export const DRIVER_CONTRACT_PROFILE_STORAGE_KEY = 'driverContractProfile';

export type DriverContractType = 'full_time' | 'part_time';
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface DriverContractProfile {
  contractType: DriverContractType;
  weeklyHours: number;
  contractualWeekdays: IsoWeekday[];
}

export const DEFAULT_DRIVER_CONTRACT_PROFILE: DriverContractProfile = {
  contractType: 'full_time',
  weeklyHours: 40,
  contractualWeekdays: [1, 2, 3, 4, 5],
};

const isIsoWeekday = (value: unknown): value is IsoWeekday =>
  Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 7;

export const normalizeDriverContractProfile = (value: unknown): DriverContractProfile => {
  if (!value || typeof value !== 'object') return { ...DEFAULT_DRIVER_CONTRACT_PROFILE };
  const candidate = value as Partial<DriverContractProfile>;
  const contractType = candidate.contractType === 'part_time' ? 'part_time' : 'full_time';
  const weeklyHours = Number(candidate.weeklyHours);
  const contractualWeekdays = Array.isArray(candidate.contractualWeekdays)
    ? [...new Set(candidate.contractualWeekdays.filter(isIsoWeekday))].sort((a, b) => a - b)
    : [...DEFAULT_DRIVER_CONTRACT_PROFILE.contractualWeekdays];

  return {
    contractType,
    weeklyHours: Number.isFinite(weeklyHours) && weeklyHours > 0 && weeklyHours <= 60
      ? weeklyHours
      : contractType === 'part_time' ? 24 : 40,
    contractualWeekdays,
  };
};

export const getIsoWeekday = (date: Date): IsoWeekday =>
  (date.getDay() === 0 ? 7 : date.getDay()) as IsoWeekday;

export const isContractualWeekday = (date: Date, profile: DriverContractProfile): boolean =>
  profile.contractType === 'full_time' || profile.contractualWeekdays.includes(getIsoWeekday(date));

const legacyWeekdayLabels: Record<IsoWeekday, string> = {
  1: 'lun', 2: 'mar', 3: 'mer', 4: 'gio', 5: 'ven', 6: 'sab', 7: 'dom',
};

export interface LegacySalaryContractSettings {
  tipoContratto: 'full_time' | 'part_time_24' | 'part_time_32';
  oreSettimanali: number;
  giorniContratto: string[];
}

export const toLegacySalaryContractSettings = (
  profile: DriverContractProfile,
): LegacySalaryContractSettings => ({
  tipoContratto: profile.contractType === 'full_time'
    ? 'full_time'
    : profile.weeklyHours <= 24 ? 'part_time_24' : 'part_time_32',
  oreSettimanali: profile.weeklyHours,
  giorniContratto: profile.contractualWeekdays.map((weekday) => legacyWeekdayLabels[weekday]),
});
