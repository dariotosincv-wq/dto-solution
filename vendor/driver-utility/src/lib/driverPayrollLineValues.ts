import type {
  PayslipLine,
  PayslipLineSourceColumn,
  PayslipQuantityUnit,
  PayrollRuleCategory,
} from './driverPayrollTypes';
import { resolvePayrollCodeDefinition } from './driverPayrollCodeCatalog';

export type PayslipLineSemanticValues = {
  unitValue?: number;
  quantity?: number;
  quantityUnit: PayslipQuantityUnit;
  earningAmount?: number;
  deductionAmount?: number;
  informationalValue?: number;
  sourceColumn?: PayslipLineSourceColumn;
};

export const quantityUnitForPayslipCode = (code?: string): PayslipQuantityUnit =>
  (code && resolvePayrollCodeDefinition({ code }).definition?.quantityUnit) || 'unknown';

export const getPayslipLineSemanticValues = (line: PayslipLine): PayslipLineSemanticValues => {
  const quantityUnit = line.quantityUnit ?? quantityUnitForPayslipCode(line.code);
  const catalogType = line.code
    ? resolvePayrollCodeDefinition({ code: line.code }).definition?.economicType
    : undefined;
  const effectiveType =
    line.type ??
    (catalogType === 'unknown' ? undefined : catalogType);
  const isInformational = effectiveType === 'informational';
  const earningAmount =
    line.earningAmount ?? (effectiveType === 'earning' ? line.amount : undefined);
  const deductionAmount =
    line.deductionAmount ??
    (effectiveType === 'deduction' && line.amount !== undefined ? Math.abs(line.amount) : undefined);
  const informationalValue =
    line.informationalValue ??
    (isInformational ? line.quantity ?? line.amount : undefined);

  return {
    unitValue: line.unitValue,
    quantity: line.quantity ?? (isInformational ? informationalValue : undefined),
    quantityUnit,
    earningAmount,
    deductionAmount,
    informationalValue,
    sourceColumn:
      line.sourceColumn ??
      (earningAmount !== undefined
        ? 'earnings'
        : deductionAmount !== undefined
        ? 'deductions'
        : informationalValue !== undefined
        ? 'informational'
        : line.quantity !== undefined
        ? 'quantity'
        : line.unitValue !== undefined
        ? 'unit_value'
        : undefined),
  };
};

export const getPayslipLineEconomicAmount = (line: PayslipLine): number | undefined => {
  const values = getPayslipLineSemanticValues(line);
  return values.earningAmount ?? values.deductionAmount;
};

export const getPayslipLineQuantity = (line: PayslipLine): number | undefined =>
  getPayslipLineSemanticValues(line).quantity;

export type PayslipLineSemanticSelector = {
  canonicalKeys?: string[];
  categories?: PayrollRuleCategory[];
  legacyCodes?: string[];
};

export const matchesPayslipLineSemantic = (
  line: PayslipLine,
  selector: PayslipLineSemanticSelector
): boolean => {
  if (line.canonicalKey && selector.canonicalKeys?.includes(line.canonicalKey)) return true;
  if (line.category && selector.categories?.includes(line.category as PayrollRuleCategory)) return true;

  const resolved = line.code
    ? resolvePayrollCodeDefinition({ code: line.code, description: line.originalDescription ?? line.label }).definition
    : resolvePayrollCodeDefinition({ description: line.originalDescription ?? line.label }).definition;
  if (resolved) {
    return Boolean(
      selector.canonicalKeys?.includes(resolved.canonicalKey) ||
      selector.categories?.includes(resolved.category)
    );
  }

  return Boolean(line.code && selector.legacyCodes?.includes(line.code));
};

export const normalizePayslipLineValues = (line: PayslipLine): PayslipLine => {
  const values = getPayslipLineSemanticValues(line);
  const isInformational =
    line.type === 'informational' ||
    (line.code
      ? resolvePayrollCodeDefinition({ code: line.code }).definition?.economicType === 'informational'
      : false);
  return {
    ...line,
    ...values,
    amount: isInformational
      ? undefined
      : line.amount ?? values.earningAmount ?? values.deductionAmount,
  };
};
