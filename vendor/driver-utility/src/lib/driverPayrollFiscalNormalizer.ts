import { resolvePayrollCodeDefinition } from './driverPayrollCodeCatalog';
import {
  normalizeFiscalLabel,
  resolvePayrollFiscalLabels,
  type PayrollFiscalLabelDefinition,
  type PayrollFiscalTarget,
} from './driverPayrollFiscalCatalog';
import type {
  PayslipFiscalData,
  PayrollFiscalPeriod,
  PayrollFiscalValue,
  PayrollFiscalValueSource,
  PayrollFiscalValueKind,
} from './driverPayrollFiscalTypes';
import { mapPayrollFiscalValueKindToUnit } from './driverPayrollFiscalUnits';
import type { PdfTextItem, StructuredPdfText, ReconstructedPdfLine } from './driverPayrollPdfLayout';
import { isPdfVisuallyBelow, isSamePdfVisualRow } from './driverPayrollPdfGeometry';
import { parseItalianNumber } from './driverPayrollParsers/payslipParserHelpers';
import type { PayslipImport, PayslipLine } from './driverPayrollTypes';

type FiscalCandidate = {
  target: PayrollFiscalTarget;
  value: number;
  valueKind?: PayrollFiscalValueKind;
  source: PayrollFiscalValueSource;
  period: PayrollFiscalPeriod;
  confidence: number;
  ambiguous: boolean;
  rawText: string;
  page?: number;
  section: string;
  extractionMethod: PayrollFiscalValue['extractionMethod'];
  alternatives: string[];
};

const moneyPattern = /[+-]?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}/g;
const percentagePattern = /[+-]?(?:\d{1,3}(?:[.,]\d+)?)\s*%/g;
const integerPattern = /[+-]?\d+/g;

const numericValues = (text: string, kind: PayrollFiscalValueKind = 'money'): number[] => {
  const pattern = kind === 'percentage' ? percentagePattern : kind === 'integer' ? integerPattern : moneyPattern;
  const matches = text.match(pattern) ?? [];
  return matches
    .map((value) => parseItalianNumber(value.replace('%', '').trim()))
    .filter((value): value is number => value !== undefined);
};

const emptyFiscalData = (payslip: PayslipImport): PayslipFiscalData => ({
  schemaVersion: 'fiscal-v1',
  period: { month: payslip.month || undefined, year: payslip.year || undefined },
  socialSecurity: {},
  incomeTax: {},
  additionalTaxes: {},
  tfr: {},
  annualProgressives: {},
  unclassifiedValues: [],
  warnings: [],
});

const periodFromContext = (
  definition: PayrollFiscalLabelDefinition,
  row: ReconstructedPdfLine,
  precedingRows: ReconstructedPdfLine[],
  followingRows: ReconstructedPdfLine[]
): PayrollFiscalPeriod => {
  if (definition.explicitPeriod) return definition.explicitPeriod;
  const text = normalizeFiscalLabel(row.text);
  if (/\b(progressiv|progressivo|progressivi|progr)\b/.test(text)) return 'progressive';
  if (/\b(mese|mensile)\b/.test(text)) return 'monthly';
  if (/\b(annuale|anno)\b/.test(text)) return 'annual';
  const progressiveSection = [...precedingRows]
    .reverse()
    .find((candidate) => candidate.page === row.page && normalizeFiscalLabel(candidate.text) === 'progressivi');
  if (progressiveSection) return 'progressive';
  const laterProgressiveSection = followingRows
    .find((candidate) => candidate.page === row.page && normalizeFiscalLabel(candidate.text) === 'progressivi');
  return laterProgressiveSection ? 'monthly' : 'unknown_period';
};

