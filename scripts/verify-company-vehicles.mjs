// Isolated browser fixtures only: no real session, database writes or production requests.
import { chromium, expect } from '@playwright/test'
import assert from 'node:assert/strict'

const base = process.env.VEHICLES_TEST_URL || 'http://127.0.0.1:5174'
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Local test server required')
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const context = await browser.newContext()
  let items = [
    { vehicle_id: 'v10', internal_code: 'TEST-10', plate: 'LOCAL10', silhouette_category: 'MEDIUM', status: 'active', open_report_count: 0 },
    { vehicle_id: 'v2', internal_code: 'TEST-2', plate: 'LOCAL02', silhouette_category: 'SMALL', status: 'inactive', open_report_count: 2 },
    { vehicle_id: 'v1', internal_code: 'TEST-1', plate: 'LOCAL01', silhouette_category: 'MEDIUM', status: 'active', open_report_count: 0 },
  ]
  let failLoad = false, failRemove = false, denyAccess = false
  const calls = [], errors = []
  await context.route('**/company/src/auth/AuthContext.jsx*', route => route.fulfill({ contentType: 'text/javascript', body: `const auth = { session: { access_token: 'isolated-local-test' }, access: { organization: { id: 'local-test', name: 'Impresa test locale' }, role: 'COMPANY_ADMIN', state: 'active_license', capabilities: { useTools: ${!denyAccess}, manageDevices: true, viewInspections: true } }, signOut() {}, refreshAccess: async () => {} }; export function AuthProvider({children}) { return children } export function useAuth() { return auth }` }))
  await context.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method()
    if (!url.pathname.startsWith('/api/company-')) return route.continue()
    calls.push({ path: url.pathname, method, body: request.postDataJSON() })
    if (url.pathname === '/api/company-vehicles') {
      if (method === 'GET') return route.fulfill({ status: failLoad ? 503 : 200, json: failLoad ? { error: 'UNAVAILABLE' } : { items, existing: [...items, { internal_code: 'ARCHIVED', plate: 'LOCALOLD' }] } })
      const body = request.postDataJSON()
      if (body.plate === 'LOCAL01') return route.fulfill({ status: 409, json: { error: 'VEHICLE_PLATE_EXISTS' } })
      const added = (body.vehicles || [body]).map((vehicle, index) => ({ ...vehicle, vehicle_id: `new-${items.length + index}`, status: 'active', open_report_count: 0 }))
      items = [...items, ...added]
      return route.fulfill({ json: { imported: added.length, skipped: 0 } })
    }
    if (url.pathname === '/api/company-vehicle' && url.searchParams.has('removal_check')) return route.fulfill({ json: { hasHistory: url.searchParams.get('id') === 'v2' } })
    if (url.pathname === '/api/company-vehicle' && method === 'DELETE') {
      if (failRemove) return route.fulfill({ status: 503, json: { error: 'UNAVAILABLE' } })
      items = items.filter(vehicle => vehicle.vehicle_id !== url.searchParams.get('id'))
      return route.fulfill({ json: { ok: true } })
    }
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  const counts = () => page.locator('.vehicles-kpis strong')
  const codes = () => page.locator('.vehicles-table tbody th strong')
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(`${base}/azienda/veicoli`)
    await expect(counts()).toHaveText(['3', '0', '2', '1', '0'])
    await expect(codes()).toHaveText(['TEST-1', 'TEST-2', 'TEST-10'])
    await expect(page.getByRole('heading', { name: 'Veicoli', exact: true })).toBeVisible()
    await expect(page.getByText('2 segnalazioni aperte', { exact: true })).toBeVisible()
    await expect(page.getByText('Disattivato', { exact: true })).toBeVisible()
    assert.deepEqual(await page.locator('.vehicles-row-actions a').evaluateAll(links => links.map(link => link.getAttribute('href'))), ['/azienda/veicoli/v1', '/azienda/veicoli/v2', '/azienda/veicoli/v10'])
    assert(await page.locator('.vehicles-row-actions a, .vehicles-row-actions button').evaluateAll(elements => elements.every(element => element.getBoundingClientRect().height >= 44)))
    await page.locator('.vehicles-banner img').evaluate(image => image.decode())
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow ${width}px`)
    assert.equal(await page.locator('.vehicles-table tbody tr').first().evaluate(row => getComputedStyle(row).display), width <= 700 ? 'grid' : 'table-row')
    await page.getByLabel('Ordina per').selectOption('desc')
    await expect(codes()).toHaveText(['TEST-10', 'TEST-2', 'TEST-1'])
    await page.getByLabel('Ordina per').selectOption('asc')
    // Optional new screenshots only; existing user artifacts must never be overwritten.
    if (process.env.VEHICLES_VISUAL === '1' && [375, 1440].includes(width)) {
      const { writeFile } = await import('node:fs/promises')
      await writeFile(`.vehicles-review-${width}.png`, await page.screenshot({ fullPage: true }), { flag: 'wx' })
    }
    console.log(`PASS ${width}px: render, dynamic KPI including zero, natural sort, reports/status, detail URLs, touch targets, asset, no overflow`)
  }
  await page.getByLabel('Codice mezzo', { exact: true }).fill('NEW-4')
  await page.getByLabel('Targa', { exact: true }).fill('LOCAL04')
  await page.getByLabel('Categoria', { exact: true }).selectOption('LARGE')
  await page.getByRole('button', { name: 'Aggiungi veicolo', exact: true }).click()
  await expect(counts()).toHaveText(['4', '1', '2', '1', '0'])
  assert.deepEqual(calls.find(call => call.method === 'POST').body, { internal_code: 'NEW-4', plate: 'LOCAL04', silhouette_category: 'LARGE' })
  await expect(page.getByLabel('Codice mezzo', { exact: true })).toHaveValue('')
  await page.getByLabel('Codice mezzo', { exact: true }).fill('DUPLICATE')
  await page.getByLabel('Targa', { exact: true }).fill('LOCAL01')
  await page.getByRole('button', { name: 'Aggiungi veicolo', exact: true }).click()
  await expect(page.getByText('Targa già presente nell’organizzazione.', { exact: true })).toBeVisible()
  const csv = 'codice_mezzo,targa,categoria\nCSV-1,LOCALCSV,EXTRA_SMALL\nARCHIVED,LOCALOLD,SMALL\nBAD,LOCALBAD,INVALID'
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Importa flotta CSV' }).click()
  await (await chooser).setFiles({ name: 'local.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await expect(page.getByRole('heading', { name: 'Anteprima CSV' })).toBeVisible()
  await expect(page.getByText('3 righe lette · 1 pronte per import · 2 con errori o duplicate')).toBeVisible()
  await page.setViewportSize({ width: 320, height: 1000 })
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'CSV preview overflow')
  await page.getByRole('button', { name: 'Importa 1 veicoli', exact: true }).click()
  await expect(counts()).toHaveText(['5', '1', '2', '1', '1'])
  assert.deepEqual(calls.filter(call => call.method === 'POST').at(-1).body, { vehicles: [{ internal_code: 'CSV-1', plate: 'LOCALCSV', silhouette_category: 'EXTRA_SMALL' }] })
  await expect(page.getByText('1 veicoli importati · 2 non importati')).toBeVisible()
  const deleteCount = () => calls.filter(call => call.method === 'DELETE').length
  page.once('dialog', dialog => { assert.match(dialog.message(), /Rimuovere definitivamente/); void dialog.dismiss() })
  await page.getByRole('button', { name: 'Rimuovi TEST-1', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Rimuovi TEST-1', exact: true })).toBeEnabled()
  assert.equal(deleteCount(), 0)
  failRemove = true
  page.once('dialog', dialog => { void dialog.accept() })
  await page.getByRole('button', { name: 'Rimuovi TEST-1', exact: true }).click()
  await expect(page.getByText('Rimozione del veicolo non riuscita.', { exact: true })).toBeVisible()
  await expect(counts()).toHaveText(['5', '1', '2', '1', '1'])
  failRemove = false
  page.once('dialog', dialog => { assert.match(dialog.message(), /ha uno storico.*archiviato/); void dialog.accept() })
  await page.getByRole('button', { name: 'Rimuovi TEST-2', exact: true }).click()
  await expect(counts()).toHaveText(['4', '1', '2', '0', '1'])
  await expect(page.getByRole('button', { name: 'Rimuovi TEST-2', exact: true })).toHaveCount(0)
  page.once('dialog', dialog => { assert.match(dialog.message(), /Rimuovere definitivamente/); void dialog.accept() })
  await page.getByRole('button', { name: 'Rimuovi TEST-1', exact: true }).click()
  await expect(counts()).toHaveText(['3', '1', '1', '0', '1'])
  const detail = page.getByRole('link', { name: 'Apri TEST-10', exact: true })
  await detail.click()
  await page.waitForURL(`${base}/azienda/veicoli/v10`)
  items = []
  await page.goto(`${base}/azienda/veicoli`)
  await expect(counts()).toHaveText(['0', '0', '0', '0', '0'])
  await expect(page.getByText('Nessun veicolo nel catalogo.', { exact: true })).toBeVisible()
  failLoad = true
  await page.reload()
  await expect(page.getByText('Catalogo veicoli non disponibile.', { exact: true })).toBeVisible()
  denyAccess = true
  await page.reload()
  await page.waitForURL(`${base}/azienda/dashboard`)
  assert.deepEqual(errors, [])
  console.log('PASS unchanged add payload, duplicate error, CSV validation/import, confirmation/cancel/archive/delete/rollback, detail navigation, empty/error, access guard, no JS errors. Fixtures only; no real company session.')
} finally { await browser.close() }
