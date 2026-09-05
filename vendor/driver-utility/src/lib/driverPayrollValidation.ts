import type { PayslipImport, PayslipLine } from './driverPayrollTypes';
import type { PayslipFiscalData, PayrollFiscalValue } from './driverPayrollFiscalTypes';

export const PAYROLL_ECONOMIC_SELECTION_CRITERION =
  'logisticsLayoutV1: include importo quando interpretationMethod=logisticsLayoutV1_geometric_columns, sourceColumn coincide con earnings/deductions e la colonna opposta è vuota; confidence semantica non usata come veto; totali/imponibili/informativi restano esclusi';

export type PayrollValidationOverallStatus =
  | 'valid'
  | 'valid_with_warnings'
  | 'inconsistent'
  | 'insufficient_data';

export type PayrollValidationCheckStatus = 'passed' | 'warning' | 'failed' | 'skipped';
export type PayrollValidationCheckSeverity = 'info' | 'low' | 'medium' | 'high';
export type PayrollValidationCheckCategory =
  | 'summary'
  | 'earnings'
  | 'deductions'
  | 'line_calculation'
  | 'payment'
  | 'completeness'
  | 'social_security'
  | 'income_tax'
  | 'additional_tax'
  | 'tfr'
  | 'fiscal_completeness';

export interface PayrollValidationCheck {
  id: string;
  category: PayrollValidationCheckCategory;
  title: string;
  status: PayrollValidationCheckStatus;
  severity: PayrollValidationCheckSeverity;
  expectedValue?: number;
  actualValue?: number;
  difference?: number;
  tolerance?: number;
  confidence: number;
  explanation: string;
  sourceLineCodes?: string[];
  sourceCanonicalKeys?: string[];
  metadata?: Record<string, unknown>;
}

export interface PayrollValidationResult {
  overallStatus: PayrollValidationOverallStatus;
  confidence: number;
  checks: PayrollValidationCheck[];
  errors: string[];
  warnings: string[];
  informationalNotes: string[];
  summary: {
    passed: number;
    warnings: number;
    failed: number;
    skipped: number;
  };
}

export interface PayrollValidationOptions {
  rounding?: number;
  ordinaryTolerance?: number;
  warningTolerance?: number;
  minimumLineConfidence?: number;
  fiscalData?: PayslipFiscalData;
}

type IncludedLine = { line: PayslipLine; amount: number; index: number };
type ExcludedLine = { line: PayslipLine; index: number; reason: string };

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const abs = (value: number) => Math.abs(value);
const codeOf = (line: PayslipLine) => line.originalCode ?? line.code ?? 'senza codice';
const keyOf = (line: PayslipLine) => line.canonicalKey ?? line.classification ?? 'unknown';

const statusForDifference = (
  difference: number,
  ordinaryTolerance: number,
  warningTolerance: number
): Pick<PayrollValidationCheck, 'status' | 'severity'> => {
  const magnitude = abs(difference);
  if (magnitude <= ordinaryTolerance) return { status: 'passed', severity: 'info' };
  if (magnitude <= warningTolerance) return { status: 'warning', severity: 'medium' };
  return { status: 'failed', severity: 'high' };
};

const isTotalOrNonEconomic = (line: PayslipLine) => {
  const semantic = `${keyOf(line)} ${line.category ?? ''} ${line.label}`.toLowerCase();
  return (
    line.economicType === 'informational' ||
    line.economicType === 'neutral' ||
    line.category === 'employer_social_contribution' ||
    line.category === 'bilateral_body_employer_contribution' ||
    line.category === 'tax_credit' ||
    line.category === 'social_security_taxable' ||
    line.category === 'income_tax_taxable' ||
    line.category === 'tfr_taxable' ||
    /\b(totale|subtotale|imponibile|progressivo)\b/.test(semantic)
  );
};

const lineIdentity = (line: PayslipLine, amount: number) =>
  [codeOf(line), keyOf(line), line.label.trim().toLowerCase(), amount, line.quantity ?? '', line.unitValue ?? ''].join('|');

