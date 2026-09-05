import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { backupFilename, createDriverBackup, parseDriverBackup, restoreDriverBackup, summarizeDriverBackup, validateDriverBackup } from '../src/features/driver/backup/driverBackup.js'
import { BACKUP_KEYS, BACKUP_EXCLUDED_FIELDS, MAX_BACKUP_BYTES } from '../src/features/driver/backup/backupPolicy.js'
import schema from '../src/features/driver/backup/schema.generated.js'

class MemoryStorage {
  constructor(data = {}) { this.values = new Map(Object.entries(data).map(([key, value]) => [key, JSON.stringify(value)])); this.writes = 0 }
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) { this.writes++; this.values.set(key, value) }
  removeItem(key) { this.writes++; this.values.delete(key) }
}
const fiscalValue = { value: 0.23, valueKind: 'fraction', unit: 'FRACTION', source: 'fiscal_section', period: 'monthly', confidence: 0.9, extractionMethod: 'label_catalog' }
const payslip = {
  id: 'cedolino-fixture', year: 2026, month: 1, importedAt: '2026-02-05T12:00:00.000Z', extractionMethod: 'pdf_text',
  parsedLines: [{ label: 'Voce anonimizzata', amount: 1909.64, quantity: 23, quantityUnit: 'days', confidence: 0.85 }],
  summary: { netAmount: 1909.64, totalEarnings: 2200, totalDeductions: 290.36 }, warnings: ['Verifica le voci non riconosciute'], confidence: 0.8,
  fiscalDataVersion: 'fiscal-v1', fiscalData: { schemaVersion: 'fiscal-v1', socialSecurity: { contributionRate: fiscalValue }, incomeTax: {}, additionalTaxes: {}, tfr: {}, annualProgressives: {}, unclassifiedValues: [], warnings: [] },
}
const input = Object.fromEntries(['workedDays', 'eligibleTravelDays', 'sundaysWorked', 'holidaysWorked', 'vacationDays', 'parHours', 'sicknessDays', 'injuryDays', 'strikeHours', 'abortDays', 'ordinaryHours', 'effectiveHours', 'theoreticalHours', 'overtime30Hours', 'overtime50Hours'].map(key => [key, 0]))
const data = {
  attendance: { '2026-01-01': { status: 'Festività non lavorata', notes: 'Nota personale' }, '2026-02-02': { status: '', notes: 'Solo nota' }, '2026-02-03': { status: 'Lavorato < 4 ore' } },
  driverContractProfile: { contractType: 'part_time', weeklyHours: 24, contractualWeekdays: [1, 3, 5, 6] },
  'driverPayroll.payslips': [payslip],
  'driverPayroll.profiles': [{ id: 'profile', contractCode: 'DL05', employmentType: 'full_time' }],
  'driverPayroll.contractSources': [{ id: 'source', title: 'Fonte test', type: 'ccnl' }],
  'driverPayroll.rules': [{ id: 'rule', code: 'TEST', name: 'Regola', category: 'base_pay', sourceIds: ['source'], appliesWhen: [], doesNotApplyWhen: [] }],
  'driverPayroll.codes': [{ code: 'TEST', label: 'Voce', normalizedName: 'voce', type: 'earning', category: 'base_pay', linkedRuleIds: ['rule'], sign: 'positive', parserAliases: ['test'] }],
  'driverPayroll.predictions': [{ id: 'prediction', year: 2026, month: 1, createdAt: '2026-01-31T12:00:00.000Z', inputSnapshot: { ...input, year: 2026, month: 1, attendanceEvents: [] }, predictedLines: [], predictedSummary: { netAmount: 1900 }, assumptions: [], missingData: [] }],
  'driverPayroll.comparisons': [{ id: 'comparison', predictionId: 'prediction', payslipImportId: 'cedolino-fixture', year: 2026, month: 1, lineDifferences: [{ label: 'Netto', difference: 9.64 }], possibleCauses: [], modelUpdatesSuggested: [] }],
  'driverPayroll.learningProfile': [{ knownAliases: { TEST: ['test'] }, recurringDeductions: [], recurringEarnings: [], roundingPatterns: { TEST: 0.01 }, confidenceByRule: { rule: 0.8 } }],
}
const backup = () => createDriverBackup(new MemoryStorage(data), new Date('2026-09-05T12:00:00.000Z'))

