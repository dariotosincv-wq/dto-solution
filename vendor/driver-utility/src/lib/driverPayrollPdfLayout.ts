export type PdfTextItem = {
  text: string;
  page: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
};

export type ReconstructedPdfLine = {
  page: number;
  y: number;
  text: string;
  items: PdfTextItem[];
};

export type StructuredPdfText = {
  pages: number;
  pageSizes?: Array<{ page: number; width: number; height: number }>;
  items: PdfTextItem[];
  reconstructedLines: ReconstructedPdfLine[];
  plainText: string;
};

export type ReconstructPdfLinesOptions = {
  yTolerance?: number;
  xGapThreshold?: number;
};

const normalizeCellText = (value: string): string => value.replace(/\s+/g, ' ').trim();

export function reconstructPdfLines(
  items: PdfTextItem[],
  options: ReconstructPdfLinesOptions = {}
): ReconstructedPdfLine[] {
  const yTolerance = options.yTolerance ?? 3;
  const xGapThreshold = options.xGapThreshold ?? 10;
  const sortedItems = [...items]
    .filter((item) => normalizeCellText(item.text))
    .sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  const rows: Array<{ page: number; y: number; items: PdfTextItem[] }> = [];

  sortedItems.forEach((item) => {
    const row = rows.find((candidate) => candidate.page === item.page && Math.abs(candidate.y - item.y) <= yTolerance);
    if (row) {
      row.items.push(item);
      row.y = (row.y * (row.items.length - 1) + item.y) / row.items.length;
    } else {
      rows.push({ page: item.page, y: item.y, items: [item] });
    }
  });

  return rows
    .sort((a, b) => a.page - b.page || b.y - a.y)
    .map((row) => {
      const rowItems = [...row.items].sort((a, b) => a.x - b.x);
      const text = rowItems.reduce((line, item, index) => {
        const cell = normalizeCellText(item.text);
        if (!cell) return line;
        if (index === 0 || !line) return cell;

        const previous = rowItems[index - 1];
        const previousRight = previous.x + (previous.width ?? 0);
        const gap = item.x - previousRight;
        return `${line}${gap > xGapThreshold ? ' ' : ' '}${cell}`;
      }, '');

      return {
        page: row.page,
        y: row.y,
        text: normalizeCellText(text),
        items: rowItems,
      };
    })
    .filter((row) => row.text);
}
