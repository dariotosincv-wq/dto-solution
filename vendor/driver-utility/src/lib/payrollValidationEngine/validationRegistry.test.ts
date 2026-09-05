import { describe, expect, it } from 'vitest';
import {
  NET_PAY_CONSISTENCY_CHECK_ID,
  netPayConsistencyCheck,
} from './checks/netPayConsistencyCheck';
import {
  SUMMARY_CONSISTENCY_CHECK_ID,
  summaryConsistencyCheck,
} from './checks/summaryConsistencyCheck';
import {
  INPS_OBSERVATION_QUALITY_CHECK_ID,
  inpsObservationQualityCheck,
} from './checks/inpsObservationQualityCheck';
import {
  INPS_TAXABLE_STRUCTURAL_CONSISTENCY_CHECK_ID,
  inpsTaxableStructuralConsistencyCheck,
} from './checks/inpsTaxableStructuralConsistencyCheck';
import {
  INPS_TAXABLE_RULE_AVAILABILITY_CHECK_ID,
  inpsTaxableRuleAvailabilityCheck,
} from './checks/inpsTaxableRuleAvailabilityCheck';
import {
  INPS_OBSERVED_CALCULATION_CONSISTENCY_CHECK_ID,
  inpsObservedCalculationConsistencyCheck,
} from './checks/inpsObservedCalculationConsistencyCheck';
import {
  getAllChecks,
  getChecksByCategory,
  getChecksByStatus,
  getStableChecks,
  PayrollValidationRegistryStatus,
} from './validationRegistry';

