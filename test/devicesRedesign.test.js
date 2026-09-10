import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('device management presents real license KPIs, responsive table and visible sidebar account', async () => {
  const [page, styles, devicesStyles] = await Promise.all([
    readFile(new URL('../company/src/pages/DevicesPage.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../company/src/styles.css', import.meta.url), 'utf8'),
    readFile(new URL('../company/src/pages/devices.css', import.meta.url), 'utf8'),
  ])
  assert.match(page, /devices-kpis/)
  assert.match(page, /Dispositivi registrati/)
  assert.match(page, /Dispositivi attivi/)
  assert.match(page, /Slot totali/)
  assert.match(page, /devices-table/)
  assert.match(page, /Attiva nuovo dispositivo/)
  assert.match(page, /summary\?\.available/)
  assert.match(styles, /opacity: 1; visibility: visible/)
  assert.match(styles, /href\$="\/account"/)
  assert.match(devicesStyles, /@media\(max-width:640px\)/)
})
