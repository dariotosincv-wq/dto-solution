import type { PayrollValidationPeriod } from './types';
import { gregorianDaysInMonth } from './gregorianDate';

/**
 * Converte il periodo di competenza nella data normativa ufficiale: l'ultimo
 * giorno del mese, senza costruire Date locali o dipendere dal fuso orario.
 */
export const payrollPeriodToRuleEffectiveDate = (
  period: Readonly<PayrollValidationPeriod>
): string => {
  const { year, month } = period;
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    year === undefined ||
    month === undefined ||
    year < 1 ||
    year > 9999 ||
    month < 1 ||
    month > 12
  ) {
    throw new RangeError('Invalid payroll validation period');
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${gregorianDaysInMonth(year, month)}`;
};