const selectEconomicLines = (
  payslip: PayslipImport,
  kind: 'earning' | 'deduction',
  minimumConfidence: number
): { included: IncludedLine[]; excluded: ExcludedLine[]; incomplete: boolean; unknownIncluded: number } => {
  const included: IncludedLine[] = [];
  const excluded: ExcludedLine[] = [];
  const seen = new Set<string>();
  let incomplete = false;
  let unknownIncluded = 0;

  payslip.parsedLines.forEach((line, index) => {
    const amount = kind === 'earning' ? line.earningAmount : line.deductionAmount;
    const opposite = kind === 'earning' ? line.deductionAmount : line.earningAmount;
    if (amount === undefined) return;

    const certifiedEconomicColumn =
      opposite === undefined &&
      line.geometricEconomicCertified === true &&
      line.sourceColumn === (kind === 'earning' ? 'earnings' : 'deductions');
    let reason: string | undefined;
    if (opposite !== undefined) reason = 'entrambe le colonne economiche sono valorizzate';
    else if (isTotalOrNonEconomic(line)) reason = 'totale, imponibile o voce non economica';
    else if (
      kind === 'earning' &&
      line.sourceColumn !== 'earnings' &&
      line.economicType !== 'earning'
    ) reason = 'provenienza della colonna competenze non certa';
    else if (
      kind === 'deduction' &&
      line.sourceColumn !== 'deductions' &&
      line.economicType !== 'deduction'
    ) reason = 'provenienza della colonna trattenute non certa';
    else if (!certifiedEconomicColumn && line.classificationAmbiguous) reason = 'classificazione ambigua';
    else if (!certifiedEconomicColumn && (line.confidence ?? 0) < minimumConfidence) reason = 'confidence insufficiente';

    const identity = lineIdentity(line, amount);
    if (!reason && seen.has(identity)) reason = 'possibile duplicato';

    if (reason) {
      excluded.push({ line, index, reason });
      incomplete = true;
      return;
    }

    seen.add(identity);
    included.push({ line, amount, index });
    if ((line.category ?? 'unknown') === 'unknown' || keyOf(line) === 'unknown') unknownIncluded += 1;
  });

  return { included, excluded, incomplete, unknownIncluded };
};

