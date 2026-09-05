import type { StructuredPdfText } from '../driverPayrollPdfLayout';
import type { PayslipImport } from '../driverPayrollTypes';
import { payrollDebugLog } from '../driverPayrollDebugLogger';
import { parseGenericPayslip } from './genericPayslipParser';
import { detectPayslipFormat } from './payslipFormatDetector';
import { parseLogisticsLayoutV1Payslip } from './logisticsLayoutV1Parser';

export { detectPayslipFormat } from './payslipFormatDetector';

export function parsePayslip(structuredText: StructuredPdfText): PayslipImport {
  const detection = detectPayslipFormat(structuredText);

  if (detection.format === 'logisticsLayoutV1' && detection.confidence >= 55) {
    payrollDebugLog('[PAYROLL][2] Parser realmente utilizzato:', 'parseLogisticsLayoutV1Payslip');
    return parseLogisticsLayoutV1Payslip(structuredText, detection);
  }

  payrollDebugLog('[PAYROLL][2] Parser realmente utilizzato:', 'parseGenericPayslip');
  const generic = parseGenericPayslip(structuredText);

  if (detection.format === 'unknown') {
    return {
      ...generic,
      detectedFormat: 'unknown',
      parserUsed: 'generic',
      warnings: [
        'La busta paga e stata letta solo parzialmente. Controlla e correggi i dati prima di salvarla.',
        ...generic.warnings,
      ],
    };
  }

  return generic;
}
