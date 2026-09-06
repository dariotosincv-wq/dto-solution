// Fixtures exist only in this local browser test; no real authentication or database writes.
import { chromium, expect } from '@playwright/test'
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
const base = process.env.DRIVERS_TEST_URL || 'http://127.0.0.1:5174'
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname))
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const context = await browser.newContext()
  let items = [
    { driver_id: 'one', first_name: 'Zeta', last_name: 'Alfa', driver_code: 'TEST1', status: 'active' },
    { driver_id: 'two', first_name: 'Beta', last_name: 'Alfa', driver_code: '', status: 'active' },
    { driver_id: 'three', first_name: 'Alfa', last_name: 'Zeta', driver_code: 'TEST3', status: 'archived' },
  ]
  let failure = false
  const calls = [], errors = []
  await context.route('**/company/src/auth/AuthContext.jsx*', route => route.fulfill({ contentType: 'text/javascript', body: `const auth={session:{access_token:'isolated-local-test'},access:{organization:{id:'test',name:'Impresa test locale'},role:'COMPANY_ADMIN',state:'active_license',capabilities:{useTools:true,viewInspections:true,manageDevices:true}},signOut(){}};export function AuthProvider({children}){return children} export function useAuth(){return auth}` }))
  await context.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (!path.startsWith('/api/company-')) return route.continue()
    calls.push({ path, method: request.method(), body: request.postDataJSON() })
    assert.equal(path, '/api/company-drivers')
    if (request.method() === 'GET') return route.fulfill({ status: failure ? 503 : 200, json: failure ? { error: 'UNAVAILABLE' } : { items } })
    const body = request.postDataJSON()
    if (request.method() === 'PATCH') { assert.equal(body.action, 'ARCHIVE'); items = items.map(driver => driver.driver_id === body.driver_id ? { ...driver, status: 'archived' } : driver) }
    else {
      if (body.driver_code === 'TEST1') return route.fulfill({ status: 409, json: { error: 'DRIVER_CODE_EXISTS' } })
      items = [...items, ...(body.drivers || [body]).map((driver, index) => ({ ...driver, driver_id: `added-${items.length + index}`, status: 'active' }))]
    }
    return route.fulfill({ json: { ok: true } })
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  const counts = page.locator('.drivers-kpis strong')
  const names = page.locator('.drivers-table tbody th')
  for (const width of [320,375,768,1024,1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(`${base}/azienda/driver`)
    await expect(counts).toHaveText(['3','2','1'])
    await expect(names).toHaveText(['Alfa Beta','Alfa Zeta','Zeta Alfa'])
    await expect(page.getByRole('heading',{name:'Driver',exact:true})).toBeVisible()
    await page.locator('.drivers-art img').evaluate(img => img.decode())
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow ${width}`)
    assert(await page.locator('.drivers-actions button').evaluateAll(buttons => buttons.every(button => button.getBoundingClientRect().height >= 44)))
    assert.equal(await page.locator('.drivers-table tbody tr').first().evaluate(row => getComputedStyle(row).display), width <= 700 ? 'grid' : 'table-row')
    await page.getByLabel('Ordina per').selectOption('surname-desc')
    await expect(names).toHaveText(['Zeta Alfa','Alfa Zeta','Alfa Beta'])
    await page.getByLabel('Ordina per').selectOption('name-asc')
    await expect(names).toHaveText(['Zeta Alfa','Alfa Beta','Alfa Zeta'])
    await page.getByLabel('Ordina per').selectOption('surname-asc')
    if (process.env.DRIVERS_VISUAL === '1' && [375,1440].includes(width)) await writeFile(`.drivers-review-${width}.png`,await page.screenshot({fullPage:true}),{flag:'wx'})
    console.log(`PASS ${width}px: rendering, KPI, surname/name ordering, touch targets, local asset, no overflow`)
  }
  for (const [query, expected] of [['test3',['Zeta Alfa']],['beta',['Alfa Beta']],['ALFA',['Alfa Beta','Alfa Zeta','Zeta Alfa']],['missing',[]]]) {
    await page.getByLabel('Cerca driver').fill(query)
    await expect(names).toHaveText(expected)
    await expect(counts).toHaveText(['3','2','1'])
  }
  await expect(page.getByText('Nessun driver corrisponde alla ricerca.')).toBeVisible()
  await page.getByLabel('Cerca driver').fill('')
  await page.locator('.drivers-filters select').selectOption('archived')
  await expect(names).toHaveText(['Zeta Alfa'])
  await expect(page.locator('.drivers-actions button')).toHaveCount(0)
  await page.locator('.drivers-filters select').selectOption('active')
  await expect(names).toHaveText(['Alfa Beta','Alfa Zeta'])
  await page.locator('.drivers-filters select').selectOption('all')
  await page.getByRole('button',{name:'Aggiungi driver',exact:true}).click()
  assert.equal(calls.filter(call => call.method === 'POST').length,0)
  await page.getByLabel('Nome',{exact:true}).fill('Nuovo')
  await page.getByLabel('Cognome',{exact:true}).fill('Test')
  await page.getByRole('button',{name:'Aggiungi driver',exact:true}).click()
  await expect(counts).toHaveText(['4','3','1'])
  assert.deepEqual(calls.find(call => call.method === 'POST').body,{driver_code:'',first_name:'Nuovo',last_name:'Test'})
  await expect(page.getByLabel('Nome',{exact:true})).toHaveValue('')
  await page.getByLabel('Codice driver',{exact:true}).fill('TEST1')
  await page.getByLabel('Nome',{exact:true}).fill('Duplicato')
  await page.getByLabel('Cognome',{exact:true}).fill('Test')
  await page.getByRole('button',{name:'Aggiungi driver',exact:true}).click()
  await expect(page.getByText('Codice driver già presente.',{exact:true})).toBeVisible()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button',{name:'Importa CSV',exact:true}).click()
  await (await chooser).setFiles({name:'local.csv',mimeType:'text/csv',buffer:Buffer.from('driver_code,nome,cognome\nCSV1,Import,Test\nTEST1,Duplicate,Test\nBAD,,Test')})
  await expect(page.getByText('3 righe · 1 pronte · 2 non valide/duplicate')).toBeVisible()
  await page.setViewportSize({width:320,height:1000})
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),'CSV overflow')
  await page.getByRole('button',{name:'Importa 1 driver',exact:true}).click()
  await expect(counts).toHaveText(['5','4','1'])
  assert.deepEqual(calls.filter(call => call.method === 'POST').at(-1).body,{drivers:[{first_name:'Import',last_name:'Test',driver_code:'CSV1'}]})
  page.once('dialog',dialog => { assert.match(dialog.message(),/Lo storico resterà disponibile/); void dialog.dismiss() })
  await page.getByRole('button',{name:'Archivia Alfa Beta',exact:true}).click()
  assert.equal(calls.filter(call => call.method === 'PATCH').length,0)
  page.once('dialog',dialog => { void dialog.accept() })
  await page.getByRole('button',{name:'Archivia Alfa Beta',exact:true}).click()
  await expect(counts).toHaveText(['5','3','2'])
  assert.deepEqual(calls.find(call => call.method === 'PATCH').body,{driver_id:'two',action:'ARCHIVE'})
  await expect(page.getByRole('button',{name:'Archivia Alfa Beta',exact:true})).toHaveCount(0)
  items=[]
  await page.reload()
  await expect(counts).toHaveText(['0','0','0'])
  await expect(page.getByText('Nessun driver in anagrafica.')).toBeVisible()
  failure=true
  await page.reload()
  await expect(page.getByText('Anagrafica driver non disponibile.')).toBeVisible()
  assert.deepEqual(errors,[])
  console.log('PASS search/status filters, empty results/catalog, required fields/optional code, duplicate error, CSV validation/import, archive cancel/confirm payload and retained history, load error. Local fixtures only.')
} finally { await browser.close() }
