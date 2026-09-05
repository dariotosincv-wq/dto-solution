import {
  NET_PAY_CONSISTENCY_CHECK_ID,
  NET_PAY_CONSISTENCY_CHECK_VERSION,
  netPayConsistencyCheck,
} from './checks/netPayConsistencyCheck';
import {
  SUMMARY_CONSISTENCY_CHECK_ID,
  SUMMARY_CONSISTENCY_CHECK_VERSION,
  summaryConsistencyCheck,
} from './checks/summaryConsistencyCheck';
import {
  INPS_OBSERVATION_QUALITY_CHECK_ID,
  INPS_OBSERVATION_QUALITY_CHECK_VERSION,
  inpsObservationQualityCheck,
} from './checks/inpsObservationQualityCheck';
import {
  INPS_TAXABLE_STRUCTURAL_CONSISTENCY_CHECK_ID,
  INPS_TAXABLE_STRUCTURAL_CONSISTENCY_CHECK_VERSION,
  inpsTaxableStructuralConsistencyCheck,
} from './checks/inpsTaxableStructuralConsistencyCheck';
import {
  INPS_TAXABLE_RULE_AVAILABILITY_CHECK_ID,
  INPS_TAXABLE_RULE_AVAILABILITY_CHECK_VERSION,
  inpsTaxableRuleAvailabilityCheck,
} from './checks/inpsTaxableRuleAvailabilityCheck';
import {
  INPS_OBSERVED_CALCULATION_CONSISTENCY_CHECK_ID,
  INPS_OBSERVED_CALCULATION_CONSISTENCY_CHECK_VERSION,
  inpsObservedCalculationConsistencyCheck,
} from './checks/inpsObservedCalculationConsistencyCheck';
import type {
  PayrollValidationCategory,
  PayrollValidationCheck,
} from './types';

export enum PayrollValidationRegistryStatus {
  STABLE = 'STABLE',
  EXPERIMENTAL = 'EXPERIMENTAL',
  DISABLED = 'DISABLED',
}

export interface PayrollValidationRegistryEntry {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly category: PayrollValidationCategory;
  readonly check: PayrollValidationCheck;
  readonly status: PayrollValidationRegistryStatus;
}

const PAYROLL_VALIDATION_REGISTRY: ReadonlyArray<PayrollValidationRegistryEntry> =
  Object.freeze([
    Object.freeze({
      id: NET_PAY_CONSISTENCY_CHECK_ID,
      name: netPayConsistencyCheck.title,
      version: NET_PAY_CONSISTENCY_CHECK_VERSION,
      category: netPayConsistencyCheck.category,
      check: netPayConsistencyCheck,
      status: PayrollValidationRegistryStatus.STABLE,
    }),
    Object.freeze({
      id: SUMMARY_CONSISTENCY_CHECK_ID,
      name: summaryConsistencyCheck.title,
      version: SUMMARY_CONSISTENCY_CHECK_VERSION,
      category: summaryConsistencyCheck.category,
      check: summaryConsistencyCheck,
      status: PayrollValidationRegistryStatus.EXPERIMENTAL,
    }),
    Object.freeze({
      id: INPS_OBSERVATION_QUALITY_CHECK_ID,
      name: inpsObservationQualityCheck.title,
      version: INPS_OBSERVATION_QUALITY_CHECK_VERSION,
      category: inpsObservationQualityCheck.category,
      check: inpsObservationQualityCheck,
      status: PayrollValidationRegistryStatus.STABLE,
    }),
    Object.freeze({
      id: INPS_TAXABLE_STRUCTURAL_CONSISTENCY_CHECK_ID,
      name: inpsTaxableStructuralConsistencyCheck.title,
      version: INPS_TAXABLE_STRUCTURAL_CONSISTENCY_CHECK_VERSION,
      category: inpsTaxableStructuralConsistencyCheck.category,
      check: inpsTaxableStructuralConsistencyCheck,
      status: PayrollValidationRegistryStatus.EXPERIMENTAL,
    }),
    Object.freeze({
      id: INPS_TAXABLE_RULE_AVAILABILITY_CHECK_ID,
      name: inpsTaxableRuleAvailabilityCheck.title,
      version: INPS_TAXABLE_RULE_AVAILABILITY_CHECK_VERSION,
      category: inpsTaxableRuleAvailabilityCheck.category,
      check: inpsTaxableRuleAvailabilityCheck,
      status: PayrollValidationRegistryStatus.EXPERIMENTAL,
    }),
    Object.freeze({
      id: INPS_OBSERVED_CALCULATION_CONSISTENCY_CHECK_ID,
      name: inpsObservedCalculationConsistencyCheck.title,
      version: INPS_OBSERVED_CALCULATION_CONSISTENCY_CHECK_VERSION,
      category: inpsObservedCalculationConsistencyCheck.category,
      check: inpsObservedCalculationConsistencyCheck,
      status: PayrollValidationRegistryStatus.EXPERIMENTAL,
    }),
  ]);

const readonlySelection = (
  predicate: (entry: PayrollValidationRegistryEntry) => boolean
): ReadonlyArray<PayrollValidationRegistryEntry> =>
  Object.freeze(PAYROLL_VALIDATION_REGISTRY.filter(predicate));

export const getAllChecks = (): ReadonlyArray<PayrollValidationRegistryEntry> =>
  PAYROLL_VALIDATION_REGISTRY;

export const getChecksByStatus = (
  status: PayrollValidationRegistryStatus
): ReadonlyArray<PayrollValidationRegistryEntry> =>
  readonlySelection((entry) => entry.status === status);

export const getChecksByCategory = (
  category: PayrollValidationCategory
): ReadonlyArray<PayrollValidationRegistryEntry> =>
  readonlySelection((entry) => entry.category === category);

export const getStableChecks = (): ReadonlyArray<PayrollValidationRegistryEntry> =>
  getChecksByStatus(PayrollValidationRegistryStatus.STABLE);
