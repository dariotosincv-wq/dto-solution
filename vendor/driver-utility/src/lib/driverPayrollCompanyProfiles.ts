import type { DriverPayrollCompanyProfile } from './driverPayrollTypes';

export const GENERIC_LOGISTICS_DL05_PROFILE: DriverPayrollCompanyProfile = {
  id: 'generic_logistics_dl05_g1',
  name: 'Generic Logistics / DL05',
  payrollProvider: 'Payroll Layout v1',
  siteCode: 'DL05',
  contractCode: 'CCNL_LOGISTICA_MERCI_SPEDIZIONE',
  level: 'G1',
  fullTimeDefault: true,
  defaultEmploymentType: 'full_time',
  travelAllowanceRates: [
    {
      validFrom: '2025-01-01',
      validTo: '2025-12-31',
      amount: 20.5,
    },
    {
      validFrom: '2026-01-01',
      amount: 22.5,
    },
  ],
  sundayTravelExtraAmount: 7,
  unionFeeMode: 'notFixed',
  ebilogMode: 'readFromPayslip',
  pdrMode: 'nonPredictable',
  notes: [
    'Trattenuta sindacale non stimata rigidamente: dipende dal sindacato.',
    'EBILOG da leggere dalla busta paga reale.',
    'PDR classificato come non prevedibile e gestibile solo manualmente.',
  ],
};

export const DEFAULT_DRIVER_PAYROLL_COMPANY_PROFILES: DriverPayrollCompanyProfile[] = [
  GENERIC_LOGISTICS_DL05_PROFILE,
];

export function getTravelAllowanceForPeriod(
  companyProfile: DriverPayrollCompanyProfile,
  year: number,
  month: number
): number | undefined {
  const target = new Date(year, month, 1).getTime();

  const matchingRates = companyProfile.travelAllowanceRates
    .filter((rate) => {
      const from = new Date(rate.validFrom).getTime();
      const to = rate.validTo ? new Date(rate.validTo).getTime() : Infinity;
      return target >= from && target <= to;
    })
    .sort((a, b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime());

  return matchingRates[0]?.amount;
}