const economicSumCheck = (
  payslip: PayslipImport,
  kind: 'earning' | 'deduction',
  official: number | undefined,
  ordinaryTolerance: number,
  warningTolerance: number,
  minimumConfidence: number
): PayrollValidationCheck => {
  const selection = selectEconomicLines(payslip, kind, minimumConfidence);
  const title = kind === 'earning' ? 'Somma delle singole competenze' : 'Somma delle singole trattenute';
  const id = kind === 'earning' ? 'EARNINGS_LINES_SUM' : 'DEDUCTIONS_LINES_SUM';
  const metadata = {
    included: selection.included.map(({ line, index, amount }) => ({
      index,
      code: codeOf(line),
      canonicalKey: keyOf(line),
      description: line.label,
      amount,
      interpretationMethod: line.interpretationMethod,
      sourceColumn: line.sourceColumn,
      geometricEconomicCertified: line.geometricEconomicCertified,
      economicSelectionResult: 'included',
    })),
    excluded: selection.excluded.map(({ line, index, reason }) => ({
      index,
      code: codeOf(line),
      canonicalKey: keyOf(line),
      description: line.label,
      reason,
      interpretationMethod: line.interpretationMethod,
      sourceColumn: line.sourceColumn,
      geometricEconomicCertified: line.geometricEconomicCertified,
      economicSelectionResult: 'excluded',
      economicSelectionExclusionReason: reason,
    })),
    unknownIncluded: selection.unknownIncluded,
  };

  if (official === undefined) {
    return {
      id,
      category: kind === 'earning' ? 'earnings' : 'deductions',
      title,
      status: 'skipped',
      severity: 'medium',
      confidence: 20,
      explanation: `Controllo non eseguibile: totale ufficiale ${kind === 'earning' ? 'competenze' : 'trattenute'} assente.`,
      metadata,
    };
  }
  if (!selection.included.length) {
    return {
      id,
      category: kind === 'earning' ? 'earnings' : 'deductions',
      title,
      status: 'skipped',
      severity: 'low',
      actualValue: official,
      confidence: 30,
      explanation: 'Il riepilogo è disponibile, ma non ci sono righe dettagliate certificabili da sommare.',
      metadata,
    };
  }

  const expected = round2(selection.included.reduce((sum, item) => sum + item.amount, 0));
  const difference = round2(expected - official);
  const differenceStatus = statusForDifference(difference, ordinaryTolerance, warningTolerance);
  const uncertainCompleteness = selection.incomplete || selection.unknownIncluded > 0;
  const status =
    differenceStatus.status === 'failed' && uncertainCompleteness ? 'warning' : differenceStatus.status;
  const severity = status === 'warning' ? 'medium' : differenceStatus.severity;

  return {
    id,
    category: kind === 'earning' ? 'earnings' : 'deductions',
    title,
    status,
    severity,
    expectedValue: expected,
    actualValue: official,
    difference,
    tolerance: ordinaryTolerance,
    confidence: Math.max(35, 95 - selection.excluded.length * 10 - selection.unknownIncluded * 8),
    explanation:
      status === 'passed'
        ? 'La somma delle righe economiche certificate coincide con il totale ufficiale.'
        : uncertainCompleteness
          ? 'La somma differisce dal totale ufficiale, ma alcune righe sono escluse o non classificate: il dettaglio potrebbe essere incompleto.'
          : 'La somma delle righe economiche certificate differisce dal totale ufficiale.',
    sourceLineCodes: selection.included.map(({ line }) => codeOf(line)),
    sourceCanonicalKeys: selection.included.map(({ line }) => keyOf(line)),
    metadata,
  };
};

const reliableFiscalAmount = (value?: PayrollFiscalValue) =>
  value && !value.ambiguous && value.confidence >= 70 && typeof value.value === 'number'
    ? value.value
    : undefined;

