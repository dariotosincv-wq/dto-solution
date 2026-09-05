import { payrollPeriodToRuleEffectiveDate } from '../ruleEffectiveDate';
import type { ResolvedRule, RuleContext } from '../ruleEngine/types';
import {
  PAYROLL_VALIDATION_CATEGORIES,
  type PayrollValidationCheck,
  type PayrollValidationContext,
  type PayrollValidationMissingInput,
  type PayrollValidationResult,
} from '../types';

export const INPS_TAXABLE_RULE_AVAILABILITY_CHECK_ID =
  'fiscal.inps-taxable-rule-availability';
export const INPS_TAXABLE_RULE_AVAILABILITY_CHECK_VERSION = '1.0.0';
export const INPS_TAXABLE_RULE_CANONICAL_FIELD = 'socialSecurity.taxable';
export const INPS_TAXABLE_RULE_FISCAL_CATEGORY = 'INPS';

export interface InpsTaxableRuleAvailabilityCheckOptions {
  readonly clock?: () => string;
}

const missingInput = (
  id: string,
  description: string
): PayrollValidationMissingInput => ({
  id,
  description,
  required: true,
  effect: 'BLOCKS_CHECK',
});

const unavailable = (description: string) => ({
  kind: 'UNAVAILABLE' as const,
  reason: 'NOT_DETERMINABLE' as const,
  description,
});

const isStructurallyUsable = (
  resolved: Readonly<ResolvedRule>,
  effectiveDate: string
): boolean => {
  const { definition, version } = resolved;
  return (
    definition.canonicalField === INPS_TAXABLE_RULE_CANONICAL_FIELD &&
    definition.fiscalCategory === INPS_TAXABLE_RULE_FISCAL_CATEGORY &&
    typeof version.version === 'string' &&
    version.version.length > 0 &&
    typeof version.source?.id === 'string' &&
    version.source.id.length > 0 &&
    (version.validFrom === undefined || version.validFrom <= effectiveDate) &&
    (version.validTo === undefined || effectiveDate <= version.validTo) &&
    (version.payload?.kind === 'PARAMETER_SET' ||
      version.payload?.kind === 'THRESHOLD' ||
      version.payload?.kind === 'RANGE')
  );
};

