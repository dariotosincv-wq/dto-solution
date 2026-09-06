// Isolated browser fixtures: no production authentication, API calls or storage writes.
import { chromium, expect } from '@playwright/test'
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
const base=process.env.INSPECTIONS_TEST_URL || 'http://127.0.0.1:5174'
assert(['127.0.0.1','localhost'].includes(new URL(base).hostname))
const browser=await chromium.launch({channel:'chrome',headless:true})
try {
  const context=await browser.newContext({acceptDownloads:true})
  const items=[{id:'one',inspectedAt:'2030-03-01T12:00:00Z',vehiclePlate:'LOCAL1',vehicleDescription:'V1',inspectionType:'pickup'},{id:'two',inspectedAt:'2030-03-02T12:00:00Z',vehiclePlate:'LOCAL1',vehicleDescription:'V1',inspectionType:'return'},{id:'three',inspectedAt:'2030-03-03T12:00:00Z',vehiclePlate:'LOCAL2',vehicleDescription:'',inspectionType:'pickup'}]
  const calls=[],errors=[]
  let failure=false,downloadFailure=false
  await context.route('**/company/src/auth/AuthContext.jsx*',route=>route.fulfill({contentType:'text/javascript',body:`const auth={session:{access_token:'isolated-local-test'},access:{organization:{id:'test',name:'Impresa test locale'},role:'COMPANY_ADMIN',state:'active_license',capabilities:{useTools:true,viewInspections:true,manageDevices:true}},signOut(){}};export function AuthProvider({children}){return children}export function useAuth(){return auth}`}))
  // Verify the existing route receives two PDF Files, without retesting the untouched PDF engine.
  await context.route('**/src/pages/CheckVanComparisonPage.jsx*',route=>route.fulfill({contentType:'text/javascript',body:`import React from '/node_modules/.vite/deps/react.js'; export default function Comparison(){const files=window.history.state?.usr?.files||[];return React.createElement('output',{id:'received-files'},JSON.stringify(files.map(f=>({name:f.name,type:f.type,size:f.size}))))}`}))
  await context.route('**/api/**',route=>{
    const request=route.request(),url=new URL(request.url())
    if(!url.pathname.startsWith('/api/company-')) return route.continue()
    calls.push({path:url.pathname,query:Object.fromEntries(url.searchParams),method:request.method(),body:request.postDataJSON()})
    if(url.pathname==='/api/company-inspection-download') return route.fulfill({status:downloadFailure?503:200,json:downloadFailure?{error:'UNAVAILABLE'}:{url:`${base}/local-test.pdf?id=${request.postDataJSON().id}`}})
    assert.equal(url.pathname,'/api/company-inspections')
    const q=url.searchParams
    const filtered=items.filter(item=>(!q.get('plate')||item.vehiclePlate===q.get('plate'))&&(!q.get('inspectionType')||item.inspectionType===q.get('inspectionType'))&&(!q.get('dateFrom')||item.inspectedAt.slice(0,10)>=q.get('dateFrom'))&&(!q.get('dateTo')||item.inspectedAt.slice(0,10)<=q.get('dateTo')))
    return route.fulfill({status:failure?503:200,json:failure?{error:'UNAVAILABLE'}:{items:filtered}})
  })
  const pdf=Buffer.from('%PDF-1.4\n% isolated fixture\n%%EOF')
  await context.route('**/local-test.pdf?*',route=>route.fulfill({contentType:'application/pdf',headers:{'Content-Disposition':'attachment; filename="local-test.pdf"'},body:pdf}))
  const page=await context.newPage()
  page.on('pageerror',error=>errors.push(error.message))
  const counts=page.locator('.inspections-kpis strong'),checks=page.locator('.inspections-table input[type=checkbox]'),compare=page.getByRole('button',{name:'Confronta selezionate',exact:true})
  for(const width of [320,375,768,1024,1440]) {
    await page.setViewportSize({width,height:1000})
    await page.goto(`${base}/azienda/ispezioni`)
    await expect(counts).toHaveText(['3','2','1'])
    await expect(checks).toHaveCount(3)
    await expect(compare).toBeDisabled()
    await expect(page.locator('.inspections-table tbody tr').first()).toContainText('LOCAL2')
    await page.locator('.inspections-art img').evaluate(img=>img.decode())
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width}`)
    assert(await page.locator('.inspections-download button,.inspections-selection label').evaluateAll(elements=>elements.every(element=>element.getBoundingClientRect().height>=44)))
    await page.getByLabel('Ordina per').selectOption('oldest')
    await expect(checks.first()).toHaveAttribute('aria-label',/LOCAL1.*1 mar/)
    await page.getByLabel('Ordina per').selectOption('newest')
    if(process.env.INSPECTIONS_VISUAL==='1'&&[375,1440].includes(width)) await writeFile(`.inspections-review-${width}.png`,await page.screenshot({fullPage:true}),{flag:'wx'})
    console.log(`PASS ${width}px: document render, KPI, sort, download/checkbox touch targets, no overflow`)
  }
  const downloaded=page.waitForEvent('download')
  await page.getByRole('button',{name:'Scarica PDF',exact:true}).first().click()
  const download=await downloaded
  assert.equal(download.suggestedFilename(),'local-test.pdf')
  assert.equal(await download.failure(),null)
  assert.deepEqual(calls.find(call=>call.path.endsWith('download')).body,{id:'three'})
  await checks.nth(0).check();await checks.nth(1).check()
  await expect(compare).toBeEnabled();await expect(checks.nth(2)).toBeDisabled()
  await checks.nth(1).uncheck();await expect(compare).toBeDisabled();await checks.nth(1).check()
  await compare.click()
  await page.waitForURL(`${base}/azienda/pdf/confronta`)
  const files=JSON.parse(await page.locator('#received-files').textContent())
  assert.equal(files.length,2)
  assert(files.every(file=>file.type==='application/pdf'&&file.size===pdf.length))
  assert(files.some(file=>file.name.includes('LOCAL1'))&&files.some(file=>file.name.includes('LOCAL2')))
  await page.goto(`${base}/azienda/ispezioni`)
  await expect(checks).toHaveCount(3)
  await checks.first().check()
  await page.getByLabel('Dal',{exact:true}).fill('2030-03-01')
  await page.getByLabel('Al',{exact:true}).fill('2030-03-02')
  await page.getByLabel('Targa',{exact:true}).fill('LOCAL1')
  await page.getByLabel('Tipo',{exact:true}).selectOption('return')
  await page.getByRole('button',{name:'Filtra',exact:true}).click()
  await expect(counts).toHaveText(['1','0','1'])
  assert.deepEqual(calls.filter(call=>call.method==='GET').at(-1).query,{dateFrom:'2030-03-01',dateTo:'2030-03-02',plate:'LOCAL1',inspectionType:'return'})
  await expect(checks.first()).not.toBeChecked()
  await expect(compare).toBeDisabled()
  const reads=calls.filter(call=>call.method==='GET').length
  await page.getByRole('button',{name:'Pulisci filtri'}).click()
  for(const label of ['Dal','Al','Targa','Tipo']) await expect(page.getByLabel(label,{exact:true})).toHaveValue('')
  assert.equal(calls.filter(call=>call.method==='GET').length,reads,'Clear resets UI only')
  await page.getByRole('button',{name:'Filtra',exact:true}).click()
  await expect(counts).toHaveText(['3','2','1'])
  downloadFailure=true
  await page.getByRole('button',{name:'Scarica PDF',exact:true}).first().click()
  await expect(page.getByRole('alert')).toHaveText('Download temporaneamente non disponibile.')
  await checks.nth(0).check();await checks.nth(1).check();await compare.click()
  await expect(page.getByRole('alert')).toHaveText('Non è stato possibile preparare il confronto.')
  downloadFailure=false
  await page.getByLabel('Targa',{exact:true}).fill('MISSING')
  await page.getByRole('button',{name:'Filtra',exact:true}).click()
  await expect(counts).toHaveText(['0','0','0'])
  await expect(page.getByText('Nessuna ispezione trovata.',{exact:false})).toBeVisible()
  failure=true
  await page.getByRole('button',{name:'Filtra',exact:true}).click()
  await expect(page.getByRole('alert')).toHaveText('Non è stato possibile caricare le ispezioni.')
  await expect(counts).toHaveText(['—','—','—'])
  assert.deepEqual(errors,[])
  console.log('PASS existing filter query, UI reset, PDF download, 2-document selection limit, cross-vehicle comparison Files/route, invalid selection reset, empty/load/download/compare errors. Isolated fixtures only.')
} finally {await browser.close()}
