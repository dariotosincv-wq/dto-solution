import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const source = async (path) => readFile(new URL(path, root), 'utf8')

test('DSP departure page is routed, authorized and connected to queue API', async () => {
  const [routes, app, page, api] = await Promise.all([
    source('company/src/routes.js'), source('company/src/App.jsx'), source('company/src/pages/OperationalDeparturesPage.jsx'), source('company/src/lib/companySupabase.js'),
  ])
  assert.match(routes, /operationalDepartures/)
  assert.match(app, /giornata-operativa\/partenze/)
  assert.match(page, /canManageVehicles/)
  assert.match(page, /loadOperationalDepartureQueue/)
  assert.match(page, /startOperationalDepartureQueue/)
  assert.match(page, /setInterval\(.*3000/)
  assert.match(page, /departure_order/)
  assert.match(api, /operational-departure-queue/)
})

test('driver departure panel uses only the QR session endpoints and confirms its own departure', async () => {
  const [area, panel] = await Promise.all([source('src/pages/OperationalAreaPage.jsx'), source('src/pages/OperationalDeparturePanel.jsx')])
  assert.match(area, /OperationalDeparturePanel/)
  assert.match(panel, /action=departure-status/)
  assert.match(panel, /action=departure-confirm/)
  assert.match(panel, /credentials: 'same-origin'/)
  assert.match(panel, /È IL TUO TURNO/)
  assert.match(panel, /Parto ora/)
  assert.match(panel, /setInterval\(.*3000/)
})
