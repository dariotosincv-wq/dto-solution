import type { PdfTextItem, StructuredPdfText } from '../driverPayrollPdfLayout';
import type { PayslipSummary } from '../driverPayrollTypes';
import {
  fieldConfidence,
  findMoneyValues,
  isPlausibleMoney,
  isPlausibleMonth,
  isPlausibleYear,
  MONTHS,
  normalizeText,
  parseItalianNumber,
  round2,
} from './payslipParserHelpers';

type BoundingBox = {
  page: number;
  x: number;
  y: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type FinalSummaryFieldMatch = {
  label: string;
  value?: number | string;
  labelBox: BoundingBox;
  valueBox?: BoundingBox;
  horizontalDistance?: number;
  verticalDistance?: number;
  sameRow: boolean;
  sameColumnBand: boolean;
  confidence: number;
  rejectedCandidates?: Array<{ value: string; reason: string }>;
};

export type PayslipFinalSummarySource = {
  row?: string;
  page?: number;
  label?: string;
  match?: FinalSummaryFieldMatch;
};

type PeriodMatch = {
  month?: number;
  year?: number;
  label?: string;
  row?: string;
  page?: number;
  match?: FinalSummaryFieldMatch;
};

export type PayslipFinalSummary = {
  month?: number;
  year?: number;
  periodLabel?: string;
  totalEarnings?: number;
  totalDeductions?: number;
  net?: number;
  paymentDate?: string;
  rounding?: number;
  confidence: number;
  isEconomicallyConsistent?: boolean;
  warnings: string[];
  sources: Partial<Record<'period' | 'totalEarnings' | 'totalDeductions' | 'net' | 'paymentDate' | 'rounding', PayslipFinalSummarySource>>;
};

type SummaryCell = {
  text: string;
  normalized: string;
  box: BoundingBox;
};

type SummaryRow = {
  page: number;
  y: number;
  text: string;
  normalized: string;
  cells: SummaryCell[];
};

type MoneyCandidate = {
  value: number;
  text: string;
  row: SummaryRow;
  cell: SummaryCell;
  labelCell: SummaryCell;
  score: number;
  horizontalDistance: number;
  verticalDistance: number;
  sameRow: boolean;
  sameColumnBand: boolean;
  rejectedCandidates: Array<{ value: string; reason: string }>;
};

const FINAL_LABEL_PATTERNS = [
  /periodo\s+(?:di\s+)?paga|periodo\s+pag/i,
  /totale\s+competenze/i,
  /totale\s+trattenute/i,
  /\bnetto\b/i,
  /data\s+valuta/i,
  /bonifico/i,
  /arrotondamento/i,
];

const EXCLUDED_CONTEXT =
  /altre\s+detrazioni|detrazioni\s+familiari|imponibile|imponibile\s+sociale|imponibile\s+fiscale|imposta\s+versata|trattenute\s+sociali|inps|irpef|tfr|mat\.\s* mese\s+al\s+netto|mat\s+mese\s+al\s+netto|accantonamento|progressiv[oi]|progr\.|maturato|rivalutazione|quota\s+devoluta/i;
const PERIOD_FORBIDDEN = /data\s+valuta|data\s+pagamento|pagamento|bonifico|data\s+documento|data\s+stampa|nascita|assunzione/i;
const NET_FORBIDDEN = /bonifico|imponibile|totale\s+competenze|trattenute|tfr|arrotondamento/i;
const DEDUCTION_FORBIDDEN = /trattenute\s+inps|trattenute\s+fiscali|trattenuta\s+sindacale|singole\s+trattenute|detrazioni/i;
const GROSS_FORBIDDEN = /retribuzione|stipendio|imponibile|detrazioni|tfr/i;

const boxFromItems = (items: PdfTextItem[], fallbackPage = 1): BoundingBox => {
  if (items.length === 0) {
    return { page: fallbackPage, x: 0, y: 0, right: 0, bottom: 0, width: 0, height: 0 };
  }
  const x = Math.min(...items.map((item) => item.x));
  const y = Math.max(...items.map((item) => item.y));
  const right = Math.max(...items.map((item) => item.x + (item.width ?? item.text.length * 6)));
  const bottom = Math.min(...items.map((item) => item.y - (item.height ?? 10)));
  return { page: items[0].page, x, y, right, bottom, width: right - x, height: y - bottom };
};

const boxFromCellText = (item: PdfTextItem, text: string): BoundingBox => {
  const width = Math.max(text.length * 6, item.width ?? text.length * 6);
  const height = item.height ?? 10;
  return { page: item.page, x: item.x, y: item.y, right: item.x + width, bottom: item.y - height, width, height };
};

const boxFromRowTextRange = (row: SummaryRow, start: number, length: number): BoundingBox => {
  const rowBox = boxFromItems(
    row.cells.map((cell) => ({
      text: cell.text,
      page: cell.box.page,
      x: cell.box.x,
      y: cell.box.y,
      width: cell.box.width,
      height: cell.box.height,
    }))
  );
  const charWidth = row.text.length > 0 ? Math.max(rowBox.width / row.text.length, 4) : 6;
  const x = rowBox.x + start * charWidth;
  const width = Math.max(length * charWidth, 6);
  return { ...rowBox, x, right: x + width, width };
};

const toRows = (layout: StructuredPdfText): SummaryRow[] =>
  layout.reconstructedLines
    .map((line) => {
      const items = line.items.length > 0 ? line.items : [{ text: line.text, page: line.page, x: 0, y: line.y }];
      const cells = [...items]
        .sort((a, b) => a.x - b.x)
        .map<SummaryCell>((item) => ({
          text: item.text.replace(/\s+/g, ' ').trim(),
          normalized: normalizeText(item.text),
          box: boxFromCellText(item, item.text.replace(/\s+/g, ' ').trim()),
        }))
        .filter((cell) => cell.text);
      return {
        page: line.page,
        y: line.y,
        text: line.text.replace(/\s+/g, ' ').trim(),
        normalized: normalizeText(line.text),
        cells,
      };
    })
    .filter((line) => line.text)
    .sort((a, b) => a.page - b.page || b.y - a.y);

const getFinalRows = (rows: SummaryRow[]) => {
  const footerHeader = rows.find(
    (row) =>
      /periodo\s+(?:di\s+)?paga|periodo\s+pag/i.test(row.normalized) &&
      /data\s+valuta/i.test(row.normalized) &&
      /arrotondamento/i.test(row.normalized) &&
      /\bnetto\b/i.test(row.normalized)
  );
  if (footerHeader) {
    return rows.filter(
      (row) =>
        row.page === footerHeader.page &&
        row.y <= footerHeader.y + 6 &&
        row.y >= footerHeader.y - 32 &&
        !EXCLUDED_CONTEXT.test(row.normalized)
    );
  }

  const labelRows = rows.filter((row) => FINAL_LABEL_PATTERNS.some((pattern) => pattern.test(row.normalized)));
  if (labelRows.length === 0) {
    const byPage = new Map<number, SummaryRow[]>();
    rows.forEach((row) => byPage.set(row.page, [...(byPage.get(row.page) ?? []), row]));
    return Array.from(byPage.values()).flatMap((pageRows) => pageRows.slice(Math.floor(pageRows.length * 0.65)));
  }

  const page = labelRows[labelRows.length - 1].page;
  const pageLabelRows = labelRows.filter((row) => row.page === page);
  const topFinalY = Math.max(...pageLabelRows.map((row) => row.y));
  const bottomFinalY = Math.min(...pageLabelRows.map((row) => row.y));
  return rows.filter((row) => row.page === page && row.y <= topFinalY + 8 && row.y >= bottomFinalY - 35);
};

const monthPattern = () => Object.keys(MONTHS).join('|');

const parsePeriodFromText = (text: string) => {
  const match = normalizeText(text).match(new RegExp(`\\b(${monthPattern()})\\s+(20\\d{2})\\b`, 'i'));
  if (!match) return {};
  const month = MONTHS[match[1].toLowerCase()];
  const year = Number(match[2]);
  return {
    month: isPlausibleMonth(month) ? month : undefined,
    year: isPlausibleYear(year) ? year : undefined,
    label: `${match[1].toUpperCase()} ${match[2]}`,
  };
};

const findLabelCells = (rows: SummaryRow[], pattern: RegExp) =>
  rows.flatMap((row) => {
    const direct = row.cells.filter((cell) => pattern.test(cell.normalized));
    if (direct.length > 0) {
      return direct.map((cell) => {
        const match = cell.text.match(pattern);
        if (!match || match.index === undefined) return { row, cell };
        return {
          row,
          cell: {
            text: cell.text.slice(match.index),
            normalized: normalizeText(cell.text.slice(match.index)),
            box: boxFromRowTextRange(
              {
                ...row,
                text: cell.text,
                cells: [cell],
              },
              match.index,
              match[0].length
            ),
          },
        };
      });
    }
    if (!pattern.test(row.normalized)) return [];
    const match = row.text.match(pattern);
    if (!match || match.index === undefined) return [];
    return [{
      row,
      cell: {
        text: row.text.slice(match.index),
        normalized: normalizeText(row.text.slice(match.index)),
        box: boxFromRowTextRange(row, match.index, match[0].length),
      },
    }];
  });

const nextSummaryLabelIndex = (text: string, start: number) => {
  return FINAL_LABEL_PATTERNS
    .flatMap((pattern) => Array.from(text.matchAll(new RegExp(pattern.source, 'gi'))))
    .map((match) => match.index)
    .filter((index): index is number => index !== undefined && index > start)
    .sort((a, b) => a - b)[0];
};

const textSegmentAfterLabel = (text: string, label: RegExp) => {
  const match = text.match(label);
  if (!match || match.index === undefined) return '';
  const start = match.index + match[0].length;
  const nextLabel = nextSummaryLabelIndex(text, start);
  return text.slice(start, nextLabel);
};

const moneyFromTextAfterLabel = (text: string, label: RegExp) => {
  const afterLabel = textSegmentAfterLabel(text, label);
  return findMoneyValues(afterLabel).filter((value) => isPlausibleMoney(value, 0, 50000))[0];
};

const moneyTextFromCell = (cell: SummaryCell) => {
  const match = cell.text.match(/[+-]?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}/);
  return match?.[0];
};

