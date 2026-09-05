import { DEFAULT_PAYROLL_CODES } from './driverPayrollCodes';
import type {
  PayrollCode,
  PayrollCodeDefinition,
  PayrollCodeResolution,
  PayrollCodeResolutionContext,
  PayslipQuantityUnit,
} from './driverPayrollTypes';

export const normalizePayrollDefinitionText = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}%]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const QUANTITY_UNITS: Record<string, PayslipQuantityUnit> = {
  '0169': 'hours',
  '0170': 'days',
  '0779': 'hours',
  '0785': 'hours',
  '1981': 'hours',
  '1989': 'hours',
  '2014': 'hours',
  '2030': 'hours',
  '2050': 'hours',
  '2250': 'hours',
  '2310': 'days',
  '2315': 'days',
  '3900': 'days',
  '3901': 'days',
  '5000': 'days',
  '5050': 'hours',
  '5100': 'hours',
  '5121': 'days',
};

const taxTreatment = (code: PayrollCode): PayrollCodeDefinition['taxTreatment'] =>
  code.isTaxable === true ? 'taxable' : code.isTaxable === false ? 'exempt' : 'unknown';

const socialSecurityTreatment = (code: PayrollCode): PayrollCodeDefinition['socialSecurityTreatment'] =>
  code.affectsInps === true ? 'subject' : code.affectsInps === false ? 'exempt' : 'unknown';

const SEMANTIC_OVERRIDES: Record<string, Partial<PayrollCodeDefinition>> = {
  '1000': { canonicalKey: 'payroll.base_pay', category: 'base_pay', historicalBehavior: 'structural' },
  '1052': { canonicalKey: 'payroll.edr', category: 'edr', historicalBehavior: 'structural' },
  '2030': { canonicalKey: 'payroll.overtime', category: 'overtime', calculationRule: 'unit_times_quantity', historicalBehavior: 'variable' },
  '2250': { canonicalKey: 'payroll.overtime_premium', category: 'overtime_premium', calculationRule: 'unit_times_quantity', historicalBehavior: 'variable' },
  '2310': {
    canonicalKey: 'payroll.travel_allowance',
    category: 'travel_allowance',
    quantityUnit: 'days',
    calculationRule: 'unit_times_quantity',
    historicalBehavior: 'variable',
  },
  '2315': {
    canonicalKey: 'payroll.sunday_premium',
    category: 'sunday_premium',
    quantityUnit: 'days',
    calculationRule: 'unit_times_quantity',
    historicalBehavior: 'variable',
  },
  '2500': { canonicalKey: 'payroll.sickness.waiting_period', category: 'sickness_waiting_period' },
  '2520': { canonicalKey: 'payroll.sickness.inps_50', category: 'sickness' },
  '2530': { canonicalKey: 'payroll.sickness.inps_66', category: 'sickness' },
  '2600': { canonicalKey: 'payroll.sickness.employer_supplement', category: 'sickness_employer_supplement' },
  '2650': { canonicalKey: 'payroll.sickness.absence_deduction', category: 'generic_deduction' },
  '2700': { canonicalKey: 'payroll.accident.waiting_period', category: 'accident' },
  '2720': { canonicalKey: 'payroll.accident.inail_60', category: 'accident' },
  '2800': { canonicalKey: 'payroll.accident.employer_supplement', category: 'accident_employer_supplement' },
  '2850': { canonicalKey: 'payroll.accident.absence_deduction', category: 'generic_deduction' },
  '3900': { canonicalKey: 'payroll.holiday.paid', category: 'paid_leave' },
  '3901': { canonicalKey: 'payroll.holiday.premium', category: 'holiday_premium' },
  '4009': { canonicalKey: 'payroll.performance_bonus', category: 'performance_bonus', historicalBehavior: 'variable' },
  '4301': {
    canonicalKey: 'payroll.expense_reimbursement',
    category: 'expense_reimbursement',
    taxTreatment: 'exempt',
    socialSecurityTreatment: 'exempt',
    affectsTfr: false,
  },
  '5000': { canonicalKey: 'payroll.vacation', category: 'vacation', quantityUnit: 'days', historicalBehavior: 'variable' },
  '5050': { canonicalKey: 'payroll.permission', category: 'permission', quantityUnit: 'hours', historicalBehavior: 'variable' },
  '5100': { canonicalKey: 'payroll.former_holiday_leave', category: 'former_holiday_leave', quantityUnit: 'hours' },
  '5121': { canonicalKey: 'payroll.former_holiday_paid', category: 'former_holiday_leave' },
  '5340': { canonicalKey: 'payroll.thirteenth_month', category: 'thirteenth_month' },
  '5390': { canonicalKey: 'payroll.fourteenth_month', category: 'fourteenth_month' },
  '6633': {
    canonicalKey: 'payroll.bilateral_body.employee_contribution',
    category: 'bilateral_body_employee_contribution',
  },
  '7033': {
    canonicalKey: 'payroll.bilateral_body.employer_contribution',
    category: 'bilateral_body_employer_contribution',
    economicType: 'informational',
  },
  '8001': { canonicalKey: 'payroll.social_contribution.employee', category: 'employee_social_contribution' },
  '8002': { canonicalKey: 'payroll.tax.income', category: 'income_tax' },
  '8320': { canonicalKey: 'payroll.tax.regional', category: 'regional_tax' },
  '8420': { canonicalKey: 'payroll.tax.municipal.balance', category: 'municipal_tax_balance' },
  '8460': { canonicalKey: 'payroll.tax.municipal.advance', category: 'municipal_tax_advance' },
  '8580': { canonicalKey: 'payroll.tax.adjustment.730', category: 'tax_adjustment', historicalBehavior: 'one_off' },
  '9202': { canonicalKey: 'payroll.generic_deduction.damage', category: 'generic_deduction' },
  '9250': { canonicalKey: 'payroll.salary_advance.recovery', category: 'salary_advance_recovery', historicalBehavior: 'one_off' },
  '9300': { canonicalKey: 'payroll.union_fee', category: 'union_fee', historicalBehavior: 'recurring' },
  '9531': { canonicalKey: 'payroll.tax.deductible_charges', category: 'informational' },
};

