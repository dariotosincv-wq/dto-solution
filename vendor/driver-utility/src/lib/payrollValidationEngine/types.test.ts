import { describe, expect, it } from 'vitest';
import type {
  PayrollObservedFiscalObservations,
  PayrollValidationCheck,
  PayrollValidationContext,
  PayrollValidationResult,
} from './types';
import { PAYROLL_VALIDATION_CATEGORIES } from './types';

const executedAt = '2026-07-31T10:00:00.000Z';

describe('Payroll Validation Engine domain contracts', () => {
  it('espone FISCAL come categoria ufficiale senza modificare TAX', () => {
    expect(PAYROLL_VALIDATION_CATEGORIES.FISCAL).toBe('FISCAL');
    expect(PAYROLL_VALIDATION_CATEGORIES.TAX).toBe('TAX');
  });

  it('rappresenta osservazioni fiscali complete e JSON serializzabili', () => {
    const fiscalObservations: PayrollObservedFiscalObservations = {
      schemaVersion: 'fiscal-v1',
      period: { year: 2025, month: 9 },
      values: [
        {
          canonicalField: 'incomeTax.taxWithheld',
          value: 152.92,
          unit: 'UNSPECIFIED',
          classificationStatus: 'CLASSIFIED',
          fiscalPeriod: 'monthly',
          source: 'fiscal_section',
          confidence: 98,
          ambiguous: false,
          rawText: 'TRATTENUTE IRPEF 152,92',
          page: 1,
          section: 'FISCALE_IRPEF',
          extractionMethod: 'geometric_column',
          alternatives: [],
          provenance: [
            {
              id: 'fiscal-income-tax',
              source: 'PAYROLL',
              description: 'Trattenute IRPEF osservate',
              confidence: 98,
            },
          ],
        },
      ],
      warnings: [],
    };
    const restored = JSON.parse(JSON.stringify(fiscalObservations));

    expect(restored).toEqual(fiscalObservations);
    expect(restored.values[0]).toMatchObject({
      canonicalField: 'incomeTax.taxWithheld',
      fiscalPeriod: 'monthly',
      source: 'fiscal_section',
      confidence: 98,
    });
  });

  it.each(['EUR', 'PERCENT_POINTS', 'FRACTION', 'UNSPECIFIED'] as const)(
    'rappresenta e serializza l unita fiscale osservata %s',
    (unit) => {
      const value: PayrollObservedFiscalObservations = {
        schemaVersion: 'fiscal-v1',
        values: [
          {
            canonicalField: 'fixture.unit',
            value: 9.19,
            unit,
            classificationStatus: 'CLASSIFIED',
            fiscalPeriod: 'monthly',
            source: 'fiscal_section',
            confidence: 100,
            extractionMethod: 'label_catalog',
            provenance: [],
          },
        ],
        warnings: [],
      };

      expect(JSON.parse(JSON.stringify(value))).toEqual(value);
    }
  );

  it('rappresenta un risultato PASS completo', () => {
    const result: PayrollValidationResult = {
      id: 'travel-days',
      checkVersion: '1.0.0',
      title: 'Trasferte',
      category: 'TRAVEL_ALLOWANCE',
      status: 'PASS',
      expectedValue: { kind: 'NUMBER', value: 12, unit: 'DAYS' },
      actualValue: { kind: 'NUMBER', value: 12, unit: 'DAYS' },
      difference: { kind: 'NUMBER', value: 0, unit: 'DAYS' },
      tolerance: { kind: 'NUMBER', value: 0, unit: 'DAYS' },
      shortExplanation: 'Tutte le trasferte risultano pagate.',
      detailedExplanation: 'Le 12 giornate eleggibili coincidono con le 12 trasferte rilevate.',
      confidence: 98,
      suggestion: 'Nessuna azione necessaria.',
      evidence: [
        {
          id: 'work-travel-days',
          source: 'WORK_SHIFTS',
          description: 'Giornate eleggibili dai turni',
          value: { kind: 'NUMBER', value: 12, unit: 'DAYS' },
          period: { year: 2025, month: 9 },
          confidence: 98,
        },
      ],
      missingInputs: [],
      ruleSource: {
        id: 'travel-rule',
        version: '2025.1',
        sourceType: 'COMPANY_PROFILE',
        status: 'CONFIRMED',
        validFrom: '2025-01-01',
        confidence: 100,
      },
      executedAt,
      metadata: { formula: 'eligibleTravelDays = paidTravelDays' },
    };

    expect(result.status).toBe('PASS');
    expect(result.expectedValue).toEqual({ kind: 'NUMBER', value: 12, unit: 'DAYS' });
    expect(result.evidence).toHaveLength(1);
  });

  it('rappresenta INFO con un valore non determinabile e missingInputs espliciti', () => {
    const result: PayrollValidationResult = {
      id: 'overtime-hours',
      checkVersion: '1.0.0',
      title: 'Ore straordinarie',
      category: 'WORKING_TIME',
      status: 'INFO',
      expectedValue: {
        kind: 'UNAVAILABLE',
        reason: 'NOT_DETERMINABLE',
        description: 'Ore autorizzate non disponibili.',
      },
      shortExplanation: 'Il controllo non può essere completato.',
      detailedExplanation: 'Mancano le ore di straordinario autorizzate per il periodo.',
      confidence: 20,
      evidence: [],
      missingInputs: [
        {
          id: 'authorized-overtime-hours',
          description: 'Ore di straordinario autorizzate',
          required: true,
          effect: 'BLOCKS_CHECK',
        },
      ],
      executedAt,
    };

    expect(result.status).toBe('INFO');
    expect(result.missingInputs[0].effect).toBe('BLOCKS_CHECK');
  });

  it('accetta un Validation Context parziale', () => {
    const context: PayrollValidationContext = {
      work: {
        period: { year: 2025, month: 9 },
        workedDays: 18,
        incompleteEventCount: 0,
        confidence: 90,
        provenance: [],
      },
    };

    expect(context.payroll).toBeUndefined();
    expect(context.work?.workedDays).toBe(18);
  });

  it('permette a un controllo di esempio di ricevere il contesto readonly e restituire il contratto standard', async () => {
    const check: PayrollValidationCheck = {
      id: 'fixture-worked-days',
      version: '1.0.0',
      title: 'Giorni lavorati',
      category: 'PRESENCE',
      requiredInputs: [{ id: 'work.workedDays', description: 'Giorni dai turni' }],
      optionalInputs: [],
      applicability: {
        description: 'Applicabile quando sono disponibili i turni.',
        evaluate: (context) => context.work !== undefined,
      },
      execute: (context) => ({
        id: 'fixture-worked-days',
        checkVersion: '1.0.0',
        title: 'Giorni lavorati',
        category: 'PRESENCE',
        status: context.work?.workedDays === undefined ? 'INFO' : 'PASS',
        actualValue: context.work?.workedDays === undefined
          ? { kind: 'UNAVAILABLE', reason: 'MISSING' }
          : { kind: 'NUMBER', value: context.work.workedDays, unit: 'DAYS' },
        shortExplanation: 'Controllo fixture completato.',
        detailedExplanation: 'Controllo usato esclusivamente per certificare il contratto.',
        confidence: context.work?.confidence ?? 0,
        evidence: context.work?.provenance ?? [],
        missingInputs: [],
        executedAt,
      }),
    };
    const context: PayrollValidationContext = {
      work: {
        period: { year: 2025, month: 9 },
        workedDays: 18,
        incompleteEventCount: 0,
        confidence: 90,
        provenance: [],
      },
    };

    expect(check.applicability.evaluate(context)).toBe(true);
    await expect(Promise.resolve(check.execute(context))).resolves.toMatchObject({
      id: 'fixture-worked-days',
      status: 'PASS',
    });
  });

  it('descrive il cedolino tramite canonical key senza campi tecnici Logistics V1', () => {
    const context: PayrollValidationContext = {
      payroll: {
        period: { year: 2025, month: 9 },
        lines: [
          {
            canonicalKey: 'payroll.travel_allowance',
            description: 'Trasferta',
            quantity: 12,
            quantityUnit: 'DAYS',
            unitValue: 20.5,
            earningAmount: 246,
            confidence: 96,
            provenance: [],
          },
        ],
        economicSummary: {
          totalEarnings: 2194.51,
          totalDeductions: 382.44,
          netAmount: 1812.07,
        },
        confidence: 96,
        provenance: [],
      },
    };
    const serialized = JSON.stringify(context);

    expect(serialized).toContain('payroll.travel_allowance');
    expect(serialized).not.toContain('logisticsLayoutV1');
    expect(serialized).not.toContain('parserUsed');
    expect(serialized).not.toContain('sourceGeometry');
  });

  it('mantiene i dati fondamentali dopo serializzazione JSON', () => {
    const result: PayrollValidationResult = {
      id: 'travel-rate',
      checkVersion: '1.0.0',
      title: 'Valore trasferta',
      category: 'TRAVEL_ALLOWANCE',
      status: 'WARNING',
      expectedValue: { kind: 'NUMBER', value: 20.5, unit: 'EUR' },
      actualValue: { kind: 'NUMBER', value: 18, unit: 'EUR' },
      difference: { kind: 'NUMBER', value: 2.5, unit: 'EUR' },
      shortExplanation: 'Il valore della trasferta è da verificare.',
      detailedExplanation: 'La tariffa rilevata è inferiore a quella prevista.',
      confidence: 85,
      suggestion: 'Verificare la tariffa applicata.',
      evidence: [],
      missingInputs: [],
      executedAt,
    };
    const restored = JSON.parse(JSON.stringify(result)) as PayrollValidationResult;

    expect(restored).toMatchObject({
      id: 'travel-rate',
      checkVersion: '1.0.0',
      status: 'WARNING',
      confidence: 85,
    });
    expect(restored.expectedValue).toEqual({ kind: 'NUMBER', value: 20.5, unit: 'EUR' });
    expect(restored.actualValue).toEqual({ kind: 'NUMBER', value: 18, unit: 'EUR' });
  });
});
