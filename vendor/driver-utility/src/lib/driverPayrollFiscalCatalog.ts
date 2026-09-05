import type {
  PayrollFiscalPeriod,
  PayrollFiscalValueKind,
} from './driverPayrollFiscalTypes';

export type PayrollFiscalTarget =
  | 'socialSecurity.taxable'
  | 'socialSecurity.contributionRate'
  | 'socialSecurity.employeeContributions'
  | 'socialSecurity.employerContributions'
  | 'incomeTax.taxable'
  | 'incomeTax.supplementaryTaxable'
  | 'incomeTax.deductionDays'
  | 'incomeTax.grossTax'
  | 'incomeTax.workDeductions'
  | 'incomeTax.familyDeductions'
  | 'incomeTax.additionalDeductions'
  | 'incomeTax.taxCredits'
  | 'incomeTax.supplementaryTreatment'
  | 'incomeTax.netTax'
  | 'incomeTax.taxWithheld'
  | 'incomeTax.supplementaryTaxWithheld'
  | 'incomeTax.totalTaxWithheld'
  | 'incomeTax.taxAdjustment'
  | 'additionalTaxes.regionalBalance'
  | 'additionalTaxes.municipalBalance'
  | 'additionalTaxes.municipalAdvance'
  | 'tfr.monthlyAccrual'
  | 'tfr.progressiveAccrual'
  | 'tfr.taxableBase'
  | 'tfr.revaluation'
  | 'tfr.revaluationTax'
  | 'tfr.pensionFundContribution'
  | 'tfr.accrualFrom2001';

export interface PayrollFiscalLabelDefinition {
  id: string;
  target: PayrollFiscalTarget;
  aliases: string[];
  explicitPeriod?: PayrollFiscalPeriod;
  valueKind?: PayrollFiscalValueKind;
  confidence: number;
}

