import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DriverPayroll from './DriverPayroll';
import type { DriverPayrollImportResult } from '@/lib/driverPayrollImportTypes';
import type { DriverPayrollValidationReport } from '@/lib/payrollValidationEngine/driverValidationReportTypes';
import type { PayrollPrediction, PayslipImport } from '@/lib/driverPayrollTypes';

const mocks = vi.hoisted(() => ({
  importDriverPayrollPdfs: vi.fn(),
  saveConfirmedImportedPayroll: vi.fn(),
  getDriverPayrollCollection: vi.fn(),
  saveDriverPayrollCollection: vi.fn(),
  resetDriverPayrollStorage: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/lib/driverPayrollImportService', () => ({
  DRIVER_PAYROLL_IMPORT_PRIVACY_NOTE:
    'Il PDF viene analizzato temporaneamente e non viene salvato. Tutti i dati Payroll restano esclusivamente sul dispositivo e non vengono inviati al Cloud.',
  importDriverPayrollPdfs: mocks.importDriverPayrollPdfs,
  saveConfirmedImportedPayroll: mocks.saveConfirmedImportedPayroll,
}));

vi.mock('@/lib/driverPayrollStorage', () => ({
  DRIVER_PAYROLL_KEYS: {
    profiles: 'driverPayroll.profiles',
    contractSources: 'driverPayroll.contractSources',
    rules: 'driverPayroll.rules',
    codes: 'driverPayroll.codes',
    payslips: 'driverPayroll.payslips',
    predictions: 'driverPayroll.predictions',
    comparisons: 'driverPayroll.comparisons',
    learningProfile: 'driverPayroll.learningProfile',
  },
  getDriverPayrollCollection: mocks.getDriverPayrollCollection,
  saveDriverPayrollCollection: mocks.saveDriverPayrollCollection,
  resetDriverPayrollStorage: mocks.resetDriverPayrollStorage,
}));

vi.mock('sonner', () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

let root: Root | undefined;
let host: HTMLDivElement | undefined;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const makePayslip = (overrides: Partial<PayslipImport> = {}): PayslipImport => ({
  id: 'payslip_2026_01',
  payrollProvider: 'Payroll Layout v1',
  payrollPeriodLabel: 'GENNAIO 2026',
  year: 2026,
  month: 1,
  importedAt: '2026-02-10T10:00:00.000Z',
  extractionMethod: 'pdf_text',
  confidence: 94,
  parsedLines: [
    { code: '2310', label: 'TRASFERTA', quantity: 17, unitValue: 22.5, amount: 382.5 },
    { code: '2315', label: 'INDENNITA LAVORO DOMENICALE', quantity: 2, unitValue: 7, amount: 14 },
    { code: '0170', label: 'GIORNI LAVORATI', amount: 22 },
    { code: '2030', label: 'STRAORDINARIO 30%', quantity: 3, amount: 60 },
  ],
  summary: {
    grossAmount: 2318.86,
    netAmount: 1806.52,
    totalDeductions: 512.34,
  },
  warnings: [],
  ...overrides,
});

const makeResult = (overrides: Partial<DriverPayrollImportResult> = {}): DriverPayrollImportResult => ({
  importId: 'import_1',
  fileName: 'busta.pdf',
  status: 'ready',
  payslip: makePayslip(),
  warnings: [],
  errors: [],
  confidence: 94,
  importedAt: '2026-02-10T10:00:00.000Z',
  diagnosticReport: {
    parserId: 'logisticsLayoutV1',
    pageCount: 1,
    pages: [{ page: 1, width: 640, height: 820, tokens: [], reconstructedRows: [] }],
    finalSummaryCandidates: { period: [], totalEarnings: [], totalDeductions: [], net: [] },
    selectedValues: { month: 1, year: 2026, totalEarnings: 2318.86, totalDeductions: 512.34, net: 1806.52 },
    validation: { equationChecked: true, expectedNet: 1806.52, difference: 0, valid: true },
    warnings: [],
  },
  temporaryReadDiagnostic: {
    analyzedAt: '2026-02-10T10:00:00.000Z',
    extractionMethod: 'pdf_text',
    structuredText: {
      pages: 1,
      pageSizes: [{ page: 1, width: 640, height: 820 }],
      items: [],
      reconstructedLines: [],
      plainText: '',
    },
    parserPayslip: makePayslip(),
  },
  privacy: {
    originalPdfStored: false,
    rawTextStored: false,
    sensitiveDataStored: false,
  },
  ...overrides,
});

const makeValidationReport = (): DriverPayrollValidationReport => ({
  summary: {
    totalResults: 1,
    correctCount: 1,
    checkCount: 0,
    problemCount: 0,
    informationCount: 0,
    technicalProblemCount: 0,
    overallStatus: 'OK',
    message: 'I controlli disponibili sono stati completati.',
  },
  items: [{
    title: 'Coerenza economica',
    userStatus: 'CORRECT',
    indicator: 'GREEN',
    checked: 'Riepilogo economico',
    shortExplanation: 'I valori risultano coerenti.',
    detailedExplanation: 'Il controllo non ha rilevato anomalie.',
    suggestion: 'Nessuna azione richiesta.',
    missingInformation: [],
  }],
  technicalProblems: [],
  technical: {
    runExecutedAt: '2026-02-10T10:00:00.000Z',
    executedChecks: 1,
    skippedChecks: 0,
    internalErrors: [],
    items: [{
      checkId: 'economic.net-pay-consistency',
      version: '1.0.0',
      category: 'ECONOMIC',
      confidence: 1,
      evidence: [],
      missingInputs: [],
      executedAt: '2026-02-10T10:00:00.000Z',
    }],
  },
});

const makePrediction = (overrides: Partial<PayrollPrediction> = {}): PayrollPrediction => ({
  id: 'prediction_2026_01',
  year: 2026,
  month: 1,
  createdAt: '2026-02-01T10:00:00.000Z',
  inputSnapshot: {
    year: 2026,
    month: 1,
    attendanceEvents: [],
    workedDays: 22,
    eligibleTravelDays: 17,
    sundaysWorked: 0,
    holidaysWorked: 1,
    vacationDays: 1,
    parHours: 4,
    sicknessDays: 0,
    injuryDays: 0,
    strikeHours: 0,
    abortDays: 0,
    ordinaryHours: 168,
    effectiveHours: 171,
    theoreticalHours: 168,
    overtime30Hours: 3,
    overtime50Hours: 0,
  },
  predictedLines: [{ code: '4009', label: 'PDR', amount: 100 }],
  predictedSummary: {
    grossAmount: 2318.86,
    netAmount: 1806.52,
  },
  assumptions: [],
  missingData: [],
  ...overrides,
});

const mockPayrollCollections = (payslips: PayslipImport[] = [], predictions: PayrollPrediction[] = []) => {
  mocks.getDriverPayrollCollection.mockImplementation((key: string) => {
    if (key === 'driverPayroll.predictions') return Promise.resolve(predictions);
    return Promise.resolve(payslips);
  });
};

const renderPage = async () => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);

  await act(async () => {
    root?.render(
      <MemoryRouter>
        <DriverPayroll />
      </MemoryRouter>
    );
  });

  await waitForText('Busta Paga Driver');
  return host;
};