const fromLegacyCode = (item: PayrollCode): PayrollCodeDefinition => {
  const base: PayrollCodeDefinition = {
    code: item.code,
    canonicalKey: `payroll.${item.category}`,
    canonicalDescription: item.label,
    aliases: item.parserAliases,
    category: item.category,
    economicType: item.type,
    quantityUnit: QUANTITY_UNITS[item.code] ?? 'unknown',
    priority: 0,
    taxTreatment: taxTreatment(item),
    socialSecurityTreatment: socialSecurityTreatment(item),
    affectsTfr: item.affectsTfr ?? 'unknown',
    calculationRule: 'unknown',
    historicalBehavior: 'unknown',
    source: 'builtin',
    legacyPayrollCode: item,
  };
  return { ...base, ...SEMANTIC_OVERRIDES[item.code] };
};

const fallback = (
  code: string,
  canonicalKey: string,
  canonicalDescription: string,
  economicType: PayrollCodeDefinition['economicType'],
  category: PayrollCodeDefinition['category'],
  quantityUnit: PayslipQuantityUnit,
  aliases: string[] = []
): PayrollCodeDefinition => ({
  code,
  canonicalKey,
  canonicalDescription,
  economicType,
  category,
  quantityUnit,
  aliases,
  priority: 0,
  taxTreatment: 'unknown',
  socialSecurityTreatment: 'unknown',
  affectsTfr: 'unknown',
  calculationRule: ['2014', '2050'].includes(code) ? 'unit_times_quantity' : 'unknown',
  historicalBehavior: ['payroll.epa', 'payroll.seniority_increment'].includes(canonicalKey)
    ? 'structural'
    : ['2014', '2050'].includes(code) ? 'variable' : 'unknown',
  source: 'builtin',
});

export const BUILTIN_PAYROLL_CODE_DEFINITIONS: PayrollCodeDefinition[] = [
  ...DEFAULT_PAYROLL_CODES.map(fromLegacyCode),
  fallback('0169', 'payroll.worked_hours', 'Ore lavorate mese', 'informational', 'worked_hours', 'hours'),
  fallback('0170', 'payroll.worked_days', 'Giorni lavorati', 'informational', 'worked_days', 'days'),
  fallback('0779', 'payroll.theoretical_hours', 'Monte ore teorico', 'informational', 'theoretical_hours', 'hours'),
  fallback('0785', 'payroll.effective_hours', 'Monte ore effettivo', 'informational', 'effective_hours', 'hours'),
  fallback('1981', 'payroll.sickness.hours', 'Ore malattia', 'informational', 'sickness', 'hours'),
  fallback('1989', 'payroll.accident.hours', 'Ore infortunio', 'informational', 'accident', 'hours'),
  fallback('2014', 'payroll.overtime.part_time_18', 'PT verticali supplementare 18%', 'earning', 'overtime', 'hours'),
  fallback('2050', 'payroll.sunday_premium.part_time_65', 'PT supplementare 65% domenica', 'earning', 'sunday_premium', 'hours'),
  fallback('5963', 'payroll.fringe_benefit', 'Fringe benefit', 'earning', 'fringe_benefit', 'unknown'),
  fallback('8128', 'payroll.tax.last_deduction', 'Ultima detrazione', 'informational', 'tax_deduction', 'unknown'),
  fallback('8146', 'payroll.informational.credit_dl_3_2020', 'Credito D.L.3/20', 'informational', 'informational', 'unknown'),
  fallback('8582', 'payroll.tax.adjustment.730.regional', 'M730 addizionale regionale', 'deduction', 'tax_adjustment', 'unknown'),
  fallback('', 'payroll.epa', 'EPA CCNL', 'earning', 'epa', 'unknown', [
    'epa ccnl',
    'elemento perequativo aziendale',
  ]),
  fallback('', 'payroll.seniority_increment', 'Scatti di anzianità', 'earning', 'seniority_increment', 'unknown', [
    'scatti di anzianita',
    'scatto di anzianita',
  ]),
];