const buildMatch = (label: string, candidate: MoneyCandidate, confidence: number): FinalSummaryFieldMatch => ({
  label,
  value: candidate.value,
  labelBox: candidate.labelCell.box,
  valueBox: candidate.cell.box,
  horizontalDistance: candidate.horizontalDistance,
  verticalDistance: candidate.verticalDistance,
  sameRow: candidate.sameRow,
  sameColumnBand: candidate.sameColumnBand,
  confidence,
  rejectedCandidates: candidate.rejectedCandidates,
});

const findMoneyCandidates = (rows: SummaryRow[], label: RegExp, forbidden: RegExp, labelName: string): MoneyCandidate[] => {
  const labels = findLabelCells(rows, label);
  const candidates: MoneyCandidate[] = [];

  labels.forEach(({ row, cell: labelCell }) => {
    const labelSegment = textSegmentAfterLabel(labelCell.text, label);
    const normalizedSegment = normalizeText(labelSegment);
    if (EXCLUDED_CONTEXT.test(labelCell.normalized) || forbidden.test(normalizedSegment)) return;
    const candidateCountBeforeLabel = candidates.length;
    const nextLabelX = row.cells
      .filter((cell) => cell.box.x > labelCell.box.x + 2 && FINAL_LABEL_PATTERNS.some((pattern) => pattern.test(cell.normalized)))
      .map((cell) => cell.box.x)
      .sort((a, b) => a - b)[0];

    const sameCellValue = moneyFromTextAfterLabel(labelCell.text, label);
    if (sameCellValue !== undefined) {
      candidates.push({
        value: sameCellValue,
        text: String(sameCellValue),
        row,
        cell: labelCell,
        labelCell,
        score: 96,
        horizontalDistance: 0,
        verticalDistance: 0,
        sameRow: true,
        sameColumnBand: true,
        rejectedCandidates: [],
      });
    }

    const rejectedCandidates: Array<{ value: string; reason: string }> = [];
    row.cells.forEach((candidateCell) => {
      const moneyText = moneyTextFromCell(candidateCell);
      if (!moneyText) return;
      const value = parseItalianNumber(moneyText);
      if (!isPlausibleMoney(value, 0, 50000)) return;

      const horizontalDistance = candidateCell.box.x - labelCell.box.right;
      const verticalDistance = Math.abs(candidateCell.box.y - labelCell.box.y);
      const sameRow = verticalDistance <= 5;
      const sameColumnBand = horizontalDistance >= -4 && horizontalDistance <= 360;

      if (candidateCell.box.x < labelCell.box.x - 2) {
        rejectedCandidates.push({ value: moneyText, reason: 'valore sopra o a sinistra della label' });
        return;
      }
      if (!sameRow) {
        rejectedCandidates.push({ value: moneyText, reason: 'distanza verticale eccessiva' });
        return;
      }
      if (!sameColumnBand) {
        rejectedCandidates.push({ value: moneyText, reason: 'colonna non adiacente' });
        return;
      }
      if (nextLabelX !== undefined && candidateCell.box.x >= nextLabelX - 2) {
        rejectedCandidates.push({ value: moneyText, reason: 'valore oltre la prossima label del riepilogo' });
        return;
      }

      candidates.push({
        value,
        text: moneyText,
        row,
        cell: candidateCell,
        labelCell,
        score: Math.max(70, 98 - Math.max(horizontalDistance, 0) / 12 - verticalDistance * 3),
        horizontalDistance,
        verticalDistance,
        sameRow,
        sameColumnBand,
        rejectedCandidates,
      });
    });

    if (candidates.length === candidateCountBeforeLabel) {
      const belowRows = rows.filter((candidateRow) => candidateRow.page === row.page && candidateRow.y < row.y && row.y - candidateRow.y <= 24);
      belowRows.forEach((candidateRow) => {
        candidateRow.cells.forEach((candidateCell) => {
          const moneyText = moneyTextFromCell(candidateCell);
          if (!moneyText || EXCLUDED_CONTEXT.test(candidateRow.normalized) || forbidden.test(candidateRow.normalized)) return;
          const value = parseItalianNumber(moneyText);
          if (!isPlausibleMoney(value, 0, 50000)) return;
          const horizontalDistance = candidateCell.box.x - labelCell.box.x;
          const verticalDistance = Math.abs(candidateCell.box.y - labelCell.box.y);
          const sameColumnBand = Math.abs(horizontalDistance) <= 90 || (candidateCell.box.x >= labelCell.box.right - 4 && candidateCell.box.x - labelCell.box.right <= 240);
          if (nextLabelX !== undefined && candidateCell.box.x >= nextLabelX - 2) {
            rejectedCandidates.push({ value: moneyText, reason: 'riga sotto ma valore nella colonna successiva' });
            return;
          }
          if (!sameColumnBand) {
            rejectedCandidates.push({ value: moneyText, reason: 'riga sotto ma colonna non adiacente' });
            return;
          }
          candidates.push({
            value,
            text: moneyText,
            row: candidateRow,
            cell: candidateCell,
            labelCell,
            score: Math.max(62, 82 - verticalDistance * 2 - Math.abs(horizontalDistance) / 20),
            horizontalDistance,
            verticalDistance,
            sameRow: false,
            sameColumnBand,
            rejectedCandidates,
          });
        });
      });
    }
  });

  return candidates
    .filter((candidate, index, all) => all.findIndex((item) => item.value === candidate.value && item.row.text === candidate.row.text) === index)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
};

