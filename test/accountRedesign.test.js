import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('account page presents authenticated company data in the redesigned account card', async () => {
  const source = await readFile(new URL('../company/src/pages/AccountPage.jsx', import.meta.url), 'utf8')
  assert.match(source, /session\?\.user\?\.email/)
  assert.match(source, /access\?\.role/)
  assert.match(source, /access\?\.organization\?\.name/)
  assert.match(source, /Le informazioni del tuo account aziendale/)
  assert.match(source, /className="account-card"/)
  assert.doesNotMatch(source, /Modifica dati/)
})

test('account layout includes a mobile-first responsive breakpoint and readable sidebar account state', async () => {
  const [styles, shellStyles] = await Promise.all([
    readFile(new URL('../company/src/pages/account.css', import.meta.url), 'utf8'),
    readFile(new URL('../company/src/styles.css', import.meta.url), 'utf8'),
  ])
  assert.match(styles, /@media \(max-width: 640px\)/)
  assert.match(shellStyles, /\.company-sidebar nav a\.active/)
  assert.match(shellStyles, /\.company-sidebar > button[^}]*color:/)
})