const isDefinitionActive = (definition: PayrollCodeDefinition, date?: string) =>
  (!date || !definition.validFrom || date >= definition.validFrom) &&
  (!date || !definition.validTo || date <= definition.validTo);

const contextCompatible = (definition: PayrollCodeDefinition, context: PayrollCodeResolutionContext) => {
  if (definition.companyId && definition.companyId !== context.companyId) return false;
  if (
    !definition.companyId &&
    definition.companyAliases?.length &&
    (!context.companyName ||
      !definition.companyAliases.some(
        (alias) => normalizePayrollDefinitionText(alias) === normalizePayrollDefinitionText(context.companyName!)
      ))
  ) return false;
  if (definition.contractType && definition.contractType !== context.contractType) return false;
  if (definition.payrollSoftware && definition.payrollSoftware !== context.payrollSoftware) return false;
  return isDefinitionActive(definition, context.effectiveDate);
};

const contextSpecificity = (definition: PayrollCodeDefinition) =>
  Number(Boolean(definition.companyId || definition.companyAliases?.length)) * 8 +
  Number(Boolean(definition.contractType)) * 3 +
  Number(Boolean(definition.payrollSoftware)) * 3;

type Candidate = {
  definition: PayrollCodeDefinition;
  method: PayrollCodeResolution['method'];
  confidence: number;
  score: number;
};

export type ResolvePayrollCodeDefinitionInput = {
  code?: string;
  description?: string;
  context?: PayrollCodeResolutionContext;
  definitions?: PayrollCodeDefinition[];
};

export const resolvePayrollCodeDefinition = ({
  code,
  description,
  context = {},
  definitions = BUILTIN_PAYROLL_CODE_DEFINITIONS,
}: ResolvePayrollCodeDefinitionInput): PayrollCodeResolution => {
  const available = definitions.filter((definition) => contextCompatible(definition, context));
  const normalizedDescription = normalizePayrollDefinitionText(description ?? '');
  const candidates: Candidate[] = [];

  available.forEach((definition) => {
    const priority = definition.priority ?? 0;
    const specific = contextSpecificity(definition);
    if (code && definition.code === code.trim()) {
      const companySpecific = specific > 0;
      candidates.push({
        definition,
        method: companySpecific ? 'exact_company_code' : 'exact_generic_code',
        confidence: companySpecific ? 100 : 96,
        score: 400 + specific + priority,
      });
      return;
    }

    if (!normalizedDescription) return;
    const descriptions = [definition.canonicalDescription, ...(definition.aliases ?? [])]
      .map(normalizePayrollDefinitionText);
    if (descriptions.includes(normalizedDescription)) {
      candidates.push({
        definition,
        method: 'description_alias',
        confidence: 84,
        score: 200 + specific + priority,
      });
      return;
    }

    const patternMatch = (definition.descriptionPatterns ?? []).some((pattern) => {
      try {
        return new RegExp(pattern, 'i').test(description ?? '');
      } catch {
        return false;
      }
    });
    if (patternMatch) {
      candidates.push({
        definition,
        method: 'description_pattern',
        confidence: 72,
        score: 100 + specific + priority,
      });
    }
  });

  candidates.sort((a, b) => b.score - a.score);
  const exactCandidate = candidates.find(
    (candidate) =>
      candidate.method === 'exact_company_code' || candidate.method === 'exact_generic_code'
  );
  const descriptionCandidates = candidates.filter(
    (candidate) =>
      candidate.method === 'description_alias' || candidate.method === 'description_pattern'
  );
  const conflictingDescription = exactCandidate
    ? descriptionCandidates.find(
        (candidate) => candidate.definition.canonicalKey !== exactCandidate.definition.canonicalKey
      )
    : undefined;
  if (exactCandidate && conflictingDescription) {
    return {
      method: exactCandidate.method,
      confidence: 40,
      ambiguous: true,
      alternatives: [exactCandidate.definition, conflictingDescription.definition],
    };
  }

  const best = candidates[0];
  if (!best) return { method: 'unknown', confidence: 0, ambiguous: false, alternatives: [] };
  const tied = candidates.filter((candidate) => candidate.score === best.score);
  const distinct = Array.from(new Map(tied.map((candidate) => [candidate.definition.canonicalKey, candidate.definition])).values());
  if (distinct.length > 1) {
    return {
      method: best.method,
      confidence: Math.min(best.confidence, 45),
      ambiguous: true,
      alternatives: distinct,
    };
  }
  return {
    definition: best.definition,
    method: best.method,
    confidence: best.confidence,
    ambiguous: false,
    alternatives: candidates.slice(1, 4).map((candidate) => candidate.definition),
  };
};
