import type { StructuredPdfText } from '../driverPayrollPdfLayout';
import { normalizeText } from './payslipParserHelpers';
import type { PayslipFormatDetection } from './payrollParserTypes';

export function detectPayslipFormat(structuredText: StructuredPdfText): PayslipFormatDetection {
  const text = normalizeText(structuredText.plainText);
  const indicators: string[] = [];

  if (text.includes('periodo di paga') || text.includes('periodo paga')) indicators.push('pay_period');
  if (text.includes('voce') && /ore|gg|mesi/.test(text)) indicators.push('voice_hours_header');
  if (text.includes('voce') && text.includes('trattenute') && text.includes('competenze')) indicators.push('payroll_table_columns');
  if (/totale\s+competenze/.test(text) && /totale\s+trattenute/.test(text) && /\bnetto\b/.test(text)) indicators.push('final_summary_box');
  if (/data\s+valuta|arrotondamento/.test(text) && /totale\s+competenze|totale\s+trattenute/.test(text)) indicators.push('final_payment_footer');
  if (text.includes('paga base')) indicators.push('base_pay_label');
  if (/\b(?:0169|0170|0779|0785|1000|2310|2315)\b/.test(text)) indicators.push('known_payroll_codes');

  const hasDedicatedLayoutShape =
    indicators.includes('voice_hours_header') &&
    indicators.includes('known_payroll_codes') &&
    (indicators.includes('final_summary_box') || indicators.includes('payroll_table_columns'));

  if (hasDedicatedLayoutShape || indicators.length >= 4) {
    return {
      format: 'logisticsLayoutV1',
      confidence: Math.min(98, 45 + indicators.length * 12),
      indicators,
    };
  }

  if (/netto|lordo|totale competenze|bonifico|trattenute|periodo/.test(text)) {
    return {
      format: 'generic',
      confidence: 55,
      indicators: ['generic_payroll_terms'],
    };
  }

  return {
    format: 'unknown',
    confidence: 15,
    indicators,
  };
}
