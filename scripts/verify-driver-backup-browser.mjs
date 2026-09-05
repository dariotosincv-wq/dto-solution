import { chromium } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
import { BACKUP_KEYS } from '../src/features/driver/backup/backupPolicy.js'

// Isolated browser context, synthetic/anonymized data only. No user profile.
const output = resolve(import.meta.dirname, '../artifacts/driver')
mkdirSync(output, { recursive: true })
const fixtureReport = JSON.parse(readFileSync(resolve(output, 'pdf-parity.json'), 'utf8'))
const payslips = fixtureReport.reports.at(-1).stored
assert.equal(payslips.length, 4, 'Run verify-driver-pdf.mjs first')
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const checks = []
const errors = []
const requests = []
const base = 'http://127.0.0.1:5173'
const context = await browser.newContext({ locale: 'it-IT', timezoneId: 'Europe/Rome', acceptDownloads: true })
const page = await context.newPage()
page.on('pageerror', error => errors.push(error.message))
page.on('request', request => requests.push(request.url()))
const snapshot = () => page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), BACKUP_KEYS)
const upload = text => page.getByLabel('Seleziona il file di backup').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(text) })
try {
  await page.goto(base + '/area-driver')
  await page.getByRole('heading', { name: 'Accordo Assoespressi – Ultimo miglio Amazon', exact: true }).waitFor()
  await page.getByRole('link', { name: 'Vai alla normativa', exact: true }).click()
  await page.getByRole('heading', { level: 1, name: 'Normativa di riferimento', exact: true }).waitFor()
  assert.equal(await page.locator('.driver-area-card[id]').count(), 6)
  for (const link of await page.locator('.driver-area-card[id] a').evaluateAll(links => links.map(link => link.href))) assert(['www.normattiva.it', 'www.lavoro.gov.it'].includes(new URL(link).hostname))
  checks.push('six legislation cards, official sources, connected Area Driver navigation')

  for (const route of ['normativa', 'backup']) for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 950 })
    await page.goto(`${base}/area-driver/${route}`)
    await page.getByRole('heading', { level: 1 }).waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${route} overflow at ${width}`)
    assert.equal(await page.locator('.navigation__areas a').first().getAttribute('aria-current'), 'page')
    await page.screenshot({ path: resolve(output, `${route}-${width}.png`), fullPage: true })
    checks.push(`${route}: ${width}px, active Driver CTA, no horizontal overflow`)
  }

  await page.evaluate(payslips => {
    const date = new Date()
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
    localStorage.setItem('attendance', JSON.stringify({ [key]: { status: 'Lavorato', notes: 'Nota backup fixture' }, '2000-01-01': { status: 'Ferie', notes: 'Altro mese' } }))
    localStorage.setItem('driverContractProfile', JSON.stringify({ contractType: 'part_time', weeklyHours: 24, contractualWeekdays: [1, 3, 5, 6] }))
    localStorage.setItem('driverPayroll.payslips', JSON.stringify(payslips))
    localStorage.setItem('unrelated.fixture', 'must survive')
  }, payslips)
  await page.goto(base + '/area-driver/busta-paga')
  await page.getByRole('tab', { name: 'Mese', exact: true }).click()
  await page.getByRole('button', { name: 'Salva riepilogo locale', exact: true }).click()
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('driverPayroll.predictions') ?? '[]').length === 1)
  const original = await snapshot()
  assert.equal(JSON.parse(original['driverPayroll.payslips']).length, 4)
  await page.getByRole('link', { name: 'Backup e ripristino', exact: true }).click()
  const downloadReady = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Esporta backup', exact: true }).click()
  const download = await downloadReady
  const backupPath = resolve(output, 'backup-fixture.json')
  await download.saveAs(backupPath)
  const text = readFileSync(backupPath, 'utf8')
  const backup = JSON.parse(text)
  assert.match(download.suggestedFilename(), /^DriverUtility-AreaDriver-Backup-\d{4}-\d{2}-\d{2}\.json$/)
  assert.doesNotMatch(text, /"(?:pdf|pdfFile|rawText|rawLine|sourceGeometry|temporaryReadDiagnostic|unrelated.fixture)"/)
  for (const key of BACKUP_KEYS) assert.deepEqual(backup.data[key], original[key] === null ? null : JSON.parse(original[key]), key)
  checks.push('download JSON: four real parser fixture histories and actual saved simulator result, exact equality including fiscal-v1')

  await page.evaluate(() => localStorage.setItem('attendance', '{}'))
  const changed = await snapshot()
  await upload('{broken')
  await page.getByRole('alert').filter({ hasText: 'Backup non valido' }).waitFor()
  assert.deepEqual(await snapshot(), changed)
  await upload(JSON.stringify({ ...backup, version: 999 }))
  await page.getByRole('alert').filter({ hasText: 'Versione non supportata' }).waitFor()
  assert.deepEqual(await snapshot(), changed)
  await upload(text)
  await page.getByRole('heading', { name: 'Anteprima del ripristino' }).waitFor()
  assert.deepEqual(await snapshot(), changed, 'preview must not write')
  assert.equal(await page.getByRole('button', { name: 'Conferma ripristino', exact: true }).isDisabled(), true)
  await page.getByRole('button', { name: 'Annulla', exact: true }).click()
  assert.deepEqual(await snapshot(), changed)
  checks.push('corrupt/unknown version rejected; preview and cancellation leave existing data unchanged')

  await upload(text)
  await page.getByRole('checkbox').check()
  await page.screenshot({ path: resolve(output, 'backup-preview-mobile.png'), fullPage: true })
  await page.getByRole('button', { name: 'Conferma ripristino', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Ripristino riuscito' }).waitFor()
  for (const [key, value] of Object.entries(await snapshot())) assert.deepEqual(value === null ? null : JSON.parse(value), original[key] === null ? null : JSON.parse(original[key]), key)
  assert.equal(await page.evaluate(() => localStorage.getItem('unrelated.fixture')), 'must survive')
  checks.push('explicit confirmation restores attendance, notes, profile, all history fiscal fields, saved simulation; unrelated data retained')

  await page.goto(base + '/area-driver/turni')
  await page.getByText('Esporta PDF Turni Driver', { exact: false }).waitFor()
  await page.getByRole('button', { name: 'Reset mese', exact: false }).click()
  await page.getByRole('button', { name: 'Azzera', exact: true }).click()
  const afterAttendanceReset = await snapshot()
  assert.deepEqual(JSON.parse(afterAttendanceReset.attendance), { '2000-01-01': { status: 'Ferie', notes: 'Altro mese' } })
  assert.equal(afterAttendanceReset['driverPayroll.payslips'], original['driverPayroll.payslips'])
  assert.equal(afterAttendanceReset['driverPayroll.predictions'], original['driverPayroll.predictions'])
  checks.push('original monthly attendance reset preserves Payroll history and simulations')

  await page.goto(base + '/area-driver/busta-paga')
  await page.getByRole('button', { name: 'Reset dati Payroll', exact: false }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Elimina tutto', exact: true }).click()
  await page.waitForFunction(() => localStorage.getItem('driverPayroll.payslips') === null)
  const afterPayrollReset = await snapshot()
  assert.equal(afterPayrollReset.attendance, afterAttendanceReset.attendance)
  assert.equal(afterPayrollReset.driverContractProfile, original.driverContractProfile)
  assert.equal(afterPayrollReset['driverPayroll.predictions'], null)
  checks.push('original Payroll reset preserves attendance, notes and contract profile')
  assert.deepEqual(errors, [])
  assert(requests.every(url => url.startsWith(base + '/') || url.startsWith('blob:') || url.startsWith('data:')), 'unexpected external request')
  writeFileSync(resolve(output, 'backup-browser-checks.json'), JSON.stringify({ passed: checks, errors, externalRequests: [] }, null, 2))
  console.log(JSON.stringify({ passed: checks.length, checks, errors }))
} catch (error) {
  await page.screenshot({ path: resolve(output, 'backup-browser-failure.png'), fullPage: true })
  console.error(JSON.stringify({ checks, errors, failure: error.message }))
  throw error
} finally { await browser.close() }
