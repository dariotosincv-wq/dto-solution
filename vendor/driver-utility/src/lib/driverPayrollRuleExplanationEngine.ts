import ruleDefinitions from './driverPayrollCcnlRules.json';
import type {
  DriverPayrollComparisonResult,
  DriverPayrollComparisonRow,
  DriverPayrollDifferenceCauseKind,
  DriverPayrollDifferenceSeverity,
} from './driverPayrollComparison';
import type { DriverPayrollComparisonMetricKey } from './driverPayrollTypes';

export type DriverPayrollRuleConfidence = 'Alta' | 'Media' | 'Bassa';

export type DriverPayrollRuleDifferenceDirection = 'positive' | 'negative' | 'any';

export interface DriverPayrollRuleConditions {
  metricKeys?: DriverPayrollComparisonMetricKey[];
  causeKinds?: DriverPayrollDifferenceCauseKind[];
  severities?: DriverPayrollDifferenceSeverity[];
  directions?: DriverPayrollRuleDifferenceDirection[];
  minAbsDifference?: number;
}

export interface DriverPayrollExplanationRule {
  id: string;
  title: string;
  description: string;
  priority: number;
  confidence: DriverPayrollRuleConfidence;
  category: string;
  conditions: DriverPayrollRuleConditions;
}

export interface DriverPayrollRuleExplanation {
  id: string;
  ruleId: string;
  title: string;
  description: string;
  confidence: DriverPayrollRuleConfidence;
  category: string;
  priority: number;
  metricKey: DriverPayrollComparisonMetricKey;
  metricLabel: string;
  difference: number;
  ccnlRuleCandidateIds: string[];
  learningHints: {
    canImproveWithAttendanceLink: boolean;
    canImproveWithPayrollCodeHistory: boolean;
    canImproveWithCcnlRuleLink: boolean;
  };
}

const defaultRules = ruleDefinitions as DriverPayrollExplanationRule[];

const getDirection = (difference: number): DriverPayrollRuleDifferenceDirection =>
  difference < 0 ? 'negative' : difference > 0 ? 'positive' : 'any';

const conditionIncludes = <T extends string>(allowed: T[] | undefined, value: T) =>
  !allowed || allowed.length === 0 || allowed.includes(value);

const ruleMatchesRow = (rule: DriverPayrollExplanationRule, row: DriverPayrollComparisonRow) => {
  if (row.severity !== 'large' || row.difference === undefined) return false;

  const conditions = rule.conditions;
  const rowCauseKinds = row.explanationSeeds.map((seed) => seed.kind);
  const hasCauseMatch =
    !conditions.causeKinds ||
    conditions.causeKinds.length === 0 ||
    rowCauseKinds.some((kind) => conditions.causeKinds?.includes(kind));

  return (
    conditionIncludes(conditions.metricKeys, row.key) &&
    conditionIncludes(conditions.severities, row.severity) &&
    conditionIncludes(conditions.directions, getDirection(row.difference)) &&
    hasCauseMatch &&
    Math.abs(row.difference) >= (conditions.minAbsDifference ?? 0)
  );
};

const createExplanation = (
  rule: DriverPayrollExplanationRule,
  row: DriverPayrollComparisonRow
): DriverPayrollRuleExplanation => ({
  id: `${row.key}-${rule.id}`,
  ruleId: rule.id,
  title: rule.title,
  description: rule.description,
  confidence: rule.confidence,
  category: rule.category,
  priority: rule.priority,
  metricKey: row.key,
  metricLabel: row.label,
  difference: row.difference ?? 0,
  ccnlRuleCandidateIds: row.explanationSeeds.flatMap((seed) => seed.ccnlRuleCandidateIds),
  learningHints: {
    canImproveWithAttendanceLink: ['allowance', 'overtime', 'holiday', 'absence', 'sickness'].includes(rule.category),
    canImproveWithPayrollCodeHistory: ['bonus', 'ccnl_rule'].includes(rule.category),
    canImproveWithCcnlRuleLink: true,
  },
});

export const getDefaultDriverPayrollExplanationRules = () => [...defaultRules];

export const explainDriverPayrollComparison = (
  comparison: DriverPayrollComparisonResult,
  rules: DriverPayrollExplanationRule[] = defaultRules
): DriverPayrollRuleExplanation[] => {
  return comparison.rows
    .flatMap((row) => rules.filter((rule) => ruleMatchesRow(rule, row)).map((rule) => createExplanation(rule, row)))
    .sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title));
};
