import jsPDF from 'jspdf';

export function generateAttendancePDF(data: {
  month: string;
  year: string;
  days: { date: string; status: string; notes?: string; holidayName?: string }[];
  totals: Record<string, number>;
}) {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text(`Riepilogo Presenze — ${data.month} ${data.year}`, 14, 20);

  doc.setFontSize(10);
  let y = 35;

  for (const [key, val] of Object.entries(data.totals)) {
    doc.text(`${key}: ${val}`, 14, y);
    y += 6;
  }

  y += 6;

  doc.setFontSize(9);
  for (const day of data.days) {
    if (y > 275) {
      doc.addPage();
      y = 20;
    }

    doc.text(
      `${day.date} — ${day.status}${day.holidayName ? ` [${day.holidayName}]` : ''}${day.notes ? ` (${day.notes})` : ''}`,
      14,
      y
    );
    y += 5;
  }

  return doc;
}

export interface SalaryPDFData {
  month: string;
  year: number;
  result: {
    workedDays: number;
    workedFeriali: number;
    workedDomeniche: number;
    totaleTrasferta: number;
    nettoFinale: number;
    festivoLavoratoDays?: number;
    festivoPagatoDays?: number;
  };
  attendance: Record<string, { status: string }>;
}

export function generateSalaryPDF(data: SalaryPDFData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = 20;

  const row = (label: string, value: string, bold = false) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(label, 16, y);
    doc.text(value, pageWidth - 16, y, { align: 'right' });
    y += 6;
  };

  const sectionTitle = (text: string) => {
    y += 4;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(text, 14, y);
    y += 2;
    doc.setDrawColor(200);
    doc.line(14, y, pageWidth - 14, y);
    y += 6;
  };

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Stima Stipendio Mensile', 14, y);

  y += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.month} ${data.year}`, 14, y);

  sectionTitle('Riepilogo');

  row('Giorni lavorati', String(data.result.workedDays));
  row('Feriali', String(data.result.workedFeriali));
  row('Domeniche', String(data.result.workedDomeniche));

  if (data.result.festivoLavoratoDays !== undefined) {
    row('Festivi lavorati', String(data.result.festivoLavoratoDays));
  }

  if (data.result.festivoPagatoDays !== undefined) {
    row('Festivi pagati', String(data.result.festivoPagatoDays));
  }

  row('Totale trasferta', `€${data.result.totaleTrasferta.toFixed(2)}`, true);
  row('Netto finale', `€${data.result.nettoFinale.toFixed(2)}`, true);

  const attendanceEntries = Object.entries(data.attendance).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  if (attendanceEntries.length > 0) {
    doc.addPage();
    y = 20;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Dettaglio Presenze', 14, y);

    y += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    for (const [date, value] of attendanceEntries) {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }

      doc.text(`${date} — ${value.status}`, 14, y);
      y += 6;
    }
  }

  return doc;
}

export function generateHolidaysPDF(data: Record<string, string | number>) {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text('Riepilogo Ferie e Permessi', 14, 20);

  doc.setFontSize(10);
  let y = 35;

  for (const [key, val] of Object.entries(data)) {
    doc.text(`${key}: ${val}`, 14, y);
    y += 7;
  }

  return doc;
}
