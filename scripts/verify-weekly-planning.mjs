// Isolated local browser tests. Every company API is intercepted; no real data.
import { chromium, expect } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { entryKey, weekDays, shiftDay, resolveEffective, copyPreviousWeek } from '../company/src/lib/weeklyPlanning.js'
const base = process.env.PLANNING_TEST_URL || 'http://127.0.0.1:5178'
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname))
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const context = await browser.newContext()
  const drivers = Array.from({ length: 100 }, (_, index) => ({ driver_id: `d${index}`, first_name: 'Test', last_name: `Driver ${String(index + 1).padStart(3, '0')}`, status: 'active', expected_weekly_days: [3, 4, 5][index % 3] }))
  const vehicles = drivers.map((_, index) => ({ vehicle_id: `v${index}`, internal_code: `VAN ${String(index + 1).padStart(3, '0')}`, plate: `TEST${index}`, status: 'active' }))
  const weeks = new Map(), requests = [], errors = []
  let fail = false, stale = false, role = 'COMPANY_ADMIN'
  const initial = start => ({ week_start: start, revision: 0, drivers, vehicles, entries: drivers.flatMap((driver, index) => weekDays(start).map((assignment_date, day) => ({ driver_id: driver.driver_id, assignment_date, work_status: day >= 5 ? 'RIPOSO' : index === 1 && day === 2 ? 'FERIE' : 'TURNO', vehicle_id: day >= 5 || (index === 2 && day >= 1) ? null : `v${index}`, route: day >= 5 ? null : '33', notes: null }))), requirements: weekDays(start).map(assignment_date => ({ assignment_date, required_drivers: 100 })), overrides: [], daily: [] })
  const get = start => { if (!weeks.has(start)) weeks.set(start, initial(start)); const value = weeks.get(start); return { ...value, effective: resolveEffective(value.entries, value.overrides, value.daily) } }
  await context.route('**/company/src/auth/AuthContext.jsx*', route => route.fulfill({ contentType: 'text/javascript', body: `const auth={session:{access_token:'isolated-planning-test'},access:{organization:{id:'local',name:'Impresa test'},role:'${role}',state:'active_license',capabilities:{useTools:true,viewInspections:true,manageDevices:true}},signOut(){}};export function AuthProvider({children}){return children}export function useAuth(){return auth}` }))
  await context.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), body = request.postDataJSON()
    if (url.pathname.startsWith('/api/_lib/')) return route.continue()
    requests.push({ method: request.method(), path: url.pathname, body })
    if (url.pathname === '/api/company-drivers') {
      if (body) { const driver = drivers.find(item => item.driver_id === body.driver_id); Object.assign(driver, { expected_weekly_days: body.expected_weekly_days }); return route.fulfill({ json: driver }) }
      return route.fulfill({ json: { items: drivers } })
    }
    if (url.pathname === '/api/company-assignments') {
      const date = url.searchParams.get('date'), value = get('2026-09-07')
      return route.fulfill({ json: { date, drivers, vehicles, assignments: value.effective.filter(item => item.assignment_date === date && item.work_status === 'TURNO'), operational: value.effective.filter(item => item.assignment_date === date) } })
    }
    if (url.searchParams.get('resource') !== 'company-planning') return route.fulfill({ json: { items: [] } })
    if (fail) return route.fulfill({ status: 503, json: { error: 'PLANNING_UNAVAILABLE' } })
    const start = body?.week_start || url.searchParams.get('week_start'), value = get(start)
    if (request.method() === 'GET') return route.fulfill({ json: value })
    if (stale || value.revision !== body.revision) return route.fulfill({ status: 409, json: { error: 'PLANNING_STALE' } })
    const next = { ...weeks.get(start), revision: value.revision + 1 }
    const item = { ...body }, key = entryKey(body.driver_id, body.assignment_date)
    let copied = 0, propagated = []
    if (['SAVE', 'CLEAR'].includes(body.action)) {
      next.entries = [...value.entries.filter(entry => entryKey(entry.driver_id, entry.assignment_date) !== key), ...(body.action === 'SAVE' ? [item] : [])]
      if (body.action === 'SAVE' && item.work_status === 'TURNO' && item.vehicle_id) next.entries = next.entries.map(entry => {
        if (entry.driver_id !== item.driver_id || entry.assignment_date <= item.assignment_date || entry.work_status !== 'TURNO' || entry.vehicle_id) return entry
        const updated = { ...entry, vehicle_id: item.vehicle_id }; propagated.push(updated); return updated
      })
    }
    if (['OVERRIDE', 'RESET_OVERRIDE'].includes(body.action)) next.overrides = [...value.overrides.filter(entry => entryKey(entry.driver_id, entry.assignment_date) !== key), ...(body.action === 'OVERRIDE' ? [item] : [])]
    if (body.action === 'REQUIREMENT') next.requirements = [...value.requirements.filter(entry => entry.assignment_date !== body.assignment_date), item]
    if (body.action === 'COPY_PREVIOUS') { const copy = copyPreviousWeek(get(shiftDay(start, -7)).entries, value.entries, start); next.entries = [...value.entries, ...copy]; copied = copy.length }
    weeks.set(start, next)
    return route.fulfill({ json: { revision: next.revision, item: ['CLEAR', 'RESET_OVERRIDE'].includes(body.action) ? null : item, propagated, copied, copied_requirements: 0 } })
  })
  const page = await context.newPage()
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message) })
  const path = '/azienda/pianificazione/settimanale?date=2026-09-07'
  await mkdir('artifacts/planning', { recursive: true })
  for (const width of [1536, 1024, 768, 375]) {
    await page.setViewportSize({ width, height: 1024 })
    await page.goto(base + path)
    await expect(page.locator('.planning-grid tbody tr')).toHaveCount(10, { timeout: 15000 }).catch(async error => { console.log(page.url(), await page.locator('body').innerText(), requests); throw error })
    await expect(page.locator('.planning-days article')).toHaveCount(7)
    await expect(page.locator('.planning-grid tbody th').first()).toHaveText('Driver 001 Test')
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No page overflow at ${width}`)
    await page.screenshot({ path: `artifacts/planning/weekly-${width}.png`, fullPage: width > 600 })
    await page.getByRole('button', { name: /^Driver 001 Test, 2026-09-07,/ }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    assert(await page.locator('dialog').evaluate(el => el.getBoundingClientRect().width <= innerWidth && el.getBoundingClientRect().height <= innerHeight), `Editor fits ${width}`)
    await page.getByRole('button', { name: 'Chiudi editor' }).click()
    console.log(`PASS ${width}px: 100 drivers, 10 visible rows, seven cards, order, no overflow`)
  }
  await page.setViewportSize({ width: 1536, height: 1024 })
  await page.getByLabel('Cerca driver', { exact: true }).fill('Driver 010')
  await expect(page.locator('.planning-grid tbody tr')).toHaveCount(1)
  await page.getByLabel('Cerca driver', { exact: true }).fill('')
  await page.getByLabel('Filtra profilo').selectOption('3')
  await expect(page.locator('.planning-profile').first()).toHaveText('3 giorni')
  await page.getByLabel('Filtra profilo').selectOption('')
  await page.getByLabel('Filtra stato').selectOption('FERIE')
  await expect(page.locator('.planning-grid tbody tr')).toHaveCount(1)
  await page.getByLabel('Filtra stato').selectOption('')
  await page.getByRole('button', { name: 'Pagina successiva', exact: true }).click()
  await expect(page.locator('.planning-grid tbody th').first()).toHaveText('Driver 011 Test')
  await page.getByRole('button', { name: 'Pagina precedente', exact: true }).click()
  const propagate = date => page.getByRole('button', { name: new RegExp(`^Driver 003 Test, ${date},`) })
  await propagate('2026-09-07').click()
  await page.getByLabel('Mezzo previsto (facoltativo)').selectOption('v2')
  await page.getByRole('button', { name: 'Salva', exact: true }).click()
  await expect(propagate('2026-09-08')).toContainText('VAN 003')
  await propagate('2026-09-09').click()
  await page.getByLabel('Mezzo previsto (facoltativo)').selectOption('v6')
  await page.getByRole('button', { name: 'Salva', exact: true }).click()
  await expect(propagate('2026-09-10')).toContainText('VAN 003')
  const cell = () => page.getByRole('button', { name: /^Driver 001 Test, 2026-09-07,/ })
  const getCount = () => requests.filter(request => request.method === 'GET' && request.path === '/api/platform').length
  const reads = getCount()
  await cell().click()
  await page.screenshot({ path: 'artifacts/planning/editor.png' })
  await page.getByLabel('Stato', { exact: true }).selectOption('FERIE')
  await page.getByRole('button', { name: 'Salva', exact: true }).click()
  await expect(cell()).toContainText('Ferie')
  assert.equal(getCount(), reads, 'Cell save does not reload the week')
  await cell().click()
  await page.getByLabel('Modifica', { exact: true }).selectOption('effective')
  await page.getByLabel('Stato', { exact: true }).selectOption('TURNO')
  await page.getByLabel('Mezzo previsto (facoltativo)').selectOption('v1')
  await page.getByLabel('Rotta (facoltativa)').fill('44')
  await page.getByRole('button', { name: 'Salva', exact: true }).click()
  await expect(cell()).toContainText('Ferie')
  await expect(cell()).toContainText('Variazione')
  assert.equal(get('2026-09-07').effective.find(entry => entry.driver_id === 'd0' && entry.assignment_date === '2026-09-07').route, '44')
  await cell().click()
  await page.getByLabel('Modifica', { exact: true }).selectOption('effective')
  await page.getByRole('button', { name: 'Ripristina piano', exact: true }).click()
  await expect(cell()).not.toContainText('Variazione')
  const required = page.getByLabel('Driver richiesti 2026-09-07')
  await required.fill('105'); await required.press('Enter')
  await expect(page.locator('.planning-days article').first()).toContainText('Mancano 6 driver')
  await page.getByRole('button', { name: 'Copia settimana precedente', exact: true }).click()
  await expect(page.getByText('0 celle e 0 fabbisogni copiati. I dati già presenti sono stati conservati.')).toBeVisible()
  await expect(cell()).toContainText('Ferie')
  stale = true
  await cell().click()
  await page.getByLabel('Note operative').fill('Nota da conservare')
  await page.getByRole('button', { name: 'Salva', exact: true }).click()
  await expect(page.locator('dialog [role="alert"]')).toContainText('altro responsabile')
  await expect(page.getByLabel('Note operative')).toHaveValue('Nota da conservare')
  await page.getByRole('button', { name: 'Chiudi editor' }).click()
  stale = false
  await page.getByRole('button', { name: 'Ricarica', exact: true }).click()
  await expect(cell()).toBeEnabled()
  await page.getByLabel('Settimana', { exact: true }).fill('2026-09-09')
  await expect(page.locator('.planning-grid tbody tr')).toHaveCount(10)
  await page.getByRole('button', { name: 'Settimana successiva', exact: true }).click()
  await expect(page.getByLabel('Settimana', { exact: true })).toHaveValue('2026-09-14')
  await page.getByRole('link', { name: 'Driver', exact: true }).click()
  const profile = page.getByLabel('Giornate settimanali previste di Driver 001 Test', { exact: true })
  await profile.selectOption('5'); await expect(profile).toHaveValue('5')
  await page.goto(base + path)
  await expect(page.getByRole('columnheader', { name: 'Azioni', exact: true })).toHaveCount(0)
  await expect(page.locator('.planning-profile').first()).toHaveText('5 giorni')
  fail = true; await page.reload()
  await expect(page.getByRole('alert')).toContainText('Pianificazione non disponibile')
  fail = false; role = 'COMPANY_OPERATOR'; await page.reload()
  await expect(page).toHaveURL(/azienda\/dashboard/)
  assert.deepEqual(errors, [])
  console.log('PASS search/profile/status/pagination, planned and effective edits, required coverage, safe copy, stale recovery, profile persistence, errors and access guard')
} finally { await browser.close() }
