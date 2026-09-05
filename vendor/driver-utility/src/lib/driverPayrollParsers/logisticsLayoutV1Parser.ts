import { normalizePayslipLines } from '../driverPayrollPayslipNormalizer';
import { payrollDebugLog } from '../driverPayrollDebugLogger';
import type { StructuredPdfText } from '../driverPayrollPdfLayout';
import type { PayslipImport, PayslipLine, PayslipSummary } from '../driverPayrollTypes';
import {
  buildId,
  fieldConfidence,
  findMoneyValues,
  isPlausibleDays,
  isPlausibleHours,
  isPlausibleMoney,
  isPlausibleMonth,
  isPlausibleYear,
  MONTHS,
  normalizeText,
  parseItalianNumber,
  round2,
  stripAccents,
  sumLineAmounts,
} from './payslipParserHelpers';
import {
  finalSummaryFieldConfidence,
  parsePayslipFinalSummary,
} from './finalSummaryParser';
import type { PayslipFormatDetection } from './payrollParserTypes';
import { isSamePdfVisualRow } from '../driverPayrollPdfGeometry';

export const LOGISTICS_V1_PARSER_BUILD_MARKER = 'logistics-v1-fix-2026-07-26-02';
export const LOGISTICS_V1_PARSER_SOURCE_FILE =
  'src/lib/driverPayrollParsers/logisticsLayoutV1Parser.ts';

type ParsedLineDraft = PayslipLine & { rawNumbers?: number[] };
export type PayrollTableRow = {
  code: string;
  description: string;
  unitValue?: number;
  quantity?: number;
  deduction?: number;
  earning?: number;
  page: number;
  y: number;
  rawLine: string;
  geometry: PayslipLine['sourceGeometry'];
  economicColumnCertain: boolean;
  confidence: number;
  mathematicallyValidated: boolean;
};

export type PayrollFinalSummary = {
  month?: number;
  year?: number;
  totalEarnings?: number;
  totalDeductions?: number;
  net?: number;
  mathematicallyValidated: boolean;
  confidence: number;
  warnings: string[];
};

type LogisticsFinalTableCell = {
  text: string;
  normalized: string;
  page: number;
  x: number;
  y: number;
  right: number;
  width: number;
};

type LogisticsFinalTableValue = {
  value: number;
  row: string;
  page: number;
};

type LogisticsFinalTablePeriod = {
  label?: string;
  month?: number;
  year?: number;
  row?: string;
  page?: number;
};

type LogisticsFinalTableSummary = {
  period: LogisticsFinalTablePeriod;
  paymentDate?: { value: string; row: string; page: number };
  totalEarnings?: LogisticsFinalTableValue;
  totalDeductions?: LogisticsFinalTableValue;
  net?: LogisticsFinalTableValue;
  isEconomicallyConsistent?: boolean;
  warnings: string[];
  confidence: number;
};

type LogisticsMonthlyTotals = {
  totalEarnings?: LogisticsFinalTableValue;
  totalDeductions?: LogisticsFinalTableValue;
  isEconomicallyConsistent?: boolean;
  warnings: string[];
};

type LogisticsTableColumnKey = 'code' | 'description' | 'unitValue' | 'quantity' | 'deduction' | 'earning';

type LogisticsTableColumns = Record<LogisticsTableColumnKey, { x: number; right: number }>;
type LogisticsTableLayout = {
  columns: LogisticsTableColumns;
  page: number;
  headerY: number;
  endY: number;
};

const isNumericToken = (value: string): boolean =>
  /^[+-]?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?$/.test(value);

const moneyFromCell = (cell: LogisticsFinalTableCell): number | undefined => {
  const match = cell.text.match(/[+-]?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}/);
  return match ? parseItalianNumber(match[0]) : undefined;
};

const toFinalTableCells = (structuredText: StructuredPdfText): LogisticsFinalTableCell[] =>
  structuredText.reconstructedLines
    .flatMap((line) => {
      const items = line.items.length > 0 ? line.items : [{ text: line.text, page: line.page, x: 0, y: line.y, width: line.text.length * 6 }];
      return items.map((item) => {
        const text = item.text.replace(/\s+/g, ' ').trim();
        const width = item.width ?? text.length * 6;
        return {
          text,
          normalized: normalizeText(text),
          page: item.page,
          x: item.x,
          y: item.y,
          right: item.x + width,
          width,
        };
      });
    })
    .filter((cell) => cell.text)
    .sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);

const finalTableRows = (cells: LogisticsFinalTableCell[]) => {
  const rows: Array<{ page: number; y: number; cells: LogisticsFinalTableCell[]; text: string }> = [];
  cells.forEach((cell) => {
    const row = rows.find((candidate) => candidate.page === cell.page && Math.abs(candidate.y - cell.y) <= 5);
    if (row) {
      row.cells.push(cell);
      row.y = (row.y * (row.cells.length - 1) + cell.y) / row.cells.length;
    } else {
      rows.push({ page: cell.page, y: cell.y, cells: [cell], text: '' });
    }
  });

  return rows
    .map((row) => {
      const sortedCells = [...row.cells].sort((a, b) => a.x - b.x);
      return {
        ...row,
        cells: sortedCells,
        text: sortedCells.map((cell) => cell.text).join(' '),
      };
    })
    .sort((a, b) => a.page - b.page || b.y - a.y);
};

const findHeaderCell = (row: ReturnType<typeof finalTableRows>[number], patterns: RegExp[]) =>
  row.cells.find((cell) => patterns.some((pattern) => pattern.test(cell.normalized)));

const buildColumnRanges = (anchors: Record<LogisticsTableColumnKey, number>): LogisticsTableColumns => {
  const ordered = (Object.entries(anchors) as Array<[LogisticsTableColumnKey, number]>).sort((a, b) => a[1] - b[1]);
  return Object.fromEntries(
    ordered.map(([key, x], index) => {
      const previous = ordered[index - 1]?.[1];
      const next = ordered[index + 1]?.[1];
      return [
        key,
        {
          x: previous === undefined ? x - 40 : (previous + x) / 2,
          right: next === undefined ? x + 160 : (x + next) / 2,
        },
      ];
    })
  ) as LogisticsTableColumns;
};

