import type {
  AttendanceEvent,
  AttendanceStatus,
  PayrollMonthInput,
} from './driverPayrollTypes';
import {
  DEFAULT_DRIVER_CONTRACT_PROFILE,
  isContractualWeekday,
  type DriverContractProfile,
} from './driverContractProfile';
import { isItalianHoliday } from './italianHolidays';

export interface DriverAttendanceDay {
  status: string;
  notes?: string;
}

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseLocalDate = (dateStr: string): Date | null => {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;

  const [year, month, day] = parts;
  return new Date(year, month - 1, day);
};

export const deriveAttendancePayrollStatus = (
  status: string,
  isSunday: boolean,
  isHoliday: boolean
): AttendanceStatus | null => {
  switch ((status || '').trim()) {
    case 'Lavorato':
    case 'Lavorato < 4 ore':
      if (isSunday) return 'sunday_worked';
      if (isHoliday) return 'holiday_worked';
      return 'worked';
    case 'Ferie':
      return 'vacation';
    case 'Permesso':
    case 'Permesso (ROL)':
      return 'par';
    case 'Ex festivita':
    case 'Ex festività':
      return 'ex_holiday';
    case 'Malattia':
      return 'sickness';
    case 'Infortunio':
      return 'injury';
    case 'Riposo':
      return isHoliday && !isSunday ? 'holiday_not_worked' : 'rest';
    case 'Rotta abortita':
      return 'abort';
    case 'Visita medica':
    case 'Prelievo':
      return 'medical_visit';
    case 'Festivo lavorato':
      return 'holiday_worked';
    case 'Festivo pagato':
    case 'Festività non lavorata':
      return 'holiday_not_worked';
    default:
      return null;
  }
};

const isPaidStatus = (status: AttendanceStatus): boolean => {
  return !['unpaid_leave', 'strike'].includes(status);
};

const isWorkedStatus = (status: AttendanceStatus): boolean => {
  return ['worked', 'sunday_worked', 'holiday_worked', 'training'].includes(status);
};

export function buildAttendanceEvent(
  dateStr: string,
  attendanceDay: DriverAttendanceDay,
  theoreticalHours = 8,
  contractProfile: DriverContractProfile = DEFAULT_DRIVER_CONTRACT_PROFILE,
): AttendanceEvent | null {
  const date = parseLocalDate(dateStr);
  if (!date) return null;

  const isSunday = date.getDay() === 0;
  const isHoliday = isItalianHoliday(date);
  const status = deriveAttendancePayrollStatus(attendanceDay?.status, isSunday, isHoliday);
  if (!status) return null;
  const isWorkedHoliday = status === 'holiday_worked';
  const isAbort = status === 'abort';
  const worked = isWorkedStatus(status);
  const shortWorkedDay = attendanceDay?.status.trim() === 'Lavorato < 4 ore';

  return {
    date: dateStr,
    status,
    hoursWorked: worked && !shortWorkedDay ? theoreticalHours : 0,
    theoreticalHours,
    isSunday,
    isHoliday,
    isContractualDay: isContractualWeekday(date, contractProfile),
    isWorkedHoliday,
    isAbort,
    isPaid: isPaidStatus(status),
    eligibleForTravelAllowance: worked && !shortWorkedDay,
    shortWorkedDay,
    eligibleForSundayAllowance: status === 'sunday_worked',
    overtimeHours30: 0,
    overtimeHours50: 0,
    notes: attendanceDay?.notes,
  };
}

export function buildPayrollMonthInput(params: {
  year: number;
  month: number;
  driverProfileId?: string;
  attendance: Record<string, DriverAttendanceDay>;
  theoreticalHoursPerDay?: number;
  contractProfile?: DriverContractProfile;
}): PayrollMonthInput {
  const theoreticalHoursPerDay = params.theoreticalHoursPerDay ?? 8;
  const daysInMonth = new Date(params.year, params.month + 1, 0).getDate();
  const attendanceEvents: AttendanceEvent[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = formatLocalDate(new Date(params.year, params.month, day));
    const attendanceDay = params.attendance[dateStr];
    if (!attendanceDay) continue;

    const event = buildAttendanceEvent(
      dateStr,
      attendanceDay,
      theoreticalHoursPerDay,
      params.contractProfile ?? DEFAULT_DRIVER_CONTRACT_PROFILE,
    );
    if (event) attendanceEvents.push(event);
  }

  const workedEvents = attendanceEvents.filter((event) => isWorkedStatus(event.status));
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

  return {
    year: params.year,
    month: params.month,
    driverProfileId: params.driverProfileId,
    attendanceEvents,
    workedDays: workedEvents.length,
    eligibleTravelDays: attendanceEvents.filter((event) => event.eligibleForTravelAllowance).length,
    sundaysWorked: attendanceEvents.filter((event) => event.status === 'sunday_worked').length,
    holidaysWorked: attendanceEvents.filter((event) => event.status === 'holiday_worked').length,
    vacationDays: attendanceEvents.filter((event) => event.status === 'vacation').length,
    parHours: sum(
      attendanceEvents
        .filter((event) => event.status === 'par')
        .map((event) => event.theoreticalHours ?? 0)
    ),
    sicknessDays: attendanceEvents.filter((event) => event.status === 'sickness').length,
    injuryDays: attendanceEvents.filter((event) => event.status === 'injury').length,
    strikeHours: sum(
      attendanceEvents
        .filter((event) => event.status === 'strike')
        .map((event) => event.theoreticalHours ?? 0)
    ),
    abortDays: attendanceEvents.filter((event) => event.status === 'abort').length,
    ordinaryHours: sum(workedEvents.map((event) => event.hoursWorked ?? 0)),
    effectiveHours: sum(attendanceEvents.map((event) => event.hoursWorked ?? 0)),
    theoreticalHours: sum(attendanceEvents.map((event) => event.theoreticalHours ?? 0)),
    overtime30Hours: sum(attendanceEvents.map((event) => event.overtimeHours30 ?? 0)),
    overtime50Hours: sum(attendanceEvents.map((event) => event.overtimeHours50 ?? 0)),
  };
}
