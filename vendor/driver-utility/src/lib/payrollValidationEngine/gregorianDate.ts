const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const isGregorianLeapYear = (year: number): boolean =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

export const gregorianDaysInMonth = (year: number, month: number): number => {
  const days = [31, isGregorianLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[month - 1] ?? 0;
};

export const isNormalizedIsoDate = (value: string): boolean => {
  const match = ISO_DATE_PATTERN.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return (
    year >= 1 &&
    year <= 9999 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= gregorianDaysInMonth(year, month)
  );
};