const textOf = () => host?.textContent ?? '';

const waitFor = async (assertion: () => void, timeoutMs = 2000) => {
  const started = Date.now();
  let lastError: unknown;

  while (Date.now() - started < timeoutMs) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  throw lastError;
};

const waitForText = (text: string | RegExp) =>
  waitFor(() => {
    if (typeof text === 'string') {
      expect(textOf()).toContain(text);
    } else {
      expect(textOf()).toMatch(text);
    }
  });

const byTextButton = (text: string | RegExp): HTMLButtonElement => {
  const buttons = Array.from(host?.querySelectorAll('button') ?? []);
  const found = buttons.find((button) =>
    typeof text === 'string' ? button.textContent?.includes(text) : text.test(button.textContent ?? '')
  );
  if (!found) throw new Error(`Button not found: ${text.toString()}`);
  return found;
};

const byDocumentTextButton = (text: string | RegExp): HTMLButtonElement => {
  const buttons = Array.from(document.body.querySelectorAll('button'));
  const found = buttons.find((button) =>
    typeof text === 'string' ? button.textContent?.includes(text) : text.test(button.textContent ?? '')
  );
  if (!found) throw new Error(`Document button not found: ${text.toString()}`);
  return found;
};

const inputByLabel = (labelText: string): HTMLInputElement => {
  const labels = Array.from(host?.querySelectorAll('label') ?? []);
  const label = labels.find((item) => item.textContent?.trim() === labelText);
  if (!label) throw new Error(`Label not found: ${labelText}`);
  const id = label.getAttribute('for');
  const input = id ? host?.querySelector<HTMLInputElement>(`#${CSS.escape(id)}`) : null;
  if (!input) throw new Error(`Input not found for label: ${labelText}`);
  return input;
};