const findPeriod = (rows: SummaryRow[]): PeriodMatch => {
  const labels = findLabelCells(rows, /periodo\s+(?:di\s+)?paga|periodo\s+pag/i);
  for (const { row, cell } of labels) {
    const sameCell = parsePeriodFromText(cell.text);
    if (sameCell.month && sameCell.year) {
      return { ...sameCell, row: row.text, page: row.page, match: { label: 'PERIODO DI PAGA', value: sameCell.label, labelBox: cell.box, valueBox: cell.box, horizontalDistance: 0, verticalDistance: 0, sameRow: true, sameColumnBand: true, confidence: 96 } };
    }

    const rightCells = row.cells.filter((candidate) => candidate.box.x >= cell.box.right - 4 && Math.abs(candidate.box.y - cell.box.y) <= 5);
    const rightText = rightCells.map((candidate) => candidate.text).join(' ');
    const sameRow = parsePeriodFromText(rightText);
    if (sameRow.month && sameRow.year) {
      const valueBox = boxFromItems(rightCells.map((candidate) => ({ text: candidate.text, page: candidate.box.page, x: candidate.box.x, y: candidate.box.y, width: candidate.box.width, height: candidate.box.height })));
      return { ...sameRow, row: row.text, page: row.page, match: { label: 'PERIODO DI PAGA', value: sameRow.label, labelBox: cell.box, valueBox, horizontalDistance: valueBox.x - cell.box.right, verticalDistance: Math.abs(valueBox.y - cell.box.y), sameRow: true, sameColumnBand: true, confidence: 96 } };
    }

    const belowRows = rows.filter((candidate) => candidate.page === row.page && candidate.y < row.y && row.y - candidate.y <= 24 && !PERIOD_FORBIDDEN.test(candidate.normalized));
    const belowText = belowRows.map((candidate) => candidate.text).join(' ');
    const below = parsePeriodFromText(belowText);
    if (below.month && below.year) {
      return { ...below, row: belowText, page: row.page, match: { label: 'PERIODO DI PAGA', value: below.label, labelBox: cell.box, valueBox: boxFromItems(belowRows.flatMap((candidate) => candidate.cells).map((candidate) => ({ text: candidate.text, page: candidate.box.page, x: candidate.box.x, y: candidate.box.y, width: candidate.box.width, height: candidate.box.height }))), horizontalDistance: 0, verticalDistance: 12, sameRow: false, sameColumnBand: true, confidence: 88 } };
    }
  }
  return {};
};

