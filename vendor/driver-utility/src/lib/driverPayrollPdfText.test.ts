import { beforeEach, describe, expect, it, vi } from 'vitest';

const pdfjsMock = vi.hoisted(() => ({
  GlobalWorkerOptions: {} as { workerSrc?: string },
  getDocument: vi.fn(),
}));

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => pdfjsMock);
vi.mock('pdfjs-dist/legacy/build/pdf.worker.mjs?url', () => ({
  default: '/assets/pdf.worker.mjs',
}));

describe('driverPayrollPdfText', () => {
  beforeEach(() => {
    pdfjsMock.GlobalWorkerOptions.workerSrc = undefined;
    pdfjsMock.getDocument.mockReset();
  });

  const testFile = (name = 'busta.pdf') =>
    ({
      name,
      type: 'application/pdf',
      arrayBuffer: async () => new Uint8Array([37, 80, 68, 70]).buffer,
    }) as File;

  it('configura e carica pdfjs-dist con worker locale', async () => {
    const { extractTextFromPayslipPdf } = await import('./driverPayrollPdfText');
    pdfjsMock.getDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: async () => ({
          getTextContent: async () => ({
            items: [{ str: 'PERIODO PAGA GENNAIO 2026' }, { str: 'BONIFICO 1.234,56' }],
          }),
        }),
      }),
    });

    const text = await extractTextFromPayslipPdf(testFile());

    expect(pdfjsMock.GlobalWorkerOptions.workerSrc).toBe('/assets/pdf.worker.mjs');
    expect(pdfjsMock.getDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.any(Uint8Array),
        useWorkerFetch: false,
      })
    );
    expect(text).toContain('PERIODO PAGA GENNAIO 2026');
  });

  it('distingue PDF composto solo da immagini', async () => {
    const { DriverPayrollPdfTextError, extractTextFromPayslipPdf } = await import('./driverPayrollPdfText');
    pdfjsMock.getDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: async () => ({
          getTextContent: async () => ({ items: [] }),
        }),
      }),
    });

    await expect(extractTextFromPayslipPdf(testFile('scan.pdf'))).rejects.toMatchObject({
      code: 'PDF_SCANNED_DOCUMENT',
    });
    await expect(extractTextFromPayslipPdf(testFile('scan.pdf'))).rejects.toBeInstanceOf(
      DriverPayrollPdfTextError
    );
  });

  it('distingue PDF protetto da password', async () => {
    const { extractTextFromPayslipPdf } = await import('./driverPayrollPdfText');
    const error = new Error('Password required');
    error.name = 'PasswordException';
    pdfjsMock.getDocument.mockReturnValue({
      promise: Promise.reject(error),
    });

    await expect(extractTextFromPayslipPdf(testFile('protetto.pdf'))).rejects.toMatchObject({
      code: 'PDF_PASSWORD_PROTECTED',
    });
  });

  it('distingue PDF danneggiato o non valido', async () => {
    const { extractTextFromPayslipPdf } = await import('./driverPayrollPdfText');
    const error = new Error('Invalid PDF structure');
    error.name = 'InvalidPDFException';
    pdfjsMock.getDocument.mockReturnValue({
      promise: Promise.reject(error),
    });

    await expect(extractTextFromPayslipPdf(testFile('rotto.pdf'))).rejects.toMatchObject({
      code: 'PDF_INVALID',
    });
  });
});
