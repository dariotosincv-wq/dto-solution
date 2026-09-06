// Browser-only fixtures; no test data is included in application code or sent to production.
import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'

const base = process.env.DASHBOARD_TEST_URL || 'http://127.0.0.1:5174'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const directory = 'artifacts/company-dashboard'
mkdirSync(directory, { recursive: true })
try {
  const context = await browser.newContext()
  let scenario = 'populated'
  const requests = []
  const company = 'Azienda verifica locale S.r.l.'
  // Replace only the authentication module served to this isolated test browser.
  await context.route('**/company/src/auth/AuthContext.jsx*', route => route.fulfill({ contentType: 'text/javascript', body: `export function AuthProvider({children}) { return children } export function useAuth() { return { session: { access_token: 'local-dashboard-test' }, access: { organization: { id: 'local', name: '${company}' }, role: 'COMPANY_ADMIN', state: 'active_license', devices: { active: 2, capacity: 5, available: 3 }, capabilities: { useTools: true, manageDevices: true, viewInspections: true } }, signOut() {} } }` }))
  await context.route('**/api/**', route => {
    const url = new URL(route.request().url())
    if (!url.pathname.startsWith('/api/company-')) return route.continue()
    requests.push({ path: url.pathname, method: route.request().method() })
    if (scenario === 'error') return route.fulfill({ status: 503, json: { error: 'TEST_UNAVAILABLE' } })
    const vehicles = [{ vehicle_id: 'v1', internal_code: 'TEST-A', plate: 'TEST001', status: 'active', open_report_count: 1 }, { vehicle_id: 'v2', internal_code: 'TEST-B', plate: 'TEST002', status: 'inactive', open_report_count: 0 }]
    const reports = [{ report_id: 'r1', vehicle_id: 'v1', report_type: 'BRAKES', description: 'Segnalazione di test locale', status: 'OPEN', reported_at: '2026-09-06T07:15:00Z', driver: 'Driver di test' }]
    const inspections = [{ id: 'i1', vehiclePlate: 'TEST001', inspectionType: 'pickup', inspectedAt: '2026-09-06T08:00:00Z' }]
    return route.fulfill({ json: { items: scenario === 'empty' ? [] : url.pathname === '/api/company-vehicles' ? vehicles : url.pathname === '/api/company-vehicle-reports' ? reports : url.pathname === '/api/company-inspections' ? inspections : [] } })
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(`${base}/azienda/dashboard`)
    await page.getByText('Segnalazione di test locale', { exact: true }).waitFor()
    await page.getByText(company, { exact: true }).waitFor()
    assert.equal(await page.locator('.fleet-kpi strong').allTextContents().then(items => items.join(',')), '2,1,1,1')
    assert.equal(await page.locator('.fleet-heading time').textContent(), await page.evaluate(() => new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())))
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow ${width}`)
    assert.deepEqual(await page.locator('.fleet-shortcuts a').evaluateAll(links => links.map(link => link.getAttribute('href'))), ['/azienda/veicoli', '/azienda/ispezioni', '/azienda/pdf/verifica', '/azienda/pdf/confronta'])
    assert(await page.locator('.fleet-shortcuts a').evaluateAll(links => links.every(link => link.getBoundingClientRect().height >= 44)))
    await page.screenshot({ path: `${directory}/${width}.png`, fullPage: true })
    console.log(`PASS ${width}: session-derived company, dynamic date, real contract data rendering, routes, no overflow`)
  }
  for (const path of ['/azienda/veicoli', '/azienda/ispezioni', '/azienda/pdf/verifica', '/azienda/pdf/confronta']) {
    await page.goto(`${base}/azienda/dashboard`)
    await page.locator(`.company-sidebar a[href="${path}"]`).click()
    await page.waitForURL(`${base}${path}`)
    assert(await page.locator('.company-main').isVisible())
  }
  scenario = 'empty'
  await page.goto(`${base}/azienda/dashboard`)
  await page.getByText('Nessun problema da verificare', { exact: true }).waitFor()
  assert.deepEqual(await page.locator('.fleet-kpi strong').allTextContents(), ['0', '0', '0', '0'])
  scenario = 'error'
  await page.reload()
  await page.getByRole('alert').waitFor()
  assert.deepEqual(await page.locator('.fleet-kpi strong').allTextContents(), ['—', '—', '—', '—'])
  assert.equal(await page.getByText('Nessun problema da verificare', { exact: true }).count(), 0)
  assert(requests.every(request => request.method === 'GET'))
  assert.deepEqual(errors, [])
  console.log('PASS empty/error states, sidebar destinations, GET-only requests, no JavaScript errors. Auth is simulated in browser; no live company session used.')
} finally { await browser.close() }