const parseItalianDate = (text: string) => {
  const match = text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);
  if (!match) return undefined;
  const day = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${month}-${day}`;
};

const findPaymentDate = (rows: SummaryRow[]) => {
  const labels = findLabelCells(rows, /data\s+valuta/i);
  for (const { row, cell } of labels) {
    const sameRowDate = parseItalianDate(textSegmentAfterLabel(row.text, /data\s+valuta/i));
    if (sameRowDate) return { value: sameRowDate, row: row.text, page: row.page };

    const nextLabelX = row.cells
      .filter((candidate) => candidate.box.x > cell.box.x + 2 && FINAL_LABEL_PATTERNS.some((pattern) => pattern.test(candidate.normalized)))
      .map((candidate) => candidate.box.x)
      .sort((a, b) => a - b)[0];
    const belowRows = rows.filter((candidate) => candidate.page === row.page && candidate.y < row.y && row.y - candidate.y <= 24);
    for (const belowRow of belowRows) {
      const columnText = belowRow.cells
        .filter((candidate) => candidate.box.x >= cell.box.x - 4 && (nextLabelX === undefined || candidate.box.x < nextLabelX - 2))
        .map((candidate) => candidate.text)
        .join(' ');
      const belowDate = parseItalianDate(columnText);
      if (belowDate) return { value: belowDate, row: belowRow.text, page: belowRow.page };
    }
  }

  const fallbackRow = rows.find((item) => /bonifico/i.test(item.normalized));
  const fallbackDate = fallbackRow ? parseItalianDate(fallbackRow.text) : undefined;
  return fallbackDate ? { value: fallbackDate, row: fallbackRow.text, page: fallbackRow.page } : {};
};

const findRounding = (rows: SummaryRow[]) => {
  const candidates = findMoneyCandidates(rows, /arrotondamento/i, /$a/, 'ARROTONDAMENTO');
  return candidates[0];
};

const selectEconomicCombination = (
  earningsCandidates: MoneyCandidate[],
  deductionCandidates: MoneyCandidate[],
  netCandidates: MoneyCandidate[],
  rounding = 0
) => {
  let best: { earnings: MoneyCandidate; deductions: MoneyCandidate; net: MoneyCandidate; score: number; coherent: boolean } | undefined;
  const candidateKey = (candidate: MoneyCandidate) =>
    `${candidate.row.page}:${candidate.cell.box.x}:${candidate.cell.box.y}:${candidate.cell.text}:${candidate.value}`;

  earningsCandidates.forEach((earnings) => {
    deductionCandidates.forEach((deductions) => {
      netCandidates.forEach((net) => {
        const keys = [candidateKey(earnings), candidateKey(deductions), candidateKey(net)];
        if (new Set(keys).size !== keys.length) return;

        const difference = Math.abs(round2(earnings.value - deductions.value + rounding) - net.value);
        const coherent = difference <= 0.02;
        const score = earnings.score + deductions.score + net.score + (coherent ? 80 : -120) - difference * 50;
        if (!best || score > best.score) best = { earnings, deductions, net, score, coherent };
      });
    });
  });

  return best?.coherent ? best : undefined;
};

export const parsePayslipFinalSummary = (layout: StructuredPdfText): PayslipFinalSummary => {
  const rows = getFinalRows(toRows(layout));
  const period = findPeriod(rows);
  const earningsCandidates = findMoneyCandidates(rows, /totale\s+competenze/i, GROSS_FORBIDDEN, 'TOTALE COMPETENZE');
  const deductionCandidates = findMoneyCandidates(rows, /totale\s+trattenute/i, DEDUCTION_FORBIDDEN, 'TOTALE TRATTENUTE');
  const netCandidates = findMoneyCandidates(rows, /\bnetto\b/i, NET_FORBIDDEN, 'NETTO');
  const roundingCandidate = findRounding(rows);
  const rounding = roundingCandidate?.value ?? 0;
  const selected = selectEconomicCombination(earningsCandidates, deductionCandidates, netCandidates, rounding);
  const hasFullEconomicCandidateSet = earningsCandidates.length > 0 && deductionCandidates.length > 0 && netCandidates.length > 0;
  const selectedEarnings = selected?.earnings ?? (!hasFullEconomicCandidateSet ? earningsCandidates[0] : undefined);
  const selectedDeductions = selected?.deductions ?? (!hasFullEconomicCandidateSet ? deductionCandidates[0] : undefined);
  const selectedNet = selected?.net ?? (!hasFullEconomicCandidateSet ? netCandidates[0] : undefined);
  const paymentDate = findPaymentDate(rows);
  const warnings: string[] = [];

  if (!period.month || !period.year) warnings.push('Periodo di paga non trovato nel riepilogo finale.');
  if (!selected && (earningsCandidates.length > 0 || deductionCandidates.length > 0 || netCandidates.length > 0)) {
    warnings.push('Riepilogo economico finale incoerente: valori da verificare.');
  }
  if (deductionCandidates.length === 0) warnings.push('Totale trattenute finale non trovato.');
  if (netCandidates.length === 0) warnings.push('Netto finale non trovato.');

  const foundCount = [
    period.month && period.year,
    selectedEarnings,
    selectedDeductions,
    selectedNet,
  ].filter(Boolean).length;
  const economicConfidence = selected
    ? Math.min(98, Math.round((selected.earnings.score + selected.deductions.score + selected.net.score) / 3 + 5))
    : Math.round(([selectedEarnings, selectedDeductions, selectedNet].filter(Boolean) as MoneyCandidate[]).reduce((total, candidate) => total + candidate.score, 0) / Math.max(1, [selectedEarnings, selectedDeductions, selectedNet].filter(Boolean).length));

  return {
    month: period.month,
    year: period.year,
    periodLabel: period.label,
    totalEarnings: selectedEarnings?.value,
    totalDeductions: selectedDeductions?.value,
    net: selectedNet?.value,
    paymentDate: paymentDate.value,
    rounding,
    confidence: foundCount === 0 ? 0 : Math.min(98, Math.max(economicConfidence, 55 + foundCount * 10)),
    isEconomicallyConsistent: hasFullEconomicCandidateSet ? selected !== undefined : undefined,
    warnings,
    sources: {
      period: period.row ? { row: period.row, page: period.page, label: 'PERIODO DI PAGA', match: period.match } : undefined,
      totalEarnings: selectedEarnings ? { row: selectedEarnings.row.text, page: selectedEarnings.row.page, label: 'TOTALE COMPETENZE', match: buildMatch('TOTALE COMPETENZE', selectedEarnings, economicConfidence) } : undefined,
      totalDeductions: selectedDeductions ? { row: selectedDeductions.row.text, page: selectedDeductions.row.page, label: 'TOTALE TRATTENUTE', match: buildMatch('TOTALE TRATTENUTE', selectedDeductions, economicConfidence) } : undefined,
      net: selectedNet ? { row: selectedNet.row.text, page: selectedNet.row.page, label: 'NETTO', match: buildMatch('NETTO', selectedNet, economicConfidence) } : undefined,
      paymentDate: paymentDate.row ? { row: paymentDate.row, page: paymentDate.page, label: 'DATA VALUTA' } : undefined,
      rounding: roundingCandidate ? { row: roundingCandidate.row.text, page: roundingCandidate.row.page, label: 'ARROTONDAMENTO', match: buildMatch('ARROTONDAMENTO', roundingCandidate, roundingCandidate.score) } : undefined,
    },
  };
};

export const mergeFinalSummaryIntoSummary = (
  fallback: PayslipSummary,
  finalSummary: PayslipFinalSummary
): PayslipSummary => ({
  ...fallback,
  grossAmount: finalSummary.totalEarnings ?? fallback.grossAmount,
  totalEarnings: finalSummary.totalEarnings ?? fallback.totalEarnings,
  totalDeductions: finalSummary.totalDeductions ?? fallback.totalDeductions,
  netAmount: finalSummary.net ?? fallback.netAmount,
  paymentDate: finalSummary.paymentDate ?? fallback.paymentDate,
});

export const finalSummaryFieldConfidence = (
  finalSummary: PayslipFinalSummary,
  key: keyof PayslipFinalSummary['sources'],
  value: string | number | undefined,
  fallbackParser: string
) => {
  const source = finalSummary.sources[key];
  const confidence = value === undefined ? 'missing' : source && finalSummary.isEconomicallyConsistent !== false ? 'confirmed' : 'uncertain';
  return fieldConfidence(
    confidence,
    source ? 'finalSummary' : fallbackParser,
    value,
    source?.row,
    source?.page
  );
};