export const normalizeFiscalLabel = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}%]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const PAYROLL_FISCAL_LABEL_DEFINITIONS: PayrollFiscalLabelDefinition[] = [
  {
    id: 'FISCAL_DEDUCTION_DAYS',
    target: 'incomeTax.deductionDays',
    aliases: ['gg detrazione', 'giorni detrazione'],
    valueKind: 'integer',
    confidence: 92,
  },
  {
    id: 'FISCAL_SOCIAL_TAXABLE',
    target: 'socialSecurity.taxable',
    aliases: ['imponibile previdenziale', 'imponibile inps', 'imponibile contributivo', 'imponibile sociale'],
    confidence: 92,
  },
  {
    id: 'FISCAL_SOCIAL_RATE',
    target: 'socialSecurity.contributionRate',
    aliases: ['aliquota contributiva', 'aliquota inps dipendente', 'aliquota inps'],
    valueKind: 'percentage',
    confidence: 90,
  },
  {
    id: 'FISCAL_EMPLOYEE_CONTRIBUTIONS',
    target: 'socialSecurity.employeeContributions',
    aliases: ['contributi inps dipendente', 'trattenute inps', 'contributi dipendente', 'trattenute sociali'],
    confidence: 88,
  },
  {
    id: 'FISCAL_EMPLOYER_CONTRIBUTIONS',
    target: 'socialSecurity.employerContributions',
    aliases: ['contributi inps azienda', 'contributi datore di lavoro', 'contributi azienda'],
    confidence: 88,
  },
  {
    id: 'FISCAL_INCOME_TAXABLE',
    target: 'incomeTax.taxable',
    aliases: ['imponibile fiscale', 'imponibile irpef', 'imp le fiscale'],
    confidence: 92,
  },
  {
    id: 'FISCAL_GROSS_TAX',
    target: 'incomeTax.grossTax',
    aliases: ['irpef lorda', 'imposta lorda'],
    confidence: 92,
  },
  {
    id: 'FISCAL_WORK_DEDUCTIONS',
    target: 'incomeTax.workDeductions',
    aliases: ['detrazioni lavoro dipendente', 'detrazione lavoro dipendente'],
    confidence: 92,
  },
  {
    id: 'FISCAL_FAMILY_DEDUCTIONS',
    target: 'incomeTax.familyDeductions',
    aliases: ['detrazioni familiari', 'detrazioni coniuge', 'detrazioni figli'],
    confidence: 86,
  },
  {
    id: 'FISCAL_ADDITIONAL_DEDUCTIONS',
    target: 'incomeTax.additionalDeductions',
    aliases: ['ulteriore detrazione', 'altre detrazioni'],
    confidence: 82,
  },
  {
    id: 'FISCAL_TAX_CREDIT',
    target: 'incomeTax.taxCredits',
    aliases: ['credito fiscale', 'credito irpef'],
    confidence: 90,
  },
  {
    id: 'FISCAL_SUPPLEMENTARY_TREATMENT',
    target: 'incomeTax.supplementaryTreatment',
    aliases: ['trattamento integrativo'],
    confidence: 94,
  },
  {
    id: 'FISCAL_NET_TAX',
    target: 'incomeTax.netTax',
    aliases: ['irpef netta', 'imposta netta'],
    confidence: 92,
  },
  {
    id: 'FISCAL_TAX_WITHHELD',
    target: 'incomeTax.taxWithheld',
    aliases: ['ritenuta irpef', 'irpef trattenuta', 'trattenute fiscali', 'imposta versata'],
    confidence: 90,
  },
  {
    id: 'FISCAL_TAX_ADJUSTMENT',
    target: 'incomeTax.taxAdjustment',
    aliases: ['conguaglio fiscale', 'conguaglio irpef', 'conguaglio 730'],
    explicitPeriod: 'adjustment',
    confidence: 88,
  },
  {
    id: 'FISCAL_REGIONAL_BALANCE',
    target: 'additionalTaxes.regionalBalance',
    aliases: ['addizionale regionale', 'add reg rata a p'],
    confidence: 92,
  },
  {
    id: 'FISCAL_MUNICIPAL_BALANCE',
    target: 'additionalTaxes.municipalBalance',
    aliases: ['addizionale comunale saldo', 'addizionale comunale rata anno precedente', 'add com rata a p'],
    confidence: 92,
  },
  {
    id: 'FISCAL_MUNICIPAL_ADVANCE',
    target: 'additionalTaxes.municipalAdvance',
    aliases: ['addizionale comunale acconto', 'addizionale comunale acconto anno corrente', 'add com rata acconto a c'],
    confidence: 94,
  },
  {
    id: 'FISCAL_TFR_MONTHLY',
    target: 'tfr.monthlyAccrual',
    aliases: ['quota tfr mese', 'tfr maturato mese', 'mat mese al netto dello 0 5 %'],
    explicitPeriod: 'monthly',
    confidence: 92,
  },
  {
    id: 'FISCAL_TFR_PROGRESSIVE',
    target: 'tfr.progressiveAccrual',
    aliases: ['tfr progressivo', 'tfr maturato progressivo', 'progressivo maturato a c netto'],
    explicitPeriod: 'progressive',
    confidence: 92,
  },
  {
    id: 'FISCAL_TFR_TAXABLE',
    target: 'tfr.taxableBase',
    aliases: ['imponibile tfr', 'retribuzione utile tfr', 'retrib utile tfr', 'retr utile tfr'],
    confidence: 92,
  },
  {
    id: 'FISCAL_TFR_REVALUATION',
    target: 'tfr.revaluation',
    aliases: ['rivalutazione tfr'],
    confidence: 90,
  },
  {
    id: 'FISCAL_TFR_REVALUATION_TAX',
    target: 'tfr.revaluationTax',
    aliases: ['imposta rivalutazione tfr'],
    confidence: 90,
  },
  {
    id: 'FISCAL_TFR_PENSION_FUND',
    target: 'tfr.pensionFundContribution',
    aliases: ['quota fondo pensione', 'tfr versato fondo pensione'],
    confidence: 88,
  },
  {
    id: 'FISCAL_TFR_FROM_2001',
    target: 'tfr.accrualFrom2001',
    aliases: ['accant t f r dal 01 01 2001', 'accantonamento tfr dal 01 01 2001'],
    explicitPeriod: 'progressive',
    confidence: 94,
  },
];

export const resolvePayrollFiscalLabels = (text: string): PayrollFiscalLabelDefinition[] => {
  const normalized = normalizeFiscalLabel(text);
  const matches = PAYROLL_FISCAL_LABEL_DEFINITIONS.map((definition) => ({
    definition,
    score: Math.max(
      0,
      ...definition.aliases
        .map(normalizeFiscalLabel)
        .filter((alias) => normalized.includes(alias))
        .map((alias) => alias.length)
    ),
  })).filter((item) => item.score > 0);
  const bestScore = Math.max(0, ...matches.map((item) => item.score));
  return matches.filter((item) => item.score === bestScore).map((item) => item.definition);
};