const completeDeductionsCheck = (
  payslip: PayslipImport,
  fiscalData: PayslipFiscalData,
  official: number | undefined,
  ordinaryTolerance: number,
  warningTolerance: number,
  minimumConfidence: number
): PayrollValidationCheck => {
  const selection = selectEconomicLines(payslip, 'deduction', minimumConfidence);
  const lineKeys = new Set(selection.included.map(({ line }) => keyOf(line)));
  const components = selection.included.map(({ line, amount }) => ({
    source: 'payroll_line',
    code: codeOf(line),
    canonicalKey: keyOf(line),
    amount,
  }));
  const social = reliableFiscalAmount(fiscalData.socialSecurity.employeeContributions);
  const totalTax = reliableFiscalAmount(fiscalData.incomeTax.totalTaxWithheld);
  const ordinaryTax = reliableFiscalAmount(
    fiscalData.incomeTax.ordinaryTaxWithheld ??
    fiscalData.incomeTax.taxWithheld ??
    fiscalData.incomeTax.netTax
  );
  const supplementaryTax = reliableFiscalAmount(fiscalData.incomeTax.supplementaryTaxWithheld);
  const taxComponents = totalTax !== undefined
    ? [{ code: 'IRPEF_TOTALE', canonicalKey: 'fiscal.tax.withheld.total', amount: totalTax }]
    : [
        ...(ordinaryTax !== undefined
          ? [{ code: 'IRPEF_MO', canonicalKey: 'fiscal.tax.withheld.ordinary', amount: ordinaryTax }]
          : []),
        ...(supplementaryTax !== undefined
          ? [{ code: 'IRPEF_MS', canonicalKey: 'fiscal.tax.withheld.supplementary', amount: supplementaryTax }]
          : []),
      ];
  if (
    social !== undefined &&
    !lineKeys.has('payroll.social_contribution.employee')
  ) {
    components.push({ source: 'fiscal_section', code: 'INPS_MENSILE', canonicalKey: 'fiscal.social.employee', amount: social });
  }
  if (!lineKeys.has('payroll.tax.income')) {
    taxComponents.forEach((component) => {
      components.push({ source: 'fiscal_section', ...component });
    });
  }
  const metadata = {
    components,
    excluded: selection.excluded.map(({ line, reason }) => ({ code: codeOf(line), canonicalKey: keyOf(line), reason })),
    deduplication: 'canonical source: fiscal INPS and IRPEF total (or distinct M.O./M.S.) added only when the equivalent payLine is absent',
  };
  if (official === undefined || !components.length) {
    return {
      id: 'DEDUCTIONS_COMPLETE_RECONCILIATION',
      category: 'deductions',
      title: 'Riconciliazione completa delle trattenute',
      status: 'skipped',
      severity: 'low',
      actualValue: official,
      confidence: 25,
      explanation: 'Totale ufficiale o componenti mensili delle trattenute insufficienti.',
      metadata,
    };
  }
  const expected = round2(components.reduce((sum, item) => sum + item.amount, 0));
  const difference = round2(expected - official);
  const differenceStatus = statusForDifference(difference, ordinaryTolerance, warningTolerance);
  return {
    id: 'DEDUCTIONS_COMPLETE_RECONCILIATION',
    category: 'deductions',
    title: 'Riconciliazione completa delle trattenute',
    ...differenceStatus,
    expectedValue: expected,
    actualValue: official,
    difference,
    tolerance: ordinaryTolerance,
    confidence: selection.excluded.length ? 80 : 95,
    explanation: differenceStatus.status === 'passed'
      ? 'PayLines, contributi previdenziali mensili e ritenuta IRPEF riconciliano il totale ufficiale senza doppio conteggio.'
      : 'La riconciliazione completa differisce dal totale ufficiale; verificare componenti mancanti o ambigue.',
    sourceLineCodes: components.map((item) => item.code),
    sourceCanonicalKeys: components.map((item) => item.canonicalKey),
    metadata,
  };
};

const lineCalculationChecks = (
  payslip: PayslipImport,
  ordinaryTolerance: number,
  warningTolerance: number
): PayrollValidationCheck[] =>
  payslip.parsedLines.map((line, index): PayrollValidationCheck | undefined => {
    const amount = line.earningAmount ?? line.deductionAmount;
    const base = {
      id: `LINE_CALCULATION_${index + 1}`,
      category: 'line_calculation' as const,
      title: `Tariffa × quantità: ${codeOf(line)} ${line.label}`,
      sourceLineCodes: [codeOf(line)],
      sourceCanonicalKeys: [keyOf(line)],
      metadata: { index, calculationRule: line.calculationRule ?? 'unknown', description: line.label },
    };
    if (line.classificationAmbiguous) {
      return { ...base, status: 'skipped', severity: 'low', confidence: 20, explanation: 'Riga ambigua: formula non applicata.' };
    }
    if (line.calculationRule !== 'unit_times_quantity') {
      return {
        ...base,
        status: 'skipped',
        severity: 'info',
        confidence: 70,
        explanation: `Formula lineare non applicabile: regola ${line.calculationRule ?? 'unknown'}.`,
      };
    }
    if (line.quantityUnit === 'unknown' || line.unitValue === undefined || line.quantity === undefined || amount === undefined) {
      return { ...base, status: 'skipped', severity: 'low', confidence: 40, explanation: 'Tariffa, quantità, unità o importo insufficienti.' };
    }
    const expected = round2(line.unitValue * line.quantity);
    const difference = round2(expected - amount);
    const differenceStatus = statusForDifference(difference, ordinaryTolerance, warningTolerance);
    return {
      ...base,
      ...differenceStatus,
      expectedValue: expected,
      actualValue: amount,
      difference,
      tolerance: ordinaryTolerance,
      confidence: line.classificationConfidence ?? line.confidence ?? 70,
      explanation:
        differenceStatus.status === 'passed'
          ? 'Il prodotto tariffa × quantità è coerente con l’importo della riga.'
          : 'Il prodotto tariffa × quantità differisce dall’importo letto; verificare le regole di arrotondamento della voce.',
    };
  }).filter((check): check is PayrollValidationCheck => Boolean(check));

