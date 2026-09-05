import type { DriverPayrollImportResult } from './driverPayrollImportTypes';
import type { PayrollHistoricalValidationResult } from './driverPayrollHistoricalValidation';
import { getPayrollCategoryForCode } from './driverPayrollPayslipNormalizer';
import { parsePayslipFinalSummary } from './driverPayrollParsers/finalSummaryParser';
import { detectPayslipFormat } from './driverPayrollParsers/payslipFormatDetector';
import type { PayslipImport, PayslipLine } from './driverPayrollTypes';
import { getPayslipLineSemanticValues } from './driverPayrollLineValues';

type ParserDecision = {
  page: number;
  y: number;
  text: string;
  ruleId: string;
  outcome: 'ACCETTATA' | 'IGNORATA' | 'CLASSIFICATA';
  reason: string;
  confidence: number | string;
};

const line = (character = '-', length = 78) => character.repeat(length);
const value = (input: unknown) =>
  input === undefined || input === null || input === '' ? 'NON DISPONIBILE' : String(input);
const normalized = (input: string) => input.toLowerCase().replace(/\s+/g, ' ').trim();
const fmt = (input: number | undefined) => input === undefined ? 'NON DISPONIBILE' : String(input);

const originalDescription = (payrollLine: PayslipLine) => {
  const raw = payrollLine.rawLine?.trim();
  if (!raw) return payrollLine.label;
  const withoutCode = payrollLine.code
    ? raw.replace(new RegExp(`^\\s*${payrollLine.code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`), '')
    : raw;
  return withoutCode.replace(/[+-]?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}.*$/, '').trim() || payrollLine.label;
};

const findRecognizedLine = (rowText: string, payslip?: PayslipImport) => {
  const row = normalized(rowText);
  return payslip?.parsedLines.find((item) => {
    const raw = normalized(item.rawLine ?? '');
    if (raw && (raw === row || raw.includes(row) || row.includes(raw))) return true;
    return Boolean(item.code && row.includes(item.code) && row.includes(normalized(item.label)));
  });
};

const buildParserDecisions = (result: DriverPayrollImportResult): ParserDecision[] => {
  const temporary = result.temporaryReadDiagnostic;
  if (!temporary) return [];
  const payslip = temporary.parserPayslip;
  const finalSummary = parsePayslipFinalSummary(temporary.structuredText);

  return temporary.structuredText.reconstructedLines.map((row) => {
    const recognizedLine = findRecognizedLine(row.text, payslip);
    if (recognizedLine) {
      return {
        page: row.page,
        y: row.y,
        text: row.text,
        ruleId: 'RULE_001',
        outcome: 'ACCETTATA',
        reason: `La riga ha prodotto la voce paga ${recognizedLine.code ?? 'senza codice'} (${recognizedLine.label}).`,
        confidence: recognizedLine.confidence ?? 'non assegnata',
      };
    }

    const summaryEntry = Object.entries(finalSummary.sources).find(([, source]) =>
      source?.row && normalized(source.row) === normalized(row.text)
    );
    if (summaryEntry) {
      const [field, source] = summaryEntry;
      return {
        page: row.page,
        y: row.y,
        text: row.text,
        ruleId: 'RULE_002',
        outcome: 'CLASSIFICATA',
        reason: `La riga è stata selezionata dal parser del riepilogo finale per il campo ${field}.`,
        confidence: source?.match?.confidence ?? finalSummary.confidence,
      };
    }

    if (/periodo\s+(?:di\s+)?paga|competenza/i.test(row.text)) {
      return {
        page: row.page,
        y: row.y,
        text: row.text,
        ruleId: 'RULE_003',
        outcome: finalSummary.sources.period?.row ? 'CLASSIFICATA' : 'IGNORATA',
        reason: finalSummary.sources.period?.row
          ? 'La riga contiene il periodo riconosciuto dal parser del riepilogo.'
          : 'La riga sembra riferirsi al periodo, ma non ha prodotto un periodo confermato.',
        confidence: finalSummary.sources.period?.match?.confidence ?? (finalSummary.month && finalSummary.year ? finalSummary.confidence : 0),
      };
    }

    if (/\bvoce\b.*\b(?:ore|gg|mesi|competenze|trattenute)\b/i.test(row.text)) {
      return {
        page: row.page,
        y: row.y,
        text: row.text,
        ruleId: 'RULE_004',
        outcome: 'IGNORATA',
        reason: 'Riga strutturale/intestazione della tabella: utile al riconoscimento del layout, non salvata come voce paga.',
        confidence: 95,
      };
    }

    if (/azienda|dipendente|matricola|codice\s+fiscale|livello|centro\s+di\s+costo/i.test(row.text)) {
      return {
        page: row.page,
        y: row.y,
        text: row.text,
        ruleId: 'RULE_005',
        outcome: 'CLASSIFICATA',
        reason: 'Riga di metadati o dati anagrafici; non è una voce economica della busta.',
        confidence: 80,
      };
    }

    return {
      page: row.page,
      y: row.y,
      text: row.text,
      ruleId: 'RULE_006',
      outcome: 'IGNORATA',
      reason: 'Nessuna voce paga, campo del riepilogo o metadato strutturato è stato prodotto da questa riga.',
      confidence: 0,
    };
  });
};

