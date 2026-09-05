import { describe, expect, it } from 'vitest';
import { answerDriverPayrollQuestion } from './driverPayrollAssistant';
import { compareDriverPayrollMonth } from './driverPayrollComparison';
import { explainDriverPayrollComparison } from './driverPayrollRuleExplanationEngine';
import { createDriverPayrollSimulation } from './driverPayrollSimulator';
import { GENERIC_LOGISTICS_DL05_PROFILE } from './driverPayrollCompanyProfiles';
import { DRIVER_PAYROLL_BASE_RULES } from './driverPayrollRules';
import type { PayrollPrediction, PayslipImport } from './driverPayrollTypes';

const payslip: PayslipImport = {
  id: 'payslip_2026_02',
  year: 2026,
  month: 2,
  importedAt: '2026-03-01T10:00:00.000Z',
  extractionMethod: 'pdf_text',
  parsedLines: [
    { code: '2310', label: 'Trasferta', quantity: 18, amount: 405 },
    { code: '2030', label: 'Straordinario', quantity: 4, amount: 80 },
  ],
  summary: {
    grossAmount: 2400,
    netAmount: 1850,
  },
  fieldConfidence: {
    bonus: { confidence: 'uncertain', parserUsed: 'test', value: 'PDR' },
  },
  warnings: ['Campo premio da verificare'],
};

const prediction: PayrollPrediction = {
  id: 'prediction_2026_02',
  year: 2026,
  month: 2,
  createdAt: '2026-02-28T10:00:00.000Z',
  inputSnapshot: {
    year: 2026,
    month: 2,
    attendanceEvents: [],
    workedDays: 17,
    eligibleTravelDays: 17,
    sundaysWorked: 2,
    holidaysWorked: 1,
    vacationDays: 1,
    parHours: 8,
    sicknessDays: 1,
    injuryDays: 0,
    strikeHours: 0,
    abortDays: 1,
    ordinaryHours: 136,
    effectiveHours: 136,
    theoreticalHours: 160,
    overtime30Hours: 3,
    overtime50Hours: 0,
  },
  predictedLines: [
    { code: '2310', label: 'Trasferta', quantity: 17, amount: 382.5, type: 'earning' },
    { code: '2315', label: 'Domenica', quantity: 2, amount: 14, type: 'earning' },
    { label: 'Bonus manuale', amount: 50, type: 'earning', section: 'manual' },
  ],
  predictedSummary: {
    grossAmount: 2200,
    netAmount: 1700,
  },
  assumptions: [],
  missingData: ['Importo orario straordinario/supplementare 30 autorizzato.'],
};

const comparison = compareDriverPayrollMonth({
  year: 2026,
  month: 2,
  predicted: { netAmount: 1700, grossAmount: 2200, travelDays: 15 },
  actual: { netAmount: 1850, grossAmount: 2400, travelDays: 18 },
});
const explanations = explainDriverPayrollComparison(comparison);
const simulation = createDriverPayrollSimulation({
  year: 2026,
  month: 1,
  attendance: {
    '2026-02-02': { status: 'Lavorato' },
    '2026-02-03': { status: 'Ferie' },
    '2026-02-04': { status: 'Malattia' },
    '2026-02-05': { status: 'Rotta abortita' },
  },
});

const ask = (question: string, extra = {}) =>
  answerDriverPayrollQuestion({
    question,
    year: 2026,
    month: 2,
    payslipHistory: [payslip],
    predictions: [prediction],
    comparison,
    ruleExplanations: explanations,
    simulation,
    companyProfile: GENERIC_LOGISTICS_DL05_PROFILE,
    ccnlRules: DRIVER_PAYROLL_BASE_RULES,
    ...extra,
  });

