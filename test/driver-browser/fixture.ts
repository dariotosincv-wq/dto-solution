import jsPDF from 'jspdf'
import { september2025AnonymizedFixture } from '../../vendor/driver-utility/src/lib/driverPayrollParsers/fixtures/september2025AnonymizedFixture'
import { october2025AnonymizedFixture } from '../../vendor/driver-utility/src/lib/driverPayrollParsers/fixtures/october2025AnonymizedFixture'
import { november2025TwoPageAnonymizedFixture } from '../../vendor/driver-utility/src/lib/driverPayrollParsers/fixtures/november2025TwoPageAnonymizedFixture'
import { january2026SummaryAnonymizedFixture } from '../../vendor/driver-utility/src/lib/driverPayrollParsers/fixtures/january2026SummaryAnonymizedFixture'
import { parsePayslip } from '../../vendor/driver-utility/src/lib/driverPayrollParsers/payslipParserRegistry'
import { extractStructuredTextFromPayslipPdf } from '../../vendor/driver-utility/src/lib/driverPayrollPdfText'
import { importDriverPayrollPdf, saveConfirmedImportedPayroll } from '../../vendor/driver-utility/src/lib/driverPayrollImportService'
import { applyPayrollEconomicCoherenceGuard } from '../../vendor/driver-utility/src/lib/driverPayrollParserDiagnostics'
import { normalizePayslipFiscalData } from '../../vendor/driver-utility/src/lib/driverPayrollFiscalNormalizer'
import { validatePayslipFiscalData } from '../../vendor/driver-utility/src/lib/driverPayrollFiscalValidation'
import { validatePayrollConsistency } from '../../vendor/driver-utility/src/lib/driverPayrollValidation'
import { parsePayslipFinalSummary } from '../../vendor/driver-utility/src/lib/driverPayrollParsers/finalSummaryParser'

// Additional integration harness; all original tests and fixtures remain unchanged.
const clean = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(clean)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !['id','importedAt','sourceGeometry','sourceRowY','rawTextTemporary','rawLine'].includes(key)).map(([key, item]) => [key, clean(item)]))
  return value
}
window.runPdfParity = async () => {
  const results = []
  for (const [name, make] of Object.entries({ september2025AnonymizedFixture, october2025AnonymizedFixture, november2025TwoPageAnonymizedFixture, january2026SummaryAnonymizedFixture })) {
    const fixture = make()
    const pdf = new jsPDF({ unit: 'pt', format: [640, 842], compress: false, precision: 10 })
    for (let page = 1; page <= fixture.pages; page++) {
      if (page > 1) pdf.addPage([640, 842])
      for (const [index, item] of fixture.items.filter(item => item.page === page).entries()) {
        // Separate fonts prevent PDF.js from merging adjacent independently positioned cells.
        pdf.setFont(index % 2 ? 'times' : 'helvetica')
        pdf.setFontSize(item.height ?? 6.5)
        const width = pdf.getTextWidth(item.text)
        pdf.text(item.text, item.x, 842 - item.y, { horizontalScale: (item.width ?? width) / width })
      }
    }
    const buffer = pdf.output('arraybuffer')
    const file = new File([buffer], name + '.pdf', { type: 'application/pdf' })
    const extracted = await extractStructuredTextFromPayslipPdf(file)
    const analyze = (structured: typeof fixture) => {
      const parser = parsePayslip(structured)
      const guarded = applyPayrollEconomicCoherenceGuard(parser)
      const fiscalData = normalizePayslipFiscalData(structured, guarded)
      return clean({ parser, guarded, fiscalData, fiscalValidation: validatePayslipFiscalData(fiscalData, guarded), economicValidation: validatePayrollConsistency(guarded, { fiscalData, rounding: parsePayslipFinalSummary(structured).rounding }) })
    }
    const expected = analyze(fixture)
    const actual = analyze(extracted)
    const imported = await importDriverPayrollPdf(file, { now: () => new Date('2026-09-05T12:00:00.000Z'), readExistingPayslips: async () => [] })
    if (imported.payslip) await saveConfirmedImportedPayroll(imported)
    results.push({ name, bytes: Array.from(new Uint8Array(buffer)), expected, actual, extractedPages: extracted.pages, extractedItems: extracted.items, imported: clean({ status: imported.status, errors: imported.errors, confidence: imported.confidence, warnings: imported.warnings, payslip: imported.payslip, pipeline: imported.validationPipeline?.profile, checks: imported.validationPipeline?.selectedCheckIds }), stored: JSON.parse(localStorage.getItem('driverPayroll.payslips') ?? '[]') })
  }
  return results
}

window.runPdfErrors = async () => {
  const scanned = new jsPDF().output('arraybuffer')
  const files = [
    new File([], 'empty.pdf', { type: 'application/pdf' }),
    new File(['not pdf'], 'wrong.txt', { type: 'text/plain' }),
    new File([scanned], 'image-only.pdf', { type: 'application/pdf' }),
    new File(['%PDF-broken'], 'broken.pdf', { type: 'application/pdf' }),
  ]
  const results = []
  for (const file of files) {
    const result = await importDriverPayrollPdf(file)
    results.push({ name: file.name, status: result.status, code: result.errors[0]?.code })
  }
  return results
}
