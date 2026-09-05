import { analyzeDriverPayrollHistory, extractDriverPayrollMonthlyValues } from './driverPayrollAnalysis';
import type { DriverPayrollComparisonResult } from './driverPayrollComparison';
import type { DriverPayrollRuleExplanation } from './driverPayrollRuleExplanationEngine';
import type { DriverPayrollSimulationResult } from './driverPayrollSimulator';
import type {
  DriverPayrollCompanyProfile,
  DriverPayrollRuleDefinition,
  PayrollPrediction,
  PayslipImport,
  PayslipLine,
} from './driverPayrollTypes';
import { getPayslipLineEconomicAmount, getPayslipLineQuantity } from './driverPayrollLineValues';

export type DriverPayrollAssistantSourceType =
  | 'payslipHistory'
  | 'prediction'
  | 'comparison'
  | 'attendance'
  | 'ccnlRule'
  | 'companyProfile'
  | 'manualInput';

export interface DriverPayrollAssistantResponse {
  title: string;
  answer: string;
  details?: string[];
  sourceTypes: DriverPayrollAssistantSourceType[];
  confidence: 'high' | 'medium' | 'low';
  warnings?: string[];
  suggestedQuestions?: string[];
}

export interface DriverPayrollAssistantInput {
  question: string;
  year?: number;
  month?: number;
  payslipHistory?: PayslipImport[];
  predictions?: PayrollPrediction[];
  comparison?: DriverPayrollComparisonResult;
  ruleExplanations?: DriverPayrollRuleExplanation[];
  simulation?: DriverPayrollSimulationResult;
  companyProfile?: DriverPayrollCompanyProfile;
  ccnlRules?: DriverPayrollRuleDefinition[];
}

type Intent =
  | 'futurePay'
  | 'net'
  | 'gross'
  | 'difference'
  | 'travel'
  | 'worked'
  | 'sunday'
  | 'vacation'
  | 'permit'
  | 'sickness'
  | 'abort'
  | 'manual'
  | 'missing'
  | 'importantDifferences'
  | 'ruleExplanations'
  | 'notPredictable'
  | 'verifyFields'
  | 'netTrend'
  | 'netAverage'
  | 'highestNet'
  | 'lowestNet'
  | 'fallback';

const euroFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
});

const numberFormatter = new Intl.NumberFormat('it-IT', {
  maximumFractionDigits: 2,
});

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const hasAny = (text: string, words: string[]) => words.some((word) => text.includes(word));

const formatCurrency = (value?: number) =>
  value === undefined ? 'Dato non disponibile' : euroFormatter.format(value);

const formatNumber = (value?: number) =>
  value === undefined ? 'Dato non disponibile' : numberFormatter.format(value);

const unique = <T,>(items: T[]) => Array.from(new Set(items));