const completenessChecks = (payslip: PayslipImport): PayrollValidationCheck[] => {
  const checks: PayrollValidationCheck[] = [];
  const add = (
    id: string,
    title: string,
    present: boolean,
    severity: PayrollValidationCheckSeverity,
    missingExplanation: string
  ) => checks.push({
    id,
    category: id === 'PAYMENT_DATE_PRESENT' ? 'payment' : 'completeness',
    title,
    status: present ? 'passed' : severity === 'high' ? 'failed' : 'warning',
    severity: present ? 'info' : severity,
    confidence: present ? 100 : 95,
    explanation: present ? `${title}: dato disponibile.` : missingExplanation,
  });

  const earnings = payslip.summary.grossAmount ?? payslip.summary.totalEarnings;
  const hasAnySummaryValue =
    earnings !== undefined ||
    payslip.summary.totalDeductions !== undefined ||
    payslip.summary.netAmount !== undefined;
  add('FINAL_SUMMARY_PRESENT', 'Riepilogo finale disponibile', hasAnySummaryValue, 'high', 'Riepilogo finale non disponibile.');
  add('TOTAL_EARNINGS_PRESENT', 'Totale competenze disponibile', earnings !== undefined, 'high', 'Totale competenze ufficiale mancante.');
  add('TOTAL_DEDUCTIONS_PRESENT', 'Totale trattenute disponibile', payslip.summary.totalDeductions !== undefined, 'high', 'Totale trattenute ufficiale mancante.');
  add('NET_PRESENT', 'Netto disponibile', payslip.summary.netAmount !== undefined, 'high', 'Netto ufficiale mancante.');
  add('PAYMENT_DATE_PRESENT', 'Data pagamento disponibile', Boolean(payslip.summary.paymentDate), 'low', 'Data pagamento non disponibile.');
  add('PAY_LINES_PRESENT', 'Righe paga disponibili', payslip.parsedLines.length > 0, 'medium', 'Nessuna riga paga dettagliata estratta.');

  const unknown = payslip.parsedLines.filter((line) => (line.category ?? 'unknown') === 'unknown').length;
  const unknownRatio = payslip.parsedLines.length ? unknown / payslip.parsedLines.length : 0;
  checks.push({
    id: 'UNKNOWN_LINES_RATIO',
    category: 'completeness',
    title: 'Percentuale di righe non classificate',
    status: unknownRatio >= 0.5 ? 'warning' : 'passed',
    severity: unknownRatio >= 0.5 ? 'medium' : 'info',
    actualValue: round2(unknownRatio * 100),
    confidence: payslip.parsedLines.length ? 90 : 20,
    explanation: `${unknown} righe su ${payslip.parsedLines.length} non hanno una classificazione semantica nota.`,
    metadata: { unknown, total: payslip.parsedLines.length, ratio: unknownRatio },
  });

  const ambiguousEconomic = payslip.parsedLines.filter(
    (line) => line.classificationAmbiguous && (line.earningAmount !== undefined || line.deductionAmount !== undefined)
  );
  checks.push({
    id: 'AMBIGUOUS_ECONOMIC_LINES',
    category: 'completeness',
    title: 'Righe economiche ambigue',
    status: ambiguousEconomic.length ? 'warning' : 'passed',
    severity: ambiguousEconomic.length ? 'medium' : 'info',
    actualValue: ambiguousEconomic.length,
    confidence: 90,
    explanation: ambiguousEconomic.length
      ? `${ambiguousEconomic.length} righe economiche ambigue sono state escluse dalle somme certificate.`
      : 'Nessuna riga economica ambigua.',
    sourceLineCodes: ambiguousEconomic.map(codeOf),
  });

  const doubleAmounts = payslip.parsedLines.filter(
    (line) => line.earningAmount !== undefined && line.deductionAmount !== undefined
  );
  checks.push({
    id: 'DOUBLE_ECONOMIC_COLUMNS',
    category: 'completeness',
    title: 'Righe con competenze e trattenute entrambe valorizzate',
    status: doubleAmounts.length ? 'warning' : 'passed',
    severity: doubleAmounts.length ? 'medium' : 'info',
    actualValue: doubleAmounts.length,
    confidence: 95,
    explanation: doubleAmounts.length
      ? `${doubleAmounts.length} righe hanno entrambe le colonne economiche valorizzate e sono escluse dalle somme.`
      : 'Nessuna riga valorizza contemporaneamente competenze e trattenute.',
    sourceLineCodes: doubleAmounts.map(codeOf),
  });

  const uncategorizedEconomic = payslip.parsedLines.filter(
    (line) =>
      (line.earningAmount !== undefined || line.deductionAmount !== undefined) &&
      (!line.category || line.category === 'unknown')
  );
  checks.push({
    id: 'UNCATEGORIZED_ECONOMIC_LINES',
    category: 'completeness',
    title: 'Righe economiche senza categoria',
    status: uncategorizedEconomic.length ? 'warning' : 'passed',
    severity: uncategorizedEconomic.length ? 'low' : 'info',
    actualValue: uncategorizedEconomic.length,
    confidence: 90,
    explanation: uncategorizedEconomic.length
      ? `${uncategorizedEconomic.length} righe hanno un importo certo ma nessuna categoria semantica nota.`
      : 'Tutte le righe economiche hanno una categoria oppure non sono presenti.',
    sourceLineCodes: uncategorizedEconomic.map(codeOf),
  });

  const categorizedWithoutAmount = payslip.parsedLines.filter(
    (line) =>
      Boolean(line.category && !['unknown', 'informational'].includes(line.category)) &&
      line.economicType !== 'informational' &&
      line.economicType !== 'neutral' &&
      line.earningAmount === undefined &&
      line.deductionAmount === undefined
  );
  checks.push({
    id: 'CATEGORIZED_LINES_WITHOUT_AMOUNT',
    category: 'completeness',
    title: 'Righe classificate senza importo economico',
    status: categorizedWithoutAmount.length ? 'warning' : 'passed',
    severity: categorizedWithoutAmount.length ? 'low' : 'info',
    actualValue: categorizedWithoutAmount.length,
    confidence: 85,
    explanation: categorizedWithoutAmount.length
      ? `${categorizedWithoutAmount.length} righe hanno una categoria nota ma un importo economico non determinabile.`
      : 'Nessuna riga economica classificata è priva di importo.',
    sourceLineCodes: categorizedWithoutAmount.map(codeOf),
  });
  return checks;
};