const interpretedFields = (payslip?: PayslipImport) => {
  if (!payslip) return ['Nessun oggetto PayslipImport prodotto dal parser.'];
  const fieldConfidence = payslip.fieldConfidence ?? {};
  const fields: Array<[string, unknown]> = [
    ['periodo.label', payslip.payrollPeriodLabel],
    ['periodo.mese', payslip.month],
    ['periodo.anno', payslip.year],
    ['azienda', payslip.companyName],
    ['payrollProvider', payslip.payrollProvider],
    ['livello', payslip.level],
    ['sedeCodice', payslip.siteCode],
    ['centroCostoCodice', payslip.costCenterCode],
    ['centroCostoDescrizione', payslip.costCenterDescription],
    ['codiceAttivita', payslip.activityCode],
    ['centroCosto', payslip.siteCostCenter],
    ...Object.entries(payslip.summary).map(([key, fieldValue]) => [`summary.${key}`, fieldValue] as [string, unknown]),
  ];
  return fields.map(([key, fieldValue]) => {
    const info = fieldConfidence[key] ?? fieldConfidence[key.replace('summary.', '')];
    return [
      `Campo: ${key}`,
      `  Valore: ${value(fieldValue)}`,
      `  Origine: ${info?.parserUsed ?? payslip.parserUsed ?? 'parser'}`,
      `  Confidence: ${info?.confidence ?? 'non assegnata'}`,
      info?.value !== undefined ? `  Valore sorgente: ${value(info.value)}` : undefined,
      info?.sourceLabel ? `  Etichetta sorgente: ${info.sourceLabel}` : undefined,
      info?.page ? `  Pagina sorgente: ${info.page}` : undefined,
    ].filter(Boolean).join('\n');
  });
};

const recognizedPayLines = (
  payslip?: PayslipImport,
  validation?: DriverPayrollImportResult['payrollValidation']
) => {
  if (!payslip?.parsedLines.length) return ['Nessuna voce paga riconosciuta.'];
  return payslip.parsedLines.map((item, index) => {
    const category = item.code ? getPayrollCategoryForCode(item.code) : undefined;
    const semantic = getPayslipLineSemanticValues(item);
    const selectionEntries = validation?.checks
      .filter((check) => ['EARNINGS_LINES_SUM', 'DEDUCTIONS_LINES_SUM', 'DEDUCTIONS_COMPLETE_RECONCILIATION'].includes(check.id))
      .flatMap((check) => {
        type SelectionEntry = Record<string, unknown> & {
          index?: number;
          code?: string;
          description?: string;
          economicSelectionExclusionReason?: string;
          reason?: string;
        };
        const metadata = check.metadata as {
          included?: SelectionEntry[];
          excluded?: SelectionEntry[];
        } | undefined;
        return [
          ...(metadata?.included ?? []).map((entry) => ({ ...entry, result: 'included' })),
          ...(metadata?.excluded ?? []).map((entry) => ({ ...entry, result: 'excluded' })),
        ];
      });
    const selection = selectionEntries?.find((entry) =>
      entry.index === index || (entry.code === item.code && entry.description === item.label)
    );
    return [
      `Voce ${index + 1}`,
      `  Codice originale: ${value(item.code)}`,
      `  Descrizione originale: ${originalDescription(item)}`,
      `  Descrizione normalizzata: ${item.label}`,
      `  Categoria assegnata: ${value(category ?? item.section ?? item.type)}`,
      `  Quantità: ${fmt(item.quantity)}`,
      `  Unità quantità: ${semantic.quantityUnit}`,
      `  Tariffa: ${fmt(item.unitValue)}`,
      `  Competenze: ${fmt(semantic.earningAmount)}`,
      `  Trattenute: ${fmt(semantic.deductionAmount)}`,
      `  Valore informativo: ${fmt(semantic.informationalValue)}`,
      `  Confidence: ${value(item.confidence)}`,
      `  interpretationMethod: ${value(item.interpretationMethod)}`,
      `  sourceColumn: ${value(item.sourceColumn)}`,
      `  geometricEconomicCertified: ${value(item.geometricEconomicCertified)}`,
      `  sourcePage: ${value(item.sourcePage)}`,
      `  sourceRowY: ${value(item.sourceRowY)}`,
      `  economicSelectionResult: ${value(selection?.result ?? item.economicSelectionResult)}`,
      `  economicSelectionExclusionReason: ${value(selection?.economicSelectionExclusionReason ?? selection?.reason ?? item.economicSelectionExclusionReason)}`,
      `  Riga sorgente: ${value(item.rawLine)}`,
    ].join('\n');
  });
};