const detectIntent = (question: string): Intent => {
  const q = normalize(question);

  if (hasAny(q, [
    'quanto prendero',
    'quanto prendo',
    'quanto guadagnero',
    'quanto guadagno questo mese',
    'stipendio previsto',
    'stipendio atteso',
    'stipendio futuro',
    'quale sara il mio stipendio',
    'quale sara il mio netto',
    'netto previsto',
    'lordo previsto',
    'previsione stipendio',
  ])) return 'futurePay';
  if (hasAny(q, ['media netta', 'media netto'])) return 'netAverage';
  if (hasAny(q, ['andamento netto', 'trend netto'])) return 'netTrend';
  if (hasAny(q, ['netto piu alto', 'mese con netto alto', 'massimo netto'])) return 'highestNet';
  if (hasAny(q, ['netto piu basso', 'mese con netto basso', 'minimo netto'])) return 'lowestNet';
  if (hasAny(q, ['dati mancano', 'cosa manca', 'quali dati mancano', 'piu precisa'])) return 'missing';
  if (hasAny(q, ['non prevedibile', 'non stimabile', 'prevedibile automaticamente'])) return 'notPredictable';
  if (hasAny(q, ['campi da verificare', 'da verificare', 'controllare busta'])) return 'verifyFields';
  if (hasAny(q, ['spiegazioni', 'motivi', 'possibili motivi', 'rule explanation'])) return 'ruleExplanations';
  if (hasAny(q, ['differenze importanti', 'scostamenti importanti'])) return 'importantDifferences';
  if (hasAny(q, ['differenza', 'scostamento', 'meno', 'piu', 'previsto reale'])) return 'difference';
  if (hasAny(q, ['trasferta', 'trasferte', 'indennita trasferta'])) return 'travel';
  if (hasAny(q, ['giorni lavorati', 'giorni ho lavorato', 'quanto ho lavorato'])) return 'worked';
  if (hasAny(q, ['domenica', 'domeniche', 'domenicale'])) return 'sunday';
  if (hasAny(q, ['ferie', 'giorni ferie'])) return 'vacation';
  if (hasAny(q, ['permesso', 'permessi', 'par'])) return 'permit';
  if (hasAny(q, ['malattia', 'giorni malattia'])) return 'sickness';
  if (hasAny(q, ['abort', 'rotta annullata', 'giornata annullata'])) return 'abort';
  if (hasAny(q, ['manuali', 'voce manuale', 'voci manuali'])) return 'manual';
  if (hasAny(q, ['lordo', 'retribuzione lorda', 'competenze'])) return 'gross';
  if (hasAny(q, ['netto', 'quanto prendo', 'quanto prendero', 'stipendio', 'paga'])) return 'net';
  return 'fallback';
};

const findPayslip = (input: DriverPayrollAssistantInput) =>
  input.payslipHistory?.find((item) => item.year === input.year && item.month === input.month);

const findPrediction = (input: DriverPayrollAssistantInput) =>
  input.predictions?.find((item) => item.year === input.year && item.month === input.month);

const sumLines = (lines: PayslipLine[] = [], codes: string[], valueKey: 'quantity' | 'amount') => {
  const matching = lines.filter((line) => line.code && codes.includes(line.code));
  if (matching.length === 0) return undefined;
  return matching.reduce(
    (total, line) =>
      total +
      (valueKey === 'quantity'
        ? getPayslipLineQuantity(line) ?? 0
        : getPayslipLineEconomicAmount(line) ?? 0),
    0
  );
};

const createResponse = (response: DriverPayrollAssistantResponse): DriverPayrollAssistantResponse => ({
  suggestedQuestions: [
    'Quanti giorni ho lavorato questo mese?',
    'Quante trasferte risultano questo mese?',
    'Quanti permessi ho registrato?',
  ],
  ...response,
  sourceTypes: unique(response.sourceTypes),
});

const getMetricRow = (input: DriverPayrollAssistantInput, key: string) =>
  input.comparison?.rows.find((row) => row.key === key);

const unavailable = (): DriverPayrollAssistantResponse =>
  createResponse({
    title: 'Dati non sufficienti',
    answer: 'Non ci sono dati sufficienti per rispondere con precisione.',
    sourceTypes: [],
    confidence: 'low',
    warnings: ['Importa una busta, salva un riepilogo mese o inserisci turni per il mese selezionato.'],
  });

