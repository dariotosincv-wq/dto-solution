import { createFiscalRuleCatalogV1 } from './fiscalRuleCatalog';
import { createRuleResolver } from './ruleEngine/ruleResolver';
import type {
  RuleDefinition,
  RuleResolver,
} from './ruleEngine/types';
import type { PayrollValidationServices } from './types';

export interface FiscalRuleIntegrationV1 {
  readonly catalog: ReadonlyArray<RuleDefinition>;
  readonly ruleResolver: RuleResolver;
  readonly services: PayrollValidationServices;
}

/**
 * Compone il catalogo fiscale v1 con il RuleResolver e i servizi da iniettare.
 * Ogni chiamata crea un grafo indipendente e privo di stato globale.
 */
export const createFiscalRuleIntegrationV1 = (): FiscalRuleIntegrationV1 => {
  const catalog = createFiscalRuleCatalogV1();
  const ruleResolver = createRuleResolver(catalog);
  const services: PayrollValidationServices = Object.freeze({ ruleResolver });

  return Object.freeze({ catalog, ruleResolver, services });
};
