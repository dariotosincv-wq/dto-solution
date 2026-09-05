import { createRuleDefinition } from './ruleEngine/ruleResolver';
import { assertValidRuleCatalog } from './ruleEngine/ruleCatalogValidation';
import type { RuleDefinition, RuleDefinitionInput } from './ruleEngine/types';

export const SOCIAL_SECURITY_TAXABLE_RULE_ID =
  'fiscal.inps.social-security-taxable';
export const SOCIAL_SECURITY_TAXABLE_CANONICAL_FIELD =
  'socialSecurity.taxable';
export const SOCIAL_SECURITY_TAXABLE_FISCAL_CATEGORY = 'INPS';
export const SOCIAL_SECURITY_TAXABLE_RULE_VERSION = '1.0.0';

const createSocialSecurityTaxableDefinition = (): RuleDefinitionInput => ({
  id: SOCIAL_SECURITY_TAXABLE_RULE_ID,
  canonicalField: SOCIAL_SECURITY_TAXABLE_CANONICAL_FIELD,
  fiscalCategory: SOCIAL_SECURITY_TAXABLE_FISCAL_CATEGORY,
  versions: [
    {
      version: SOCIAL_SECURITY_TAXABLE_RULE_VERSION,
      validFrom: '1998-01-01',
      source: {
        id: 'italy.dlgs-314-1997.article-6',
        type: 'LAW',
        title:
          'Decreto legislativo 2 settembre 1997, n. 314, articolo 6; Legge 30 aprile 1969, n. 153, articolo 12',
        authority: 'Repubblica Italiana',
        documentReference:
          'https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:1997;314~art6=',
        publishedAt: '1997-09-19',
      },
      payload: {
        kind: 'PARAMETER_SET',
        parameters: [
          {
            key: 'fieldName',
            value: SOCIAL_SECURITY_TAXABLE_CANONICAL_FIELD,
          },
          {
            key: 'description',
            value:
              'Definizione normativa del reddito da lavoro dipendente ai fini contributivi',
          },
          {
            key: 'validationScope',
            value: 'availability-and-structural-use',
          },
          {
            key: 'sourceType',
            value: 'national-legislation',
          },
        ],
      },
    },
  ],
});

/** Crea una nuova istanza validata e immutabile del catalogo fiscale v1. */
export const createFiscalRuleCatalogV1 = (): ReadonlyArray<RuleDefinition> => {
  const definitions = [createSocialSecurityTaxableDefinition()];
  assertValidRuleCatalog(definitions);
  return Object.freeze(definitions.map(createRuleDefinition));
};
