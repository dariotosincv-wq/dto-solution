import type {
  PayrollFiscalUnit,
  PayrollFiscalValueKind,
} from './driverPayrollFiscalTypes';

/** Unico mapping autorizzato dalla semantica sorgente all'unita osservata. */
export const mapPayrollFiscalValueKindToUnit = (
  valueKind: PayrollFiscalValueKind | undefined
): PayrollFiscalUnit => {
  switch (valueKind) {
    case 'money':
      return 'EUR';
    case 'percentage':
      return 'PERCENT_POINTS';
    case 'fraction':
      return 'FRACTION';
    case 'integer':
    case undefined:
      return 'UNSPECIFIED';
  }
};
