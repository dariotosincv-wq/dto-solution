import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('Account is part of the normal company navigation immediately after Devices', async () => {
  const source = await readFile(new URL('../company/src/components/AppShell.jsx', import.meta.url), 'utf8')
  const devices = source.indexOf('COMPANY_ROUTES.devices')
  const account = source.indexOf('COMPANY_ROUTES.account', devices)
  assert.ok(devices > -1 && account > devices)
  assert.match(source.slice(devices, account + 60), /<NavLink to=\{COMPANY_ROUTES\.account\}>Account<\/NavLink>/)
})

test('sidebar preserves its dark logout area and scrolls its navigation when needed', async () => {
  const source = await readFile(new URL('../company/src/styles.css', import.meta.url), 'utf8')
  assert.match(source, /\.company-sidebar \{[^}]*overflow: hidden/s)
  assert.match(source, /\.company-sidebar nav \{[^}]*overflow-y: auto/s)
  assert.match(source, /\.company-sidebar > button \{[^}]*border-top: 1px solid #344054/s)
  assert.doesNotMatch(source, /nav a\[href\$="\/account"\]/)
})
