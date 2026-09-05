import {
  BUILTIN_PAYROLL_CODE_DEFINITIONS,
  resolvePayrollCodeDefinition,
} from './driverPayrollCodeCatalog';
import { normalizePayslipLineValues } from './driverPayrollLineValues';
import type {
  PayrollCodeDefinition,
  PayrollCodeResolutionContext,
  PayrollRuleCategory,
  PayslipLine,
} from './driverPayrollTypes';

export const PAYROLL_LAYOUT_V1_CODE_LABELS: Record<string, string> = Object.fromEntries(
  BUILTIN_PAYROLL_CODE_DEFINITIONS.map((item) => [item.code, item.canonicalDescription])
);

export type NormalizePayslipLineOptions = {
  context?: PayrollCodeResolutionContext;
  definitions?: PayrollCodeDefinition[];
};

export function normalizePayslipLine(
  line: PayslipLine,
  options: NormalizePayslipLineOptions = {}
): PayslipLine {
  const resolution = resolvePayrollCodeDefinition({
    code: line.code,
    description: line.originalDescription ?? line.label,
    context: options.context,
    definitions: options.definitions,
  });
  const definition = resolution.definition;

  if (
    line.code === '8128' &&
    definition?.economicType === 'informational' &&
    (line.earningAmount !== undefined || line.deductionAmount !== undefined)
  ) {
    line = {
      ...line,
      informationalValue: line.earningAmount ?? line.deductionAmount,
      amount: undefined,
      earningAmount: undefined,
      deductionAmount: undefined,
    };
  }

  if (!definition) {
    const economicType =
      line.earningAmount !== undefined && line.deductionAmount === undefined
        ? 'earning'
        : line.deductionAmount !== undefined && line.earningAmount === undefined
        ? 'deduction'
        : 'informational';
    return normalizePayslipLineValues({
      ...line,
      classification: line.classification ?? 'unknown',
      category: line.category ?? 'unknown',
      section: line.section ?? 'unknown',
      type: line.type ?? economicType,
      economicType: line.economicType ?? economicType,
      quantityUnit: line.quantityUnit ?? 'unknown',
      classificationMethod: resolution.method,
      classificationConfidence: resolution.confidence,
      classificationAmbiguous: resolution.ambiguous,
      classificationAlternatives: resolution.alternatives.map((item) => item.canonicalKey),
      calculationRule: line.calculationRule ?? 'unknown',
    });
  }

  const replaceUnknown = <T,>(current: T | undefined, fallback: T): T =>
    current === undefined || current === ('unknown' as T) ? fallback : current;

  return normalizePayslipLineValues({
    ...line,
    label: line.label || definition.canonicalDescription,
    canonicalKey: line.canonicalKey ?? definition.canonicalKey,
    classification: line.classification && line.classification !== 'unknown'
      ? line.classification
      : definition.canonicalKey,
    category: definition.category,
    type: replaceUnknown(line.type, definition.economicType === 'unknown' ? 'informational' : definition.economicType),
    economicType: replaceUnknown(
      line.economicType,
      definition.economicType === 'unknown' ? 'informational' : definition.economicType
    ),
    section: line.section === 'unknown' || !line.section ? definition.category : line.section,
    linkedPayrollCode: line.linkedPayrollCode ?? definition.code,
    quantityUnit: replaceUnknown(line.quantityUnit, definition.quantityUnit ?? 'unknown'),
    classificationMethod: resolution.method,
    classificationConfidence: resolution.confidence,
    classificationAmbiguous: resolution.ambiguous,
    classificationAlternatives: resolution.alternatives.map((item) => item.canonicalKey),
    calculationRule: line.calculationRule ?? definition.calculationRule ?? 'unknown',
    interpretationMethod: line.interpretationMethod ?? `catalog_${resolution.method}`,
  });
}

export function normalizePayslipLines(
  lines: PayslipLine[],
  options: NormalizePayslipLineOptions = {}
): PayslipLine[] {
  return lines.map((line) => normalizePayslipLine(line, options));
}

export function getPayrollCategoryForCode(code: string): PayrollRuleCategory | undefined {
  return resolvePayrollCodeDefinition({ code }).definition?.category;
}
