import { isNormalizedIsoDate } from '../gregorianDate';
import type { RuleDefinitionInput, RuleVersion } from './types';

export type RuleCatalogValidationCode =
  | 'INVALID_IDENTIFIER'
  | 'INVALID_DATE'
  | 'INVERTED_VALIDITY_PERIOD'
  | 'DUPLICATE_DEFINITION'
  | 'DUPLICATE_VERSION';

export interface RuleCatalogValidationIssue {
  readonly code: RuleCatalogValidationCode;
  readonly definitionId?: string;
  readonly version?: string;
  readonly field: string;
  readonly value: string | undefined;
}

export class RuleCatalogValidationError extends TypeError {
  readonly issue: RuleCatalogValidationIssue;

  constructor(issue: RuleCatalogValidationIssue) {
    super(
      `${issue.code}: ${issue.field}=${JSON.stringify(issue.value)}` +
        (issue.definitionId === undefined ? '' : ` definition=${JSON.stringify(issue.definitionId)}`) +
        (issue.version === undefined ? '' : ` version=${JSON.stringify(issue.version)}`)
    );
    this.name = 'RuleCatalogValidationError';
    this.issue = Object.freeze({ ...issue });
  }
}

const fail = (issue: RuleCatalogValidationIssue): never => {
  throw new RuleCatalogValidationError(issue);
};

const validateIdentifier = (
  value: string | undefined,
  field: string,
  definitionId?: string,
  version?: string,
  optional = false
): void => {
  if (optional && value === undefined) return;
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    fail({ code: 'INVALID_IDENTIFIER', definitionId, version, field, value });
  }
};

const validateDate = (
  value: string | undefined,
  field: 'validFrom' | 'validTo' | 'source.publishedAt',
  definitionId: string,
  version: string
): void => {
  if (value !== undefined && (typeof value !== 'string' || !isNormalizedIsoDate(value))) {
    fail({ code: 'INVALID_DATE', definitionId, version, field, value });
  }
};

const normalizedPart = (value: string | undefined): string => value?.trim() ?? '';

const versionIdentity = (
  definition: Readonly<RuleDefinitionInput>,
  version: Readonly<RuleVersion>
): string =>
  [
    normalizedPart(version.version),
    version.validFrom ?? '',
    version.validTo ?? '',
    normalizedPart(version.companyId),
    normalizedPart(version.ccnlId),
    normalizedPart(definition.canonicalField),
    normalizedPart(definition.fiscalCategory),
  ].join('\u0000');

const validateVersion = (
  definition: Readonly<RuleDefinitionInput>,
  version: Readonly<RuleVersion>
): void => {
  const definitionId = definition.id;
  validateIdentifier(version.version, 'version', definitionId, version.version);
  validateIdentifier(version.companyId, 'companyId', definitionId, version.version, true);
  validateIdentifier(version.ccnlId, 'ccnlId', definitionId, version.version, true);
  validateIdentifier(version.source.id, 'source.id', definitionId, version.version);
  validateDate(version.validFrom, 'validFrom', definitionId, version.version);
  validateDate(version.validTo, 'validTo', definitionId, version.version);
  validateDate(
    version.source.publishedAt,
    'source.publishedAt',
    definitionId,
    version.version
  );
  if (
    version.validFrom !== undefined &&
    version.validTo !== undefined &&
    version.validFrom > version.validTo
  ) {
    fail({
      code: 'INVERTED_VALIDITY_PERIOD',
      definitionId,
      version: version.version,
      field: 'validFrom/validTo',
      value: `${version.validFrom}/${version.validTo}`,
    });
  }
};

export const assertValidRuleDefinition = (
  definition: Readonly<RuleDefinitionInput>
): void => {
  validateIdentifier(definition.id, 'id', definition.id);
  validateIdentifier(definition.canonicalField, 'canonicalField', definition.id);
  validateIdentifier(definition.fiscalCategory, 'fiscalCategory', definition.id);

  const identities = new Set<string>();
  definition.versions.forEach((version) => {
    const identity = versionIdentity(definition, version);
    if (identities.has(identity)) {
      fail({
        code: 'DUPLICATE_VERSION',
        definitionId: definition.id,
        version: version.version,
        field: 'versions',
        value: identity,
      });
    }
    identities.add(identity);
    validateVersion(definition, version);
  });
};

export const assertValidRuleCatalog = (
  definitions: ReadonlyArray<Readonly<RuleDefinitionInput>>
): void => {
  const ids = new Map<string, string>();
  definitions.forEach((definition) => {
    const normalizedId = typeof definition.id === 'string' ? definition.id.trim() : '';
    if (ids.has(normalizedId)) {
      fail({
        code: 'DUPLICATE_DEFINITION',
        definitionId: definition.id,
        field: 'id',
        value: definition.id,
      });
    }
    ids.set(normalizedId, definition.id);
    assertValidRuleDefinition(definition);
  });
};
