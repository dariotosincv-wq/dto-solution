import type { DriverContractProfile } from './driverContractProfile';
import { isContractualWeekday } from './driverContractProfile';
import { getItalianHoliday } from './italianHolidays';

export type StoredAttendance = Record<string, { status?: string; notes?: string }>;

export interface MonthlyAttendanceSummary {
  year: number;
  month: number;
  daysInMonth: number;
  registeredDays: number;
  unfilledDays: number;
  workedDays: number;
  vacationDays: number;
  permitDays: number;
  sickDays: number;
  injuryDays: number;
  restDays: number;
  abortedRouteDays: number;
  medicalVisitDays: number;
  holidayWorkedDays: number;
  holidayNotWorkedDays: number;
  totalHolidayDays: number;
  sundayWorkedDays: number;
  potentialTravelDays: number;
  shortWorkedDays: number;
  unfilledHolidayDays: number;
  workedDates: string[];
  contractualDays?: number;
  nonContractualDays?: number;
  isPartial: boolean;
}

export const summarizeMonthlyAttendance = (
  attendance: StoredAttendance,
  year: number,
  month: number,
  profile: DriverContractProfile,
): MonthlyAttendanceSummary => {
  const daysInMonth = new Date(year, month, 0).getDate();
  const summary: MonthlyAttendanceSummary = {
    year, month, daysInMonth, registeredDays: 0, unfilledDays: 0, workedDays: 0,
    vacationDays: 0, permitDays: 0, sickDays: 0, injuryDays: 0, restDays: 0,
    abortedRouteDays: 0, medicalVisitDays: 0, holidayWorkedDays: 0,
    holidayNotWorkedDays: 0, totalHolidayDays: 0, sundayWorkedDays: 0, potentialTravelDays: 0,
    workedDates: [], shortWorkedDays: 0, unfilledHolidayDays: 0, isPartial: false,
  };
  if (profile.contractType === 'part_time') {
    summary.contractualDays = 0;
    summary.nonContractualDays = 0;
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month - 1, day);
    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const status = attendance[key]?.status;
    if (profile.contractType === 'part_time') {
      const field = isContractualWeekday(date, profile) ? 'contractualDays' : 'nonContractualDays';
      summary[field] = (summary[field] ?? 0) + 1;
    }
    if (!status) {
      summary.unfilledDays += 1;
      if (getItalianHoliday(date)) summary.unfilledHolidayDays += 1;
      continue;
    }
    summary.registeredDays += 1;
    if (status === 'Lavorato' || status === 'Lavorato < 4 ore') {
      summary.workedDays += 1;
      if (status === 'Lavorato') summary.potentialTravelDays += 1;
      else summary.shortWorkedDays += 1;
      summary.workedDates.push(key);
      if (date.getDay() === 0) summary.sundayWorkedDays += 1;
      if (getItalianHoliday(date)) summary.holidayWorkedDays += 1;
    } else if (status === 'Festivo lavorato' || status === 'Festività lavorata') {
      summary.holidayWorkedDays += 1;
    } else if (status === 'Festività non lavorata' || status === 'Festivo pagato') {
      summary.holidayNotWorkedDays += 1;
    } else if (status === 'Ferie') summary.vacationDays += 1;
    else if (status === 'Permesso') summary.permitDays += 1;
    else if (status === 'Malattia') summary.sickDays += 1;
    else if (status === 'Infortunio') summary.injuryDays += 1;
    else if (status === 'Riposo') summary.restDays += 1;
    else if (status === 'Rotta abortita') summary.abortedRouteDays += 1;
    else if (status === 'Visita medica') summary.medicalVisitDays += 1;
  }
  summary.totalHolidayDays = summary.holidayWorkedDays + summary.holidayNotWorkedDays;
  summary.isPartial = summary.unfilledDays > 0;
  return summary;
};
