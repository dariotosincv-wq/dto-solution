import { describe, expect, it } from 'vitest';
import { reconstructPdfLines, type PdfTextItem, type StructuredPdfText } from '../driverPayrollPdfLayout';
import { parsePayslipFinalSummary } from './finalSummaryParser';

const layoutFromItems = (items: PdfTextItem[]): StructuredPdfText => {
  const reconstructedLines = reconstructPdfLines(items);
  return {
    pages: 1,
    items,
    reconstructedLines,
    plainText: reconstructedLines.map((line) => line.text).join('\n'),
  };
};

const item = (text: string, x: number, y: number): PdfTextItem => ({ text, page: 1, x, y, width: text.length * 6, height: 10 });

describe('parsePayslipFinalSummary', () => {
  it('legge MARZO 2026 dal riepilogo finale e ignora data valuta aprile', () => {
    const summary = parsePayslipFinalSummary(
      layoutFromItems([
        item('DATA VALUTA', 30, 150),
        item('14/04/2026', 180, 150),
        item('PERIODO DI PAGA', 30, 130),
        item('MARZO', 180, 130),
        item('2026', 240, 130),
        item('TOTALE COMPETENZE', 30, 110),
        item('2.224,18', 250, 110),
        item('TOTALE TRATTENUTE', 30, 90),
        item('367,86', 250, 90),
        item('NETTO', 30, 70),
        item('1.856,32', 250, 70),
      ])
    );

    expect(summary.month).toBe(3);
    expect(summary.year).toBe(2026);
    expect(summary.periodLabel).toBe('MARZO 2026');
    expect(summary.totalEarnings).toBe(2224.18);
    expect(summary.totalDeductions).toBe(367.86);
    expect(summary.net).toBe(1856.32);
    expect(summary.paymentDate).toBe('2026-04-14');
    expect(summary.confidence).toBeGreaterThanOrEqual(90);
  });

  it('legge label sopra e valore sotto', () => {
    const summary = parsePayslipFinalSummary(
      layoutFromItems([
        item('PERIODO DI PAGA', 30, 130),
        item('APRILE 2026', 30, 115),
        item('TOTALE COMPETENZE', 30, 95),
        item('3.025,79', 30, 80),
        item('TOTALE TRATTENUTE', 30, 60),
        item('841,11', 30, 45),
        item('NETTO', 30, 25),
        item('2.184,68', 30, 10),
        item('DATA VALUTA 14/05/2026', 300, 10),
      ])
    );

    expect(summary.month).toBe(4);
    expect(summary.year).toBe(2026);
    expect(summary.totalEarnings).toBe(3025.79);
    expect(summary.totalDeductions).toBe(841.11);
    expect(summary.net).toBe(2184.68);
  });

  it('legge dicembre 2025 anche con data valuta gennaio 2026', () => {
    const summary = parsePayslipFinalSummary(
      layoutFromItems([
        item('PERIODO DI PAGA', 30, 100),
        item('DICEMBRE', 200, 100),
        item('2025', 280, 100),
        item('DATA VALUTA', 30, 80),
        item('14/01/2026', 200, 80),
        item('NETTO', 30, 60),
        item('1.600,00', 200, 60),
      ])
    );

    expect(summary.month).toBe(12);
    expect(summary.year).toBe(2025);
  });

  it('non usa periodo quando la label non esiste', () => {
    const summary = parsePayslipFinalSummary(
      layoutFromItems([
        item('DATA VALUTA', 30, 100),
        item('14/04/2026', 200, 100),
        item('NETTO', 30, 80),
        item('1.856,32', 200, 80),
      ])
    );

    expect(summary.month).toBeUndefined();
    expect(summary.year).toBeUndefined();
    expect(summary.warnings).toContain('Periodo di paga non trovato nel riepilogo finale.');
  });

  it('usa NETTO esplicito e non bonifico o arrotondamento vicini', () => {
    const summary = parsePayslipFinalSummary(
      layoutFromItems([
        item('BONIFICO 1.856,32', 30, 110),
        item('ARROTONDAMENTO 0,01', 30, 90),
        item('NETTO', 30, 70),
        item('1.856,32', 200, 70),
      ])
    );

    expect(summary.net).toBe(1856.32);
  });

  it('rifiuta valori fiscali sopra il riepilogo e sceglie la combinazione coerente', () => {
    const summary = parsePayslipFinalSummary(
      layoutFromItems([
        item('ALTRE DETRAZIONI', 30, 185),
        item('768,91', 260, 185),
        item('TFR VALORE FISCALE', 30, 168),
        item('133,43', 260, 168),
        item('TOTALE TRATTENUTE', 30, 120),
        item('367,86', 260, 120),
        item('TOTALE COMPETENZE', 360, 120),
        item('2.224,18', 560, 120),
        item('NETTO', 360, 95),
        item('1.856,32', 560, 95),
      ])
    );

    expect(summary.totalEarnings).toBe(2224.18);
    expect(summary.totalDeductions).toBe(367.86);
    expect(summary.net).toBe(1856.32);
    expect(summary.isEconomicallyConsistent).toBe(true);
    expect(summary.totalEarnings).not.toBe(768.91);
    expect(summary.totalDeductions).not.toBe(768.91);
    expect(summary.net).not.toBe(133.43);
  });

  it('non riusa il candidato delle trattenute per totale competenze', () => {
    const summary = parsePayslipFinalSummary(
      layoutFromItems([
        item('TOTALE TRATTENUTE', 30, 120),
        item('367,86', 220, 120),
        item('TOTALE COMPETENZE', 340, 120),
        item('2.224,18', 560, 120),
        item('NETTO', 340, 95),
        item('1.856,32', 560, 95),
        item('PERIODO DI PAGA', 30, 70),
        item('MARZO', 220, 70),
        item('2026', 280, 70),
      ])
    );

    expect(summary.totalEarnings).toBe(2224.18);
    expect(summary.totalDeductions).toBe(367.86);
    expect(summary.net).toBe(1856.32);
    expect(summary.totalEarnings).not.toBe(summary.totalDeductions);
    expect(summary.sources.totalEarnings?.match?.valueBox).not.toEqual(summary.sources.totalDeductions?.match?.valueBox);
    expect(summary.sources.totalEarnings?.match?.value).not.toBe(367.86);
    expect(summary.isEconomicallyConsistent).toBe(true);
  });

  it('legge periodo, competenze, trattenute e netto come blocco atomico anche sulla stessa riga', () => {
    const summary = parsePayslipFinalSummary(
      layoutFromItems([
        item('PERIODO DI PAGA MARZO 2026', 30, 150),
        item('TOTALE TRATTENUTE', 30, 120),
        item('367,86', 220, 120),
        item('TOTALE COMPETENZE', 340, 120),
        item('2.224,18', 560, 120),
        item('NETTO', 30, 95),
        item('1.856,32', 220, 95),
      ])
    );

    expect(summary.month).toBe(3);
    expect(summary.year).toBe(2026);
    expect(summary.totalEarnings).toBe(2224.18);
    expect(summary.totalDeductions).toBe(367.86);
    expect(summary.net).toBe(1856.32);
    expect(summary.isEconomicallyConsistent).toBe(true);
    expect(summary.sources.totalEarnings?.match?.valueBox).not.toEqual(summary.sources.totalDeductions?.match?.valueBox);
    expect(summary.sources.totalEarnings?.match?.valueBox).not.toEqual(summary.sources.net?.match?.valueBox);
    expect(summary.sources.totalDeductions?.match?.valueBox).not.toEqual(summary.sources.net?.match?.valueBox);
  });

  it('accetta arrotondamento entro 0,02 euro', () => {
    const summary = parsePayslipFinalSummary(
      layoutFromItems([
        item('TOTALE TRATTENUTE', 30, 120),
        item('367,86', 260, 120),
        item('TOTALE COMPETENZE', 360, 120),
        item('2.224,18', 560, 120),
        item('ARROTONDAMENTO', 30, 95),
        item('0,01', 260, 95),
        item('NETTO', 360, 95),
        item('1.856,33', 560, 95),
      ])
    );

    expect(summary.net).toBe(1856.33);
    expect(summary.rounding).toBe(0.01);
    expect(summary.isEconomicallyConsistent).toBe(true);
  });

  it('non restituisce valori economici quando nessuna combinazione e coerente', () => {
    const summary = parsePayslipFinalSummary(
      layoutFromItems([
        item('TOTALE TRATTENUTE', 30, 120),
        item('768,91', 260, 120),
        item('TOTALE COMPETENZE', 360, 120),
        item('768,91', 560, 120),
        item('NETTO', 360, 95),
        item('133,43', 560, 95),
      ])
    );

    expect(summary.totalEarnings).toBeUndefined();
    expect(summary.totalDeductions).toBeUndefined();
    expect(summary.net).toBeUndefined();
    expect(summary.isEconomicallyConsistent).toBe(false);
    expect(summary.warnings).toContain('Riepilogo economico finale incoerente: valori da verificare.');
  });

  it('rifiuta valore sopra la label o verticalmente vicino in altra sezione', () => {
    const summary = parsePayslipFinalSummary(
      layoutFromItems([
        item('768,91', 260, 142),
        item('TOTALE TRATTENUTE', 30, 120),
        item('367,86', 260, 120),
        item('TOTALE COMPETENZE', 360, 120),
        item('2.224,18', 560, 120),
        item('NETTO', 360, 95),
        item('1.856,32', 560, 95),
      ])
    );

    expect(summary.totalDeductions).toBe(367.86);
    expect(summary.sources.totalDeductions?.match?.rejectedCandidates?.some((candidate) => candidate.value === '768,91')).not.toBe(true);
  });

  it('separa geometricamente data valuta, arrotondamento e netto nel footer', () => {
    const summary = parsePayslipFinalSummary(
      layoutFromItems([
        item('PROGRESSIVI', 20, 250),
        item('TOTALE COMPETENZE', 170, 250),
        item('2.194,51', 350, 250),
        item('TFR MAT. MESE AL NETTO DELLO 0,5 %', 20, 220),
        item('130,61', 350, 220),
        item('PAGAMENTO IN', 20, 100),
        item('PERIODO DI PAGA', 140, 100),
        item('DATA VALUTA', 280, 100),
        item('ARROTONDAMENTO', 390, 100),
        item('NETTO', 535, 100),
        item('C/C: IT00 TEST', 20, 80),
        item('SETTEMBRE', 140, 80),
        item('2025', 215, 80),
        item('15/10/2025', 280, 80),
        item('1.812,07', 535, 80),
      ])
    );

    expect(summary.periodLabel).toBe('SETTEMBRE 2025');
    expect(summary.paymentDate).toBe('2025-10-15');
    expect(summary.net).toBe(1812.07);
    expect(summary.rounding).toBe(0);
    expect(summary.net).not.toBe(130.61);
    expect(summary.totalEarnings).toBeUndefined();
    expect(summary.totalEarnings).not.toBe(2194.51);
    expect(summary.sources.rounding).toBeUndefined();
  });
});
