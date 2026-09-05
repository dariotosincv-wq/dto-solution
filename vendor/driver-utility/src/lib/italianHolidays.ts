export interface ItalianHoliday {
  date: string;
  name: string;
}

export const formatLocalIsoDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const calculateEasterSunday = (year: number): Date => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
};

export const getItalianHolidays = (year: number): ItalianHoliday[] => {
  const easterSunday = calculateEasterSunday(year);
  const easterMonday = new Date(year, easterSunday.getMonth(), easterSunday.getDate() + 1);
  return [
    { date: `${year}-01-01`, name: 'Capodanno' },
    { date: `${year}-01-06`, name: 'Epifania' },
    { date: formatLocalIsoDate(easterMonday), name: 'Lunedì dell’Angelo' },
    { date: `${year}-04-25`, name: 'Festa della Liberazione' },
    { date: `${year}-05-01`, name: 'Festa dei Lavoratori' },
    { date: `${year}-06-02`, name: 'Festa della Repubblica' },
    { date: `${year}-08-15`, name: 'Ferragosto' },
    { date: `${year}-11-01`, name: 'Tutti i Santi' },
    { date: `${year}-12-08`, name: 'Immacolata Concezione' },
    { date: `${year}-12-25`, name: 'Natale' },
    { date: `${year}-12-26`, name: 'Santo Stefano' },
  ];
};

export const getItalianHoliday = (date: Date): ItalianHoliday | undefined =>
  getItalianHolidays(date.getFullYear()).find((holiday) => holiday.date === formatLocalIsoDate(date));

export const isItalianHoliday = (date: Date): boolean => Boolean(getItalianHoliday(date));