describe('driverPayrollAssistant', () => {
  it('non presenta come stipendio il netto salvato nelle previsioni legacy', () => {
    const response = ask('Qual e il netto previsto?', { payslipHistory: [] });
    expect(response.answer).toContain('non calcola uno stipendio netto o lordo futuro completo');
    expect(response.answer).not.toContain('1700');
    expect(response.sourceTypes).not.toContain('prediction');
  });

  it('risponde sul netto reale', () => {
    const response = ask('Qual e il netto reale?');
    expect(response.answer).toContain('Dato certo');
    expect(response.answer).toContain('1850');
  });

  it('risponde sul lordo reale letto dal cedolino', () => {
    const response = ask('Qual e il lordo reale?');
    expect(response.title).toBe('Lordo reale');
    expect(response.answer).toContain('Dato certo da busta reale importata');
    expect(response.answer).toContain('2400');
    expect(response.sourceTypes).toContain('payslipHistory');
  });

  it('spiega il limite anche se esiste un cedolino reale del mese', () => {
    const response = ask('Quanto prendero questo mese?');
    expect(response.title).toBe('Riepilogo del mese');
    expect(response.answer).toContain('non calcola uno stipendio netto o lordo futuro completo');
    expect(response.answer).not.toContain('1850');
  });

  it('risponde sulla differenza', () => {
    expect(ask('Qual e la differenza tra previsto e reale?').sourceTypes).toContain('comparison');
  });

  it('risponde sulle trasferte', () => {
    const response = ask('Quante trasferte risultano?');
    expect(response.answer).toContain('18');
    expect(response.details?.join(' ')).toContain('405');
    expect(`${response.answer} ${response.details?.join(' ')}`).not.toMatch(/stipendio|netto|lordo/i);
  });

  it('risponde sui giorni lavorati conosciuti', () => {
    const response = ask('Quanti giorni ho lavorato questo mese?', { payslipHistory: [] });
    expect(response.answer).toContain('17');
    expect(response.sourceTypes).toContain('prediction');
  });

  it('risponde sulle domeniche', () => {
    expect(ask('Quante domeniche risultano lavorate?').answer).toContain('2');
  });

  it('risponde sulle ferie', () => {
    expect(ask('Quanti giorni di ferie risultano?').answer).toContain('1');
  });

  it('risponde sui permessi come quantita senza attribuire un valore economico', () => {
    const response = ask('Quanti permessi ho registrato?');
    expect(response.answer).toContain('8 ore');
    expect(response.answer).not.toContain('€');
  });

  it('risponde sulla malattia', () => {
    const response = ask('Quanto incide la malattia?');
    expect(response.answer).toContain('1');
    expect(response.warnings?.join(' ')).toContain('parziale');
  });

  it('risponde sugli abort', () => {
    expect(ask('Quanti abort risultano?').warnings?.join(' ')).toContain('non genera trasferta');
  });

  it('elenca dati mancanti', () => {
    expect(ask('Quali dati mancano?').details?.join(' ')).toContain('Importo orario');
  });

  it('dichiara voce non prevedibile', () => {
    expect(ask('Che cosa non e prevedibile automaticamente?').answer).toContain('non e stimabile automaticamente');
  });

  it('produce confidence alta', () => {
    expect(ask('Qual e il netto reale?').confidence).toBe('high');
  });

  it('produce confidence media', () => {
    expect(ask('Quali dati mancano?').confidence).toBe('medium');
  });

  it('produce confidence bassa', () => {
    expect(answerDriverPayrollQuestion({ question: 'domanda non riconosciuta', year: 2026, month: 2 }).confidence).toBe('low');
  });

  it('gestisce nessun dato disponibile', () => {
    expect(answerDriverPayrollQuestion({ question: 'netto' }).answer).toContain('Non ci sono dati sufficienti');
  });

  it('risponde con spiegazioni del Rule Explanation Engine', () => {
    const response = ask('Quali possibili spiegazioni risultano?');
    expect(response.sourceTypes).toContain('ccnlRule');
  });

  it('risponde sui campi da verificare', () => {
    expect(ask('Quali campi della busta sono da verificare?').details?.join(' ')).toContain('bonus');
  });

  it('risponde sulla media netta dello storico', () => {
    expect(ask('Qual e la media netta?').answer).toContain('1850');
  });

  it('non contiene riferimenti cloud o supabase', () => {
    const serialized = JSON.stringify(ask('Quanto prendero questo mese?')).toLowerCase();
    expect(serialized).not.toContain('supabase');
    expect(serialized).not.toContain('cloud');
  });

  it('non usa grossAmount o netAmount legacy per domande sul futuro', () => {
    const response = ask('Quale sara il mio netto?');
    expect(response.answer).toContain('non calcola uno stipendio');
    expect(response.answer).not.toMatch(/1700|1850|2200|2400/);
    expect(response.sourceTypes).not.toContain('prediction');
  });

  it('non usa dati reali di un altro mese', () => {
    const response = answerDriverPayrollQuestion({
      question: 'Qual e il netto reale?',
      year: 2026,
      month: 3,
      payslipHistory: [payslip],
      predictions: [prediction],
    });

    expect(response.answer).toContain('Non ci sono dati sufficienti');
    expect(response.confidence).toBe('low');
  });

  it('ignora il netto legacy della previsione quando non esiste una busta reale', () => {
    const marchPrediction = { ...prediction, id: 'prediction_2026_03', month: 3, predictedSummary: { netAmount: 1900 } };
    const response = answerDriverPayrollQuestion({
      question: 'Qual e il netto previsto?',
      year: 2026,
      month: 3,
      payslipHistory: [payslip],
      predictions: [prediction, marchPrediction],
    });

    expect(response.answer).toContain('non calcola uno stipendio netto o lordo futuro completo');
    expect(response.answer).not.toContain('1900');
    expect(response.sourceTypes).not.toContain('prediction');
  });
});
