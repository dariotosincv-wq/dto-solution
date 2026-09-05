import type {
  PayrollObservedFiscalObservations,
  PayrollObservedFiscalUnit,
  PayrollObservedFiscalValue,
} from './types';

export const FISCAL_OBSERVATION_MIN_CONFIDENCE = 70;

const fiscalUnits = (...values: PayrollObservedFiscalUnit[]): ReadonlyArray<PayrollObservedFiscalUnit> =>
  Object.freeze(values);

const EXPECTED_UNITS: Readonly<Record<string, ReadonlyArray<PayrollObservedFiscalUnit>>> =
  Object.freeze({
    'socialSecurity.taxable': fiscalUnits('EUR'),
    'socialSecurity.contributionRate': fiscalUnits('PERCENT_POINTS', 'FRACTION'),
    'socialSecurity.employeeContributions': fiscalUnits('EUR'),
  });

interface FiscalObservationSelectionBase {
  readonly canonicalField: string;
  readonly candidates: ReadonlyArray<Readonly<PayrollObservedFiscalValue>>;
}

interface FiscalObservationSingleSelection extends FiscalObservationSelectionBase {
  readonly observation: Readonly<PayrollObservedFiscalValue>;
}

export type FiscalObservationSelectionResult =
  | (FiscalObservationSingleSelection & { readonly status: 'SELECTED' })
  | (FiscalObservationSelectionBase & { readonly status: 'MISSING' })
  | (FiscalObservationSingleSelection & { readonly status: 'AMBIGUOUS' })
  | (FiscalObservationSelectionBase & { readonly status: 'MULTIPLE_CANDIDATES' })
  | (FiscalObservationSingleSelection & { readonly status: 'LOW_CONFIDENCE' })
  | (FiscalObservationSingleSelection & { readonly status: 'PERIOD_MISMATCH' })
  | (FiscalObservationSingleSelection & {
      readonly status: 'INVALID_UNIT';
      readonly expectedUnits: ReadonlyArray<PayrollObservedFiscalUnit>;
    });

export const selectFiscalObservation = (
  fiscalObservations: Readonly<PayrollObservedFiscalObservations> | undefined,
  canonicalField: string
): FiscalObservationSelectionResult => {
  const candidates = Object.freeze(
    (fiscalObservations?.values ?? []).filter(
      (observation) => observation.canonicalField === canonicalField
    )
  );
  const base = { canonicalField, candidates };

  if (candidates.length === 0) return Object.freeze({ ...base, status: 'MISSING' });

  const monthlyCandidates = candidates.filter(
    (observation) => observation.fiscalPeriod === 'monthly'
  );
  const distinguishableCandidates = monthlyCandidates.length === 1
    ? monthlyCandidates
    : candidates;
  if (distinguishableCandidates.length > 1) {
    return Object.freeze({ ...base, status: 'MULTIPLE_CANDIDATES' });
  }

  const observation = distinguishableCandidates[0];
  const single = { ...base, observation };
  if (observation.ambiguous === true) {
    return Object.freeze({ ...single, status: 'AMBIGUOUS' });
  }
  if (observation.confidence < FISCAL_OBSERVATION_MIN_CONFIDENCE) {
    return Object.freeze({ ...single, status: 'LOW_CONFIDENCE' });
  }
  if (observation.fiscalPeriod !== 'monthly') {
    return Object.freeze({ ...single, status: 'PERIOD_MISMATCH' });
  }

  const expectedUnits = EXPECTED_UNITS[canonicalField];
  if (expectedUnits && !expectedUnits.includes(observation.unit)) {
    return Object.freeze({
      ...single,
      status: 'INVALID_UNIT',
      expectedUnits,
    });
  }

  return Object.freeze({ ...single, status: 'SELECTED' });
};