const tableEndPattern =
  /^(?:dati\s+(?:previdenziali|fiscali)|sociali\s+i\.?n\.?p\.?s|fiscali\s+irpef|progressivi|tfr|trattamento\s+fine\s+rapporto|accant(?:onamento)?\.?\s*t\.?f\.?r)/i;

const detectLogisticsTableLayouts = (rows: ReturnType<typeof finalTableRows>): LogisticsTableLayout[] => {
  const layouts: LogisticsTableLayout[] = [];
  const allCells = rows.flatMap((row) => row.cells);
  for (const code of allCells.filter((cell) => /^(?:cod(?:ice)?\.?\s*)?voce$/i.test(cell.normalized))) {
    const headerBand = allCells.filter((cell) =>
      cell.page === code.page && isSamePdfVisualRow(cell.y, code.y, 12)
    );
    const find = (patterns: RegExp[]) =>
      headerBand.find((cell) => patterns.some((pattern) => pattern.test(cell.normalized)));
    const description = find([/descrizione/i]);
    const unitValue = find([/valore\s+unitario/i]);
    const quantity = find([/ore[-/\s]*gg[-/\s]*mesi|ore\s+gg\s+mesi/i]);
    const deduction = find([/^trattenute$/i]);
    const earning = find([/^competenze$/i]);
    if (code && description && unitValue && quantity && deduction && earning) {
      const nextSection = rows.find((candidate) =>
        candidate.page === code.page &&
        candidate.y < code.y &&
        tableEndPattern.test(normalizeText(candidate.text))
      );
      layouts.push({
        columns: buildColumnRanges({
          code: code.x,
          description: description.x,
          unitValue: unitValue.x,
          quantity: quantity.x,
          deduction: deduction.x,
          earning: earning.x,
        }),
        page: code.page,
        headerY: Math.min(code.y, description.y, unitValue.y, quantity.y, deduction.y, earning.y),
        endY: nextSection?.y ?? Number.NEGATIVE_INFINITY,
      });
    }
  }

  return layouts;
};

const cellsInColumn = (
  row: ReturnType<typeof finalTableRows>[number],
  columns: LogisticsTableColumns,
  key: LogisticsTableColumnKey
) => row.cells.filter((cell) => cell.x >= columns[key].x && cell.x < columns[key].right);

const numberInColumn = (
  row: ReturnType<typeof finalTableRows>[number],
  columns: LogisticsTableColumns,
  key: LogisticsTableColumnKey
) => cellsInColumn(row, columns, key).map(moneyFromCell).find((value): value is number => value !== undefined);

const parseLogisticsMonthlyTotals = (
  structuredText: StructuredPdfText,
  footerNet?: number
): LogisticsMonthlyTotals => {
  const rows = finalTableRows(toFinalTableCells(structuredText));
  const rejectedWarnings: string[] = [];
  const candidates: Array<LogisticsMonthlyTotals & { page: number; y: number; score: number }> = [];

  for (const headerRow of rows) {
    const warnings: string[] = [];
    const deductionsLabel = findHeaderCell(headerRow, [/^totale\s+trattenute$/i]);
    const earningsLabel = findHeaderCell(headerRow, [/^totale\s+competenze$/i]);
    if (!deductionsLabel || !earningsLabel || deductionsLabel.x >= earningsLabel.x) continue;

    const pageRows = rows.filter((row) => row.page === headerRow.page);
    const headerIndex = pageRows.indexOf(headerRow);
    const valueRow = pageRows.slice(headerIndex + 1).find((row) => row.y < headerRow.y);
    if (!valueRow) {
      rejectedWarnings.push('Riga valori dei totali mensili non trovata sotto le intestazioni.');
      continue;
    }

    const verticalDistance = headerRow.y - valueRow.y;
    if (verticalDistance < 2 || verticalDistance > 14) {
      rejectedWarnings.push(`Riga valori dei totali mensili non adiacente alle intestazioni (${verticalDistance.toFixed(2)} punti).`);
      continue;
    }

    const centerX = (cell: LogisticsFinalTableCell) => cell.x + cell.width / 2;
    const deductionCenterMin = centerX(deductionsLabel);
    const deductionCenterMax = centerX(earningsLabel);
    const orderedValueCells = valueRow.cells
      .filter((cell) => moneyFromCell(cell) !== undefined)
      .sort((a, b) => centerX(a) - centerX(b));
    const deductionsCandidates = orderedValueCells.filter((cell) => {
      const valueCenter = centerX(cell);
      return valueCenter >= deductionCenterMin && valueCenter < deductionCenterMax;
    });
    const earningsCandidates = orderedValueCells.filter((cell) => centerX(cell) >= deductionCenterMax);
    const penultimateMoneyCell = orderedValueCells.at(-2);
    const lastMoneyCell = orderedValueCells.at(-1);

    if (
      deductionsCandidates.length !== 1 ||
      earningsCandidates.length !== 1 ||
      deductionsCandidates[0] !== penultimateMoneyCell ||
      earningsCandidates[0] !== lastMoneyCell
    ) {
      rejectedWarnings.push(
        `Associazione geometrica ambigua dei totali mensili: trattenute=${deductionsCandidates.length}, competenze=${earningsCandidates.length}.`
      );
      continue;
    }

    const totalDeductionsValue = moneyFromCell(deductionsCandidates[0]);
    const totalEarningsValue = moneyFromCell(earningsCandidates[0]);
    if (totalDeductionsValue === undefined || totalEarningsValue === undefined) continue;

    const totalDeductions = {
      value: totalDeductionsValue,
      row: valueRow.text,
      page: valueRow.page,
    };
    const totalEarnings = {
      value: totalEarningsValue,
      row: valueRow.text,
      page: valueRow.page,
    };
    const isEconomicallyConsistent =
      footerNet === undefined
        ? undefined
        : Math.abs(round2(totalEarningsValue - totalDeductionsValue) - footerNet) <= 0.02;

    if (isEconomicallyConsistent === false) {
      warnings.push(
        `Totali mensili non coerenti con il netto del footer: ${totalEarningsValue} - ${totalDeductionsValue} != ${footerNet}.`
      );
    }

    const score =
      60 +
      (isEconomicallyConsistent === true ? 100 : isEconomicallyConsistent === false ? -80 : 10);
    candidates.push({
      totalEarnings,
      totalDeductions,
      isEconomicallyConsistent,
      warnings,
      page: headerRow.page,
      y: headerRow.y,
      score,
    });
  }

  const selected = candidates.sort(
    (a, b) => b.score - a.score || b.page - a.page || a.y - b.y
  )[0];
  if (!selected) return { warnings: rejectedWarnings };
  return {
    totalEarnings: selected.totalEarnings,
    totalDeductions: selected.totalDeductions,
    isEconomicallyConsistent: selected.isEconomicallyConsistent,
    warnings: selected.warnings,
  };
};

