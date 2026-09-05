import type {
  PayrollValidationRunResult,
  PayrollValidationStatus,
  PayrollValidationValue,
} from './types';
import type {
  DriverPayrollValidationIndicator,
  DriverPayrollValidationItem,
  DriverPayrollValidationOverallStatus,
  DriverPayrollValidationReadableValue,
  DriverPayrollValidationReport,
  DriverPayrollValidationUserStatus,
} from './driverValidationReportTypes';

const STATUS_MAPPING: Readonly<Record<PayrollValidationStatus, {
  readonly userStatus: DriverPayrollValidationUserStatus;
  readonly indicator: DriverPayrollValidationIndicator;
}>> = Object.freeze({
  PASS: Object.freeze({ userStatus: 'CORRECT', indicator: 'GREEN' }),
  WARNING: Object.freeze({ userStatus: 'CHECK', indicator: 'YELLOW' }),
  FAIL: Object.freeze({ userStatus: 'PROBLEM', indicator: 'RED' }),
  INFO: Object.freeze({ userStatus: 'INFORMATION', indicator: 'BLUE' }),
});

const deepClone = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map(deepClone) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, deepClone(item)])
    ) as T;
  }
  return value;
};

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

const decimal = (value: number, digits = 2): string => {
  const normalized = Object.is(value, -0) ? 0 : value;
  return normalized.toFixed(digits).replace('.', ',');
};

export const formatPayrollValidationValueForDriver = (
  value: Readonly<PayrollValidationValue> | undefined
): DriverPayrollValidationReadableValue | undefined => {
  if (!value) return undefined;
  if (value.kind === 'TEXT') return { text: value.value };
  if (value.kind === 'BOOLEAN') return { text: value.value ? 'Sì' : 'No' };
  if (value.kind === 'UNAVAILABLE') {
    return {
      text: value.description ?? (
        value.reason === 'NOT_APPLICABLE'
          ? 'Dato non applicabile'
          : value.reason === 'NOT_DETERMINABLE'
            ? 'Dato non determinabile'
            : 'Dato non disponibile'
      ),
    };
  }

  switch (value.unit) {
    case 'EUR':
      return { text: `€ ${decimal(value.value)}`, unit: 'euro' };
    case 'HOURS':
      return { text: `${decimal(value.value)} ore`, unit: 'ore' };
    case 'DAYS':
      return { text: `${decimal(value.value)} giorni`, unit: 'giorni' };
    case 'PERCENT':
      return { text: `${decimal(value.value)}%`, unit: 'percentuale' };
    case 'QUANTITY':
      return { text: decimal(value.value), unit: 'quantità' };
  }
};

const overallStatus = (
  counts: Readonly<Record<PayrollValidationStatus, number>>,
  internalErrors: number
): DriverPayrollValidationOverallStatus => {
  if (counts.FAIL > 0) return 'ISSUE';
  if (counts.WARNING > 0) return 'ATTENTION';
  if (internalErrors > 0 || counts.INFO > 0 || counts.PASS === 0) return 'INCOMPLETE';
  return 'OK';
};

const overallMessage = (status: DriverPayrollValidationOverallStatus): string => {
  switch (status) {
    case 'OK': return 'I controlli completati non hanno rilevato problemi.';
    case 'ATTENTION': return 'Uno o più dati richiedono una verifica.';
    case 'ISSUE': return 'Uno o più controlli hanno rilevato una differenza da verificare.';
    case 'INCOMPLETE': return 'Mancano informazioni o controlli completati per una valutazione completa.';
  }
};

const defaultSuggestion = (status: PayrollValidationStatus): string => {
  switch (status) {
    case 'PASS': return 'Non sono necessarie azioni per questo controllo.';
    case 'WARNING': return 'Controlla il dato nel cedolino o chiedi chiarimenti all’ufficio paghe.';
    case 'FAIL': return 'Verifica il cedolino e chiedi chiarimenti all’ufficio paghe.';
    case 'INFO': return 'Fornisci le informazioni mancanti per completare il controllo.';
  }
};

export const mapPayrollValidationRunToDriverReport = (
  runResult: Readonly<PayrollValidationRunResult>
): DriverPayrollValidationReport => {
  const counts: Record<PayrollValidationStatus, number> = {
    PASS: 0,
    WARNING: 0,
    FAIL: 0,
    INFO: 0,
  };
  runResult.results.forEach((result) => { counts[result.status] += 1; });
  const status = overallStatus(counts, runResult.internalErrors.length);

  const items: DriverPayrollValidationItem[] = runResult.results.map((result) => ({
    title: result.title,
    ...STATUS_MAPPING[result.status],
    checked: result.title,
    expected: formatPayrollValidationValueForDriver(result.expectedValue),
    actual: formatPayrollValidationValueForDriver(result.actualValue),
    difference: formatPayrollValidationValueForDriver(result.difference),
    tolerance: formatPayrollValidationValueForDriver(result.tolerance),
    shortExplanation: result.shortExplanation,
    detailedExplanation: result.detailedExplanation,
    suggestion: result.suggestion ?? defaultSuggestion(result.status),
    missingInformation: result.missingInputs.map((input) => input.description),
  }));

  const report: DriverPayrollValidationReport = {
    summary: {
      totalResults: runResult.results.length,
      correctCount: counts.PASS,
      checkCount: counts.WARNING,
      problemCount: counts.FAIL,
      informationCount: counts.INFO,
      technicalProblemCount: runResult.internalErrors.length,
      overallStatus: status,
      message: overallMessage(status),
    },
    items,
    technicalProblems: runResult.internalErrors.map(() => ({
      message: 'Un controllo tecnico non è stato completato.',
    })),
    technical: {
      runExecutedAt: runResult.executedAt,
      executedChecks: runResult.executedChecks,
      skippedChecks: runResult.skippedChecks,
      internalErrors: deepClone(runResult.internalErrors),
      items: runResult.results.map((result) => ({
        checkId: result.id,
        version: result.checkVersion,
        category: result.category,
        confidence: result.confidence,
        evidence: deepClone(result.evidence),
        missingInputs: deepClone(result.missingInputs),
        ruleSource: deepClone(result.ruleSource),
        expected: deepClone(result.expectedValue),
        actual: deepClone(result.actualValue),
        difference: deepClone(result.difference),
        tolerance: deepClone(result.tolerance),
        executedAt: result.executedAt,
        metadata: deepClone(result.metadata),
      })),
    },
  };

  return deepFreeze(report);
};
