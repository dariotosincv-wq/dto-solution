import { resolvePayrollCodeDefinition } from './driverPayrollCodeCatalog';
import type { PayslipFiscalData, PayrollFiscalValue } from './driverPayrollFiscalTypes';
import type { PayslipImport, PayslipLine } from './driverPayrollTypes';
import type {
  PayrollValidationCheck,
  PayrollValidationCheckStatus,
  PayrollValidationResult,
} from './driverPayrollValidation';

export interface PayrollFiscalValidationOptions {
  ordinaryTolerance?: number;
  warningTolerance?: number;
  minimumConfidence?: number;
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const valueOf = (value?: PayrollFiscalValue) =>
  value && !value.ambiguous && typeof value.value === 'number' ? value.value : undefined;
const reliable = (value: PayrollFiscalValue | undefined, minimumConfidence: number) =>
  value && !value.ambiguous && value.confidence >= minimumConfidence && typeof value.value === 'number';

const differenceStatus = (
  difference: number,
  ordinaryTolerance: number,
  warningTolerance: number
): Pick<PayrollValidationCheck, 'status' | 'severity'> => {
  const magnitude = Math.abs(difference);
  if (magnitude <= ordinaryTolerance) return { status: 'passed', severity: 'info' };
  if (magnitude <= warningTolerance) return { status: 'warning', severity: 'medium' };
  return { status: 'failed', severity: 'high' };
};

const skipped = (
  id: string,
  category: PayrollValidationCheck['category'],
  title: string,
  explanation: string,
  metadata?: Record<string, unknown>
): PayrollValidationCheck => ({
  id,
  category,
  title,
  status: 'skipped',
  severity: 'low',
  confidence: 25,
  explanation,
  metadata,
});

const validateEmployeeContributionRate = (
  data: PayslipFiscalData,
  ordinaryTolerance: number,
  warningTolerance: number,
  minimumConfidence: number
): PayrollValidationCheck => {
  const taxable = data.socialSecurity.monthlyTaxable;
  const rate = data.socialSecurity.contributionRate;
  const contribution = data.socialSecurity.employeeContributions;
  if (!reliable(taxable, minimumConfidence) || !reliable(rate, minimumConfidence) || !reliable(contribution, minimumConfidence)) {
    return skipped(
      'FISCAL_SOCIAL_RATE',
      'social_security',
      'Contributi dipendente da imponibile e aliquota esposta',
      rate?.ambiguous
        ? 'Controllo non eseguito: sono presenti più aliquote o un’aliquota ambigua.'
        : 'Controllo non eseguito: imponibile mensile, aliquota unica esposta o contributo dipendente non disponibili con confidence sufficiente.',
      { taxable, rate, contribution }
    );
  }
  const expected = round2((taxable.value! * rate.value!) / 100);
  const difference = round2(expected - contribution.value!);
  const status = differenceStatus(difference, ordinaryTolerance, warningTolerance);
  return {
    id: 'FISCAL_SOCIAL_RATE',
    category: 'social_security',
    title: 'Contributi dipendente da imponibile e aliquota esposta',
    ...status,
    expectedValue: expected,
    actualValue: contribution.value,
    difference,
    tolerance: ordinaryTolerance,
    confidence: Math.min(taxable.confidence, rate.confidence, contribution.confidence),
    explanation:
      status.status === 'passed'
        ? 'Il contributo dipendente coincide con imponibile × aliquota esposta.'
        : 'Il contributo dipendente differisce dal prodotto imponibile × aliquota esposta; verificare basi multiple, esoneri o contributi aggiuntivi.',
    metadata: { taxable, rate, contribution, formula: 'monthlyTaxable * contributionRate / 100' },
  };
};

const lineDefinition = (line: PayslipLine) =>
  resolvePayrollCodeDefinition({ code: line.code, description: line.originalDescription ?? line.label }).definition;

const reconcileTaxableLines = (
  data: PayslipFiscalData,
  payslip: PayslipImport,
  kind: 'tax' | 'social',
  ordinaryTolerance: number,
  warningTolerance: number
): PayrollValidationCheck => {
  const officialValue = kind === 'tax'
    ? data.incomeTax.monthlyTaxable
    : data.socialSecurity.monthlyTaxable;
  const official = valueOf(officialValue);
  const included: Array<{ code?: string; amount: number; canonicalKey?: string }> = [];
  const excluded: Array<{ code?: string; reason: string }> = [];
  let incomplete = false;
  const seen = new Set<string>();

  payslip.parsedLines.forEach((line) => {
    if (line.earningAmount === undefined) return;
    const definition = lineDefinition(line);
    const treatment = kind === 'tax' ? definition?.taxTreatment : definition?.socialSecurityTreatment;
    const taxable = kind === 'tax' ? treatment === 'taxable' : treatment === 'subject';
    const exempt = kind === 'tax' ? treatment === 'exempt' : treatment === 'exempt';
    if (!definition || (!taxable && !exempt)) {
      incomplete = true;
      excluded.push({ code: line.code, reason: 'trattamento non documentato nel catalogo' });
      return;
    }
    if (!taxable) {
      excluded.push({ code: line.code, reason: 'trattamento esplicitamente esente' });
      return;
    }
    const identity = `${line.code}|${line.canonicalKey}|${line.earningAmount}`;
    if (seen.has(identity) || line.classificationAmbiguous) {
      incomplete = true;
      excluded.push({ code: line.code, reason: line.classificationAmbiguous ? 'riga ambigua' : 'duplicato' });
      return;
    }
    seen.add(identity);
    included.push({ code: line.code, amount: line.earningAmount, canonicalKey: line.canonicalKey });
  });

  const id = kind === 'tax' ? 'FISCAL_TAXABLE_RECONCILIATION' : 'FISCAL_SOCIAL_TAXABLE_RECONCILIATION';
  const category = kind === 'tax' ? 'income_tax' : 'social_security';
  const title = kind === 'tax' ? 'Riconciliazione imponibile fiscale' : 'Riconciliazione imponibile previdenziale';
  const metadata = { included, excluded, coverageComplete: !incomplete };
  if (official === undefined || !included.length) {
    return skipped(id, category, title, 'Imponibile mensile ufficiale o righe imponibili documentate insufficienti.', metadata);
  }
  const expected = round2(included.reduce((sum, line) => sum + line.amount, 0));
  const difference = round2(expected - official);
  const rawStatus = differenceStatus(difference, ordinaryTolerance, warningTolerance);
  const status = rawStatus.status === 'failed' && incomplete ? 'warning' : rawStatus.status;
  return {
    id,
    category,
    title,
    status,
    severity: status === 'warning' ? 'medium' : rawStatus.severity,
    expectedValue: expected,
    actualValue: official,
    difference,
    tolerance: ordinaryTolerance,
    confidence: incomplete ? 55 : 90,
    explanation:
      status === 'passed'
        ? 'Le competenze con trattamento documentato riconciliano l’imponibile ufficiale.'
        : incomplete
          ? 'La differenza potrebbe dipendere da voci con trattamento fiscale o previdenziale non ancora documentato.'
          : 'Le righe imponibili documentate differiscono dall’imponibile ufficiale.',
    sourceLineCodes: included.map((line) => line.code ?? 'senza codice'),
    sourceCanonicalKeys: included.map((line) => line.canonicalKey ?? 'unknown'),
    metadata,
  };
};

const validateIncomeTax = (
  data: PayslipFiscalData,
  ordinaryTolerance: number,
  warningTolerance: number,
  minimumConfidence: number
): PayrollValidationCheck => {
  const gross = data.incomeTax.grossTax;
  const net = data.incomeTax.netTax ?? data.incomeTax.taxWithheld;
  const deductions = [
    data.incomeTax.workDeductions,
    data.incomeTax.familyDeductions,
    data.incomeTax.additionalDeductions,
  ].filter((value): value is PayrollFiscalValue => Boolean(value));
  if (
    !reliable(gross, minimumConfidence) ||
    !reliable(net, minimumConfidence) ||
    !deductions.length ||
    deductions.some((value) => !reliable(value, minimumConfidence)) ||
    data.incomeTax.taxAdjustment
  ) {
    return skipped(
      'FISCAL_INCOME_TAX_EQUATION',
      'income_tax',
      'Relazione interna IRPEF',
      data.incomeTax.taxAdjustment
        ? 'Controllo non eseguito: il conguaglio è conservato separatamente e il suo segno fiscale non è certificato.'
        : 'Controllo non eseguito: imposta lorda, detrazioni certe o imposta netta non sono disponibili.',
      {
        gross,
        deductions,
        taxCredits: data.incomeTax.taxCredits,
        supplementaryTreatment: data.incomeTax.supplementaryTreatment,
        net,
        adjustment: data.incomeTax.taxAdjustment,
      }
    );
  }
  const deductionsTotal = deductions.reduce((sum, value) => sum + value.value!, 0);
  const expected = round2(gross.value! - deductionsTotal);
  const difference = round2(expected - net.value!);
  const status = differenceStatus(difference, ordinaryTolerance, warningTolerance);
  return {
    id: 'FISCAL_INCOME_TAX_EQUATION',
    category: 'income_tax',
    title: 'Relazione interna IRPEF',
    ...status,
    expectedValue: expected,
    actualValue: net.value,
    difference,
    tolerance: ordinaryTolerance,
    confidence: Math.min(gross.confidence, net.confidence, ...deductions.map((value) => value.confidence)),
    explanation:
      status.status === 'passed'
        ? 'Imposta lorda meno detrazioni coincide con l’imposta netta esposta.'
        : 'La relazione tra imposta lorda, detrazioni e imposta netta presenta una differenza da verificare.',
    metadata: {
      gross,
      deductions,
      taxCreditsExcluded: data.incomeTax.taxCredits,
      supplementaryTreatmentExcluded: data.incomeTax.supplementaryTreatment,
      net,
      formula: 'grossTax - documentedDeductions',
    },
  };
};

const validateTaxableDifference = (data: PayslipFiscalData): PayrollValidationCheck => {
  const social = valueOf(data.socialSecurity.monthlyTaxable);
  const tax = valueOf(data.incomeTax.monthlyTaxable);
  if (social === undefined || tax === undefined) {
    return skipped(
      'FISCAL_TAXABLE_BASES_DIFFERENCE',
      'fiscal_completeness',
      'Confronto imponibile previdenziale e fiscale',
      'Uno o entrambi gli imponibili mensili non sono disponibili; nessuna uguaglianza viene presunta.'
    );
  }
  const difference = round2(tax - social);
  return {
    id: 'FISCAL_TAXABLE_BASES_DIFFERENCE',
    category: 'fiscal_completeness',
    title: 'Confronto imponibile previdenziale e fiscale',
    status: difference === 0 ? 'passed' : 'warning',
    severity: difference === 0 ? 'info' : 'low',
    expectedValue: social,
    actualValue: tax,
    difference,
    confidence: 80,
    explanation: difference === 0
      ? 'Gli imponibili coincidono; restano concettualmente distinti.'
      : 'Gli imponibili sono differenti. La differenza non è automaticamente un errore e può dipendere da trattamenti diversi delle voci.',
    metadata: { socialSecurityTaxable: social, incomeTaxTaxable: tax },
  };
};

const validateAdditionalTaxes = (data: PayslipFiscalData, payslip: PayslipImport): PayrollValidationCheck[] => {
  const definitions = [
    ['FISCAL_REGIONAL_TAX_LINE', 'Addizionale regionale', data.additionalTaxes.regionalBalance, 'payroll.tax.regional'],
    ['FISCAL_MUNICIPAL_BALANCE_LINE', 'Addizionale comunale saldo', data.additionalTaxes.municipalBalance, 'payroll.tax.municipal.balance'],
    ['FISCAL_MUNICIPAL_ADVANCE_LINE', 'Addizionale comunale acconto', data.additionalTaxes.municipalAdvance, 'payroll.tax.municipal.advance'],
  ] as const;
  return definitions.map(([id, title, fiscalValue, canonicalKey]) => {
    if (!fiscalValue) return skipped(id, 'additional_tax', title, `${title}: dato non disponibile.`);
    const matching = payslip.parsedLines.filter((line) =>
      (line.canonicalKey ?? lineDefinition(line)?.canonicalKey) === canonicalKey
    );
    const sum = round2(matching.reduce((total, line) => total + (line.deductionAmount ?? 0), 0));
    if (!matching.length) {
      return skipped(id, 'additional_tax', title, 'Valore fiscale disponibile ma nessuna riga paga confrontabile.', { fiscalValue });
    }
    const difference = round2(sum - (fiscalValue.value ?? 0));
    return {
      id,
      category: 'additional_tax',
      title,
      status: Math.abs(difference) <= 0.02 ? 'passed' : 'warning',
      severity: Math.abs(difference) <= 0.02 ? 'info' : 'medium',
      expectedValue: sum,
      actualValue: fiscalValue.value,
      difference,
      tolerance: 0.02,
      confidence: fiscalValue.confidence,
      explanation: Math.abs(difference) <= 0.02
        ? 'Il valore strutturato coincide con la riga paga corrispondente.'
        : 'Il valore strutturato e la riga paga corrispondente differiscono o potrebbero essere duplicati.',
      sourceLineCodes: matching.map((line) => line.code ?? 'senza codice'),
      sourceCanonicalKeys: [canonicalKey],
      metadata: { fiscalValue, matchingLines: matching.length },
    };
  });
};

const validateTfr = (data: PayslipFiscalData): PayrollValidationCheck[] => {
  const monthly = valueOf(data.tfr.monthlyAccrual);
  const progressive = valueOf(data.tfr.progressiveAccrual);
  const relation = monthly === undefined || progressive === undefined
    ? skipped(
      'FISCAL_TFR_MONTHLY_PROGRESSIVE',
      'tfr',
      'Relazione TFR mensile e progressivo',
      'Quota mensile o progressivo TFR non disponibili; la formula normativa non viene ricostruita.'
    )
    : {
      id: 'FISCAL_TFR_MONTHLY_PROGRESSIVE',
      category: 'tfr' as const,
      title: 'Relazione TFR mensile e progressivo',
      status: progressive >= monthly ? 'passed' as const : 'warning' as const,
      severity: progressive >= monthly ? 'info' as const : 'medium' as const,
      expectedValue: monthly,
      actualValue: progressive,
      difference: round2(progressive - monthly),
      confidence: 80,
      explanation: progressive >= monthly
        ? 'Il TFR progressivo non è inferiore alla quota mensile.'
        : 'Il TFR progressivo risulta inferiore alla quota mensile; verificare conguagli o classificazione del periodo.',
      metadata: { monthly: data.tfr.monthlyAccrual, progressive: data.tfr.progressiveAccrual },
    };
  return [
    relation,
    skipped(
      'FISCAL_TFR_THEORETICAL_FORMULA',
      'tfr',
      'Formula teorica TFR',
      'Controllo sperimentale non eseguito: non tutte le voci utili al TFR sono documentate con certezza.'
    ),
  ];
};

export const validatePayslipFiscalData = (
  data: PayslipFiscalData,
  payslip: PayslipImport,
  options: PayrollFiscalValidationOptions = {}
): PayrollValidationResult => {
  const ordinaryTolerance = options.ordinaryTolerance ?? 0.02;
  const warningTolerance = options.warningTolerance ?? 0.1;
  const minimumConfidence = options.minimumConfidence ?? 70;
  const checks: PayrollValidationCheck[] = [
    validateEmployeeContributionRate(data, ordinaryTolerance, warningTolerance, minimumConfidence),
    reconcileTaxableLines(data, payslip, 'social', ordinaryTolerance, warningTolerance),
    reconcileTaxableLines(data, payslip, 'tax', ordinaryTolerance, warningTolerance),
    validateIncomeTax(data, ordinaryTolerance, warningTolerance, minimumConfidence),
    validateTaxableDifference(data),
    ...validateAdditionalTaxes(data, payslip),
    ...validateTfr(data),
  ];

  const fiscalValues = [
    ...Object.values(data.socialSecurity),
    ...Object.values(data.incomeTax),
    ...Object.values(data.additionalTaxes),
    ...Object.values(data.tfr),
  ].filter((value): value is PayrollFiscalValue => Boolean(value && typeof value === 'object' && 'confidence' in value));
  const ambiguous = fiscalValues.filter((value) => value.ambiguous).length + data.unclassifiedValues.filter((value) => value.ambiguous).length;
  checks.push({
    id: 'FISCAL_DATA_COMPLETENESS',
    category: 'fiscal_completeness',
    title: 'Completezza dei dati fiscali e contributivi',
    status: fiscalValues.length === 0 ? 'skipped' : ambiguous || data.unclassifiedValues.length ? 'warning' : 'passed',
    severity: fiscalValues.length === 0 ? 'low' : ambiguous ? 'medium' : data.unclassifiedValues.length ? 'low' : 'info',
    actualValue: fiscalValues.length,
    confidence: fiscalValues.length ? Math.max(30, 90 - ambiguous * 15 - data.unclassifiedValues.length * 5) : 10,
    explanation: fiscalValues.length === 0
      ? 'Nessun dato fiscale strutturato sufficiente: i controlli fiscali non implicano un errore del cedolino.'
      : `${fiscalValues.length} valori fiscali strutturati; ${data.unclassifiedValues.length} valori conservati con periodo non determinato e ${ambiguous} ambigui.`,
    metadata: { structuredValues: fiscalValues.length, unclassifiedValues: data.unclassifiedValues, ambiguous },
  });

  const count = (status: PayrollValidationCheckStatus) => checks.filter((check) => check.status === status).length;
  const summary = { passed: count('passed'), warnings: count('warning'), failed: count('failed'), skipped: count('skipped') };
  const fundamentalFailure = checks.some((check) => check.status === 'failed' && check.severity === 'high');
  const executed = checks.filter((check) => check.status !== 'skipped');
  const overallStatus = fundamentalFailure
    ? 'inconsistent'
    : executed.length === 0
      ? 'insufficient_data'
      : summary.warnings || summary.failed || summary.skipped
        ? 'valid_with_warnings'
        : 'valid';
  const confidence = executed.length
    ? Math.max(0, Math.min(100, Math.round(
      executed.reduce((sum, check) => sum + check.confidence, 0) / executed.length -
      summary.warnings * 4 -
      summary.failed * 10
    )))
    : 0;
  return {
    overallStatus,
    confidence,
    checks,
    errors: checks.filter((check) => check.status === 'failed').map((check) => check.explanation),
    warnings: checks.filter((check) => check.status === 'warning').map((check) => check.explanation),
    informationalNotes: checks.filter((check) => check.status === 'skipped').map((check) => check.explanation),
    summary,
  };
};