export const parseLogisticsLayoutV1TableRows = (structuredText: StructuredPdfText): PayrollTableRow[] => {
  const rows = finalTableRows(toFinalTableCells(structuredText));
  const layouts = detectLogisticsTableLayouts(rows);
  if (!layouts.length) return [];
  const parsedRows = layouts.flatMap((layout) => {
    const { columns } = layout;
    return rows
      .filter((row) =>
        row.page === layout.page &&
        row.y < layout.headerY - 1 &&
        row.y > layout.endY + 1
      )
      .map<PayrollTableRow | undefined>((row) => {
      const code = cellsInColumn(row, columns, 'code').map((cell) => cell.text).join(' ').match(/\b\d{4}\b/)?.[0];
      if (!code) return undefined;

      const description = cellsInColumn(row, columns, 'description')
        .map((cell) => cell.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!description) return undefined;

      const unitValue = numberInColumn(row, columns, 'unitValue');
      const quantity = numberInColumn(row, columns, 'quantity');
      const deduction = numberInColumn(row, columns, 'deduction');
      const earning = numberInColumn(row, columns, 'earning');
      if (
        unitValue === undefined &&
        quantity === undefined &&
        deduction === undefined &&
        earning === undefined
      ) return undefined;

      const economicColumnCertain = deduction === undefined || earning === undefined;
      const formulaTarget = earning ?? deduction;
      const mathematicallyValidated =
        unitValue !== undefined && quantity !== undefined && formulaTarget !== undefined
          ? Math.abs(round2(unitValue * quantity) - formulaTarget) <= 0.02
          : formulaTarget !== undefined || quantity !== undefined;

      return {
        code,
        description,
        unitValue,
        quantity,
        deduction,
        earning,
        page: row.page,
        y: row.y,
        rawLine: row.text,
        geometry: {
          y: row.y,
          cells: row.cells.map((cell) => ({
            text: cell.text,
            x: cell.x,
            y: cell.y,
            width: cell.width,
          })),
        },
        economicColumnCertain,
        confidence: !economicColumnCertain ? 45 : mathematicallyValidated ? 100 : 65,
        mathematicallyValidated,
      };
      })
      .filter((row): row is PayrollTableRow => Boolean(row));
  });

  const seen = new Set<string>();
  return parsedRows.filter((row) => {
    const identity = [
      row.page,
      row.code,
      row.description,
      row.unitValue ?? '',
      row.quantity ?? '',
      row.deduction ?? '',
      row.earning ?? '',
    ].join('|');
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
};

const tableRowToPayslipLine = (row: PayrollTableRow): ParsedLineDraft => {
  const neutralDescription = normalizeText(row.description);
  return {
    code: row.code,
    label: row.description,
    originalCode: row.code,
    originalDescription: row.description,
    normalizedDescription: neutralDescription,
    unitValue: row.unitValue,
    quantity: row.quantity,
    earningAmount: row.earning,
    deductionAmount: row.deduction,
    sourceColumn:
      !row.economicColumnCertain
        ? 'informational'
        : row.earning !== undefined
        ? 'earnings'
        : row.deduction !== undefined
        ? 'deductions'
        : row.quantity !== undefined
        ? 'quantity'
        : 'unit_value',
    confidence: row.confidence,
    rawLine: row.rawLine,
    sourcePage: row.page,
    sourceRowY: row.y,
    sourceGeometry: row.geometry,
    interpretationMethod: 'logisticsLayoutV1_geometric_columns',
    geometricEconomicCertified:
      row.economicColumnCertain &&
      (row.earning !== undefined || row.deduction !== undefined),
    economicSelectionResult:
      row.economicColumnCertain && (row.earning !== undefined || row.deduction !== undefined)
        ? 'pending'
        : 'excluded',
    economicSelectionExclusionReason: row.economicColumnCertain
      ? undefined
      : 'entrambe le colonne economiche sono valorizzate',
  };
};

const validateFinalSummaryAgainstRows = (finalTable: LogisticsFinalTableSummary, tableRows: PayrollTableRow[]): PayrollFinalSummary => {
  const earningsSum = round2(tableRows.reduce(
    (total, row) => total + (row.economicColumnCertain ? row.earning ?? 0 : 0),
    0
  ));
  const deductionsSum = round2(tableRows.reduce(
    (total, row) => total + (row.economicColumnCertain ? row.deduction ?? 0 : 0),
    0
  ));
  const totalEarnings = finalTable.totalEarnings?.value;
  const totalDeductions = finalTable.totalDeductions?.value;
  const net = finalTable.net?.value;
  const earningsValid = totalEarnings !== undefined && (earningsSum === 0 || Math.abs(earningsSum - totalEarnings) <= 0.02);
  const deductionsValid = totalDeductions !== undefined && (deductionsSum === 0 || Math.abs(deductionsSum - totalDeductions) <= 0.02);
  const netValid =
    totalEarnings !== undefined && totalDeductions !== undefined && net !== undefined
      ? Math.abs(round2(totalEarnings - totalDeductions) - net) <= 0.02
      : false;
  const warnings = [...finalTable.warnings];

  if (totalEarnings !== undefined && !earningsValid) warnings.push('Totale competenze non coerente con le righe in colonna competenze.');
  if (totalDeductions !== undefined && !deductionsValid) warnings.push('Totale trattenute non coerente con le righe in colonna trattenute.');
  if (net !== undefined && !netValid) warnings.push('Netto non coerente con totale competenze e totale trattenute.');

  return {
    month: finalTable.period.month,
    year: finalTable.period.year,
    totalEarnings,
    totalDeductions,
    net,
    mathematicallyValidated: earningsValid && deductionsValid && netValid,
    confidence: earningsValid && deductionsValid && netValid ? 100 : 65,
    warnings,
  };
};

const finalSummaryLabelPatterns = [
  /periodo\s+(?:di\s+)?paga|periodo\s+pag/i,
  /data\s+(?:valuta|pagamento)/i,
  /arrotondamento/i,
  /totale\s+competenze/i,
  /totale\s+trattenute/i,
  /\bnetto\b/i,
];

const isExcludedMonthlySummaryContext = (text: string) =>
  /progressiv[oi]|progr\.|tfr|mat\.\s* mese\s+al\s+netto|mat\s+mese\s+al\s+netto/i.test(normalizeText(text));

const selectFinalSummaryRowCandidates = (rows: ReturnType<typeof finalTableRows>) => {
  const labelRows = rows.filter(
    (row) =>
      !isExcludedMonthlySummaryContext(row.text) &&
      finalSummaryLabelPatterns.some((pattern) => pattern.test(normalizeText(row.text)))
  );
  if (labelRows.length === 0) return [] as Array<ReturnType<typeof finalTableRows>>;

  const candidates: Array<ReturnType<typeof finalTableRows>> = [];
  const pages = Array.from(new Set(labelRows.map((row) => row.page)));
  pages.forEach((page) => {
    const pageLabels = labelRows.filter((row) => row.page === page).sort((a, b) => b.y - a.y);
    const groups: Array<typeof pageLabels> = [];
    pageLabels.forEach((row) => {
      const current = groups.at(-1);
      const previous = current?.at(-1);
      if (!current || !previous || previous.y - row.y > 45) groups.push([row]);
      else current.push(row);
    });

    groups.forEach((group) => {
      const topY = Math.max(...group.map((row) => row.y));
      const bottomY = Math.min(...group.map((row) => row.y));
      const candidateRows = rows.filter(
        (row) =>
          row.page === page &&
          row.y <= topY + 10 &&
          row.y >= bottomY - 30 &&
          !isExcludedMonthlySummaryContext(row.text)
      );
      if (candidateRows.length > 0) candidates.push(candidateRows);
    });
  });

  return candidates;
};

const parseDateFromText = (text: string) => {
  const match = text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);
  if (!match) return undefined;
  const day = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${month}-${day}`;
};

const parsePeriodText = (text: string) => {
  const monthNames = Object.keys(MONTHS).join('|');
  const match = normalizeText(text).match(new RegExp(`\\b(${monthNames})\\s+(20\\d{2})\\b`, 'i'));
  if (!match) return {};
  const month = MONTHS[match[1].toLowerCase()];
  const year = Number(match[2]);
  return {
    label: `${match[1].toUpperCase()} ${match[2]}`,
    month: isPlausibleMonth(month) ? month : undefined,
    year: isPlausibleYear(year) ? year : undefined,
  };
};

const labelPatterns = [
  /periodo\s+(?:di\s+)?paga|periodo\s+pag/i,
  /data\s+(?:valuta|pagamento)/i,
  /arrotondamento/i,
  /totale\s+competenze/i,
  /totale\s+trattenute/i,
  /\bnetto\b/i,
];

const nextFinalLabelX = (rowCells: LogisticsFinalTableCell[], labelCell: LogisticsFinalTableCell) =>
  rowCells
    .filter((cell) => cell.x > labelCell.x + 2 && labelPatterns.some((pattern) => pattern.test(cell.normalized)))
    .map((cell) => cell.x)
    .sort((a, b) => a - b)[0];

const findFinalLabelCell = (cells: LogisticsFinalTableCell[], pattern: RegExp) =>
  cells.find((cell) => pattern.test(cell.normalized));

const findMoneyInFinalCell = (
  rows: ReturnType<typeof finalTableRows>,
  labelCell: LogisticsFinalTableCell,
  labelPattern: RegExp,
  allowBelowRight = false
): LogisticsFinalTableValue | undefined => {
  const row = rows.find((candidate) => candidate.page === labelCell.page && candidate.cells.includes(labelCell));
  if (!row) return undefined;
  const rowCells = row.cells;
  const sameCellSegment = labelCell.text.replace(labelPattern, '');
  const sameCellMoney = sameCellSegment.match(/[+-]?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}/)?.[0];
  if (sameCellMoney) {
    const value = parseItalianNumber(sameCellMoney);
    if (isPlausibleMoney(value, 0, 50000)) return { value, row: row.text, page: row.page };
  }

  const nextLabelX = nextFinalLabelX(rowCells, labelCell);
  const valueCell = rowCells.find((cell) => {
    if (cell.x < labelCell.right - 4) return false;
    if (nextLabelX !== undefined && cell.x >= nextLabelX - 2) return false;
    return /[+-]?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}/.test(cell.text);
  });
  const money = valueCell?.text.match(/[+-]?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}/)?.[0];
  const value = money ? parseItalianNumber(money) : undefined;
  if (isPlausibleMoney(value, 0, 50000)) return { value, row: row.text, page: row.page };

  if (!allowBelowRight) return undefined;
  const belowRows = rows.filter((candidate) => candidate.page === row.page && candidate.y < row.y && row.y - candidate.y <= 24);
  for (const belowRow of belowRows) {
    const belowCell = belowRow.cells.find((cell) => {
      if (cell.x < labelCell.x - 4) return false;
      if (nextLabelX !== undefined && cell.x >= nextLabelX - 2) return false;
      return /[+-]?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}/.test(cell.text);
    });
    const belowMoney = belowCell?.text.match(/[+-]?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}/)?.[0];
    const belowValue = belowMoney ? parseItalianNumber(belowMoney) : undefined;
    if (isPlausibleMoney(belowValue, 0, 50000)) return { value: belowValue, row: belowRow.text, page: belowRow.page };
  }

  return undefined;
};

const findTextInFinalCell = (
  rows: ReturnType<typeof finalTableRows>,
  labelCell: LogisticsFinalTableCell,
  labelPattern: RegExp,
  allowBelow = false
) => {
  const row = rows.find((candidate) => candidate.page === labelCell.page && candidate.cells.includes(labelCell));
  if (!row) return { text: '', row: '', page: labelCell.page };
  const sameCellSegment = labelCell.text.replace(labelPattern, '').trim();
  if (sameCellSegment) return { text: sameCellSegment, row: row.text, page: row.page };
  const nextLabelX = nextFinalLabelX(row.cells, labelCell);
  const rightCells = row.cells.filter((cell) => cell.x >= labelCell.right - 4 && (nextLabelX === undefined || cell.x < nextLabelX - 2));
  const rightText = rightCells.map((cell) => cell.text).join(' ');
  if (rightText || !allowBelow) return { text: rightText, row: row.text, page: row.page };

  const belowRows = rows.filter((candidate) => candidate.page === row.page && candidate.y < row.y && row.y - candidate.y <= 24);
  for (const belowRow of belowRows) {
    const belowCells = belowRow.cells.filter(
      (cell) => cell.x >= labelCell.x - 4 && (nextLabelX === undefined || cell.x < nextLabelX - 2)
    );
    const text = belowCells.map((cell) => cell.text).join(' ').trim();
    if (text) return { text, row: belowRow.text, page: belowRow.page };
  }

  return { text: '', row: row.text, page: row.page };
};

const parseLogisticsFinalSummaryRows = (
  rows: ReturnType<typeof finalTableRows>
): LogisticsFinalTableSummary => {
  const cells = rows.flatMap((row) => row.cells);
  const periodCell = findFinalLabelCell(cells, /periodo\s+(?:di\s+)?paga|periodo\s+pag/i);
  const paymentDatePattern = /data\s+(?:valuta|pagamento)/i;
  const paymentDateCell = findFinalLabelCell(cells, paymentDatePattern);
  const totalEarningsCell = findFinalLabelCell(cells, /totale\s+competenze/i);
  const totalDeductionsCell = findFinalLabelCell(cells, /totale\s+trattenute/i);
  const netCell =
    cells.find((cell) => /^netto$/i.test(cell.normalized) && !isExcludedMonthlySummaryContext(cell.text)) ??
    cells.find((cell) => /\bnetto\b/i.test(cell.normalized) && !isExcludedMonthlySummaryContext(cell.text));
  const warnings: string[] = [];

  const periodSource = periodCell ? findTextInFinalCell(rows, periodCell, /periodo\s+(?:di\s+)?paga|periodo\s+pag/i, true) : undefined;
  const period = periodSource ? { ...parsePeriodText(periodSource.text), row: periodSource.row, page: periodSource.page } : {};
  const paymentDateSource = paymentDateCell ? findTextInFinalCell(rows, paymentDateCell, paymentDatePattern, true) : undefined;
  const paymentDate = paymentDateSource ? parseDateFromText(paymentDateSource.text) : undefined;
  const totalEarnings = totalEarningsCell ? findMoneyInFinalCell(rows, totalEarningsCell, /totale\s+competenze/i) : undefined;
  const totalDeductions = totalDeductionsCell ? findMoneyInFinalCell(rows, totalDeductionsCell, /totale\s+trattenute/i) : undefined;
  const net = netCell ? findMoneyInFinalCell(rows, netCell, /\bnetto\b/i, true) : undefined;
  const hasFullFinalTable = Boolean(totalEarnings && totalDeductions && net);
  const isEconomicallyConsistent =
    totalEarnings && totalDeductions && net
      ? Math.abs(round2(totalEarnings.value - totalDeductions.value) - net.value) <= 0.01
      : undefined;

  if (hasFullFinalTable && isEconomicallyConsistent === false) {
    warnings.push(
      `Riepilogo finale Logistica 1 incoerente: Totale competenze ${totalEarnings?.value ?? 'mancante'}, Totale trattenute ${totalDeductions?.value ?? 'mancante'}, Netto ${net?.value ?? 'mancante'}.`
    );
  }

  return {
    period,
    paymentDate: paymentDate && paymentDateSource ? { value: paymentDate, row: paymentDateSource.row, page: paymentDateSource.page } : undefined,
    totalEarnings,
    totalDeductions,
    net,
    isEconomicallyConsistent: hasFullFinalTable ? isEconomicallyConsistent : undefined,
    warnings,
    confidence: isEconomicallyConsistent ? 100 : hasFullFinalTable ? 78 : 0,
  };
};

const finalSummaryCandidateScore = (candidate: LogisticsFinalTableSummary) =>
  (candidate.period.month && candidate.period.year ? 8 : 0) +
  (candidate.totalEarnings ? 25 : 0) +
  (candidate.totalDeductions ? 25 : 0) +
  (candidate.net ? 35 : 0) +
  (candidate.paymentDate ? 12 : 0) +
  (candidate.isEconomicallyConsistent === true
    ? 100
    : candidate.isEconomicallyConsistent === false
      ? -70
      : 0);

const parseLogisticsFinalSummaryTable = (structuredText: StructuredPdfText): LogisticsFinalTableSummary => {
  const rows = finalTableRows(toFinalTableCells(structuredText));
  const candidates = selectFinalSummaryRowCandidates(rows).map((candidateRows) => {
    const summary = parseLogisticsFinalSummaryRows(candidateRows);
    return {
      summary,
      score: finalSummaryCandidateScore(summary),
      page: candidateRows[0]?.page ?? 0,
      y: Math.min(...candidateRows.map((row) => row.y)),
    };
  });
  const selected = candidates.sort(
    (a, b) => b.score - a.score || b.page - a.page || a.y - b.y
  )[0]?.summary;

  return selected ?? {
    period: {},
    warnings: ['Nessun blocco riepilogativo finale riconosciuto.'],
    confidence: 0,
  };
};

function inferLineNumbers(code: string, numbers: number[]): Pick<PayslipLine, 'quantity' | 'unitValue' | 'amount' | 'confidence'> {
  if (numbers.length === 0) return { confidence: 35 };

  if (code === '0169' || code === '0779' || code === '0785' || code === '1981' || code === '1989') {
    const hours = numbers.find(isPlausibleHours);
    return { amount: hours, confidence: hours !== undefined ? 88 : 35 };
  }

  if (code === '0170') {
    const days = numbers.find(isPlausibleDays);
    return { amount: days, confidence: days !== undefined ? 88 : 35 };
  }

  if (['3900', '3901', '5000', '5050', '5100', '5121'].includes(code) && numbers.length <= 2) {
    const quantity = numbers.find(isPlausibleDays);
    const amount = numbers.find((value) => value > 31);
    return { quantity, amount, confidence: quantity !== undefined ? 82 : 35 };
  }

  const amount = numbers[numbers.length - 1];
  if (numbers.length >= 3) {
    const unitValue = numbers[numbers.length - 3];
    const quantity = numbers[numbers.length - 2];
    const expected = round2(unitValue * quantity);
    const confidence = Math.abs(expected - amount) <= 0.02 ? 94 : 68;
    return { unitValue, quantity, amount, confidence };
  }

  if (numbers.length === 2) return { quantity: numbers[0], amount, confidence: 62 };
  return { amount, confidence: 55 };
}

export function parseLogisticsLayoutV1PayslipLine(row: string): ParsedLineDraft | undefined {
  const lineMatch = row.replace(/\s+/g, ' ').trim().match(/^(\d{4})\s+(.+)$/);
  if (!lineMatch) return undefined;

  const code = lineMatch[1];
  const rest = lineMatch[2];
  const tokens = rest.split(' ');
  const firstValueIndex = tokens.findIndex((token) => token === '*' || isNumericToken(token));
  const descriptionTokens = firstValueIndex >= 0 ? tokens.slice(0, firstValueIndex) : tokens;
  const valueTokens = firstValueIndex >= 0 ? tokens.slice(firstValueIndex) : [];
  const rawNumbers = valueTokens
    .filter((token) => token !== '*' && isNumericToken(token))
    .map((token) => parseItalianNumber(token))
    .filter((value): value is number => value !== undefined);

  return {
    code,
    label: descriptionTokens.join(' ').trim(),
    rawLine: row,
    rawNumbers,
    ...inferLineNumbers(code, rawNumbers),
  };
}

const boundedTextTableRows = (rows: string[]): string[] => {
  const headerIndex = rows.findIndex((row) => {
    const normalized = normalizeText(row);
    return /\bvoce\b/.test(normalized) &&
      /ore\s*[/ -]?\s*gg|ore\s+gg|mesi/.test(normalized) &&
      /importo|competenze|trattenute/.test(normalized);
  });
  if (headerIndex < 0) return [];
  const afterHeader = rows.slice(headerIndex + 1);
  const endIndex = afterHeader.findIndex((row) => {
    const normalized = normalizeText(row);
    return tableEndPattern.test(normalized) ||
      /^totale\s+(?:competenze|trattenute)\b/.test(normalized) ||
      /^periodo\s+(?:di\s+)?paga\b/.test(normalized);
  });
  return endIndex < 0 ? afterHeader : afterHeader.slice(0, endIndex);
};

const extractLogisticsMetadata = (structuredText: StructuredPdfText) => {
  const rows = finalTableRows(toFinalTableCells(structuredText));
  const topRows = rows.slice(0, 12);
  const allCells = rows.flatMap((row) => row.cells);
  const companyCell = topRows
    .flatMap((row) => row.cells)
    .find((cell) => /\b(?:s\.?r\.?l\.?|s\.?p\.a\.?)\b/i.test(cell.text));
  const companyName = companyCell?.text
    .replace(/\s+/g, ' ')
    .trim()
    .match(/^.*?\b(?:s\.?r\.?l\.?|s\.?p\.?a\.?)\b/i)?.[0]
    ?.toUpperCase();

  const levelHeader = topRows
    .flatMap((row) => row.cells)
    .find((cell) => /^liv(?:ello)?\.?$/i.test(cell.normalized));
  const levelRows = levelHeader
    ? rows.filter((row) =>
        row.page === levelHeader.page &&
        row.y <= levelHeader.y + 2 &&
        row.y >= levelHeader.y - 35
      )
    : [];
  const inlineLevel = topRows
    .flatMap((row) => row.cells)
    .map((cell) => cell.text.match(/\bliv(?:ello)?\.?\s*[:\-]?\s*([A-Z]\d+)\b/i)?.[1])
    .find(Boolean);
  const level = (levelRows
    .flatMap((row) => row.cells)
    .filter((cell) => !levelHeader || Math.abs(cell.x - levelHeader.x) <= 45)
    .map((cell) => cell.text.match(/\b([A-Z]\d+)\b/i)?.[1])
    .find(Boolean)
    ?? inlineLevel)
    ?.toUpperCase();

  const cellsRightOnSameVisualRow = (label: LogisticsFinalTableCell, tolerance = 3) =>
    allCells
      .filter((cell) =>
        cell.page === label.page &&
        cell.x > label.x + Math.max(1, label.width * 0.5) &&
        isSamePdfVisualRow(cell.y, label.y, tolerance)
      )
      .sort((a, b) => a.x - b.x);

  const costHeader = allCells.find((cell) =>
    /^(?:c\/costo|centro\s+(?:di\s+)?costo)(?:\s|$)/i.test(cell.normalized)
  );
  const inlineCostValue = costHeader?.text
    .replace(/^(?:c\/costo|centro\s+(?:di\s+)?costo)\s*:?\s*/i, '')
    .trim();
  const costValuesOnRow = costHeader ? cellsRightOnSameVisualRow(costHeader) : [];
  const costValues = costHeader && costValuesOnRow.length
    ? costValuesOnRow
    : costHeader
    ? allCells
        .filter((cell) =>
          cell.page === costHeader.page &&
          cell.x >= costHeader.x - 2 &&
          cell.y < costHeader.y &&
          costHeader.y - cell.y <= 35
        )
        .sort((a, b) => b.y - a.y || a.x - b.x)
    : [];
  const costCenterCode =
    inlineCostValue?.match(/^(\d{1,4})\b/)?.[1] ??
    costValues.find((cell) => /^\d{1,4}$/.test(cell.text.trim()))?.text.trim();
  const costCenterDescription =
    inlineCostValue?.replace(/^\d{1,4}\s*/, '').trim() ||
    costValues
    .find((cell) =>
      cell.text.trim() !== costCenterCode &&
      !/^(?:sede|codice|livello|qualifica)\b/i.test(cell.normalized)
    )
    ?.text.replace(/\s+/g, ' ').trim();

  const siteHeader = allCells.find((cell) => /^sede\s*:?\s*$/i.test(cell.normalized));
  const siteCode = siteHeader
    ? cellsRightOnSameVisualRow(siteHeader).find((cell) => /^\d{1,4}$/.test(cell.text.trim()))?.text.trim()
    : undefined;

  const activityHeader = costHeader
    ? allCells
        .filter((cell) =>
          cell.page === costHeader.page &&
          /^codice\s*:?\s*$/i.test(cell.normalized) &&
          cell.y < costHeader.y &&
          costHeader.y - cell.y <= 45
        )
        .sort((a, b) => Math.abs(a.x - costHeader.x) - Math.abs(b.x - costHeader.x))[0]
    : undefined;
  const activityCode = activityHeader
    ? cellsRightOnSameVisualRow(activityHeader).find((cell) => /^\d{2,8}$/.test(cell.text.trim()))?.text.trim()
    : undefined;

  return {
    companyName,
    level,
    siteCode,
    costCenterCode,
    costCenterDescription,
    activityCode,
    siteCostCenter: costCenterCode,
  };
};

function findPeriod(rows: string[]) {
  const monthNames = Object.keys(MONTHS).join('|');
  const explicitPeriodRow = rows.find((row) => /periodo\s+(?:di\s+)?paga|periodo\s+pag/i.test(normalizeText(row)));
  const fallbackRows = rows.filter((row) => !/data\s+valuta|data\s+pagamento|pagamento|bonifico|data\s+documento|data\s+stampa/i.test(normalizeText(row)));
  const sourceText = normalizeText(explicitPeriodRow ?? fallbackRows.join(' '));
  const match = sourceText.match(new RegExp(`\\b(${monthNames})\\s+(20\\d{2})\\b`, 'i'));
  if (!match) return {};

  const month = MONTHS[match[1].toLowerCase()];
  const year = Number(match[2]);
  return {
    label: `${match[1].toUpperCase()} ${match[2]}`,
    month: isPlausibleMonth(month) ? month : undefined,
    year: isPlausibleYear(year) ? year : undefined,
  };
}

function findMoneyAfterLabels(rows: string[], labels: string[], forbidden: string[] = []): { value?: number; row?: string; page?: number } {
  for (const row of rows) {
    const normalized = normalizeText(row);
    if (forbidden.some((label) => normalized.includes(normalizeText(label)))) continue;
    if (!labels.some((label) => normalized.includes(normalizeText(label)))) continue;

    const values = findMoneyValues(row).filter((value) => isPlausibleMoney(value, 0, 50000));
    if (values.length > 0) return { value: values[values.length - 1], row };
  }

  return {};
}

function parseSummary(rows: string[], parsedLines: PayslipLine[]): PayslipSummary {
  const totalEarnings = findMoneyAfterLabels(rows, ['totale competenze'], ['progressivi', 'progressivo', 'tfr']).value;
  const explicitTotalDeductions = findMoneyAfterLabels(rows, ['totale trattenute']);
  const totalDeductions = explicitTotalDeductions.value;
  const netAmount =
    findMoneyAfterLabels(rows, ['netto in busta', 'netto a pagare', 'totale netto', 'importo netto', 'netto'], [
      'imponibile',
      'arrotondamento',
      'totale competenze',
      'totale trattenute',
    ]).value ?? findMoneyAfterLabels(rows, ['bonifico']).value;
  const grossFromLines = sumLineAmounts(parsedLines.filter((line) => line.type === 'earning'));

  return {
    grossAmount: isPlausibleMoney(totalEarnings) ? totalEarnings : grossFromLines > 100 ? grossFromLines : undefined,
    netAmount: isPlausibleMoney(netAmount) ? netAmount : undefined,
    totalEarnings: isPlausibleMoney(totalEarnings) ? totalEarnings : undefined,
    totalDeductions: totalDeductions !== undefined && totalDeductions >= 0 ? totalDeductions : undefined,
  };
}

export function parseLogisticsLayoutV1Payslip(structuredText: StructuredPdfText, detection?: PayslipFormatDetection): PayslipImport {
  const rows = structuredText.reconstructedLines.map((line) => line.text);
  const tableRows = parseLogisticsLayoutV1TableRows(structuredText);
  payrollDebugLog('[PAYROLL][3] Righe tabellari ricostruite:', {
    count: tableRows.length,
    pages: Array.from(new Set(tableRows.map((row) => row.page))),
  });
  const finalTable = parseLogisticsFinalSummaryTable(structuredText);
  const monthlyTotals = parseLogisticsMonthlyTotals(structuredText, finalTable.net?.value);
  payrollDebugLog('[PAYROLL][5] Netto prima dei fallback:', finalTable.net?.value ?? null);
  const tableFinalSummary = validateFinalSummaryAgainstRows(finalTable, tableRows);
  const finalSummary = parsePayslipFinalSummary(structuredText);
  const fallbackPeriod = findPeriod(rows);
  const period = {
    label: finalTable.period.label ?? finalSummary.periodLabel ?? fallbackPeriod.label,
    month: finalTable.period.month ?? finalSummary.month ?? fallbackPeriod.month,
    year: finalTable.period.year ?? finalSummary.year ?? fallbackPeriod.year,
  };
  const year = period.year;
  const month = period.month;
  const lineDrafts =
    tableRows.length > 0
      ? tableRows.map(tableRowToPayslipLine)
      : boundedTextTableRows(rows)
          .map(parseLogisticsLayoutV1PayslipLine)
          .filter((line): line is ParsedLineDraft => Boolean(line));
  const parsedLines = normalizePayslipLines(
    lineDrafts.map(({ rawNumbers: _rawNumbers, ...line }) => line)
  );
  const fallbackSummary = parseSummary(rows, parsedLines);
  const finalTableConfidence = tableRows.length > 0 ? tableFinalSummary.confidence : finalTable.confidence;
  const finalTableValidated = tableRows.length > 0 ? tableFinalSummary.mathematicallyValidated : finalTable.isEconomicallyConsistent;
  const finalSummaryValidated = finalTable.isEconomicallyConsistent === true;
  const acceptedFinalTableNet =
    finalTable.net && finalTable.isEconomicallyConsistent !== false ? finalTable.net.value : undefined;
  const summary: PayslipSummary = {
    ...fallbackSummary,
    grossAmount:
      finalTable.totalEarnings?.value ??
      monthlyTotals.totalEarnings?.value ??
      finalSummary.totalEarnings ??
      fallbackSummary.grossAmount,
    totalEarnings:
      finalTable.totalEarnings?.value ??
      monthlyTotals.totalEarnings?.value ??
      finalSummary.totalEarnings ??
      fallbackSummary.totalEarnings,
    totalDeductions:
      finalTable.totalDeductions?.value ??
      monthlyTotals.totalDeductions?.value ??
      finalSummary.totalDeductions ??
      fallbackSummary.totalDeductions,
    netAmount: acceptedFinalTableNet,
    paymentDate: finalTable.paymentDate?.value ?? finalSummary.paymentDate ?? fallbackSummary.paymentDate,
  };
  payrollDebugLog('[PAYROLL][6] Netto dopo i fallback:', summary.netAmount ?? null);
  const warnings: string[] = [];

  if (!period.month || !period.year) warnings.push('Periodo di competenza non riconosciuto.');
  if (parsedLines.length === 0) warnings.push('Nessuna riga paga riconosciuta dai codici supportati.');
  tableRows
    .filter((row) => !row.economicColumnCertain)
    .forEach((row) => warnings.push(
      `Voce ${row.code}: presenza ambigua nelle colonne competenze e trattenute; conservata come informational.`
    ));
  parsedLines
    .filter((line) => line.classificationAmbiguous)
    .forEach((line) => warnings.push(
      `Classificazione semantica ambigua per la voce ${line.code ?? line.label}: ${
        line.classificationAlternatives?.join(', ') || 'alternative non disponibili'
      }.`
    ));
  if (summary.netAmount === undefined) warnings.push('Netto non riconosciuto con confidenza sufficiente.');
  if (summary.grossAmount === undefined) warnings.push('Lordo non riconosciuto con confidenza sufficiente.');
  warnings.push(...(tableRows.length > 0 ? tableFinalSummary.warnings : finalTable.warnings));
  warnings.push(...monthlyTotals.warnings);

  const totalEarningsSource = findMoneyAfterLabels(rows, ['totale competenze']);
  const deductionsSource = findMoneyAfterLabels(rows, ['totale trattenute']);
  const tableEconomicConfidence =
    monthlyTotals.isEconomicallyConsistent === false || (!monthlyTotals.totalEarnings && !monthlyTotals.totalDeductions && finalTableValidated === false)
      ? 'uncertain'
      : 'confirmed';
  const confidence = finalSummaryValidated ? 100 : finalTableConfidence;
  const metadata = extractLogisticsMetadata(structuredText);

  return {
    id: buildId(year, month),
    payrollProvider: 'Payroll Layout v1',
    companyName: metadata.companyName,
    detectedFormat: 'logisticsLayoutV1',
    parserUsed: 'logisticsLayoutV1',
    payrollPeriodLabel: period.label,
    level: metadata.level,
    siteCode: metadata.siteCode,
    costCenterCode: metadata.costCenterCode,
    costCenterDescription: metadata.costCenterDescription,
    activityCode: metadata.activityCode,
    siteCostCenter: metadata.siteCostCenter,
    year,
    month,
    importedAt: new Date().toISOString(),
    extractionMethod: 'pdf_text',
    confidence: Math.max(20, Math.min(100, confidence || detection?.confidence || 80)),
    rawTextTemporary: structuredText.plainText,
    parsedLines,
    summary,
    warnings,
    fieldConfidence: {
      payrollPeriodLabel: finalTable.period.row
        ? fieldConfidence('confirmed', 'logisticsLayoutV1FinalTable', period.label, finalTable.period.row, finalTable.period.page)
        : finalSummaryFieldConfidence(finalSummary, 'period', period.label, 'logisticsLayoutV1'),
      grossAmount: finalTable.totalEarnings
        ? fieldConfidence(tableEconomicConfidence, 'logisticsLayoutV1FinalTable', summary.grossAmount, finalTable.totalEarnings.row, finalTable.totalEarnings.page)
        : monthlyTotals.totalEarnings
        ? fieldConfidence(
            tableEconomicConfidence,
            'logisticsLayoutV1MonthlyTotals',
            summary.grossAmount,
            monthlyTotals.totalEarnings.row,
            monthlyTotals.totalEarnings.page
          )
        : finalSummary.sources.totalEarnings
        ? finalSummaryFieldConfidence(finalSummary, 'totalEarnings', summary.grossAmount, 'logisticsLayoutV1')
        : fieldConfidence(summary.grossAmount !== undefined ? 'confirmed' : 'missing', 'logisticsLayoutV1', summary.grossAmount, totalEarningsSource.row),
      netAmount: finalTable.net
        ? fieldConfidence(tableEconomicConfidence, 'logisticsLayoutV1FinalTable', finalTable.net.value, finalTable.net.row, finalTable.net.page)
        : fieldConfidence('missing', 'logisticsLayoutV1FinalTable', undefined),
      totalDeductions: finalTable.totalDeductions
        ? fieldConfidence(tableEconomicConfidence, 'logisticsLayoutV1FinalTable', summary.totalDeductions, finalTable.totalDeductions.row, finalTable.totalDeductions.page)
        : monthlyTotals.totalDeductions
        ? fieldConfidence(
            tableEconomicConfidence,
            'logisticsLayoutV1MonthlyTotals',
            summary.totalDeductions,
            monthlyTotals.totalDeductions.row,
            monthlyTotals.totalDeductions.page
          )
        : finalSummary.sources.totalDeductions
        ? finalSummaryFieldConfidence(finalSummary, 'totalDeductions', summary.totalDeductions, 'logisticsLayoutV1')
        : fieldConfidence(
            summary.totalDeductions !== undefined ? 'confirmed' : 'missing',
            'logisticsLayoutV1',
            summary.totalDeductions,
            deductionsSource.row
          ),
    },
  };
}
