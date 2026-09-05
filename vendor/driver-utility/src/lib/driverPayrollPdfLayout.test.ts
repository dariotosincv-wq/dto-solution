import { describe, expect, it } from 'vitest';
import { reconstructPdfLines, type PdfTextItem } from './driverPayrollPdfLayout';

const row = (y: number, cells: Array<[string, number]>): PdfTextItem[] =>
  cells.map(([text, x]) => ({
    text,
    page: 1,
    x,
    y,
    width: text.length * 5,
    height: 10,
  }));

describe('driverPayrollPdfLayout', () => {
  it('ricostruisce righe Layout Logistica 1 da celle separate', () => {
    const lines = reconstructPdfLines([
      ...row(700, [
        ['1000', 10],
        ['RETRIBUZIONE/STIPENDIO', 70],
        ['87,38', 260],
        ['22,00', 330],
        ['1.922,36', 410],
      ]),
      ...row(680, [
        ['2310', 10],
        ['TRASFERTA', 70],
        ['22,50', 260],
        ['17,00', 330],
        ['382,50', 410],
      ]),
      ...row(660, [
        ['2315', 10],
        ['INDENNITA LAVORO DOMENICALE', 70],
        ['7,00', 260],
        ['2,00', 330],
        ['14,00', 410],
      ]),
    ]);

    expect(lines.map((line) => line.text)).toEqual([
      '1000 RETRIBUZIONE/STIPENDIO 87,38 22,00 1.922,36',
      '2310 TRASFERTA 22,50 17,00 382,50',
      '2315 INDENNITA LAVORO DOMENICALE 7,00 2,00 14,00',
    ]);
  });
});
