import { describe, expect, it } from 'vitest';
import {
  explainDriverPayrollComparison,
  getDefaultDriverPayrollExplanationRules,
  type DriverPayrollExplanationRule,
} from './driverPayrollRuleExplanationEngine';
import type { DriverPayrollComparisonResult } from './driverPayrollComparison';

const makeComparison = (overrides: Partial<DriverPayrollComparisonResult> = {}): DriverPayrollComparisonResult => ({
  year: 2026,
  month: 1,
  label: 'Gennaio 2026',
  source: {
    year: 2026,
    month: 1,
    predicted: { travelDays: 10, netAmount: 1800 },
    actual: { travelDays: 17, netAmount: 1700 },
  },
  rows: [
    {
      key: 'travelDays',
      label: 'Trasferte',
      predicted: 10,
      actual: 17,
      difference: 7,
      severity: 'large',
      explanationSeeds: [
        {
          kind: 'travel_allowance',
          label: 'Trasferta diversa',
          ruleCategory: 'allowance',
          ccnlRuleCandidateIds: ['ccnl_travel_allowance'],
        },
      ],
    },
  ],
  ...overrides,
});

describe('driverPayrollRuleExplanationEngine', () => {
  it('carica regole esterne al motore con campi minimi richiesti', () => {
    const rules = getDefaultDriverPayrollExplanationRules();

    expect(rules.length).toBeGreaterThan(0);
    expect(rules[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        title: expect.any(String),
        description: expect.any(String),
        priority: expect.any(Number),
        confidence: expect.stringMatching(/Alta|Media|Bassa/),
        category: expect.any(String),
        conditions: expect.any(Object),
      })
    );
  });

  it('genera spiegazioni con confidence e candidati CCNL per differenze importanti', () => {
    const explanations = explainDriverPayrollComparison(makeComparison());

    expect(explanations[0]).toEqual(
      expect.objectContaining({
        title: 'Trasferta differente',
        confidence: 'Alta',
        metricKey: 'travelDays',
        difference: 7,
        ccnlRuleCandidateIds: ['ccnl_travel_allowance'],
      })
    );
  });

  it('non genera spiegazioni per differenze piccole o dati mancanti', () => {
    const explanations = explainDriverPayrollComparison(
      makeComparison({
        rows: [
          { key: 'netAmount', label: 'Netto', predicted: 1800, actual: 1798, difference: -2, severity: 'small', explanationSeeds: [] },
          { key: 'bonusAmount', label: 'Premi', severity: 'unavailable', explanationSeeds: [] },
        ],
      })
    );

    expect(explanations).toEqual([]);
  });

  it('permette nuove regole senza modificare il motore', () => {
    const rules: DriverPayrollExplanationRule[] = [
      {
        id: 'custom-company-line',
        title: 'Voce aziendale',
        description: 'Voce aziendale non prevista.',
        priority: 120,
        confidence: 'Media',
        category: 'bonus',
        conditions: {
          metricKeys: ['bonusAmount'],
          severities: ['large'],
        },
      },
    ];

    const explanations = explainDriverPayrollComparison(
      makeComparison({
        rows: [
          {
            key: 'bonusAmount',
            label: 'Premi',
            predicted: 0,
            actual: 200,
            difference: 200,
            severity: 'large',
            explanationSeeds: [],
          },
        ],
      }),
      rules
    );

    expect(explanations).toHaveLength(1);
    expect(explanations[0].title).toBe('Voce aziendale');
  });
});