export const validatePayrollConsistency = (
  payslip: PayslipImport,
  options: PayrollValidationOptions = {}
): PayrollValidationResult => {
  const ordinaryTolerance = options.ordinaryTolerance ?? 0.02;
  const warningTolerance = options.warningTolerance ?? 0.1;
  const minimumLineConfidence = options.minimumLineConfidence ?? 60;
  const totalEarnings = payslip.summary.grossAmount ?? payslip.summary.totalEarnings;
  const totalDeductions = payslip.summary.totalDeductions;
  const net = payslip.summary.netAmount;
  const rounding = options.rounding ?? 0;
  const checks: PayrollValidationCheck[] = [];

  if (totalEarnings === undefined || totalDeductions === undefined || net === undefined) {
    checks.push({
      id: 'SUMMARY_EQUATION',
      category: 'summary',
      title: 'Coerenza del riepilogo finale',
      status: 'skipped',
      severity: 'high',
      confidence: 20,
      explanation: 'Controllo non eseguibile: competenze, trattenute o netto ufficiale mancanti.',
      metadata: { totalEarnings, totalDeductions, net, rounding },
    });
  } else {
    const plusExpected = round2(totalEarnings - totalDeductions + rounding);
    const minusExpected = round2(totalEarnings - totalDeductions - rounding);
    const plusDifference = round2(plusExpected - net);
    const minusDifference = round2(minusExpected - net);
    const useMinus = rounding !== 0 && abs(minusDifference) < abs(plusDifference);
    const expected = useMinus ? minusExpected : plusExpected;
    const difference = useMinus ? minusDifference : plusDifference;
    const differenceStatus = statusForDifference(difference, ordinaryTolerance, warningTolerance);
    checks.push({
      id: 'SUMMARY_EQUATION',
      category: 'summary',
      title: 'Coerenza del riepilogo finale',
      ...differenceStatus,
      expectedValue: expected,
      actualValue: net,
      difference,
      tolerance: ordinaryTolerance,
      confidence: 100,
      explanation:
        differenceStatus.status === 'passed'
          ? 'Il riepilogo matematico risulta coerente.'
          : `Il netto ufficiale è ${net.toFixed(2)} €, mentre la formula produce ${expected.toFixed(2)} €. Differenza: ${abs(difference).toFixed(2)} €.`,
      metadata: { totalEarnings, totalDeductions, rounding, roundingSign: useMinus ? 'subtract' : 'add' },
    });
  }

  checks.push(
    economicSumCheck(payslip, 'earning', totalEarnings, ordinaryTolerance, warningTolerance, minimumLineConfidence),
    options.fiscalData
      ? completeDeductionsCheck(
          payslip,
          options.fiscalData,
          totalDeductions,
          ordinaryTolerance,
          warningTolerance,
          minimumLineConfidence
        )
      : economicSumCheck(payslip, 'deduction', totalDeductions, ordinaryTolerance, warningTolerance, minimumLineConfidence),
    ...lineCalculationChecks(payslip, ordinaryTolerance, warningTolerance),
    ...completenessChecks(payslip)
  );

  const count = (status: PayrollValidationCheckStatus) => checks.filter((check) => check.status === status).length;
  const summary = { passed: count('passed'), warnings: count('warning'), failed: count('failed'), skipped: count('skipped') };
  const fundamentalFailure = checks.some(
    (check) => check.status === 'failed' && check.severity === 'high' && check.category === 'summary'
  );
  const summarySkipped = checks.find((check) => check.id === 'SUMMARY_EQUATION')?.status === 'skipped';
  const noDetailedLines = payslip.parsedLines.length === 0;
  const overallStatus: PayrollValidationOverallStatus = fundamentalFailure
    ? 'inconsistent'
    : summarySkipped || noDetailedLines
      ? 'insufficient_data'
      : summary.warnings > 0 || summary.failed > 0 || summary.skipped > 0
        ? 'valid_with_warnings'
        : 'valid';
  const executed = checks.filter((check) => check.status !== 'skipped');
  const confidenceBase = executed.length
    ? executed.reduce((sum, check) => sum + check.confidence, 0) / executed.length
    : 0;
  const confidence = Math.max(
    0,
    Math.min(100, Math.round(confidenceBase - summary.failed * 12 - summary.warnings * 4 - summary.skipped * 2))
  );
  const warnings = checks.filter((check) => check.status === 'warning').map((check) => check.explanation);
  const errors = checks.filter((check) => check.status === 'failed').map((check) => check.explanation);
  const informationalNotes = checks
    .filter((check) => check.status === 'skipped')
    .map((check) => check.explanation);

  return { overallStatus, confidence, checks, errors, warnings, informationalNotes, summary };
};