describe('Payroll Validation Registry', () => {
  it('contiene esclusivamente i sei controlli ufficiali', () => {
    const entries = getAllChecks();

    expect(entries).toHaveLength(6);
    expect(entries.map((entry) => entry.id)).toEqual([
      NET_PAY_CONSISTENCY_CHECK_ID,
      SUMMARY_CONSISTENCY_CHECK_ID,
      INPS_OBSERVATION_QUALITY_CHECK_ID,
      INPS_TAXABLE_STRUCTURAL_CONSISTENCY_CHECK_ID,
      INPS_TAXABLE_RULE_AVAILABILITY_CHECK_ID,
      INPS_OBSERVED_CALCULATION_CONSISTENCY_CHECK_ID,
    ]);
  });

  it('registra net-pay come STABLE con il riferimento al controllo ufficiale', () => {
    expect(getAllChecks()[0]).toEqual({
      id: 'economic.net-pay-consistency',
      name: 'Coerenza del netto',
      version: '1.0.0',
      category: 'ECONOMIC',
      check: netPayConsistencyCheck,
      status: PayrollValidationRegistryStatus.STABLE,
    });
  });

  it('registra summary-consistency come EXPERIMENTAL', () => {
    expect(getAllChecks()[1]).toEqual({
      id: 'economic.summary-consistency',
      name: 'Coerenza del riepilogo economico',
      version: '1.0.0',
      category: 'ECONOMIC',
      check: summaryConsistencyCheck,
      status: PayrollValidationRegistryStatus.EXPERIMENTAL,
    });
  });

  it('registra inps-observation-quality come STABLE dopo i controlli economici', () => {
    expect(getAllChecks()[2]).toEqual({
      id: 'fiscal.inps-observation-quality',
      name: 'Qualità dell’imponibile previdenziale INPS osservato',
      version: '1.0.0',
      category: 'FISCAL',
      check: inpsObservationQualityCheck,
      status: PayrollValidationRegistryStatus.STABLE,
    });
  });

  it('registra inps-taxable-structural-consistency come EXPERIMENTAL', () => {
    expect(getAllChecks()[3]).toEqual({
      id: 'fiscal.inps-taxable-structural-consistency',
      name: 'Coerenza strutturale dell\u2019imponibile previdenziale INPS',
      version: '1.0.0',
      category: 'FISCAL',
      check: inpsTaxableStructuralConsistencyCheck,
      status: PayrollValidationRegistryStatus.EXPERIMENTAL,
    });
  });

  it('registra inps-taxable-rule-availability come EXPERIMENTAL', () => {
    expect(getAllChecks()[4]).toEqual({
      id: INPS_TAXABLE_RULE_AVAILABILITY_CHECK_ID,
      name: 'Disponibilita regola imponibile previdenziale INPS',
      version: '1.0.0',
      category: 'FISCAL',
      check: inpsTaxableRuleAvailabilityCheck,
      status: PayrollValidationRegistryStatus.EXPERIMENTAL,
    });
  });

  it('registra inps-observed-calculation-consistency come EXPERIMENTAL', () => {
    expect(getAllChecks()[5]).toEqual({
      id: INPS_OBSERVED_CALCULATION_CONSISTENCY_CHECK_ID,
      name: 'Coerenza matematica dei contributi INPS osservati',
      version: '1.0.0',
      category: 'FISCAL',
      check: inpsObservedCalculationConsistencyCheck,
      status: PayrollValidationRegistryStatus.EXPERIMENTAL,
    });
  });

  it('filtra per categoria mantenendo l’ordine dichiarato', () => {
    expect(getChecksByCategory('ECONOMIC').map((entry) => entry.id)).toEqual([
      NET_PAY_CONSISTENCY_CHECK_ID,
      SUMMARY_CONSISTENCY_CHECK_ID,
    ]);
    expect(getChecksByCategory('TAX')).toEqual([]);
    expect(getChecksByCategory('FISCAL').map((entry) => entry.id)).toEqual([
      INPS_OBSERVATION_QUALITY_CHECK_ID,
      INPS_TAXABLE_STRUCTURAL_CONSISTENCY_CHECK_ID,
      INPS_TAXABLE_RULE_AVAILABILITY_CHECK_ID,
      INPS_OBSERVED_CALCULATION_CONSISTENCY_CHECK_ID,
    ]);
  });

  it('filtra per ogni stato senza includere controlli di altri stati', () => {
    expect(
      getChecksByStatus(PayrollValidationRegistryStatus.STABLE).map((entry) => entry.id)
    ).toEqual([
      NET_PAY_CONSISTENCY_CHECK_ID,
      INPS_OBSERVATION_QUALITY_CHECK_ID,
    ]);
    expect(
      getChecksByStatus(PayrollValidationRegistryStatus.EXPERIMENTAL)
        .map((entry) => entry.id)
    ).toEqual([
      SUMMARY_CONSISTENCY_CHECK_ID,
      INPS_TAXABLE_STRUCTURAL_CONSISTENCY_CHECK_ID,
      INPS_TAXABLE_RULE_AVAILABILITY_CHECK_ID,
      INPS_OBSERVED_CALCULATION_CONSISTENCY_CHECK_ID,
    ]);
    expect(getChecksByStatus(PayrollValidationRegistryStatus.DISABLED)).toEqual([]);
  });

  it('getStableChecks espone soltanto il controllo stabile', () => {
    expect(getStableChecks()).toEqual([
      getAllChecks()[0],
      getAllChecks()[2],
    ]);
  });

  it('mantiene un ordine deterministico tra chiamate senza ordinamento automatico', () => {
    const first = getAllChecks().map((entry) => entry.id);
    const second = getAllChecks().map((entry) => entry.id);

    expect(second).toEqual(first);
    expect(getAllChecks()[0].check).toBe(netPayConsistencyCheck);
    expect(getAllChecks()[1].check).toBe(summaryConsistencyCheck);
    expect(getAllChecks()[2].check).toBe(inpsObservationQualityCheck);
    expect(getAllChecks()[3].check).toBe(inpsTaxableStructuralConsistencyCheck);
    expect(getAllChecks()[4].check).toBe(inpsTaxableRuleAvailabilityCheck);
    expect(getAllChecks()[5].check).toBe(inpsObservedCalculationConsistencyCheck);
  });

  it('non contiene id duplicati', () => {
    const ids = getAllChecks().map((entry) => entry.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('protegge a runtime il registro, le voci e le selezioni', () => {
    const all = getAllChecks();
    const stable = getStableChecks();

    expect(Object.isFrozen(all)).toBe(true);
    expect(all.every((entry) => Object.isFrozen(entry))).toBe(true);
    expect(Object.isFrozen(stable)).toBe(true);
    expect(() => {
      (all as unknown as Array<unknown>).push({});
    }).toThrow();
    expect(() => {
      (all[0] as unknown as { status: string }).status = 'DISABLED';
    }).toThrow();
  });

  it('è serializzabile in JSON senza eseguire i controlli', () => {
    const restored = JSON.parse(JSON.stringify(getAllChecks()));

    expect(restored).toHaveLength(6);
    expect(restored).toMatchObject([
      {
        id: NET_PAY_CONSISTENCY_CHECK_ID,
        version: '1.0.0',
        status: 'STABLE',
        check: {
          id: NET_PAY_CONSISTENCY_CHECK_ID,
          version: '1.0.0',
          category: 'ECONOMIC',
        },
      },
      {
        id: SUMMARY_CONSISTENCY_CHECK_ID,
        version: '1.0.0',
        status: 'EXPERIMENTAL',
        check: {
          id: SUMMARY_CONSISTENCY_CHECK_ID,
          version: '1.0.0',
          category: 'ECONOMIC',
        },
      },
      {
        id: INPS_OBSERVATION_QUALITY_CHECK_ID,
        version: '1.0.0',
        status: 'STABLE',
        check: {
          id: INPS_OBSERVATION_QUALITY_CHECK_ID,
          version: '1.0.0',
          category: 'FISCAL',
        },
      },
      {
        id: INPS_TAXABLE_STRUCTURAL_CONSISTENCY_CHECK_ID,
        version: '1.0.0',
        status: 'EXPERIMENTAL',
        check: {
          id: INPS_TAXABLE_STRUCTURAL_CONSISTENCY_CHECK_ID,
          version: '1.0.0',
          category: 'FISCAL',
        },
      },
      {
        id: INPS_TAXABLE_RULE_AVAILABILITY_CHECK_ID,
        version: '1.0.0',
        status: 'EXPERIMENTAL',
        check: {
          id: INPS_TAXABLE_RULE_AVAILABILITY_CHECK_ID,
          version: '1.0.0',
          category: 'FISCAL',
        },
      },
      {
        id: INPS_OBSERVED_CALCULATION_CONSISTENCY_CHECK_ID,
        version: '1.0.0',
        status: 'EXPERIMENTAL',
        check: {
          id: INPS_OBSERVED_CALCULATION_CONSISTENCY_CHECK_ID,
          version: '1.0.0',
          category: 'FISCAL',
        },
      },
    ]);
  });
});