export const buildDriverPayrollReadDiagnosticTxt = (
  result: DriverPayrollImportResult,
  historicalValidation?: PayrollHistoricalValidationResult
): string => {
  const temporary = result.temporaryReadDiagnostic;
  const structured = temporary?.structuredText;
  const payslip = temporary?.parserPayslip ?? result.payslip;
  const detection = structured ? detectPayslipFormat(structured) : undefined;
  const finalSummary = structured ? parsePayslipFinalSummary(structured) : undefined;
  const decisions = buildParserDecisions(result);
  const unrecognized = decisions.filter((item) => item.outcome === 'IGNORATA');
  const validation = result.diagnosticReport?.validation;
  const output: string[] = [];

  const section = (title: string) => {
    output.push('', line('='), title, line('='));
  };

  output.push('DIAGNOSTICA LETTURA BUSTA PAGA', `Generata localmente: ${new Date().toISOString()}`);

  section('1. INFORMAZIONI GENERALI');
  output.push(
    `Nome file: ${result.fileName}`,
    `Data e ora analisi: ${temporary?.analyzedAt ?? result.importedAt}`,
    `Numero pagine: ${structured?.pages ?? result.diagnosticReport?.pageCount ?? 'NON DISPONIBILE'}`,
    `Metodo di estrazione: ${temporary?.extractionMethod ?? payslip?.extractionMethod ?? 'NON DISPONIBILE'}`,
    `Formato rilevato: ${payslip?.detectedFormat ?? detection?.format ?? 'NON DISPONIBILE'}`,
    `Parser selezionato: ${payslip?.parserUsed ?? result.diagnosticReport?.parserId ?? 'NON DISPONIBILE'}`,
    `Confidenza generale: ${value(result.confidence ?? payslip?.confidence)}`,
    `Stato importazione: ${result.status}`,
    `parserBuildMarker: ${temporary?.runtimeProvenance?.parserBuildMarker ?? 'NON DISPONIBILE'}`
  );

  section('1A. PROVENIENZA RUNTIME DEL PARSER');
  const provenance = temporary?.runtimeProvenance;
  output.push(
    `Parser build marker: ${provenance?.parserBuildMarker ?? 'NON DISPONIBILE'}`,
    `Source file parser: ${provenance?.parserSourceFile ?? 'NON DISPONIBILE'}`,
    `Source file registry: ${provenance?.registrySourceFile ?? 'NON DISPONIBILE'}`,
    `Source file validazione: ${provenance?.validationSourceFile ?? 'NON DISPONIBILE'}`,
    `Source file normalizzatore fiscale: ${provenance?.fiscalNormalizerSourceFile ?? 'NON DISPONIBILE'}`,
    `Criterio selectEconomicLines: ${provenance?.economicSelectionCriterion ?? 'NON DISPONIBILE'}`,
    `Risultato estrazione sedeCodice: ${provenance?.extractedSiteCode ?? 'NON DISPONIBILE'}`,
    `Risultato estrazione centroCostoCodice: ${provenance?.extractedCostCenterCode ?? 'NON DISPONIBILE'}`,
    `Risultato estrazione centroCostoDescrizione: ${provenance?.extractedCostCenterDescription ?? 'NON DISPONIBILE'}`,
    'Fiscal section matches trovati:'
  );
  if (!provenance?.fiscalSectionMatches.length) {
    output.push('  [nessun match]');
  } else {
    provenance.fiscalSectionMatches.forEach((match, index) => {
      output.push(
        `  Match ${index + 1}: target=${match.target}; valore=${match.value}; pagina=${value(match.page)}; sezione=${value(match.section)}; confidence=${match.confidence}; metodo=${match.extractionMethod}`,
        `    sorgente=${value(match.rawText)}`
      );
    });
  }

  section('2. TESTO GREZZO ESTRATTO');
  if (!structured) {
    output.push('Testo non disponibile: la lettura PDF non ha prodotto uno snapshot strutturato.');
  } else {
    for (let page = 1; page <= structured.pages; page += 1) {
      output.push('', `--- PAGINA ${page} ---`);
      const rows = structured.reconstructedLines.filter((row) => row.page === page);
      output.push(rows.length ? rows.map((row) => row.text).join('\n') : '[nessun testo estratto]');
    }
  }

  section('3. TOKEN PDF');
  if (!structured?.items.length) output.push('Nessun token disponibile.');
  structured?.items.forEach((token, index) => {
    output.push(
      `[${index}] pagina=${token.page} x=${token.x} y=${token.y} larghezza=${value(token.width)} altezza=${value(token.height)}`,
      `    testo=${JSON.stringify(token.text)}`
    );
  });

  section('4. RIGHE RICOSTRUITE');
  if (!structured?.reconstructedLines.length) output.push('Nessuna riga ricostruita.');
  structured?.reconstructedLines.forEach((row, index) => {
    output.push(
      `Riga ${index + 1}: pagina=${row.page} y=${row.y}`,
      `Testo: ${row.text}`,
      `Token: ${row.items.map((token) => JSON.stringify(token.text)).join(' | ')}`
    );
  });

  section('5. DATI INTERPRETATI DAL PARSER');
  output.push(...interpretedFields(payslip));
  if (finalSummary) {
    output.push(
      '',
      `Arrotondamento: ${fmt(finalSummary.rounding)}`,
      `Data valuta: ${value(finalSummary.paymentDate)}`,
      `Confidence riepilogo finale: ${finalSummary.confidence}`,
      `Origini riepilogo: ${JSON.stringify(finalSummary.sources, null, 2)}`
    );
  }

  section('6. VOCI PAGA RICONOSCIUTE');
  output.push(...recognizedPayLines(payslip, result.payrollValidation));

  section('7. RIGHE NON RICONOSCIUTE O SCARTATE');
  if (!unrecognized.length) output.push('Nessuna riga non riconosciuta rilevata.');
  unrecognized.forEach((decision) => {
    output.push(
      `Pagina ${decision.page}, y=${decision.y}`,
      `Testo: ${decision.text}`,
      `Motivo: ${decision.reason}`,
      `Regola diagnostica: ${decision.ruleId}`,
      `Confidence: ${decision.confidence}`,
      ''
    );
  });

  section('8. CONTROLLI DI COERENZA');
  output.push(
    'Formula: totale competenze - totale trattenute + arrotondamento = netto',
    `Totale competenze utilizzato: ${fmt(finalSummary?.totalEarnings ?? payslip?.summary.totalEarnings ?? payslip?.summary.grossAmount)}`,
    `Totale trattenute utilizzato: ${fmt(finalSummary?.totalDeductions ?? payslip?.summary.totalDeductions)}`,
    `Arrotondamento utilizzato: ${fmt(finalSummary?.rounding)}`,
    `Risultato atteso: ${fmt(validation?.expectedNet)}`,
    `Risultato letto: ${fmt(finalSummary?.net ?? payslip?.summary.netAmount)}`,
    `Differenza: ${fmt(validation?.difference)}`,
    `Esito: ${validation?.equationChecked ? (validation.valid ? 'COERENTE' : 'NON COERENTE') : 'NON VERIFICABILE'}`
  );

  section('9. WARNING ED ERRORI');
  if (!result.warnings.length && !result.errors.length && !payslip?.warnings.length) {
    output.push('Nessun warning o errore.');
  }
  result.warnings.forEach((warning) => {
    output.push(`[WARNING][${warning.code}] gravità=media campo=${value(warning.field)}: ${warning.message}`);
  });
  payslip?.warnings.forEach((warning) => output.push(`[PARSER_WARNING] gravità=media: ${warning}`));
  result.errors.forEach((error) => {
    output.push(
      `[ERROR][${error.code}] gravità=alta: ${error.message}`,
      error.technicalDetails ? `  Dettagli tecnici: ${error.technicalDetails}` : ''
    );
  });

  section('10. DECISIONI DEL PARSER');
  output.push(
    'Le regole RULE_xxx di questa sezione sono etichette diagnostiche osservazionali.',
    'Descrivono l’esito già prodotto dal parser e non partecipano al parsing.',
    ''
  );
  if (!decisions.length) output.push('Nessuna decisione disponibile.');
  decisions.forEach((decision, index) => {
    output.push(
      `Decisione ${index + 1}`,
      `  Pagina: ${decision.page}`,
      `  Y: ${decision.y}`,
      `  Testo: ${decision.text}`,
      `  Regola: ${decision.ruleId}`,
      `  Esito: ${decision.outcome}`,
      `  Motivazione: ${decision.reason}`,
      `  Confidence: ${decision.confidence}`,
      ''
    );
  });

  section('11. VALIDAZIONE MATEMATICA');
  const mathematicalValidation = result.payrollValidation;
  if (!mathematicalValidation) {
    output.push('Validazione matematica non disponibile per questa importazione.');
  } else {
    output.push(
      `Stato complessivo: ${mathematicalValidation.overallStatus}`,
      `Confidence: ${mathematicalValidation.confidence}`,
      `Controlli superati: ${mathematicalValidation.summary.passed}`,
      `Warning: ${mathematicalValidation.summary.warnings}`,
      `Errori: ${mathematicalValidation.summary.failed}`,
      `Controlli non eseguiti: ${mathematicalValidation.summary.skipped}`,
      ''
    );
    mathematicalValidation.checks.forEach((check) => {
      output.push(
        `[${check.status.toUpperCase()}][${check.id}] ${check.title}`,
        `  Categoria: ${check.category}`,
        `  Gravità: ${check.severity}`,
        `  Confidence: ${check.confidence}`,
        `  Valore atteso/calcolato: ${fmt(check.expectedValue)}`,
        `  Valore ufficiale/rilevato: ${fmt(check.actualValue)}`,
        `  Differenza: ${fmt(check.difference)}`,
        `  Tolleranza: ${fmt(check.tolerance)}`,
        `  Spiegazione: ${check.explanation}`,
        `  Codici sorgente: ${check.sourceLineCodes?.join(', ') || 'NESSUNO'}`,
        `  Canonical key: ${check.sourceCanonicalKeys?.join(', ') || 'NESSUNA'}`,
        `  Dati utilizzati: ${check.metadata ? JSON.stringify(check.metadata, null, 2) : 'NON DISPONIBILI'}`,
        ''
      );
    });
  }

  section('12. DATI FISCALI E CONTRIBUTIVI');
  const fiscal = result.fiscalAnalysis?.fiscalData;
  const fiscalEntry = (label: string, entry: unknown) => {
    if (!entry || typeof entry !== 'object' || !('value' in entry)) {
      output.push(`${label}: non disponibile`);
      return;
    }
    const item = entry as {
      value?: unknown;
      source?: unknown;
      period?: unknown;
      confidence?: unknown;
      ambiguous?: unknown;
      page?: unknown;
      rawText?: unknown;
    };
    output.push(
      `${label}: ${item.value ?? 'non disponibile'}`,
      `  periodo=${item.period ?? 'non identificato'} origine=${item.source ?? 'non identificata'} confidence=${item.confidence ?? 'non disponibile'} ambiguo=${item.ambiguous ?? false}`,
      `  pagina=${item.page ?? 'non disponibile'} testo=${item.rawText ?? 'non disponibile'}`
    );
  };
  if (!fiscal) {
    output.push('Dati fiscali e contributivi non disponibili.');
  } else {
    output.push(`Versione schema: ${fiscal.schemaVersion}`, '', 'Previdenza:');
    fiscalEntry('Imponibile mensile', fiscal.socialSecurity.monthlyTaxable);
    fiscalEntry('Imponibile progressivo', fiscal.socialSecurity.progressiveTaxable);
    fiscalEntry('Contributi dipendente', fiscal.socialSecurity.employeeContributions);
    fiscalEntry('Contributi azienda', fiscal.socialSecurity.employerContributions);
    fiscalEntry('Aliquota esposta', fiscal.socialSecurity.contributionRate);
    fiscalEntry('Contributi bilaterali dipendente', fiscal.socialSecurity.bilateralEmployeeContributions);
    fiscalEntry('Contributi bilaterali azienda', fiscal.socialSecurity.bilateralEmployerContributions);
    output.push('', 'IRPEF:');
    fiscalEntry('Imponibile fiscale mensile', fiscal.incomeTax.monthlyTaxable);
    fiscalEntry('Imponibile fiscale progressivo', fiscal.incomeTax.progressiveTaxable);
    fiscalEntry('Imposta lorda', fiscal.incomeTax.grossTax);
    fiscalEntry('Detrazioni lavoro', fiscal.incomeTax.workDeductions);
    fiscalEntry('Detrazioni familiari', fiscal.incomeTax.familyDeductions);
    fiscalEntry('Ulteriori detrazioni', fiscal.incomeTax.additionalDeductions);
    fiscalEntry('Crediti fiscali', fiscal.incomeTax.taxCredits);
    fiscalEntry('Trattamento integrativo', fiscal.incomeTax.supplementaryTreatment);
    fiscalEntry('Imposta netta', fiscal.incomeTax.netTax);
    fiscalEntry('Ritenuta', fiscal.incomeTax.taxWithheld);
    fiscalEntry('Conguaglio', fiscal.incomeTax.taxAdjustment);
    output.push('', 'Addizionali:');
    fiscalEntry('Regionale', fiscal.additionalTaxes.regionalBalance);
    fiscalEntry('Comunale saldo', fiscal.additionalTaxes.municipalBalance);
    fiscalEntry('Comunale acconto', fiscal.additionalTaxes.municipalAdvance);
    output.push('', 'TFR:');
    fiscalEntry('Imponibile TFR', fiscal.tfr.taxableBase);
    fiscalEntry('Quota mensile', fiscal.tfr.monthlyAccrual);
    fiscalEntry('Progressivo', fiscal.tfr.progressiveAccrual);
    fiscalEntry('Rivalutazione', fiscal.tfr.revaluation);
    fiscalEntry('Imposta rivalutazione', fiscal.tfr.revaluationTax);
    fiscalEntry('Destinazione', fiscal.tfr.destination);
    fiscalEntry('Quota fondo pensione', fiscal.tfr.pensionFundContribution);
    output.push('', 'Progressivi annuali:');
    fiscalEntry('Reddito lordo progressivo', fiscal.annualProgressives.grossIncome);
    fiscalEntry('Imponibile previdenziale progressivo', fiscal.annualProgressives.socialSecurityTaxable);
    fiscalEntry('Imponibile fiscale progressivo', fiscal.annualProgressives.incomeTaxTaxable);
    fiscalEntry('Contributi dipendente progressivi', fiscal.annualProgressives.employeeContributions);
    fiscalEntry('Imposta lorda progressiva', fiscal.annualProgressives.grossTax);
    fiscalEntry('Detrazioni progressive', fiscal.annualProgressives.deductions);
    fiscalEntry('Imposta versata progressiva', fiscal.annualProgressives.netTax);
    output.push(
      '',
      `Valori con periodo/significato non identificato: ${fiscal.unclassifiedValues.length}`,
      ...fiscal.unclassifiedValues.map((item) => JSON.stringify(item))
    );
  }

  section('13. VALIDAZIONE FISCALE E CONTRIBUTIVA');
  const fiscalValidation = result.fiscalAnalysis?.validation;
  if (!fiscalValidation) {
    output.push('Validazione fiscale e contributiva non disponibile.');
  } else {
    output.push(
      `Stato complessivo: ${fiscalValidation.overallStatus}`,
      `Confidence: ${fiscalValidation.confidence}`,
      `Superati: ${fiscalValidation.summary.passed}`,
      `Warning: ${fiscalValidation.summary.warnings}`,
      `Falliti: ${fiscalValidation.summary.failed}`,
      `Non eseguiti: ${fiscalValidation.summary.skipped}`,
      ''
    );
    fiscalValidation.checks.forEach((check) => {
      output.push(
        `[${check.status.toUpperCase()}][${check.id}] ${check.title}`,
        `  Severity: ${check.severity}`,
        `  Confidence: ${check.confidence}`,
        `  Formula/dati: ${check.metadata ? JSON.stringify(check.metadata) : 'non disponibili'}`,
        `  Valore atteso: ${fmt(check.expectedValue)}`,
        `  Valore ufficiale: ${fmt(check.actualValue)}`,
        `  Differenza: ${fmt(check.difference)}`,
        `  Motivo/esito: ${check.explanation}`,
        ''
      );
    });
  }

  section('14. TIMELINE STORICA');
  if (!historicalValidation) {
    output.push('Validazione storica non disponibile per questa esportazione.');
  } else if (!historicalValidation.timeline.length) {
    output.push('Nessun cedolino nello storico locale.');
  } else {
    historicalValidation.timeline.forEach((item) => {
      output.push(
        `${item.periodKey ?? 'PERIODO NON IDENTIFICATO'} | ${item.documentType}`,
        `  Cedolino: ${item.payslipId}`,
        `  Azienda: ${value(item.companyName)}`,
        `  Data pagamento: ${value(item.paymentDate)}`,
        `  Confidence periodo: ${item.periodConfidence}`,
        `  Confidence rapporto: ${item.relationshipConfidence}`,
        `  Ambiguo: ${item.ambiguous ? 'sì' : 'no'}`
      );
    });
  }

  section('15. CONTROLLI STORICI MULTI-MESE');
  if (!historicalValidation) {
    output.push('Controlli storici non disponibili.');
  } else {
    output.push(
      `Schema: ${historicalValidation.schemaVersion}`,
      `Stato complessivo: ${historicalValidation.overallStatus}`,
      `Confidence: ${historicalValidation.confidence}`,
      `Superati: ${historicalValidation.summary.passed}`,
      `Warning: ${historicalValidation.summary.warnings}`,
      `Falliti: ${historicalValidation.summary.failed}`,
      `Non eseguiti: ${historicalValidation.summary.skipped}`,
      ''
    );
    historicalValidation.checks.forEach((check) => {
      output.push(
        `[${check.status.toUpperCase()}][${check.id}] ${check.category}`,
        `  Periodo precedente: ${value(check.previousPeriod)}`,
        `  Periodo corrente: ${value(check.currentPeriod)}`,
        `  Valore precedente: ${fmt(check.previousValue)}`,
        `  Valore corrente: ${fmt(check.currentValue)}`,
        `  Delta atteso: ${fmt(check.expectedDelta)}`,
        `  Delta effettivo: ${fmt(check.actualDelta)}`,
        `  Differenza: ${fmt(check.difference)}`,
        `  Confidence: ${check.confidence}`,
        `  Esito: ${check.explanation}`,
        ''
      );
    });
  }

  section('16. VARIAZIONI DELLE VOCI PAGA');
  if (!historicalValidation?.lineSeries.length) {
    output.push('Serie storiche delle voci paga non disponibili.');
  } else {
    historicalValidation.lineSeries.forEach((series) => {
      output.push(
        `${series.canonicalKey} | ${series.description}`,
        `  Comportamento: ${series.behavior}`,
        `  Media: ${fmt(series.average)}`,
        `  Mediana: ${fmt(series.median)}`,
        `  Minimo: ${fmt(series.minimum)}`,
        `  Massimo: ${fmt(series.maximum)}`,
        ...series.points.map((point) =>
          `  ${point.period}: importo=${fmt(point.amount)}, quantità=${fmt(point.quantity)}, tariffa=${fmt(point.unitValue)}, unità=${value(point.quantityUnit)}`
        ),
        ''
      );
    });
  }

  return `${output.join('\n').trim()}\n`;
};

const safeFilePart = (input: string) =>
  input
    .replace(/\.pdf$/i, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'documento';

export const buildDriverPayrollReadDiagnosticFileName = (result: DriverPayrollImportResult): string => {
  const payslip = result.temporaryReadDiagnostic?.parserPayslip ?? result.payslip;
  const period = payslip?.year && payslip?.month
    ? `${payslip.year}-${String(payslip.month).padStart(2, '0')}`
    : 'periodo-non-rilevato';
  return `Diagnostica_BustaPaga_${period}_${safeFilePart(result.fileName)}.txt`;
};
