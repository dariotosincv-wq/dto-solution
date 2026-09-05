export type RuleSourceType =
  | 'LAW'
  | 'CCNL'
  | 'COMPANY_POLICY'
  | 'ADMINISTRATIVE_GUIDANCE'
  | 'MANUAL';

export interface RuleSource {
  readonly id: string;
  readonly type: RuleSourceType;
  readonly title: string;
  readonly authority?: string;
  readonly documentReference?: string;
  readonly publishedAt?: string;
}

export type RuleParameterValue = string | number | boolean;

export interface RuleParameter {
  readonly key: string;
  readonly value: RuleParameterValue;
}

export interface ParameterSetRulePayload {
  readonly kind: 'PARAMETER_SET';
  readonly parameters: ReadonlyArray<RuleParameter>;
}

export interface ThresholdRulePayload {
  readonly kind: 'THRESHOLD';
  readonly comparison: 'MINIMUM' | 'MAXIMUM';
  readonly value: number;
}

export interface RangeRulePayload {
  readonly kind: 'RANGE';
  readonly minimum?: number;
  readonly maximum?: number;
  readonly includeMinimum: boolean;
  readonly includeMaximum: boolean;
}

export type RulePayload =
  | ParameterSetRulePayload
  | ThresholdRulePayload
  | RangeRulePayload;

export interface RuleVersion {
  readonly version: string;
  readonly validFrom?: string;
  readonly validTo?: string;
  readonly ccnlId?: string;
  readonly companyId?: string;
  readonly source: RuleSource;
  readonly payload: RulePayload;
}

export interface RuleDefinition {
  readonly id: string;
  readonly canonicalField: string;
  readonly fiscalCategory: string;
  readonly versions: ReadonlyArray<RuleVersion>;
}

export interface RuleContext {
  readonly canonicalField: string;
  readonly fiscalCategory: string;
  readonly effectiveDate: string;
  readonly ccnlId?: string;
  readonly companyId?: string;
}

export interface ResolvedRule {
  readonly definition: RuleDefinition;
  readonly version: RuleVersion;
}

export type RuleResolutionResult =
  | {
      readonly kind: 'RESOLVED';
      readonly rule: ResolvedRule;
    }
  | {
      readonly kind: 'NOT_FOUND';
    }
  | {
      readonly kind: 'CONFLICT';
      readonly candidates: ReadonlyArray<ResolvedRule>;
    };

export interface RuleResolver {
  /** API ufficiale: distingue risoluzione, assenza e conflitto. */
  resolveResult(context: Readonly<RuleContext>): RuleResolutionResult;
  /** API compatibile: restituisce undefined sia in assenza sia in conflitto. */
  resolve(context: Readonly<RuleContext>): ResolvedRule | undefined;
  resolveAll(context: Readonly<RuleContext>): ReadonlyArray<ResolvedRule>;
  definitions(): ReadonlyArray<RuleDefinition>;
}

export type RuleDefinitionInput = Omit<RuleDefinition, 'versions'> & {
  readonly versions: ReadonlyArray<RuleVersion>;
};
