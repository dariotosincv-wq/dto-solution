import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const driverUtility = await readFile(new URL('../src/pages/products/DriverUtilityPage.jsx', import.meta.url), 'utf8')
const driverArea = await readFile(new URL('../src/pages/DriverAreaPage.jsx', import.meta.url), 'utf8')
const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const styles = await readFile(new URL('../src/styles/pages.css', import.meta.url), 'utf8')
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

test('Area Driver route contains the requested document and future sections', () => {
  assert.match(app, /path="area-driver" element={<DriverAreaPage \/>}/)
  for (const text of ['Contratti e documenti', 'CCNL Logistica, Trasporto Merci e Spedizione', 'Accordo Assoespressi – Ultimo miglio Amazon', 'Normativa di riferimento', 'Guide e spiegazioni', 'Turni di lavoro', 'Busta paga', 'Assistente CCNL', 'Backup e ripristino']) assert.match(driverArea, new RegExp(text))
  assert.equal((driverArea.match(/Prossimamente/g) || []).length, 1)
  assert.doesNotMatch(driverArea, /href=|\.pdf/)
})

test('Area Driver has responsive grids and active document CTAs', () => {
  assert.doesNotMatch(driverArea, /<button type="button" disabled/)
  assert.match(driverArea, /'\/area-driver\/normativa'/)
  assert.match(styles, /\.driver-area__grid \{[^}]*repeat\(3,/s)
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.driver-area__grid[^}]*repeat\(2,/)
  assert.match(styles, /@media \(max-width: 620px\)[\s\S]*\.driver-area__grid[^}]*grid-template-columns: 1fr/)
})
