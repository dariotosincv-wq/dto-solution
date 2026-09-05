import type {
  ResolvedRule,
  RuleContext,
  RuleDefinition,
  RuleDefinitionInput,
  RuleResolver,
  RuleResolutionResult,
  RuleVersion,
} from './types';
import { assertRulePayload, freezeRulePayload } from './rulePayload';
import {
  assertValidRuleCatalog,
  assertValidRuleDefinition,
} from './ruleCatalogValidation';

const freezeVersion = (version: Readonly<RuleVersion>): RuleVersion => {
  assertRulePayload(version.payload);
  return Object.freeze({
    ...version,
    source: Object.freeze({ ...version.source }),
    payload: freezeRulePayload(version.payload),
  });
};

export const createRuleDefinition = (
  input: Readonly<RuleDefinitionInput>
): RuleDefinition => {
  assertValidRuleDefinition(input);
  return Object.freeze({
    ...input,
    versions: Object.freeze(input.versions.map(freezeVersion)),
  });
};

const isPeriodApplicable = (
  version: Readonly<RuleVersion>,
  effectiveDate: string
): boolean =>
  (version.validFrom === undefined || version.validFrom <= effectiveDate) &&
  (version.validTo === undefined || effectiveDate <= version.validTo);

const isScopeApplicable = (
  version: Readonly<RuleVersion>,
  context: Readonly<RuleContext>
): boolean =>
  (version.ccnlId === undefined || version.ccnlId === context.ccnlId) &&
  (version.companyId === undefined || version.companyId === context.companyId);

const specificity = (version: Readonly<RuleVersion>): number =>
  Number(version.ccnlId !== undefined) + Number(version.companyId !== undefined);

const compareNormativePriority = (
  left: ResolvedRule,
  right: ResolvedRule
): number => {
  const specificityDifference =
    specificity(right.version) - specificity(left.version);
  if (specificityDifference !== 0) return specificityDifference;

  const leftValidFrom = left.version.validFrom ?? '';
  const rightValidFrom = right.version.validFrom ?? '';
  const validFromDifference = rightValidFrom.localeCompare(leftValidFrom);
  if (validFromDifference !== 0) return validFromDifference;

  const versionDifference = right.version.version.localeCompare(
    left.version.version,
    undefined,
    { numeric: true, sensitivity: 'base' }
  );
  if (versionDifference !== 0) return versionDifference;

  return 0;
};

const compareDiagnosticOrder = (
  left: ResolvedRule,
  right: ResolvedRule
): number =>
  compareNormativePriority(left, right) ||
  left.definition.id.localeCompare(right.definition.id);

const sameResolutionPriority = (
  left: ResolvedRule,
  right: ResolvedRule
): boolean => compareNormativePriority(left, right) === 0;

export const createRuleResolver = (
  inputs: ReadonlyArray<Readonly<RuleDefinitionInput | RuleDefinition>>
): RuleResolver => {
  assertValidRuleCatalog(inputs);
  const catalog = Object.freeze(inputs.map(createRuleDefinition));

  const resolveAll = (
    context: Readonly<RuleContext>
  ): ReadonlyArray<ResolvedRule> => {
    const matches = catalog.flatMap((definition) => {
      if (
        definition.canonicalField !== context.canonicalField ||
        definition.fiscalCategory !== context.fiscalCategory
      ) {
        return [];
      }

      return definition.versions
        .filter(
          (version) =>
            isPeriodApplicable(version, context.effectiveDate) &&
            isScopeApplicable(version, context)
        )
        .map((version) => Object.freeze({ definition, version }));
    });

    return Object.freeze(matches.sort(compareDiagnosticOrder));
  };

  const resolveResult = (
    context: Readonly<RuleContext>
  ): RuleResolutionResult => {
    const matches = resolveAll(context);
    if (matches.length === 0) return Object.freeze({ kind: 'NOT_FOUND' });

    const candidates = matches.filter((match) =>
      sameResolutionPriority(match, matches[0])
    );
    if (candidates.length > 1) {
      return Object.freeze({
        kind: 'CONFLICT',
        candidates: Object.freeze(candidates),
      });
    }

    return Object.freeze({ kind: 'RESOLVED', rule: matches[0] });
  };

  return Object.freeze({
    resolveResult,
    resolve: (context: Readonly<RuleContext>): ResolvedRule | undefined => {
      const result = resolveResult(context);
      return result.kind === 'RESOLVED' ? result.rule : undefined;
    },
    resolveAll,
    definitions: (): ReadonlyArray<RuleDefinition> => catalog,
  });
};
