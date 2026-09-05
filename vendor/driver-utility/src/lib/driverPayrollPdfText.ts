import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';
import { reconstructPdfLines, type PdfTextItem, type StructuredPdfText } from './driverPayrollPdfLayout';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type DriverPayrollPdfTextErrorCode =
  | 'PDF_PASSWORD_PROTECTED'
  | 'PDF_INVALID'
  | 'PDF_SCANNED_DOCUMENT'
  | 'PDF_READER_ERROR';

export class DriverPayrollPdfTextError extends Error {
  code: DriverPayrollPdfTextErrorCode;
  cause?: unknown;
  structuredText?: StructuredPdfText;

  constructor(
    code: DriverPayrollPdfTextErrorCode,
    message: string,
    options?: { cause?: unknown; structuredText?: StructuredPdfText }
  ) {
    super(message);
    this.name = 'DriverPayrollPdfTextError';
    this.code = code;
    this.cause = options?.cause;
    this.structuredText = options?.structuredText;
  }
}

type PdfJsTextItem = {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
};

type PdfJsPage = {
  getTextContent: () => Promise<{ items: PdfJsTextItem[] }>;
  getViewport?: (options: { scale: number }) => { width: number; height: number };
};

function classifyPdfJsError(error: unknown): DriverPayrollPdfTextError {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : String(error);
  const normalized = `${name} ${message}`.toLowerCase();

  if (normalized.includes('password')) {
    return new DriverPayrollPdfTextError(
      'PDF_PASSWORD_PROTECTED',
      'Questo PDF e protetto da password e non puo essere letto automaticamente.',
      { cause: error }
    );
  }

  if (
    normalized.includes('invalidpdf') ||
    normalized.includes('invalid pdf') ||
    normalized.includes('missing pdf') ||
    normalized.includes('corrupt') ||
    normalized.includes('damaged')
  ) {
    return new DriverPayrollPdfTextError(
      'PDF_INVALID',
      'Questo PDF sembra danneggiato o non valido.',
      { cause: error }
    );
  }

  return new DriverPayrollPdfTextError(
    'PDF_READER_ERROR',
    'Errore tecnico durante la lettura locale del PDF.',
    { cause: error }
  );
}

export async function extractTextFromPayslipPdf(file: File): Promise<string> {
  const structuredText = await extractStructuredTextFromPayslipPdf(file);
  return structuredText.plainText;
}

export async function extractStructuredTextFromPayslipPdf(file: File): Promise<StructuredPdfText> {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const document = await pdfjs.getDocument({
      data: bytes,
      useWorkerFetch: false,
    }).promise;
    const items: PdfTextItem[] = [];
    const pageSizes: Array<{ page: number; width: number; height: number }> = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport?.({ scale: 1 }) ?? { width: 0, height: 0 };
      pageSizes.push({ page: pageNumber, width: viewport.width, height: viewport.height });
      const content = await page.getTextContent();
      content.items.forEach((item) => {
        if (!("str" in item)) return;
        const text = (item.str ?? '').trim();
        if (!text) return;

        items.push({
          text,
          page: pageNumber,
          x: item.transform?.[4] ?? 0,
          y: item.transform?.[5] ?? 0,
          width: item.width,
          height: item.height,
        });
      });
    }

    const reconstructedLines = reconstructPdfLines(items);
    const extractedText = reconstructedLines.map((line) => line.text).join('\n').trim();
    const structuredText: StructuredPdfText = {
      pages: document.numPages,
      pageSizes,
      items,
      reconstructedLines,
      plainText: extractedText,
    };

    if (!extractedText && document.numPages > 0) {
      throw new DriverPayrollPdfTextError(
        'PDF_SCANNED_DOCUMENT',
        'Questo PDF sembra composto solo da immagini. L OCR locale verra aggiunto in uno step successivo.',
        { structuredText }
      );
    }

    return structuredText;
  } catch (error) {
    if (error instanceof DriverPayrollPdfTextError) throw error;
    throw classifyPdfJsError(error);
  }
}
