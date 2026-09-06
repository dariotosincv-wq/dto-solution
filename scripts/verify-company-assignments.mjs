// Local browser fixtures only. Never authenticates or writes to a real company.
import { chromium, expect } from '@playwright/test'
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
const base = process.env.ASSIGNMENTS_TEST_URL || 'http://127.0.0.1:5174'
assert(['127.0.0.1','localhost'].includes(new URL(base).hostname))
const browser = await chromium.launch({channel:'chrome',headless:true})
try {
  const context = await browser.newContext()
  const drivers = [{driver_id:'d1',last_name:'Alfa',first_name:'Zeta',driver_code:'TEST1'},{driver_id:'d2',last_name:'Alfa',first_name:'Beta',driver_code:''},{driver_id:'d3',last_name:'Zeta',first_name:'Alfa',driver_code:'TEST3'}]
  const vehicles = [{vehicle_id:'v1',internal_code:'V1',plate:'LOCAL1'},{vehicle_id:'v2',internal_code:'V2',plate:'LOCAL2'},{vehicle_id:'v3',internal_code:'V3',plate:'LOCAL3'}]
  const days = new Map(), calls = [], errors = []
  let failure=false, conflict=false, empty=false
  const initial = () => [{driver_id:'d1',vehicle_id:'v1'}]
  await context.route('**/company/src/auth/AuthContext.jsx*',route=>route.fulfill({contentType:'text/javascript',body:`const auth={session:{access_token:'isolated-local-test'},access:{organization:{id:'local',name:'Impresa test locale'},role:'COMPANY_ADMIN',state:'active_license',capabilities:{useTools:true,viewInspections:true,manageDevices:true}},signOut(){}};export function AuthProvider({children}){return children}export function useAuth(){return auth}`}))
  await context.route('**/api/**',async route=>{
    const request=route.request(),url=new URL(request.url())
    if(!url.pathname.startsWith('/api/company-')) return route.continue()
    assert.equal(url.pathname,'/api/company-assignments')
    const body=request.postDataJSON(), date=body?.assignment_date || url.searchParams.get('date')
    calls.push({method:request.method(),body,date})
    if(failure) return route.fulfill({status:503,json:{error:'UNAVAILABLE'}})
    if(!days.has(date)) days.set(date,initial())
    if(request.method()==='GET') return route.fulfill({json:{date,drivers:empty?[]:drivers,vehicles:empty?[]:vehicles,assignments:empty?[]:days.get(date)}})
    if(body.action==='COPY_PREVIOUS') {
      const previous=[...days.keys()].filter(day=>day<date).sort().at(-1)
      days.set(date,previous?structuredClone(days.get(previous)):[])
    } else {
      if(conflict || days.get(date).some(item=>item.vehicle_id===body.vehicle_id && item.driver_id!==body.driver_id)) return route.fulfill({status:409,json:{error:'ASSIGNMENT_CONFLICT'}})
      days.set(date,[...days.get(date).filter(item=>item.driver_id!==body.driver_id),{driver_id:body.driver_id,vehicle_id:body.vehicle_id}])
    }
    return route.fulfill({json:{ok:true}})
  })
  const page=await context.newPage()
  page.on('pageerror',error=>errors.push(error.message))
  const dateInput=page.getByLabel('Data assegnazioni'), names=page.locator('.daily-table tbody th')
  const select=name=>page.getByRole('combobox',{name:`Mezzo di ${name}`,exact:true})
  for(const width of [320,375,768,1024,1440]) {
    await page.setViewportSize({width,height:1000})
    await page.goto(`${base}/azienda/assegnazioni`)
    await expect(names).toHaveText(['Alfa Beta','Alfa Zeta','Zeta Alfa'])
    await expect(page.locator('.daily-summary strong')).toHaveText(['3','3'])
    await expect(select('Zeta Alfa')).toHaveValue('v1')
    await expect(select('Beta Alfa').locator('option[value="v1"]')).toBeDisabled()
    await expect(select('Zeta Alfa').locator('option[value="v1"]')).toBeEnabled()
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width}`)
    assert(await page.locator('.daily-control select,.daily-toolbar button').evaluateAll(elements=>elements.every(element=>element.getBoundingClientRect().height>=44)))
    assert.equal(await page.locator('.daily-table tbody tr').first().evaluate(row=>getComputedStyle(row).display),width<=600?'grid':'table-row')
    if(process.env.ASSIGNMENTS_VISUAL==='1' && [375,1440].includes(width)) await writeFile(`.assignments-review-${width}.png`,await page.screenshot({fullPage:true}),{flag:'wx'})
    console.log(`PASS ${width}px: render, ordering, counts, vehicle exclusion, touch targets, no overflow`)
  }
  const today=await dateInput.inputValue()
  await dateInput.fill('2030-03-01')
  await expect.poll(()=>calls.at(-1).date).toBe('2030-03-01')
  await page.getByRole('button',{name:'Giorno precedente'}).click()
  await expect(dateInput).toHaveValue('2030-02-28')
  await page.getByRole('button',{name:'Giorno successivo'}).click()
  await expect(dateInput).toHaveValue('2030-03-01')
  await page.getByRole('button',{name:'Oggi',exact:true}).click()
  await expect(dateInput).toHaveValue(today)
  await dateInput.fill('2030-03-01')
  await expect.poll(()=>calls.at(-1).date).toBe('2030-03-01')
  await select('Beta Alfa').selectOption('v2')
  await expect(page.getByText('Salvato',{exact:true})).toBeVisible()
  assert.deepEqual(calls.find(call=>call.method==='POST').body,{assignment_date:'2030-03-01',driver_id:'d2',vehicle_id:'v2'})
  await expect(select('Alfa Zeta').locator('option[value="v2"]')).toBeDisabled()
  await select('Beta Alfa').selectOption('v3')
  await expect(select('Alfa Zeta').locator('option[value="v2"]')).toBeEnabled()
  assert.equal(days.get('2030-03-01').filter(item=>item.driver_id==='d2').length,1)
  assert.equal(new Set(days.get('2030-03-01').map(item=>item.vehicle_id)).size,days.get('2030-03-01').length)
  const writes=calls.filter(call=>call.method==='POST').length
  await select('Beta Alfa').selectOption('')
  assert.equal(calls.filter(call=>call.method==='POST').length,writes,'Existing empty-value no-op preserved')
  await expect(select('Beta Alfa')).toHaveValue('v3')
  conflict=true
  await select('Alfa Zeta').selectOption('v2')
  await expect(page.getByText('Il mezzo o il driver risulta già assegnato per questa data.')).toBeVisible()
  await expect(select('Alfa Zeta')).toHaveValue('')
  conflict=false
  await dateInput.fill('2030-03-02')
  await expect.poll(()=>calls.at(-1).date).toBe('2030-03-02')
  await expect(select('Beta Alfa')).toHaveValue('')
  await page.getByRole('button',{name:'Copia ultimo giorno disponibile',exact:true}).click()
  await expect(select('Beta Alfa')).toHaveValue('v3')
  assert.deepEqual(calls.filter(call=>call.method==='POST').at(-1).body,{action:'COPY_PREVIOUS',assignment_date:'2030-03-02'})
  await page.getByRole('radio',{name:'Assegnati',exact:true}).check()
  await expect(names).toHaveText(['Alfa Beta','Alfa Zeta'])
  await page.getByRole('radio',{name:'Non assegnati',exact:true}).check()
  await expect(names).toHaveText(['Zeta Alfa'])
  await page.getByRole('radio',{name:'Tutti',exact:true}).check()
  for(const [query,expected] of [['test1',['Alfa Zeta']],['beta',['Alfa Beta']],['zeta',['Alfa Zeta','Zeta Alfa']],['missing',[]]]) {
    await page.getByLabel('Ricerca driver').fill(query)
    await expect(names).toHaveText(expected)
  }
  await expect(page.getByText('Nessun driver corrisponde ai filtri.')).toBeVisible()
  await expect(page.locator('.daily-summary strong')).toHaveText(['3','3'])
  empty=true
  await page.reload()
  await expect(page.locator('.daily-summary strong')).toHaveText(['0','0'])
  await expect(page.getByText('Nessun driver disponibile per le assegnazioni.')).toBeVisible()
  failure=true
  await page.reload()
  await expect(page.getByText('Assegnazioni non disponibili.',{exact:true})).toBeVisible()
  assert.deepEqual(errors,[])
  console.log('PASS date/history/previous/next/today, autosave/change, unique-vehicle exclusion/conflict, existing empty selection no-op, copy payload, search/filter, empty/error. Fixtures only, no real company writes.')
} finally {await browser.close()}