const candidateFromDefinition = (
  definition: PayrollFiscalLabelDefinition,
  value: number,
  row: ReconstructedPdfLine,
  precedingRows: ReconstructedPdfLine[],
  followingRows: ReconstructedPdfLine[],
  extractionMethod: FiscalCandidate['extractionMethod'],
  alternatives: string[] = []
): FiscalCandidate => {
  const period = periodFromContext(definition, row, precedingRows, followingRows);
  return {
    target: definition.target,
    value,
    valueKind: definition.valueKind,
    source: period === 'progressive' ? 'progressive_section' : 'fiscal_section',
    period,
    confidence: Math.max(20, definition.confidence - (period === 'unknown_period' ? 20 : 0) - (alternatives.length ? 25 : 0)),
    ambiguous: alternatives.length > 0,
    rawText: row.text,
    page: row.page,
    section: period === 'progressive' ? 'PROGRESSIVI' : 'FISCALE_CONTRIBUTIVA',
    extractionMethod,
    alternatives,
  };
};

const candidatesFromRows = (structuredText: StructuredPdfText): FiscalCandidate[] => {
  const candidates: FiscalCandidate[] = [];
  const rows = structuredText.reconstructedLines;

  rows.forEach((row, rowIndex) => {
    const definitions = resolvePayrollFiscalLabels(row.text);
    if (!definitions.length) return;
    const valuesByDefinition = definitions.flatMap((definition) =>
      numericValues(row.text, definition.valueKind).map((value) => ({ definition, value }))
    );
    if (valuesByDefinition.length) {
      const alternatives = definitions.length > 1 ? definitions.map((item) => item.target) : [];
      const last = valuesByDefinition[valuesByDefinition.length - 1];
      candidates.push(candidateFromDefinition(
        last.definition,
        last.value,
        row,
        rows.slice(0, rowIndex),
        rows.slice(rowIndex + 1),
        'label_catalog',
        alternatives
      ));
      return;
    }

    const headerCells = row.items
      .map((item) => ({ item, definitions: resolvePayrollFiscalLabels(item.text) }))
      .filter((entry) => entry.definitions.length > 0)
      .sort((a, b) => a.item.x - b.item.x);
    if (!headerCells.length) return;
    const valueRow = rows[rowIndex + 1];
    if (!valueRow || valueRow.page !== row.page || row.y - valueRow.y <= 0 || row.y - valueRow.y > 15) return;
    const orderedValueItems = [...valueRow.items].sort((a, b) => a.x - b.x);
    if (headerCells.length === orderedValueItems.length) {
      const orderedPairs = headerCells.map((header, index) => ({
        header,
        values: numericValues(orderedValueItems[index].text, header.definitions[0].valueKind),
      }));
      if (orderedPairs.every((pair) => pair.values.length === 1)) {
        orderedPairs.forEach(({ header, values }) => {
          const alternatives = header.definitions.length > 1 ? header.definitions.map((item) => item.target) : [];
          candidates.push(candidateFromDefinition(
            header.definitions[0],
            values[0],
            row,
            rows.slice(0, rowIndex),
            rows.slice(rowIndex + 1),
            'geometric_column',
            alternatives
          ));
        });
        return;
      }
    }

    const orderedHeaderItems = [...row.items].sort((a, b) => a.x - b.x);
    headerCells.forEach((header) => {
      const center = (item: ReconstructedPdfLine['items'][number]) =>
        item.x + (item.width ?? item.text.length * 6) / 2;
      const itemIndex = orderedHeaderItems.indexOf(header.item);
      const previousHeader = orderedHeaderItems[itemIndex - 1];
      const nextHeader = orderedHeaderItems[itemIndex + 1];
      const left = previousHeader
        ? (center(previousHeader) + center(header.item)) / 2
        : Number.NEGATIVE_INFINITY;
      const right = nextHeader
        ? (center(header.item) + center(nextHeader)) / 2
        : Number.POSITIVE_INFINITY;
      const matchingValues = valueRow.items
        .map((item) => ({
          item,
          values: numericValues(item.text, header.definitions[0].valueKind),
        }))
        .filter((entry) => entry.values.length === 1)
        .filter(({ item }) => {
          const valueCenter = center(item);
          return valueCenter >= left && valueCenter < right;
        });
      if (matchingValues.length !== 1) return;
      const alternatives = header.definitions.length > 1 ? header.definitions.map((item) => item.target) : [];
      candidates.push(candidateFromDefinition(
        header.definitions[0],
        matchingValues[0].values[0],
        row,
        rows.slice(0, rowIndex),
        rows.slice(rowIndex + 1),
        'geometric_column',
        alternatives
      ));
    });
  });
  return candidates;
};