test('backup exports only the ten persisted Driver keys, version, timestamp and filename', () => {
  const exported = createDriverBackup(new MemoryStorage({ ...data, 'unrelated.token': 'private', 'driverPayroll.parserCache': { secret: 'temporary' } }))
  assert.deepEqual(Object.keys(exported.data), BACKUP_KEYS)
  assert.deepEqual(exported.data, data)
  assert.equal(exported.version, 1)
  assert.equal(backupFilename(backup()), 'DriverUtility-AreaDriver-Backup-2026-09-05.json')
  assert.match(JSON.stringify(summarizeDriverBackup(exported)), /Cedolini nello storico/)
})
test('complete restore replaces all Driver collections without touching unrelated browser data', () => {
  const store = new MemoryStorage({ attendance: {}, 'other.area': 'preserve' })
  restoreDriverBackup(store, parseDriverBackup(JSON.stringify(backup())))
  for (const key of BACKUP_KEYS) assert.deepEqual(JSON.parse(store.getItem(key)), data[key])
  assert.equal(store.getItem('other.area'), '"preserve"')
})
for (const [label, key] of [['attendance and notes', 'attendance'], ['Payroll history including fiscal data and confidence', 'driverPayroll.payslips'], ['contract profile', 'driverContractProfile'], ['saved simulations', 'driverPayroll.predictions'], ['saved comparisons', 'driverPayroll.comparisons']]) {
  test(`${label} is identical after JSON round trip`, () => {
    const store = new MemoryStorage()
    restoreDriverBackup(store, parseDriverBackup(JSON.stringify(backup())))
    assert.deepEqual(JSON.parse(store.getItem(key)), data[key])
  })
}
test('corrupt JSON and invalid nested payloads are rejected before any writes', () => {
  assert.throws(() => parseDriverBackup('{broken'), { code: 'INVALID' })
  const mutations = [
    value => { delete value.data.attendance },
    value => { value.data.attendance['2026-02-30'] = { status: 'Ferie' } },
    value => { value.data.attendance['2026-01-01'].notes = 123 },
    value => { value.data.driverContractProfile.contractualWeekdays = [0] },
    value => { value.data['driverPayroll.payslips'][0].summary.netAmount = '1900' },
    value => { value.data['driverPayroll.payslips'][0].fiscalData.socialSecurity.contributionRate.value = 'wrong' },
    value => { value.data['driverPayroll.predictions'][0].inputSnapshot.attendanceEvents = ['invalid'] },
    value => { value.data['driverPayroll.comparisons'][0].lineDifferences[0].difference = {} },
    value => { value.data['driverPayroll.codes'][0].type = 'invalid' },
    value => { value.data['driverPayroll.learningProfile'][0].knownAliases.TEST = [4] },
    value => { value.data['foreign.key'] = [] },
  ]
  for (const mutate of mutations) {
    const value = backup(); mutate(value)
    const store = new MemoryStorage(data)
    const before = [...store.values]
    assert.throws(() => restoreDriverBackup(store, value), { code: 'INVALID' })
    assert.equal(store.writes, 0)
    assert.deepEqual([...store.values], before)
  }
})
test('unknown version is distinguished and cannot change storage', () => {
  const store = new MemoryStorage(data)
  assert.throws(() => restoreDriverBackup(store, { ...backup(), version: 99 }), { code: 'VERSION' })
  assert.equal(store.writes, 0)
})
test('write failure at every key rolls back byte for byte, including absent keys', () => {
  for (let failAt = 1; failAt <= BACKUP_KEYS.length; failAt++) {
    const store = new MemoryStorage({ attendance: {}, driverContractProfile: null, unrelated: 'keep' })
    const before = new Map(store.values)
    let attempts = 0
    const set = store.setItem.bind(store)
    store.setItem = (key, value) => { if (++attempts === failAt) throw new Error('QuotaExceededError'); set(key, value) }
    assert.throws(() => restoreDriverBackup(store, backup()), { code: 'WRITE_FAILED' })
    assert.deepEqual(store.values, before)
  }
})
test('rollback failure is reported distinctly instead of claiming success', () => {
  const store = new MemoryStorage({ attendance: {} })
  store.setItem = () => { throw new Error('storage unavailable') }
  assert.throws(() => restoreDriverBackup(store, backup()), { code: 'ROLLBACK_FAILED' })
})
test('an empty backup removes Driver keys only after validation', () => {
  const store = new MemoryStorage({ ...data, unrelated: 'keep' })
  restoreDriverBackup(store, createDriverBackup(new MemoryStorage()))
  for (const key of BACKUP_KEYS) assert.equal(store.getItem(key), null)
  assert.equal(store.getItem('unrelated'), '"keep"')
})
test('PDFs, parser raw text and temporary diagnostics are excluded recursively', () => {
  const polluted = structuredClone(data)
  for (const key of BACKUP_EXCLUDED_FIELDS) polluted['driverPayroll.payslips'][0][key] = 'sensitive-document'
  polluted['driverPayroll.payslips'][0].parsedLines[0].rawLine = 'sensitive-document'
  polluted['driverPayroll.payslips'][0].fiscalData.socialSecurity.contributionRate.rawText = 'sensitive-document'
  const exported = createDriverBackup(new MemoryStorage({ ...polluted, 'driverPayroll.tempImports': { pdf: 'sensitive-document' }, originalPdf: 'sensitive-document' }))
  assert.doesNotMatch(JSON.stringify(exported), /sensitive-document|originalPdf|rawText|rawLine|sourceGeometry/)
  assert.deepEqual(exported.data, data)
  const tampered = backup(); tampered.data['driverPayroll.payslips'][0].pdf = 'base64-pdf'
  assert.throws(() => validateDriverBackup(tampered), { code: 'INVALID' })
})
test('bad local JSON stops export without erasing it', () => {
  const store = new MemoryStorage(data)
  store.values.set('driverPayroll.payslips', '{bad')
  assert.throws(() => createDriverBackup(store), { code: 'LOCAL_DATA' })
  assert.equal(store.writes, 0)
  assert.equal(store.getItem('driverPayroll.payslips'), '{bad')
})
test('oversized, unsafe or excessively nested inputs are rejected', () => {
  assert.throws(() => parseDriverBackup(' '.repeat(MAX_BACKUP_BYTES + 1)), { code: 'SIZE' })
  assert.throws(() => parseDriverBackup('{"__proto__":{"polluted":true}}'), { code: 'INVALID' })
  const value = backup(); let nested = value
  for (let i = 0; i < 45; i++) nested = nested.child = {}
  assert.throws(() => validateDriverBackup(value), { code: 'INVALID' })
  assert.equal({}.polluted, undefined)
})
test('validation preserves original numeric precision and month conventions', () => {
  const value = backup()
  value.data['driverPayroll.predictions'][0].inputSnapshot.month = 0
  value.data['driverPayroll.predictions'][0].inputSnapshot.overtime30Hours = 1.23456789
  assert.deepEqual(parseDriverBackup(JSON.stringify(value)), value)
})
test('generated schema records hashes of the unchanged ported original type files', () => {
  for (const source of schema.provenance.sources) {
    const bytes = readFileSync(new URL(`../${source.file}`, import.meta.url))
    assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sha256)
  }
})
