import { describe, expect, it } from 'vitest';
import { generateAttendancePDF } from './pdfGenerator';
describe('PDF Turni Driver',()=>{ it('genera un documento con riepilogo, note e festivitÃ ',()=>{
  const pdf=generateAttendancePDF({month:'Giugno',year:'2026',days:[{date:'2026-06-02',status:'Lavorato',notes:'nota',holidayName:'Festa della Repubblica'}],totals:{Lavorato:1}});
  expect(pdf.getNumberOfPages()).toBe(1); expect(pdf.output('arraybuffer').byteLength).toBeGreaterThan(100);
}); });