export const createInpsTaxableRuleAvailabilityCheck = (
  options: Readonly<InpsTaxableRuleAvailabilityCheckOptions> = {}
): PayrollValidationCheck => {
  const clock = options.clock ?? (() => new Date().toISOString());

  return {
    id: INPS_TAXABLE_RULE_AVAILABILITY_CHECK_ID,
    version: INPS_TAXABLE_RULE_AVAILABILITY_CHECK_VERSION,
    title: 'Disponibilita regola imponibile previdenziale INPS',
    category: PAYROLL_VALIDATION_CATEGORIES.FISCAL,
    requiredInputs: [
      { id: 'period', description: 'Periodo di competenza payroll' },
      { id: 'services.ruleResolver', description: 'Servizio RuleResolver' },
    ],
    optionalInputs: [],
    applicability: {
      description:
        'Sempre applicabile; servizi o periodo mancanti producono un risultato INFO.',
      evaluate: () => true,
    },
    execute: (
      context: Readonly<PayrollValidationContext>
    ): PayrollValidationResult => {
      const baseResult = {
        id: INPS_TAXABLE_RULE_AVAILABILITY_CHECK_ID,
        checkVersion: INPS_TAXABLE_RULE_AVAILABILITY_CHECK_VERSION,
        title: 'Disponibilita regola imponibile previdenziale INPS',
        category: PAYROLL_VALIDATION_CATEGORIES.FISCAL,
        confidence: 100,
        executedAt: clock(),
      } satisfies Pick<
        PayrollValidationResult,
        'id' | 'checkVersion' | 'title' | 'category' | 'confidence' | 'executedAt'
      >;
      const resolver = context.services?.ruleResolver;

      if (resolver === undefined) {
        return {
          ...baseResult,
          status: 'INFO',
          actualValue: unavailable('Servizio RuleResolver non disponibile'),
          shortExplanation: 'La validazione normativa non e stata eseguita.',
          detailedExplanation:
            'Il PayrollValidationContext non contiene services.ruleResolver; nessun catalogo viene costruito dal controllo.',
          suggestion: 'Fornire il RuleResolver tramite PayrollValidationServices.',
          evidence: [],
          missingInputs: [missingInput('services.ruleResolver', 'Servizio RuleResolver')],
          metadata: {
            canonicalField: INPS_TAXABLE_RULE_CANONICAL_FIELD,
            fiscalCategory: INPS_TAXABLE_RULE_FISCAL_CATEGORY,
            resolution: 'SERVICE_UNAVAILABLE',
          },
        };
      }

      let effectiveDate: string;
      try {
        effectiveDate = payrollPeriodToRuleEffectiveDate(context.period ?? {});
      } catch (error) {
        return {
          ...baseResult,
          status: 'INFO',
          actualValue: unavailable('Periodo di competenza assente o invalido'),
          shortExplanation: 'Il periodo payroll non consente di risolvere la regola.',
          detailedExplanation:
            'La data normativa non e determinabile dal periodo di competenza; il controllo non interpreta questa mancanza come errore fiscale.',
          suggestion: 'Fornire period.year e period.month validi.',
          evidence: [],
          missingInputs: [missingInput('period', 'Periodo di competenza payroll valido')],
          metadata: {
            canonicalField: INPS_TAXABLE_RULE_CANONICAL_FIELD,
            fiscalCategory: INPS_TAXABLE_RULE_FISCAL_CATEGORY,
            resolution: 'INVALID_PERIOD',
            periodError: error instanceof Error ? error.name : 'UnknownError',
          },
        };
      }

      const ruleContext: RuleContext = {
        canonicalField: INPS_TAXABLE_RULE_CANONICAL_FIELD,
        fiscalCategory: INPS_TAXABLE_RULE_FISCAL_CATEGORY,
        effectiveDate,
      };
      const resolution = resolver.resolveResult(ruleContext);

      if (resolution.kind === 'NOT_FOUND') {
        return {
          ...baseResult,
          status: 'INFO',
          actualValue: unavailable('Nessuna regola applicabile'),
          shortExplanation: 'Non esiste una regola applicabile per il periodo richiesto.',
          detailedExplanation:
            'L assenza della regola impedisce la validazione normativa ma non dimostra un errore fiscale della busta paga.',
          evidence: [],
          missingInputs: [],
          metadata: {
            canonicalField: ruleContext.canonicalField,
            fiscalCategory: ruleContext.fiscalCategory,
            effectiveDate,
            resolution: resolution.kind,
          },
        };
      }

      if (resolution.kind === 'CONFLICT') {
        return {
          ...baseResult,
          status: 'WARNING',
          actualValue: unavailable('Conflitto tra regole applicabili'),
          shortExplanation: 'Piu regole equivalenti risultano applicabili.',
          detailedExplanation:
            'Il conflitto impedisce una validazione normativa affidabile; il controllo non seleziona arbitrariamente una regola.',
          suggestion: 'Correggere o disambiguare il catalogo delle regole.',
          evidence: [],
          missingInputs: [],
          metadata: {
            canonicalField: ruleContext.canonicalField,
            fiscalCategory: ruleContext.fiscalCategory,
            effectiveDate,
            resolution: resolution.kind,
            conflictCount: resolution.candidates.length,
            conflictingRuleIds: resolution.candidates.map(
              (candidate) => candidate.definition.id
            ),
          },
        };
      }

      const resolved = resolution.rule;
      if (!isStructurallyUsable(resolved, effectiveDate)) {
        return {
          ...baseResult,
          status: 'WARNING',
          actualValue: unavailable('Regola risolta strutturalmente inutilizzabile'),
          shortExplanation: 'La regola risolta non e strutturalmente utilizzabile.',
          detailedExplanation:
            'Il risultato del resolver non soddisfa i contratti strutturali attesi dal controllo.',
          suggestion: 'Verificare integrita del catalogo e implementazione del RuleResolver.',
          evidence: [],
          missingInputs: [],
          metadata: {
            canonicalField: ruleContext.canonicalField,
            fiscalCategory: ruleContext.fiscalCategory,
            effectiveDate,
            resolution: 'RESOLVED_UNUSABLE',
          },
        };
      }

      return {
        ...baseResult,
        status: 'PASS',
        actualValue: { kind: 'TEXT', value: resolved.version.payload.kind },
        shortExplanation: 'Una regola strutturalmente valida e non ambigua e disponibile.',
        detailedExplanation:
          'Il PASS certifica soltanto disponibilita, validita strutturale e risoluzione univoca della regola per il periodo; non verifica imponibile, contributi, aliquote o correttezza fiscale.',
        evidence: [],
        missingInputs: [],
        metadata: {
          canonicalField: ruleContext.canonicalField,
          fiscalCategory: ruleContext.fiscalCategory,
          effectiveDate,
          resolution: resolution.kind,
          ruleDefinitionId: resolved.definition.id,
          ruleVersion: resolved.version.version,
          ruleSourceId: resolved.version.source.id,
          ruleSourceType: resolved.version.source.type,
          payloadKind: resolved.version.payload.kind,
        },
      };
    },
  };
};

export const inpsTaxableRuleAvailabilityCheck =
  createInpsTaxableRuleAvailabilityCheck();
