import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const driverUtility = await readFile(new URL('../src/pages/products/DriverUtilityPage.jsx', import.meta.url), 'utf8')
const driverArea = await readFile(new URL('../src/pages/DriverAreaPage.jsx', import.meta.url), 'utf8')
const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const styles = await readFile(new URL('../src/pages/driver-dashboard.css', import.meta.url), 'utf8')
const pageLayout = await readFile(new URL('../src/components/layout/PageLayout.jsx', import.meta.url), 'utf8')

test('Driver Utility no longer exposes public CheckVan verification or comparison links', () => {
  assert.doesNotMatch(driverUtility, /to="\/verifica-checkvan"/)
  assert.doesNotMatch(driverUtility, /to="\/confronta-checkvan"/)
  assert.match(driverUtility, /to="\/area-driver"/)
})

test('legacy CheckVan tools are not registered in the public router', () => {
  assert.doesNotMatch(app, /CheckVanVerificationPage|CheckVanComparisonPage/)
  assert.doesNotMatch(app, /path="(?:verifica|confronta)-checkvan"/)
  assert.doesNotMatch(pageLayout, /\/(?:verifica|confronta)-checkvan/)
  assert.match(app, /<Route path="\*" element={<NotFoundPage \/>}/)
})

test('Area Driver dashboard contains tools, rights, privacy and help', () => {
  assert.match(app, /path="area-driver" element={<DriverAreaPage \/>}/)
  for (const text of ['I tuoi strumenti', 'Conosci i tuoi diritti', 'CCNL Logistica', 'Accordo Assoespressi – Ultimo miglio Amazon', 'Normativa di riferimento', 'Turni Driver', 'Busta Paga Driver', 'Profilo contrattuale', 'Backup e ripristino', 'I tuoi dati restano tuoi', 'Hai bisogno di aiuto?']) assert(driverArea.includes(text))
  assert.doesNotMatch(driverArea, /Prossimamente/)
  assert.doesNotMatch(driverArea, /href=|\.pdf/)
})

test('Area Driver has responsive grids and active document CTAs', () => {
  assert.doesNotMatch(driverArea, /<button type="button" disabled/)
  assert.match(driverArea, /'\/area-driver\/normativa'/)
  assert.match(styles, /\.driver-dashboard__tools \{[^}]*repeat\(4,/s)
  assert.match(styles, /@media \(max-width: 1100px\)[\s\S]*\.driver-dashboard__tools[^}]*repeat\(2,/)
  assert.match(styles, /@media \(max-width: 540px\)[\s\S]*\.driver-dashboard__tools[^}]*grid-template-columns: 1fr/)
})
