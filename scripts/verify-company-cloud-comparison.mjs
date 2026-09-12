import { chromium, expect } from '@playwright/test'
import assert from 'node:assert/strict'

const base = process.env.CLOUD_COMPARISON_TEST_URL || 'http://127.0.0.1:5175'
const items = [
  { id: 'before', inspectedAt: '2030-03-01T08:00:00Z', vehiclePlate: 'CLOUD1', vehicleDescription: 'S116', inspectionType: 'pickup' },
  { id: 'after', inspectedAt: '2030-03-02T18:00:00Z', vehiclePlate: 'CLOUD1', vehicleDescription: 'S116', inspectionType: 'return' },
]
const parserModule = "export const CHECKVAN_CATEGORIES=[{id:'front-full',it:'Anteriore',en:'Front'}];export const platesDiffer=()=>false;export const validatePdfFile=()=>null;export const releaseComparison=async()=>{};export const readCheckvanPdf=async(file,progress)=>{progress(1,1);if(globalThis.__cloudParserFailure)throw new Error('not-checkvan');return {metadata:{plate:'CLOUD1',vehicle:'S116',inspectionType:'Presa',date:'01/03/2030',time:'08:00'},photos:{},loadingTask:{destroy:async()=>{}}}}"

const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const context = await browser.newContext()
  let failure = ''; let delayed = false; let invalidDocument = ''
  const requests = []
  await context.route('**/company/src/auth/AuthContext.jsx*', route => route.fulfill({ contentType: 'text/javascript', body: "export function AuthProvider({children}){return children}export function useAuth(){return {session:{access_token:'test-token'},access:{organization:{id:'test'},role:'COMPANY_ADMIN',state:'active_license',capabilities:{useTools:true,viewInspections:true,manageDevices:true}}}}" }))
  await context.route('**/src/lib/checkvanComparison.js*', route => route.fulfill({ contentType: 'text/javascript', body: parserModule }))
  await context.route('**/api/company-inspections?*', route => route.fulfill({ json: { items } }))
  await context.route('**/api/company-inspection-download', async route => {
    const id = route.request().postDataJSON().id; requests.push(id)
    if (failure === id) return route.fulfill({ status: 404, json: { error: 'NOT_FOUND' } })
    if (delayed) await new Promise(resolve => setTimeout(resolve, 2000))
    return route.fulfill({ json: { url: `${base}/cloud-${id}.pdf` } })
  })
  await context.route('**/cloud-*.pdf', route => route.fulfill(invalidDocument && route.request().url().includes(invalidDocument) ? { contentType: 'application/json', body: '{"error":"NOT_FOUND"}' } : { contentType: 'application/pdf', body: '%PDF-1.4\n%%EOF' }))
  const page = await context.newPage()
  const select = async () => {
    await page.goto(`${base}/azienda/pdf/confronta`)
    await expect(page.getByRole('tab',{name:'Dal cloud aziendale'})).toHaveAttribute('aria-selected','true')
    await page.locator('.comparison-summary button').first().click(); await page.locator('.table-card button').first().click()
    await page.locator('.comparison-summary button').nth(1).click(); await page.locator('.table-card button').first().click()
  }
  await select()
  const compare = page.getByRole('button',{name:'Confronta ispezioni',exact:true})
  await compare.click()
  await expect(page.locator('.comparison-heading')).toBeVisible()
  assert.deepEqual(requests.sort(), ['after','before'])
  console.log('PASS cloud PDFs are fetched and passed to the shared comparison pipeline.')
  failure = 'before'; requests.length = 0
  await select(); await compare.click()
  await expect(page.getByRole('alert')).toHaveText('Impossibile recuperare il PDF della prima ispezione.')
  failure = 'after'; requests.length = 0
  await select(); await compare.click()
  await expect(page.getByRole('alert')).toHaveText('Impossibile recuperare il PDF della seconda ispezione.')
  failure = ''; invalidDocument = 'before'
  await select(); await compare.click()
  await expect(page.getByRole('alert')).toHaveText('Il documento della prima ispezione non è un PDF valido.')
  invalidDocument = ''
  await select(); await page.evaluate(() => { globalThis.__cloudParserFailure = true }); await compare.click()
  await expect(page.getByRole('alert')).toHaveText('Il documento della prima ispezione non è compatibile con le fotografie guidate CheckVan.')
  failure = ''; delayed = true
  await select(); const loading = compare.click(); await page.waitForTimeout(100); await expect(page.getByRole('button',{name:'Caricamento ispezioni...',exact:true})).toBeDisabled(); await loading
  await expect(page.locator('.comparison-heading')).toBeVisible()
  console.log('PASS first and second cloud PDF retrieval errors are visible.')
} finally { await browser.close() }
