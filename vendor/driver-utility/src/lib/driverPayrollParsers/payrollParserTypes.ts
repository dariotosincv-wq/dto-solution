import type { StructuredPdfText } from '../driverPayrollPdfLayout';
import type { PayslipDetectedFormat, PayslipImport } from '../driverPayrollTypes';

export type PayslipFormatDetection = {
  format: PayslipDetectedFormat;
  confidence: number;
  indicators: string[];
};

export type PayslipParser = {
  id: PayslipDetectedFormat;
  parse: (structuredText: StructuredPdfText, detection?: PayslipFormatDetection) => PayslipImport;
};