const selectFiles = async (files: File[]) => {
  const input = host?.querySelector<HTMLInputElement>('[data-testid="payroll-file-input"]');
  if (!input) throw new Error('File input not found');

  Object.defineProperty(input, 'files', {
    value: files,
    configurable: true,
  });

  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

const selectPdf = (fileName = 'busta.pdf') =>
  selectFiles([new File(['fake pdf'], fileName, { type: 'application/pdf' })]);

const changeInput = async (input: HTMLInputElement, value: string) => {
  await act(async () => {
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    valueSetter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

const changeElementValue = async (
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  value: string
) => {
  await act(async () => {
    const valueSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set;
    valueSetter?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

const click = async (button: HTMLButtonElement) => {
  await act(async () => {
    button.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    button.dispatchEvent(new Event('pointerup', { bubbles: true }));
    button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

beforeEach(() => {
  mocks.importDriverPayrollPdfs.mockReset();
  mocks.saveConfirmedImportedPayroll.mockReset();
  mocks.getDriverPayrollCollection.mockReset();
  mocks.saveDriverPayrollCollection.mockReset();
  mocks.resetDriverPayrollStorage.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.toastError.mockReset();
  mockPayrollCollections();
  window.localStorage.removeItem('attendance');
  mocks.saveDriverPayrollCollection.mockResolvedValue(undefined);
  mocks.resetDriverPayrollStorage.mockResolvedValue(undefined);
  mocks.saveConfirmedImportedPayroll.mockResolvedValue(makePayslip());
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }
  host?.remove();
  root = undefined;
  host = undefined;
  vi.restoreAllMocks();
});

describe('DriverPayroll page', () => {
  it('apre la pagina Payroll', async () => {
    await renderPage();

    expect(textOf()).toContain('Busta Paga Driver');
    expect(textOf()).toContain('Driver Payroll Engine');
  });

  it('mostra Privacy Payroll compatta e richiudibile', async () => {
    await renderPage();

    expect(textOf()).toContain('Privacy Payroll');
    expect(textOf()).not.toContain('Tutti i dati Payroll restano esclusivamente sul dispositivo');

    await click(byTextButton('Privacy Payroll'));
    expect(textOf()).toContain('Tutti i dati Payroll restano esclusivamente sul dispositivo');

    await click(byTextButton('Privacy Payroll'));
    expect(textOf()).not.toContain('Tutti i dati Payroll restano esclusivamente sul dispositivo');
  });

  it('seleziona PDF e chiama import service', async () => {
    mocks.importDriverPayrollPdfs.mockResolvedValue([makeResult()]);
    await renderPage();
    await selectPdf();

    await waitFor(() => expect(mocks.importDriverPayrollPdfs).toHaveBeenCalledOnce());
    expect(mocks.importDriverPayrollPdfs.mock.calls[0][0][0].name).toBe('busta.pdf');
  });

  it('mostra il caricamento durante importazione', async () => {
    let resolveImport: (value: DriverPayrollImportResult[]) => void = () => {};
    mocks.importDriverPayrollPdfs.mockReturnValue(
      new Promise((resolve) => {
        resolveImport = resolve;
      })
    );
    await renderPage();
    await selectPdf();

    expect(textOf()).toContain('Analisi della busta paga in corso');
    await act(async () => {
      resolveImport([makeResult()]);
    });
    await waitForText('Anteprima');
  });

  it('mostra anteprima dati estratti', async () => {
    mocks.importDriverPayrollPdfs.mockResolvedValue([makeResult()]);
    await renderPage();
    await selectPdf();

    await waitForText('Gennaio 2026');
    expect(inputByLabel('Netto')).toHaveValue(1806.52);
    expect(inputByLabel('Trasferte')).toHaveValue(17);
    expect(textOf()).not.toContain('Controllo della busta paga');
  });

  it('mostra il report gia prodotto dalla pipeline senza rieseguirla', async () => {
    mocks.importDriverPayrollPdfs.mockResolvedValue([makeResult({
      validationPipeline: {
        status: 'COMPLETED',
        profile: 'PRODUCTION',
        serviceSource: 'FISCAL_V1',
        selectedCheckIds: ['economic.net-pay-consistency'],
        driverReport: makeValidationReport(),
        executedAt: '2026-02-10T10:00:00.000Z',
      },
    })]);
    await renderPage();
    await selectPdf();

    await waitForText('Controllo della busta paga');
    expect(textOf()).toContain('Controlli completati');
    expect(textOf()).toContain('Coerenza economica');
    expect(host?.querySelector<HTMLDetailsElement>('details')?.open).toBe(false);
    expect(mocks.importDriverPayrollPdfs).toHaveBeenCalledOnce();
    expect(mocks.saveConfirmedImportedPayroll).not.toHaveBeenCalled();
    expect(mocks.saveDriverPayrollCollection).not.toHaveBeenCalled();
  });

  it('mostra verifica manuale quando il netto non e riconosciuto', async () => {
    mocks.importDriverPayrollPdfs.mockResolvedValue([
      makeResult({
        status: 'warning',
        payslip: makePayslip({
          summary: {
            grossAmount: 2224.18,
            totalEarnings: 2224.18,
            totalDeductions: 367.86,
            netAmount: undefined,
          },
          fieldConfidence: {
            netAmount: { confidence: 'missing', parserUsed: 'logisticsLayoutV1FinalTable' },
          },
        }),
      }),
    ]);
    await renderPage();
    await selectPdf();

    await waitForText('Netto non riconosciuto - verifica manualmente');
    expect(inputByLabel('Netto')).toHaveValue(null);
  });

  it('mostra il pulsante per esportare la diagnostica lettura locale', async () => {
    mocks.importDriverPayrollPdfs.mockResolvedValue([makeResult()]);
    await renderPage();
    await selectPdf();

    await waitForText('Esporta diagnostica lettura');
  });

  it('mostra correttamente i valori del layout reale aprile senza doppie ore o altre voci', async () => {
    mocks.importDriverPayrollPdfs.mockResolvedValue([
      makeResult({
        payslip: makePayslip({
          id: 'payslip_2026_04',
          month: 4,
          year: 2026,
          payrollPeriodLabel: 'APRILE 2026',
          parsedLines: [
            { code: '0169', label: 'ORE LAVORATE MESE', amount: 142.8, confidence: 88 },
            { code: '0170', label: 'GIORNI LAVORATI', amount: 17, confidence: 88 },
            { code: '0779', label: 'MONTE ORE TEORICO', amount: 176.4, confidence: 88 },
            { code: '0785', label: 'MONTE ORE EFFETTIVO', amount: 142.8, confidence: 88 },
            { code: '1981', label: 'ORE MALATTIA', amount: 31.2, confidence: 88 },
            { code: '2310', label: 'TRASFERTA', quantity: 17, unitValue: 22.5, amount: 382.5, confidence: 94 },
            { code: '3900', label: 'FESTIVITA', quantity: 1, amount: 90, confidence: 94 },
          ],
          summary: {
            grossAmount: 3025.79,
            netAmount: 2184.68,
            totalDeductions: 841.11,
          },
        }),
      }),
    ]);
    await renderPage();
    await selectPdf('aprile.pdf');

    await waitForText('Aprile 2026');
    expect(inputByLabel('Netto')).toHaveValue(2184.68);
    expect(inputByLabel('Totale competenze')).toHaveValue(3025.79);
    expect(inputByLabel('Totale trattenute')).toHaveValue(841.11);
    expect(inputByLabel('Ore ordinarie')).toHaveValue(142.8);
    expect(inputByLabel('Trasferte')).toHaveValue(17);
    expect(inputByLabel('Festivita')).toHaveValue(1);
    expect(inputByLabel('Malattia')).toHaveValue(31.2);
    expect(textOf()).not.toContain('Altre voci');
    expect(textOf()).not.toContain('2184.259999999999998');
  });

  it('mostra periodo e riepilogo economico del caso reale marzo 2026', async () => {
    mocks.importDriverPayrollPdfs.mockResolvedValue([
      makeResult({
        payslip: makePayslip({
          id: 'payslip_2026_03',
          month: 3,
          year: 2026,
          payrollPeriodLabel: 'MARZO 2026',
          parsedLines: [
            { code: '0169', label: 'ORE LAVORATE MESE', amount: 107.1, confidence: 88 },
            { code: '0170', label: 'GIORNI LAVORATI', amount: 13, confidence: 88 },
            { code: '5000', label: 'FERIE GODUTE', quantity: 7, confidence: 88 },
            { code: '2310', label: 'TRASFERTA', quantity: 13, unitValue: 22.5, amount: 292.5, confidence: 94 },
          ],
          summary: {
            grossAmount: 2224.18,
            totalEarnings: 2224.18,
            netAmount: 1856.32,
            totalDeductions: 367.86,
          },
        }),
      }),
    ]);
    await renderPage();
    await selectPdf('marzo.pdf');

    await waitForText('03 / 2026');
    expect(inputByLabel('Totale competenze')).toHaveValue(2224.18);
    expect(inputByLabel('Netto')).toHaveValue(1856.32);
    expect(inputByLabel('Totale trattenute')).toHaveValue(367.86);
    expect(inputByLabel('Giorni lavorati')).toHaveValue(13);
    expect(inputByLabel('Ore ordinarie')).toHaveValue(107.1);
    expect(inputByLabel('Ferie')).toHaveValue(7);
    expect(inputByLabel('Trasferte')).toHaveValue(13);
    expect(inputByLabel('Importo trasferte')).toHaveValue(292.5);
    expect(textOf()).not.toContain('2.224,18');
    expect(textOf()).not.toContain('1.856,32');
    expect(textOf()).not.toContain('367,86');
  });

  it('permette la modifica di un valore', async () => {
    mocks.importDriverPayrollPdfs.mockResolvedValue([makeResult()]);
    await renderPage();
    await selectPdf();
    await waitForText('Anteprima');

    const netInput = inputByLabel('Netto');
    await changeInput(netInput, '1900.25');

    expect(netInput).toHaveValue(1900.25);
    expect(textOf()).toContain('Modificato');
  });

  it('salva solo dopo conferma utente', async () => {
    mocks.importDriverPayrollPdfs.mockResolvedValue([makeResult()]);
    await renderPage();
    await selectPdf();
    await waitForText('Anteprima');

    expect(mocks.saveConfirmedImportedPayroll).not.toHaveBeenCalled();
    await click(byTextButton(/Salva nello storico/i));

    await waitFor(() => expect(mocks.saveConfirmedImportedPayroll).toHaveBeenCalledOnce());
  });

  it('mostra errore PDF non leggibile', async () => {
    mocks.importDriverPayrollPdfs.mockResolvedValue([
      makeResult({
        status: 'failed',
        payslip: undefined,
        errors: [{ code: 'PDF_TEXT_EXTRACTION_FAILED', message: 'Non e stato possibile leggere questo PDF.' }],
      }),
    ]);
    await renderPage();
    await selectPdf();

    await waitForText('PDF non importato');
    expect(textOf()).toContain('Non e stato possibile leggere questo PDF.');
  });

  it('mostra errore per PDF composto da immagini', async () => {
    mocks.importDriverPayrollPdfs.mockResolvedValue([
      makeResult({
        status: 'failed',
        payslip: undefined,
        errors: [{ code: 'PDF_TEXT_EMPTY', message: 'Questo PDF sembra essere composto da immagini.' }],
      }),
    ]);
    await renderPage();
    await selectPdf();

    await waitForText('Questo PDF sembra essere composto da immagini.');
  });

  it('gestisce importazione multipla con un successo e un errore', async () => {
    mocks.importDriverPayrollPdfs.mockResolvedValue([
      makeResult({ importId: 'ok' }),
      makeResult({
        importId: 'ko',
        fileName: 'documento.pdf',
        status: 'failed',
        payslip: undefined,
        errors: [{ code: 'FILE_NOT_PDF', message: 'Il file selezionato non sembra essere un PDF.' }],
      }),
    ]);
    await renderPage();
    await selectFiles([
      new File(['pdf'], 'ok.pdf', { type: 'application/pdf' }),
      new File(['txt'], 'documento.txt', { type: 'text/plain' }),
    ]);

    await waitForText('Gennaio 2026');
    expect(textOf()).toContain('documento.pdf');
    expect(textOf()).toContain('Errore');
  });

  it('mostra storico vuoto', async () => {
    await renderPage();
    await click(byTextButton('Storico'));

    await waitForText('Nessuna busta importata');
  });

  it('mostra storico con dati', async () => {
    mockPayrollCollections([makePayslip()]);
    await renderPage();
    await click(byTextButton('Storico'));

    await waitForText('Gennaio 2026');
    expect(textOf()).toContain('1806,52');
  });

  it('elimina con conferma', async () => {
    mockPayrollCollections([makePayslip()]);
    await renderPage();
    await click(byTextButton('Storico'));
    await waitForText('Gennaio 2026');

    await click(byTextButton(/Elimina/i));

    await waitFor(() => expect(window.confirm).toHaveBeenCalled());
    expect(mocks.saveDriverPayrollCollection).toHaveBeenCalledWith('driverPayroll.payslips', []);
  });

  it('non salva automaticamente dopo importazione', async () => {
    mocks.importDriverPayrollPdfs.mockResolvedValue([makeResult()]);
    await renderPage();
    await selectPdf();
    await waitForText('Anteprima');

    expect(mocks.saveConfirmedImportedPayroll).not.toHaveBeenCalled();
    expect(mocks.saveDriverPayrollCollection).not.toHaveBeenCalled();
  });

  it('non mostra dati temporanei nella UI', async () => {
    mocks.importDriverPayrollPdfs.mockResolvedValue([
      makeResult({
        payslip: makePayslip({
          rawTextTemporary: 'TESTO PDF TEMPORANEO SENSIBILE',
          parsedLines: [{ code: '2310', label: 'TRASFERTA', quantity: 17, rawLine: 'RIGA PDF TEMPORANEA' }],
        }),
      }),
    ]);
    await renderPage();
    await selectPdf();
    await waitForText('Anteprima');

    expect(textOf()).not.toContain('TESTO PDF TEMPORANEO SENSIBILE');
    expect(textOf()).not.toContain('RIGA PDF TEMPORANEA');
  });

  it('mostra la scheda Analisi con statistiche dello storico locale', async () => {
    mockPayrollCollections([
      makePayslip({ id: 'jan', month: 1, summary: { grossAmount: 2200, netAmount: 1700 }, parsedLines: [{ code: '2310', label: 'TRASFERTA', quantity: 10 }, { code: '2030', label: 'STRAORDINARIO', quantity: 2 }] }),
      makePayslip({ id: 'feb', month: 2, summary: { grossAmount: 2400, netAmount: 1800 }, parsedLines: [{ code: '2310', label: 'TRASFERTA', quantity: 12 }, { code: '2030', label: 'STRAORDINARIO', quantity: 4 }] }),
      makePayslip({ id: 'mar', month: 3, summary: { grossAmount: 2600, netAmount: 2000 }, parsedLines: [{ code: '2310', label: 'TRASFERTA', quantity: 18 }, { code: '2030', label: 'STRAORDINARIO', quantity: 8 }] }),
    ]);
    await renderPage();
    await click(byTextButton('Analisi'));

    await waitForText('Totale buste archiviate');
    expect(textOf()).toContain('Periodo coperto');
    expect(textOf()).toContain('Gennaio 2026 - Marzo 2026');
    expect(textOf()).toContain('Netto mese per mese');
    expect(textOf()).toContain('Netto medio in aumento');
    expect(textOf()).toContain('Trasferte in crescita');
    expect(textOf()).toContain('Andamento storico');
    expect(textOf()).toContain('Controlli superati');
    expect(textOf()).toContain('Non verificabili');
    expect(host?.querySelector('[data-testid="payroll-historical-validation"]')).not.toBeNull();
    expect(host?.querySelector('[data-testid="payroll-comparison-base-ready"]')?.textContent).toContain('3');
  });

  it('mostra Dato non disponibile quando lo storico non contiene una metrica', async () => {
    mockPayrollCollections([makePayslip({ parsedLines: [], summary: {} })]);
    await renderPage();
    await click(byTextButton('Analisi'));

    await waitForText('Dato non disponibile');
    expect(textOf()).toContain('Dati insufficienti per visualizzare il grafico.');
    expect(textOf()).toContain('Dati insufficienti per calcolare trend affidabili.');
  });

  it('mostra il confronto previsto reale per il mese selezionato', async () => {
    mockPayrollCollections([makePayslip()], [makePrediction()]);
    await renderPage();
    await click(byTextButton('Confronto'));

    await waitForText('Previsto');
    expect(textOf()).toContain('Reale');
    expect(textOf()).toContain('Differenza');
    expect(textOf()).not.toContain('Lordo');
    expect(textOf()).not.toContain('Netto');
    expect(textOf()).toContain('Trasferte');
    expect(textOf()).toContain('OK');
  });

  it('prepara spiegazioni e agganci CCNL per differenze importanti', async () => {
    mockPayrollCollections(
      [makePayslip({ parsedLines: [{ code: '2310', label: 'TRASFERTA', quantity: 17 }] })],
      [makePrediction({ inputSnapshot: { ...makePrediction().inputSnapshot, eligibleTravelDays: 10 } })]
    );
    await renderPage();
    await click(byTextButton('Confronto'));

    await waitForText('Differenza importante');
    expect(host?.querySelector('[data-testid="comparison-explanation-travelDays"]')?.textContent).toContain('Trasferta diversa');
    expect(host?.querySelector('[data-testid="comparison-ccnl-link-ready"]')?.textContent).toContain('1');
    expect(textOf()).toContain('Possibili spiegazioni');
    expect(textOf()).toContain('Trasferta differente');
    expect(textOf()).toContain('Alta');
  });

  it('salva una previsione locale dal simulatore', async () => {
    window.localStorage.setItem('attendance', JSON.stringify({ '2026-02-02': { status: 'Lavorato' } }));
    await renderPage();
    await click(byTextButton('Mese'));

    await changeElementValue(host!.querySelector<HTMLSelectElement>('#simulator-month')!, '1');
    await changeElementValue(host!.querySelector<HTMLInputElement>('#simulator-year')!, '2026');
    await waitForText('Giorni lavorati');

    await click(byTextButton('Salva riepilogo locale'));

    await waitFor(() => expect(mocks.saveDriverPayrollCollection).toHaveBeenCalledWith(
      'driverPayroll.predictions',
      expect.arrayContaining([expect.objectContaining({ year: 2026, month: 2 })])
    ));
  });

  it('mostra luglio 2026 come riepilogo componenti senza stipendio simulato', async () => {
    const attendance = Object.fromEntries([
      '01', '02', '03', '06', '07', '08', '09', '10', '13', '14', '15',
      '16', '17', '20', '21', '22', '23', '24', '27', '28', '29',
    ].map((day) => [`2026-07-${day}`, { status: 'Lavorato' }]));
    attendance['2026-07-30'] = { status: 'Permesso' };
    window.localStorage.setItem('attendance', JSON.stringify(attendance));

    await renderPage();
    await click(byTextButton('Mese'));
    await changeElementValue(host!.querySelector<HTMLSelectElement>('#simulator-month')!, '6');
    await changeElementValue(host!.querySelector<HTMLInputElement>('#simulator-year')!, '2026');
    await waitForText('Riepilogo del mese');

    expect(textOf()).toContain('Giorni lavorati21');
    expect(textOf()).toContain('Permessi/ROL1 giorni / 8 ore');
    expect(textOf()).toContain('Giorni con trasferta21');
    expect(textOf()).toContain('472,50');
    expect(textOf()).toContain('22,50');
    expect(textOf()).not.toContain('Stipendio previsto');
    expect(textOf()).not.toContain('Netto previsto');
    expect(textOf()).not.toContain('Lordo previsto');
    expect(textOf()).not.toContain('Confidence');
  });

  it('aggiorna la previsione esistente dello stesso mese', async () => {
    const existing = makePrediction({ id: 'existing_prediction', month: 2, predictedSummary: { grossAmount: 1, netAmount: 1 } });
    mockPayrollCollections([], [existing]);
    window.localStorage.setItem('attendance', JSON.stringify({ '2026-02-02': { status: 'Lavorato' } }));
    await renderPage();
    await click(byTextButton('Mese'));

    await changeElementValue(host!.querySelector<HTMLSelectElement>('#simulator-month')!, '1');
    await changeElementValue(host!.querySelector<HTMLInputElement>('#simulator-year')!, '2026');
    await click(byTextButton('Salva riepilogo locale'));

    await waitFor(() => {
      const calls = mocks.saveDriverPayrollCollection.mock.calls;
      const saved = calls[calls.length - 1]?.[1] as PayrollPrediction[];
      expect(saved).toHaveLength(1);
      expect(saved[0].year).toBe(2026);
      expect(saved[0].month).toBe(2);
      expect(saved[0].predictedSummary.grossAmount).toBe(22.5);
    });
  });

  it('rende la previsione salvata disponibile nella scheda Confronto', async () => {
    window.localStorage.setItem('attendance', JSON.stringify({ '2026-02-02': { status: 'Lavorato' } }));
    await renderPage();
    await click(byTextButton('Mese'));

    await changeElementValue(host!.querySelector<HTMLSelectElement>('#simulator-month')!, '1');
    await changeElementValue(host!.querySelector<HTMLInputElement>('#simulator-year')!, '2026');
    await click(byTextButton('Salva riepilogo locale'));
    await waitFor(() => expect(mocks.saveDriverPayrollCollection).toHaveBeenCalledWith('driverPayroll.predictions', expect.any(Array)));

    await click(byTextButton('Confronto'));

    await waitForText('Previsto');
    expect(textOf()).toContain('Dato non disponibile');
  });

  it('UI Assistente mostra risposta con fonti', async () => {
    mockPayrollCollections([makePayslip({ month: 2 })], [makePrediction({ month: 2 })]);
    await renderPage();
    await click(byTextButton('Assistente'));

    await changeElementValue(host!.querySelector<HTMLSelectElement>('#assistant-month')!, '2');
    await changeElementValue(host!.querySelector<HTMLInputElement>('#assistant-year')!, '2026');
    await changeElementValue(host!.querySelector<HTMLTextAreaElement>('#assistant-question')!, 'Qual e il netto previsto?');
    await click(byTextButton('Chiedi'));

    await waitForText('Risposta');
    expect(textOf()).toContain('Confidence');
    expect(textOf()).toContain('Fonti usate');
  });

  it('UI Assistente non presenta netto o lordo delle previsioni legacy', async () => {
    mockPayrollCollections([], [makePrediction({ month: 2, missingData: ['Importo orario straordinario mancante'] })]);
    await renderPage();
    await click(byTextButton('Assistente'));

    await changeElementValue(host!.querySelector<HTMLSelectElement>('#assistant-month')!, '2');
    await changeElementValue(host!.querySelector<HTMLInputElement>('#assistant-year')!, '2026');
    await changeElementValue(host!.querySelector<HTMLTextAreaElement>('#assistant-question')!, 'Qual e il netto previsto?');
    await click(byTextButton('Chiedi'));

    await waitForText('non calcola uno stipendio netto o lordo futuro completo');
    expect(textOf()).not.toContain('Netto previsto');
    expect(textOf()).not.toContain('Netto simulato');
  });

  it('UI Assistente usa domande rapide', async () => {
    mockPayrollCollections([makePayslip({ month: 2 })], [makePrediction({ month: 2 })]);
    await renderPage();
    await click(byTextButton('Assistente'));
    await changeElementValue(host!.querySelector<HTMLSelectElement>('#assistant-month')!, '2');
    await changeElementValue(host!.querySelector<HTMLInputElement>('#assistant-year')!, '2026');

    expect(textOf()).not.toContain('Quanto prendero questo mese?');
    expect(textOf()).not.toContain('Netto previsto');
    expect(textOf()).not.toContain('Lordo previsto');
    expect(textOf()).toContain('Quanti giorni ho lavorato questo mese?');
    expect(textOf()).toContain('Quanti permessi ho registrato?');

    await click(byTextButton('Quante trasferte risultano questo mese?'));

    await waitForText('Trasferte');
    expect(host?.querySelector('[data-testid="assistant-response"]')).toBeTruthy();
  });

  it('UI Assistente rifiuta una previsione di stipendio futuro senza mostrare importi legacy', async () => {
    mockPayrollCollections([makePayslip({ month: 2 })], [makePrediction({ month: 2 })]);
    await renderPage();
    await click(byTextButton('Assistente'));
    await changeElementValue(host!.querySelector<HTMLSelectElement>('#assistant-month')!, '2');
    await changeElementValue(host!.querySelector<HTMLInputElement>('#assistant-year')!, '2026');
    await changeElementValue(host!.querySelector<HTMLTextAreaElement>('#assistant-question')!, 'Quanto prendero questo mese?');
    await click(byTextButton('Chiedi'));

    await waitForText('non calcola uno stipendio netto o lordo futuro completo');
    expect(textOf()).not.toContain('1.806,52');
    expect(textOf()).not.toContain('2.318,86');
  });

  it('non salva automaticamente le domande dell Assistente', async () => {
    mockPayrollCollections([makePayslip({ month: 2 })], [makePrediction({ month: 2 })]);
    await renderPage();
    await click(byTextButton('Assistente'));

    await changeElementValue(host!.querySelector<HTMLSelectElement>('#assistant-month')!, '2');
    await changeElementValue(host!.querySelector<HTMLTextAreaElement>('#assistant-question')!, 'Quanto prendero questo mese?');
    await click(byTextButton('Chiedi'));

    await waitForText('Risposta');
    expect(mocks.saveDriverPayrollCollection).not.toHaveBeenCalled();
  });

  it('resetta tutti gli stati Driver Payroll senza toccare altre funzioni', async () => {
    mockPayrollCollections([makePayslip()], [makePrediction()]);
    await renderPage();

    await click(byTextButton('Assistente'));
    await changeElementValue(host!.querySelector<HTMLTextAreaElement>('#assistant-question')!, 'Quanto prendero questo mese?');
    await click(byTextButton('Chiedi'));
    await waitForText('Risposta');

    await click(byTextButton('Reset dati Payroll'));
    await waitFor(() => expect(document.body.textContent).toContain('Reset Driver Payroll'));
    expect(document.body.textContent).toContain('Fingerprint dei PDF');
    expect(document.body.textContent).toContain('Cache Parser Payroll');
    expect(document.body.textContent).toContain('QR Locali');
    expect(document.body.textContent).toContain('Turni Driver');

    await click(byDocumentTextButton('Elimina tutto'));

    await waitFor(() => expect(mocks.resetDriverPayrollStorage).toHaveBeenCalledOnce());
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Driver Payroll azzerato correttamente.');

    await click(byTextButton('Storico'));
    await waitForText('Nessuna busta importata');
    await click(byTextButton('Analisi'));
    await waitForText('Nessun dato disponibile');
    await click(byTextButton('Confronto'));
    await waitForText('Nessun riepilogo mese disponibile');
    await click(byTextButton('Mese'));
    await waitForText('Nessun riepilogo mensile salvato');
    await click(byTextButton('Assistente'));
    await waitForText('Nessun dato disponibile');
    expect(textOf()).not.toContain('Risposta');
  });
});