const candidatesFromMonthlySections = (structuredText: StructuredPdfText): FiscalCandidate[] => {
  const candidates: FiscalCandidate[] = [];
  const rows = structuredText.reconstructedLines;
  const sections: Array<{
    pattern: RegExp;
    fields: Array<{ label: RegExp; target: PayrollFiscalTarget }>;
    section: string;
  }> = [
    {
      pattern: /sociali\s+i\s*n\s*p\s*s/i,
      fields: [
        { label: /^imponibile$/i, target: 'socialSecurity.taxable' },
        { label: /^trattenute$/i, target: 'socialSecurity.employeeContributions' },
      ],
      section: 'SOCIALI_INPS',
    },
    {
      pattern: /fiscali\s+irpef\s+m\s*o/i,
      fields: [
        { label: /^imponibile$/i, target: 'incomeTax.taxable' },
        { label: /^trattenute$/i, target: 'incomeTax.taxWithheld' },
        { label: /^totale\s+trattenute$/i, target: 'incomeTax.totalTaxWithheld' },
      ],
      section: 'FISCALI_IRPEF_MO',
    },
    {
      pattern: /fiscali\s+irpef\s+m\s*s/i,
      fields: [
        { label: /^imponibile$/i, target: 'incomeTax.supplementaryTaxable' },
        { label: /^trattenute$/i, target: 'incomeTax.supplementaryTaxWithheld' },
        { label: /^totale\s+trattenute$/i, target: 'incomeTax.totalTaxWithheld' },
      ],
      section: 'FISCALI_IRPEF_MS',
    },
  ];

  sections.forEach((section) => {
    const seenSectionBands = new Set<string>();
    rows.forEach((sectionRow, sectionIndex) => {
      const visualHeaderRows = rows.filter((candidate) =>
        candidate.page === sectionRow.page &&
        isSamePdfVisualRow(candidate.y, sectionRow.y, 3)
      );
      const visualHeaderItems = visualHeaderRows
        .flatMap((candidate) => candidate.items)
        .sort((a, b) => a.x - b.x);
      const visualHeaderText = visualHeaderItems.map((item) => item.text).join(' ');
      if (!section.pattern.test(normalizeFiscalLabel(visualHeaderText))) return;
      const bandKey = `${section.section}|${sectionRow.page}|${Math.round(sectionRow.y)}`;
      if (seenSectionBands.has(bandKey)) return;
      seenSectionBands.add(bandKey);
      const explicitFiscalAnchors = visualHeaderItems
        .filter((item) =>
          sections.some((candidate) => candidate.pattern.test(normalizeFiscalLabel(item.text)))
        )
        .sort((a, b) => a.x - b.x);
      const syntheticSectionItem: PdfTextItem = {
        text: visualHeaderText,
        page: sectionRow.page,
        x: Math.min(...visualHeaderItems.map((item) => item.x)),
        y: sectionRow.y,
        width: Math.max(...visualHeaderItems.map((item) => item.x + (item.width ?? item.text.length * 6))) -
          Math.min(...visualHeaderItems.map((item) => item.x)),
      };
      const fiscalAnchors: PdfTextItem[] = explicitFiscalAnchors.length
        ? explicitFiscalAnchors
        : [syntheticSectionItem];
      const sectionItems = fiscalAnchors.filter((item) =>
        section.pattern.test(normalizeFiscalLabel(item.text))
      );
      if (!sectionItems.length && !explicitFiscalAnchors.length) sectionItems.push(syntheticSectionItem);
      sectionItems.forEach((sectionItem) => {
        const anchorIndex = fiscalAnchors.indexOf(sectionItem);
        const center = (item: ReconstructedPdfLine['items'][number]) =>
          item.x + (item.width ?? item.text.length * 6) / 2;
        const previous = fiscalAnchors[anchorIndex - 1];
        const next = fiscalAnchors[anchorIndex + 1];
        const left = previous ? (center(previous) + center(sectionItem)) / 2 : sectionItem.x - 20;
        const right = next ? (center(sectionItem) + center(next)) / 2 : Number.POSITIVE_INFINITY;
        const scopedRows = rows.slice(sectionIndex + 1).filter((row) =>
          row.page === sectionRow.page &&
          isPdfVisuallyBelow(row.y, sectionRow.y, 0.5, 55)
        );

        section.fields.forEach(({ label, target }) => {
          for (let index = 0; index < scopedRows.length; index += 1) {
            const row = scopedRows[index];
            const labelCells = row.items
              .filter((item) => item.x >= left && item.x < right)
              .filter((item) => label.test(normalizeFiscalLabel(item.text)));
            if (labelCells.length !== 1) continue;
            const labelCell = labelCells[0];
            const sectionLabels = row.items
              .filter((item) => item.x >= left && item.x < right)
              .filter((item) => /^(?:imponibile|trattenute|totale\s+trattenute)$/i.test(normalizeFiscalLabel(item.text)))
              .sort((a, b) => a.x - b.x);
            const labelIndex = sectionLabels.indexOf(labelCell);
            const nextLabel = sectionLabels[labelIndex + 1];
            const valueLeft = labelCell.x;
            const valueRight = nextLabel
              ? (center(labelCell) + center(nextLabel)) / 2
              : right;
            const sameRowValues = row.items
              .filter((item) => item !== labelCell && item.x >= valueLeft && item.x < valueRight)
              .flatMap((item) => numericValues(item.text));
            const nextRow = scopedRows[index + 1];
            const nextRowValues = nextRow && isPdfVisuallyBelow(nextRow.y, row.y, 0.5, 15)
              ? nextRow.items
                  .filter((item) => item.x >= valueLeft && item.x < valueRight)
                  .flatMap((item) => numericValues(item.text))
              : [];
            const sameVisualRowValues = scopedRows
              .filter((candidate) =>
                candidate.page === row.page &&
                isSamePdfVisualRow(candidate.y, row.y, 2)
              )
              .flatMap((candidate) => candidate.items)
              .filter((item) => item.x >= valueLeft && item.x < valueRight)
              .flatMap((item) => numericValues(item.text));
            const valuesInLabelRow = Array.from(new Set([
              ...sameRowValues,
              ...sameVisualRowValues,
            ]));
            const uniqueValues = valuesInLabelRow.length
              ? valuesInLabelRow
              : Array.from(new Set(nextRowValues));
            if (uniqueValues.length !== 1) continue;
            candidates.push({
              target,
              value: uniqueValues[0],
              source: 'fiscal_section',
              period: 'monthly',
              confidence: 98,
              ambiguous: false,
              rawText: `${sectionItem.text} | ${row.text}`,
              page: row.page,
              section: section.section,
              extractionMethod: 'geometric_column',
              alternatives: [],
            });
            break;
          }
        });
      });
    });
  });
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const identity = `${candidate.target}|${candidate.value}|${candidate.page}|${candidate.section}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
};

export const diagnosePayrollFiscalSectionMatches = (structuredText: StructuredPdfText) =>
  candidatesFromMonthlySections(structuredText).map((candidate) => ({
    target: candidate.target,
    value: candidate.value,
    page: candidate.page,
    section: candidate.section,
    confidence: candidate.confidence,
    extractionMethod: candidate.extractionMethod,
    rawText: candidate.rawText,
  }));

const amountForLine = (line: PayslipLine) =>
  line.deductionAmount ?? line.earningAmount ?? line.informationalValue ?? line.amount;

const lineCandidate = (
  line: PayslipLine,
  target: PayrollFiscalTarget,
  value: number
): FiscalCandidate => ({
  target,
  value,
  source: 'payroll_line',
  period: target === 'incomeTax.taxAdjustment' ? 'adjustment' : 'monthly',
  confidence: line.classificationConfidence ?? line.confidence ?? 75,
  ambiguous: Boolean(line.classificationAmbiguous),
  rawText: line.rawLine ?? `${line.code ?? ''} ${line.label}`.trim(),
  page: line.sourcePage,
  section: 'VOCI_PAGA',
  extractionMethod: 'payroll_line',
  alternatives: line.classificationAlternatives ?? [],
});

const candidatesFromLines = (lines: PayslipLine[]): FiscalCandidate[] => {
  const targetsByCanonicalKey: Record<string, PayrollFiscalTarget> = {
    'payroll.social_contribution.employee': 'socialSecurity.employeeContributions',
    'payroll.tax.income': 'incomeTax.taxWithheld',
    'payroll.tax.regional': 'additionalTaxes.regionalBalance',
    'payroll.tax.municipal.balance': 'additionalTaxes.municipalBalance',
    'payroll.tax.municipal.advance': 'additionalTaxes.municipalAdvance',
    'payroll.tax.adjustment.730': 'incomeTax.taxAdjustment',
  };
  return lines.flatMap((line) => {
    const definition = resolvePayrollCodeDefinition({
      code: line.code,
      description: line.originalDescription ?? line.label,
    }).definition;
    const canonicalKey = line.canonicalKey ?? definition?.canonicalKey;
    const target = canonicalKey ? targetsByCanonicalKey[canonicalKey] : undefined;
    const value = amountForLine(line);
    return target && value !== undefined ? [lineCandidate(line, target, value)] : [];
  });
};

const fiscalValue = (candidate: FiscalCandidate): PayrollFiscalValue => ({
  field: candidate.target,
  value: candidate.value,
  valueKind: candidate.valueKind,
  unit: mapPayrollFiscalValueKindToUnit(candidate.valueKind),
  source: candidate.source,
  period: candidate.period,
  confidence: candidate.confidence,
  ambiguous: candidate.ambiguous || undefined,
  rawText: candidate.rawText,
  page: candidate.page,
  section: candidate.section,
  extractionMethod: candidate.extractionMethod,
  alternatives: candidate.alternatives.length ? candidate.alternatives : undefined,
});

const preferCandidate = (current: PayrollFiscalValue | undefined, candidate: PayrollFiscalValue) => {
  if (!current) return candidate;
  if (candidate.confidence > current.confidence) return candidate;
  if (candidate.confidence < current.confidence || candidate.value === current.value) return current;
  return {
    ...current,
    ambiguous: true,
    confidence: Math.max(20, current.confidence - 25),
    alternatives: Array.from(new Set([
      ...(current.alternatives ?? []),
      `${candidate.field}:${candidate.value}`,
    ])),
  };
};

const assignCandidate = (data: PayslipFiscalData, candidate: FiscalCandidate) => {
  const value = fiscalValue(candidate);
  if (candidate.ambiguous || candidate.period === 'unknown_period') {
    data.unclassifiedValues.push(value);
    return;
  }
  const progressive = candidate.period === 'progressive' || candidate.period === 'annual';
  if (
    progressive &&
    ['incomeTax.workDeductions', 'incomeTax.familyDeductions'].includes(candidate.target)
  ) {
    data.unclassifiedValues.push(value);
    return;
  }
  switch (candidate.target) {
    case 'incomeTax.deductionDays':
      if (progressive) {
        data.annualProgressives.deductionDays = preferCandidate(data.annualProgressives.deductionDays, value);
      } else {
        data.incomeTax.deductionDays = preferCandidate(data.incomeTax.deductionDays, value);
      }
      break;
    case 'socialSecurity.taxable':
      if (progressive) {
        data.socialSecurity.progressiveTaxable = preferCandidate(data.socialSecurity.progressiveTaxable, value);
        data.annualProgressives.socialSecurityTaxable = preferCandidate(data.annualProgressives.socialSecurityTaxable, value);
      }
      else data.socialSecurity.monthlyTaxable = preferCandidate(data.socialSecurity.monthlyTaxable, value);
      break;
    case 'socialSecurity.contributionRate':
      data.socialSecurity.contributionRate = preferCandidate(data.socialSecurity.contributionRate, value);
      break;
    case 'socialSecurity.employeeContributions':
      if (progressive) {
        data.annualProgressives.employeeContributions = preferCandidate(
          data.annualProgressives.employeeContributions,
          value
        );
      } else {
        data.socialSecurity.employeeContributions = preferCandidate(data.socialSecurity.employeeContributions, value);
      }
      break;
    case 'socialSecurity.employerContributions':
      data.socialSecurity.employerContributions = preferCandidate(data.socialSecurity.employerContributions, value);
      break;
    case 'incomeTax.taxable':
      if (progressive) {
        data.incomeTax.progressiveTaxable = preferCandidate(data.incomeTax.progressiveTaxable, value);
        data.annualProgressives.incomeTaxTaxable = preferCandidate(data.annualProgressives.incomeTaxTaxable, value);
      }
      else {
        data.incomeTax.monthlyTaxable = preferCandidate(data.incomeTax.monthlyTaxable, value);
        data.incomeTax.ordinaryMonthlyTaxable = preferCandidate(data.incomeTax.ordinaryMonthlyTaxable, value);
      }
      break;
    case 'incomeTax.supplementaryTaxable':
      data.incomeTax.supplementaryMonthlyTaxable = preferCandidate(data.incomeTax.supplementaryMonthlyTaxable, value);
      break;
    case 'incomeTax.grossTax':
      if (progressive) data.annualProgressives.grossTax = preferCandidate(data.annualProgressives.grossTax, value);
      else data.incomeTax.grossTax = preferCandidate(data.incomeTax.grossTax, value);
      break;
    case 'incomeTax.workDeductions':
      data.incomeTax.workDeductions = preferCandidate(data.incomeTax.workDeductions, value);
      break;
    case 'incomeTax.familyDeductions':
      data.incomeTax.familyDeductions = preferCandidate(data.incomeTax.familyDeductions, value);
      break;
    case 'incomeTax.additionalDeductions':
      if (progressive) {
        data.annualProgressives.deductions = preferCandidate(data.annualProgressives.deductions, value);
      } else {
        data.incomeTax.additionalDeductions = preferCandidate(data.incomeTax.additionalDeductions, value);
      }
      break;
    case 'incomeTax.taxCredits':
      data.incomeTax.taxCredits = preferCandidate(data.incomeTax.taxCredits, value);
      break;
    case 'incomeTax.supplementaryTreatment':
      data.incomeTax.supplementaryTreatment = preferCandidate(data.incomeTax.supplementaryTreatment, value);
      break;
    case 'incomeTax.netTax':
      if (progressive) data.annualProgressives.netTax = preferCandidate(data.annualProgressives.netTax, value);
      else data.incomeTax.netTax = preferCandidate(data.incomeTax.netTax, value);
      break;
    case 'incomeTax.taxWithheld':
      if (progressive) data.annualProgressives.netTax = preferCandidate(data.annualProgressives.netTax, value);
      else {
        data.incomeTax.taxWithheld = preferCandidate(data.incomeTax.taxWithheld, value);
        data.incomeTax.ordinaryTaxWithheld = preferCandidate(data.incomeTax.ordinaryTaxWithheld, value);
      }
      break;
    case 'incomeTax.supplementaryTaxWithheld':
      data.incomeTax.supplementaryTaxWithheld = preferCandidate(data.incomeTax.supplementaryTaxWithheld, value);
      break;
    case 'incomeTax.totalTaxWithheld':
      data.incomeTax.totalTaxWithheld = preferCandidate(data.incomeTax.totalTaxWithheld, value);
      break;
    case 'incomeTax.taxAdjustment':
      data.incomeTax.taxAdjustment = preferCandidate(data.incomeTax.taxAdjustment, value);
      break;
    case 'additionalTaxes.regionalBalance':
      data.additionalTaxes.regionalBalance = preferCandidate(data.additionalTaxes.regionalBalance, value);
      break;
    case 'additionalTaxes.municipalBalance':
      data.additionalTaxes.municipalBalance = preferCandidate(data.additionalTaxes.municipalBalance, value);
      break;
    case 'additionalTaxes.municipalAdvance':
      data.additionalTaxes.municipalAdvance = preferCandidate(data.additionalTaxes.municipalAdvance, value);
      break;
    case 'tfr.monthlyAccrual':
      data.tfr.monthlyAccrual = preferCandidate(data.tfr.monthlyAccrual, value);
      break;
    case 'tfr.progressiveAccrual':
      data.tfr.progressiveAccrual = preferCandidate(data.tfr.progressiveAccrual, value);
      break;
    case 'tfr.taxableBase':
      data.tfr.taxableBase = preferCandidate(data.tfr.taxableBase, value);
      break;
    case 'tfr.revaluation':
      data.tfr.revaluation = preferCandidate(data.tfr.revaluation, value);
      break;
    case 'tfr.revaluationTax':
      data.tfr.revaluationTax = preferCandidate(data.tfr.revaluationTax, value);
      break;
    case 'tfr.pensionFundContribution':
      data.tfr.pensionFundContribution = preferCandidate(data.tfr.pensionFundContribution, value);
      break;
    case 'tfr.accrualFrom2001':
      data.unclassifiedValues.push(value);
      break;
  }
};

export const normalizePayslipFiscalData = (
  structuredText: StructuredPdfText,
  payslip: PayslipImport
): PayslipFiscalData => {
  const data = emptyFiscalData(payslip);
  [...candidatesFromRows(structuredText), ...candidatesFromMonthlySections(structuredText), ...candidatesFromLines(payslip.parsedLines)]
    .forEach((candidate) => assignCandidate(data, candidate));

  const employeeBilateral = payslip.parsedLines.find((line) =>
    (line.canonicalKey ?? resolvePayrollCodeDefinition({ code: line.code }).definition?.canonicalKey) ===
    'payroll.bilateral_body.employee_contribution'
  );
  const employerBilateral = payslip.parsedLines.find((line) =>
    (line.canonicalKey ?? resolvePayrollCodeDefinition({ code: line.code }).definition?.canonicalKey) ===
    'payroll.bilateral_body.employer_contribution'
  );
  const employeeBilateralValue = employeeBilateral && amountForLine(employeeBilateral);
  const employerBilateralValue = employerBilateral && amountForLine(employerBilateral);
  if (employeeBilateral && employeeBilateralValue !== undefined) {
    data.socialSecurity.bilateralEmployeeContributions = fiscalValue(
      lineCandidate(employeeBilateral, 'socialSecurity.employeeContributions', employeeBilateralValue)
    );
  }
  if (employerBilateral && employerBilateralValue !== undefined) {
    data.socialSecurity.bilateralEmployerContributions = fiscalValue(
      lineCandidate(employerBilateral, 'socialSecurity.employerContributions', employerBilateralValue)
    );
  }
  if (data.unclassifiedValues.length) {
    data.warnings.push(`${data.unclassifiedValues.length} valori fiscali conservati con periodo o significato ambiguo.`);
  }
  return data;
};