export const answerDriverPayrollQuestion = (input: DriverPayrollAssistantInput): DriverPayrollAssistantResponse => {
  const intent = detectIntent(input.question);
  const payslip = findPayslip(input);
  const prediction = findPrediction(input);
  const actualValues = payslip ? extractDriverPayrollMonthlyValues(payslip) : undefined;
  const simulation = input.simulation;

  if (intent === 'futurePay') {
    return createResponse({
      title: 'Riepilogo del mese',
      answer: 'Driver Utility non calcola uno stipendio netto o lordo futuro completo. Posso mostrarti i dati registrati del mese, come giorni lavorati, trasferte, ferie, permessi e altre componenti disponibili.',
      sourceTypes: [],
      confidence: 'high',
    });
  }

  if (intent === 'net' || intent === 'gross') {
    const isNet = intent === 'net';
    const label = isNet ? 'Netto' : 'Lordo';
    const realValue = isNet ? payslip?.summary.netAmount : payslip?.summary.grossAmount ?? payslip?.summary.totalEarnings;
    if (realValue !== undefined) {
      return createResponse({
        title: `${label} reale`,
        answer: `Dato certo da busta reale importata: ${formatCurrency(realValue)}.`,
        sourceTypes: ['payslipHistory'],
        confidence: 'high',
      });
    }

    return unavailable();
  }

  if (intent === 'difference') {
    const important = input.comparison?.rows.filter((row) => row.difference !== undefined && row.severity !== 'match') ?? [];
    if (important.length === 0) return unavailable();
    return createResponse({
      title: 'Differenza previsto/reale',
      answer: `Risultano ${important.length} differenze tra previsto e reale nel mese selezionato.`,
      details: important.map((row) => `${row.label}: ${formatNumber(row.difference)} (${row.severity}).`),
      sourceTypes: ['comparison'],
      confidence: 'high',
    });
  }

  if (intent === 'travel') {
    const actualQuantity = actualValues?.travelDays;
    const actualAmount = payslip ? sumLines(payslip.parsedLines, ['2310'], 'amount') : undefined;
    const predictedQuantity = prediction?.inputSnapshot.eligibleTravelDays ?? simulation?.estimate.summary.eligibleTravelDays;
    const predictedAmount = prediction ? sumLines(prediction.predictedLines, ['2310'], 'amount') : sumLines(simulation?.estimate.predictedLines, ['2310'], 'amount');
    const quantity = actualQuantity ?? predictedQuantity;
    if (quantity === undefined) return unavailable();
    return createResponse({
      title: 'Trasferte',
      answer: `${actualQuantity !== undefined ? 'Dato certo da busta reale' : 'Questa e una stima'}: risultano ${formatNumber(quantity)} trasferte.`,
      details: [`Valore trasferte: ${formatCurrency(actualAmount ?? predictedAmount)}.`],
      sourceTypes: actualQuantity !== undefined ? ['payslipHistory'] : ['prediction', 'attendance', 'companyProfile', 'ccnlRule'],
      confidence: actualQuantity !== undefined ? 'high' : 'medium',
    });
  }

  if (intent === 'worked') {
    const workedLine = payslip?.parsedLines.find((line) => line.code === '0170');
    const actualDays = workedLine ? getPayslipLineQuantity(workedLine) ?? workedLine.amount : undefined;
    const knownDays = actualDays ?? prediction?.inputSnapshot.workedDays ?? simulation?.eventSummary.workedDays;
    if (knownDays === undefined) return unavailable();
    return createResponse({
      title: 'Giorni lavorati',
      answer: `Risultano ${formatNumber(knownDays)} giorni lavorati nel mese selezionato.`,
      sourceTypes: actualDays !== undefined ? ['payslipHistory'] : ['prediction', 'attendance'],
      confidence: actualDays !== undefined ? 'high' : 'medium',
    });
  }

  if (intent === 'sunday') {
    const days = prediction?.inputSnapshot.sundaysWorked ?? simulation?.estimate.summary.sundaysWorked;
    const amount = sumLines(prediction?.predictedLines ?? simulation?.estimate.predictedLines, ['2315'], 'amount');
    if (days === undefined) return unavailable();
    return createResponse({
      title: 'Domeniche lavorate',
      answer: `Risultano ${formatNumber(days)} domeniche lavorate nei dati locali.`,
      details: [`Incidenza domenicale nota: ${formatCurrency(amount)}.`],
      sourceTypes: ['prediction', 'attendance', 'companyProfile', 'ccnlRule'],
      confidence: amount !== undefined ? 'medium' : 'low',
      warnings: amount === undefined ? ['La maggiorazione domenicale puo richiedere verifica o configurazione aziendale.'] : undefined,
    });
  }

  if (intent === 'vacation' || intent === 'permit' || intent === 'sickness' || intent === 'abort') {
    const labels = {
      vacation: 'Ferie',
      permit: 'Permessi',
      sickness: 'Malattia',
      abort: 'Abort',
    } as const;
    const valueMap = {
      vacation: prediction?.inputSnapshot.vacationDays ?? simulation?.estimate.summary.vacationDays,
      permit: prediction?.inputSnapshot.parHours ?? simulation?.estimate.summary.parHours,
      sickness: prediction?.inputSnapshot.sicknessDays ?? simulation?.estimate.summary.sicknessDays,
      abort: prediction?.inputSnapshot.abortDays ?? simulation?.estimate.summary.abortDays,
    };
    const value = valueMap[intent];
    if (value === undefined) return unavailable();
    const warning =
      intent === 'sickness'
        ? 'La malattia ha formula parziale: non vengono inventate formule fiscali mancanti.'
        : intent === 'abort'
          ? 'Abort: secondo le regole locali non genera trasferta o maggiorazioni.'
          : undefined;
    const predictionPermitDays = prediction?.inputSnapshot.attendanceEvents.some((event) => event.status === 'par')
      ? prediction.inputSnapshot.attendanceEvents.filter((event) => event.status === 'par').length
      : undefined;
    const permitDays = intent === 'permit' ? predictionPermitDays ?? simulation?.eventSummary.permitDays : undefined;
    const answer = intent === 'permit'
      ? `Nei dati locali risultano ${permitDays !== undefined ? `${formatNumber(permitDays)} giorni / ` : ''}${formatNumber(value)} ore di permesso.`
      : `Nei dati locali risultano ${formatNumber(value)} ${labels[intent].toLowerCase()}.`;
    return createResponse({
      title: labels[intent],
      answer,
      sourceTypes: ['prediction', 'attendance', 'ccnlRule'],
      confidence: warning ? 'medium' : 'high',
      warnings: warning ? [warning] : undefined,
    });
  }

  if (intent === 'manual') {
    const manualLines = (prediction?.predictedLines ?? simulation?.estimate.predictedLines ?? []).filter((line) => line.section === 'manual');
    return createResponse({
      title: 'Voci manuali',
      answer: manualLines.length > 0 ? `Sono presenti ${manualLines.length} voci manuali.` : 'Non risultano voci manuali inserite.',
      details: manualLines.map((line) => `${line.label}: ${formatCurrency(line.amount)}.`),
      sourceTypes: ['manualInput', 'prediction'],
      confidence: 'high',
    });
  }

  if (intent === 'missing') {
    const missing = unique([
      ...(prediction?.missingData ?? []),
      ...(simulation?.estimate.requiresManualInputs ?? []),
      ...(simulation?.estimate.warnings ?? []),
    ]);
    return createResponse({
      title: 'Dati mancanti',
      answer: missing.length > 0 ? 'Per un riepilogo piu completo mancano alcuni dati.' : 'Non risultano dati mancanti principali per il mese selezionato.',
      details: missing,
      sourceTypes: ['prediction', 'attendance', 'companyProfile', 'ccnlRule'],
      confidence: missing.length > 0 ? 'medium' : 'high',
    });
  }

  if (intent === 'notPredictable') {
    const details = [
      input.companyProfile?.pdrMode === 'nonPredictable' ? 'PDR/premi: questa voce non e stimabile automaticamente.' : undefined,
      'Formule fiscali complesse non implementate: non vengono inventate.',
      ...(simulation?.estimate.requiresManualInputs ?? []).filter((item) => item.toLowerCase().includes('pdr') || item.toLowerCase().includes('premi')),
    ].filter((item): item is string => Boolean(item));
    return createResponse({
      title: 'Voci non prevedibili',
      answer: 'Questa voce non e stimabile automaticamente quando manca una regola locale certa.',
      details,
      sourceTypes: ['companyProfile', 'ccnlRule'],
      confidence: 'medium',
    });
  }

  if (intent === 'importantDifferences' || intent === 'ruleExplanations') {
    const explanations = input.ruleExplanations ?? [];
    if (explanations.length === 0) {
      return createResponse({
        title: 'Possibili spiegazioni',
        answer: 'Non risultano spiegazioni importanti generate dal Rule Explanation Engine.',
        sourceTypes: ['comparison'],
        confidence: 'low',
      });
    }
    return createResponse({
      title: 'Possibili spiegazioni',
      answer: `Il Rule Explanation Engine ha trovato ${explanations.length} possibili spiegazioni.`,
      details: explanations.map((item) => `${item.title}: ${item.description} (${item.confidence}).`),
      sourceTypes: ['comparison', 'ccnlRule'],
      confidence: 'medium',
    });
  }

  if (intent === 'verifyFields') {
    const fields = Object.entries(payslip?.fieldConfidence ?? {}).filter(([, info]) => info.confidence === 'missing' || info.confidence === 'uncertain');
    const warnings = payslip?.warnings ?? [];
    if (fields.length === 0 && warnings.length === 0) return unavailable();
    return createResponse({
      title: 'Campi da verificare',
      answer: 'Alcuni dati della busta richiedono verifica.',
      details: [...fields.map(([field, info]) => `${field}: ${info.confidence}.`), ...warnings],
      sourceTypes: ['payslipHistory'],
      confidence: 'medium',
    });
  }

  if (['netTrend', 'netAverage', 'highestNet', 'lowestNet'].includes(intent)) {
    const analysis = analyzeDriverPayrollHistory(input.payslipHistory ?? []);
    if (analysis.totalPayslips === 0) return unavailable();
    if (intent === 'netAverage') {
      return createResponse({
        title: 'Media netta storico',
        answer: `La media netta dello storico e ${formatCurrency(analysis.averages.netAmount)}.`,
        sourceTypes: ['payslipHistory'],
        confidence: analysis.averages.netAmount !== undefined ? 'high' : 'low',
      });
    }
    if (intent === 'netTrend') {
      const trend = analysis.trends.find((item) => item.key === 'netAmount');
      return createResponse({
        title: 'Andamento del netto',
        answer: trend ? trend.message : 'Non ci sono dati sufficienti per calcolare un trend affidabile.',
        sourceTypes: ['payslipHistory'],
        confidence: trend ? 'medium' : 'low',
      });
    }
    const sorted = analysis.monthly
      .filter((item) => item.values.netAmount !== undefined)
      .sort((a, b) => (a.values.netAmount ?? 0) - (b.values.netAmount ?? 0));
    const selected = intent === 'highestNet' ? sorted[sorted.length - 1] : sorted[0];
    if (!selected) return unavailable();
    return createResponse({
      title: intent === 'highestNet' ? 'Netto piu alto' : 'Netto piu basso',
      answer: `${selected.label}: ${formatCurrency(selected.values.netAmount)}.`,
      sourceTypes: ['payslipHistory'],
      confidence: 'high',
    });
  }

  const netRow = getMetricRow(input, 'netAmount');
  if (netRow?.severity === 'large') {
    return createResponse({
      title: 'Domanda non riconosciuta con precisione',
      answer: 'Posso aiutarti sui dati payroll locali. Ho trovato una differenza importante sul netto.',
      details: [`Netto: ${formatNumber(netRow.difference)}.`],
      sourceTypes: ['comparison'],
      confidence: 'low',
      warnings: ['Riformula la domanda indicando netto, lordo, trasferte, ferie, malattia o differenze.'],
    });
  }

  return unavailable();
};
