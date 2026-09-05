export const payrollDebugLog = (label: string, value?: unknown): void => {
  try {
    console.log(label, value);
  } catch {
    // Diagnostic logging must never affect the local payroll import flow.
  }
};
