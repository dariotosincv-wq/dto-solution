import type { PayslipImport } from './driverPayrollTypes';
import type { PayrollParserDiagnosticReport } from './driverPayrollParserDiagnostics';
import type { StructuredPdfText } from './driverPayrollPdfLayout';
import type { PayrollValidationResult } from './driverPayrollValidation';
import type { DriverPayrollFiscalAnalysis } from './driverPayrollFiscalTypes';
import type { PayrollObservedSnapshot } from './payrollValidationEngine/types';
import type {
  PayrollValidationPipelineResult,
  PayrollValidationPipelineProfile,
  PayrollValidationPipelineServiceSource,
  runDriverPayrollValidationPipeline,
} from './payrollValidationEngine/payrollValidationPipeline';

export type DriverPayrollImportStatus = 'ready' | 'warning' | 'failed';

export type DriverPayrollValueSource = 'parser' | 'manual' | 'rule_engine' | 'learned';

export interface DriverPayrollImportWarning {
  code: string;
  message: string;
  field?: string;
}

export interface DriverPayrollImportError {
  code: string;
  message: string;
  technicalDetails?: string;
}

export interface DriverPayrollImportPrivacyReport {
  originalPdfStored: false;
  rawTextStored: false;
  sensitiveDataStored: false;
}

/**
 * Snapshot diagnostico effimero. Vive esclusivamente nel risultato in memoria
 * dell'importazione e non deve mai essere passato allo storage Payroll.
 */
export interface DriverPayrollTemporaryReadDiagnostic {
  analyzedAt: string;
  extractionMethod: 'pdf_text';
  structuredText: StructuredPdfText;
  parserPayslip?: PayslipImport;
  guardedPayslip?: PayslipImport;
  runtimeProvenance?: {
    parserBuildMarker: string;
    parserSourceFile: string;
    registrySourceFile: string;
    validationSourceFile: string;
    fiscalNormalizerSourceFile: string;
    economicSelectionCriterion: string;
    extractedSiteCode?: string;
    extractedCostCenterCode?: string;
    extractedCostCenterDescription?: string;
    fiscalSectionMatches: Array<{
      target: string;
      value: number;
      page?: number;
      section?: string;
      confidence: number;
      extractionMethod: string;
      rawText?: string;
    }>;
  };
  payrollValidationPipeline?: DriverPayrollValidationPipelineDiagnostic;
}

export type DriverPayrollValidationPipelineStatus =
  | 'COMPLETED'
  | 'NOT_RUN'
  | 'TECHNICAL_ERROR';

export interface DriverPayrollValidationPipelineDiagnostic {
  status: DriverPayrollValidationPipelineStatus;
  snapshotCreated: boolean;
  started: boolean;
  profile: PayrollValidationPipelineProfile;
  selectedCheckIds: string[];
  passCount: number;
  warningCount: number;
  failCount: number;
  infoCount: number;
  internalErrorCount: number;
  executedAt?: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface DriverPayrollValidationIntegrationResult {
  status: DriverPayrollValidationPipelineStatus;
  profile: PayrollValidationPipelineProfile;
  serviceSource?: PayrollValidationPipelineServiceSource;
  selectedCheckIds: string[];
  technicalRun?: PayrollValidationPipelineResult['technicalRun'];
  driverReport?: PayrollValidationPipelineResult['driverReport'];
  executedAt?: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface DriverPayrollImportResult {
  importId: string;
  fileName: string;
  status: DriverPayrollImportStatus;
  payslip?: PayslipImport;
  warnings: DriverPayrollImportWarning[];
  errors: DriverPayrollImportError[];
  confidence?: number;
  importedAt: string;
  logicalFingerprint?: string;
  valueSources?: Record<string, DriverPayrollValueSource>;
  diagnosticReport?: PayrollParserDiagnosticReport;
  payrollValidation?: PayrollValidationResult;
  fiscalAnalysis?: DriverPayrollFiscalAnalysis;
  observedSnapshot?: PayrollObservedSnapshot;
  validationPipeline?: DriverPayrollValidationIntegrationResult;
  temporaryReadDiagnostic?: DriverPayrollTemporaryReadDiagnostic;
  privacy: DriverPayrollImportPrivacyReport;
}

export interface DriverPayrollImportServiceOptions {
  maxFileSizeBytes?: number;
  now?: () => Date;
  extractText?: (file: File) => Promise<string>;
  readExistingPayslips?: () => Promise<PayslipImport[]>;
  savePayslip?: (payslip: PayslipImport) => Promise<unknown>;
  runValidationPipeline?: typeof runDriverPayrollValidationPipeline;
}
