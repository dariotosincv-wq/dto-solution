import type {
  PayrollValidationCheck,
  PayrollValidationContext,
  PayrollValidationResult as EnginePayrollValidationResult,
  PayrollValidationRunnerError,
  PayrollValidationRunnerErrorStage,
  PayrollValidationRunResult,
  PayrollValidationStatus,
} from './types';

export interface PayrollValidationRunnerOptions {
  readonly clock?: () => string;
}

const runnerError = (
  check: Readonly<PayrollValidationCheck>,
  stage: PayrollValidationRunnerErrorStage,
  error: unknown
): PayrollValidationRunnerError => ({
  checkId: check.id,
  checkVersion: check.version,
  stage,
  errorName: error instanceof Error ? error.name : 'UnknownError',
  message: error instanceof Error ? error.message : String(error),
});

const countStatus = (
  results: ReadonlyArray<EnginePayrollValidationResult>,
  status: PayrollValidationStatus
): number => results.filter((result) => result.status === status).length;

export async function runPayrollValidation(
  context: Readonly<PayrollValidationContext>,
  checks: ReadonlyArray<Readonly<PayrollValidationCheck>>,
  options: Readonly<PayrollValidationRunnerOptions> = {}
): Promise<PayrollValidationRunResult> {
  const clock = options.clock ?? (() => new Date().toISOString());
  const executedAt = clock();
  const results: EnginePayrollValidationResult[] = [];
  const internalErrors: PayrollValidationRunnerError[] = [];
  let executedChecks = 0;
  let skippedChecks = 0;

  for (const check of checks) {
    let applicable: boolean;
    try {
      applicable = check.applicability.evaluate(context);
    } catch (error) {
      internalErrors.push(runnerError(check, 'APPLICABILITY', error));
      continue;
    }

    if (!applicable) {
      skippedChecks += 1;
      continue;
    }

    executedChecks += 1;
    try {
      results.push(await check.execute(context));
    } catch (error) {
      internalErrors.push(runnerError(check, 'EXECUTION', error));
    }
  }

  return {
    results,
    executedAt,
    executedChecks,
    skippedChecks,
    passCount: countStatus(results, 'PASS'),
    warningCount: countStatus(results, 'WARNING'),
    failCount: countStatus(results, 'FAIL'),
    infoCount: countStatus(results, 'INFO'),
    internalErrors,
  };
}
