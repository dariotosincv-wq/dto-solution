// Matches BLOCKED_RESULT_KEYS in the original driverPayrollImportService.ts,
// with temporary diagnostics excluded as well. No payroll algorithms are changed.
export const BACKUP_EXCLUDED_FIELDS = Object.freeze([
  'rawTextTemporary', 'rawText', 'rawLine', 'sourceGeometry',
  'pdf', 'pdfFile', 'file', 'blob', 'arrayBuffer', 'base64', 'objectUrl', 'url',
  'diagnostics', 'diagnostic', 'parserCache', 'temporary', 'tempImports',
])

export const BACKUP_FORMAT = 'DriverUtility-AreaDriver-Backup'
export const BACKUP_VERSION = 1
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024
export const PAYROLL_COLLECTIONS = Object.freeze(['profiles', 'contractSources', 'rules', 'codes', 'payslips', 'predictions', 'comparisons', 'learningProfile'])
export const BACKUP_KEYS = Object.freeze(['attendance', 'driverContractProfile', ...PAYROLL_COLLECTIONS.map(name => `driverPayroll.${name}`)])
