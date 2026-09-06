// Fixtures are confined to this isolated local browser; never used by the application.
import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'

const base = process.env.CHECKVAN_TEST_URL || 'http://127.0.0.1:5174'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const context = await browser.newContext()
  let state = 'active_trial', failure = false, empty = false
  const calls = [], errors = []
  const company = 'Impresa collaudo locale'
  await context.route('**/company/src/auth/AuthContext.jsx*', route => {
    const enabled = ['active_trial', 'active_license', 'tester', 'founder'].includes(state)
    return route.fulfill({ contentType: 'text/javascript', body: `export function AuthProvider({children}) { return children } export function useAuth() { return { session: { access_token: 'isolated-local-test' }, access: { organization: { id: 'test', name: '${company}' }, license: { endsAt: '2030-12-15T12:00:00Z' }, role: 'COMPANY_ADMIN', state: '${state}', trialEligibility: { eligible: ${state === 'no_membership'} }, devices: { active: 3, capacity: 8, available: 5 }, capabilities: { useTools: ${enabled}, manageDevices: ${enabled}, viewInspections: ${enabled} } }, refreshAccess: async () => {}, signOut() {} } }` })
  })
  await context.route('**/api/**', route => {
    const url = new URL(route.request().url())
    if (!url.pathname.startsWith('/api/company-')) return route.continue()
    calls.push({ path: url.pathname, method: route.request().method() })
    if (url.pathname === '/api/company-trial') return route.fulfill({ json: { enrollmentToken: 'LOCAL-TEST-ONLY' } })
    if (failure) return route.fulfill({ status: 503, json: { error: 'UNAVAILABLE' } })
    const items = empty ? [] : url.pathname === '/api/company-vehicle-reports' ? [{ status: 'OPEN' }, { status: 'RESOLVED' }, { status: 'OPEN' }] : url.pathname === '/api/company-drivers' ? [{ status: 'active' }, { status: 'archived' }, { status: 'inactive' }] : []
    return route.fulfill({ json: { items, total: empty ? 0 : 7 } })
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 950 })
    await page.goto(`${base}/azienda/checkvan`)
    await page.waitForFunction(() => document.querySelectorAll('.checkvan-kpis strong')[1]?.textContent === '7')
    await page.getByRole('heading', { name: 'Gestione CheckVan', exact: true }).waitFor()
    await page.getByRole('heading', { name: company, exact: true }).waitFor()
    assert.deepEqual(await page.locator('.checkvan-kpis strong').allTextContents(), ['3', '7', '2', '1'])
    assert.deepEqual(await page.locator('.checkvan-license-details dd').allTextContents(), ['15 dicembre 2030', '3 / 8'])
    assert.deepEqual(await page.locator('.checkvan-actions a').evaluateAll(links => links.map(link => link.getAttribute('href'))), ['/azienda/dispositivi', '/azienda/ispezioni'])
    assert(await page.locator('.checkvan-actions a').evaluateAll(links => links.every(link => link.getBoundingClientRect().height >= 44)))
    await page.locator('.checkvan-banner img').evaluate(image => image.decode())
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow ${width}`)
    if (process.env.CHECKVAN_SCREENSHOTS === '1' && [375, 1440].includes(width)) console.log(`IMAGE:${(await page.screenshot({ fullPage: true })).toString('base64')}`)
    console.log(`PASS ${width}px: license, expiry, devices, counts, links, asset, overflow`)
  }
  for (const path of ['/azienda/dispositivi', '/azienda/ispezioni']) {
    await page.locator(`.checkvan-actions a[href="${path}"]`).click()
    await page.waitForURL(`${base}${path}`)
    await page.goto(`${base}/azienda/checkvan`)
  }
  const sidebar = await page.locator('.company-sidebar nav a').evaluateAll(links => links.map(link => link.getAttribute('href')))
  assert.deepEqual(sidebar, ['/azienda/dashboard', '/azienda/checkvan', '/azienda/veicoli', '/azienda/driver', '/azienda/assegnazioni', '/azienda/ispezioni', '/azienda/pdf/verifica', '/azienda/pdf/confronta', '/azienda/dispositivi', '/azienda/account'])
  for (const variant of ['active_license', 'tester', 'founder', 'expired', 'membership_unavailable']) {
    state = variant
    const start = calls.length
    await page.reload()
    await page.getByRole('heading', { name: 'Gestione CheckVan', exact: true }).waitFor()
    if (['active_license', 'tester', 'founder'].includes(variant)) {
      assert.equal(await page.locator('.checkvan-actions a').count(), 2)
      assert.deepEqual(await page.locator('.checkvan-license-details dd').allTextContents(), ['15 dicembre 2030', '3 / 8'])
    } else {
      assert.equal(await page.locator('.checkvan-actions a').count(), 0)
      assert.equal(calls.length, start)
    }
  }
  state = 'active_trial'; empty = true
  await page.reload()
  await page.waitForFunction(() => document.querySelectorAll('.checkvan-kpis strong')[1]?.textContent === '0')
  assert.deepEqual(await page.locator('.checkvan-kpis strong').allTextContents(), ['3', '0', '0', '0'])
  failure = true
  await page.reload()
  await page.getByText('Dati non disponibili', { exact: true }).first().waitFor()
  assert.deepEqual(await page.locator('.checkvan-kpis strong').allTextContents(), ['3', '—', '—', '—'])
  assert(calls.every(call => call.method === 'GET'))
  state = 'no_membership'; failure = false
  await page.reload()
  await page.getByLabel('Nome azienda', { exact: true }).fill('Trial collaudo locale')
  await page.getByRole('button', { name: 'Attiva trial CheckVan' }).click()
  await page.getByRole('heading', { name: 'Trial attivato', exact: true }).waitFor()
  assert.equal(calls.filter(call => call.method === 'POST').length, 1)
  await page.reload()
  assert.equal(await page.locator('.checkvan-token').count(), 0)
  assert.deepEqual(errors, [])
  console.log('PASS active/trial/tester/founder/expired/unavailable, empty/errors, unchanged local trial flow, no JS errors. Authentication simulated only in this test.')
} finally { await browser.close() }
