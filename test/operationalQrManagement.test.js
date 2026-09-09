import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('QR management distinguishes an active QR from explicit regeneration', async () => {
  const [api, page] = await Promise.all([
    readFile(new URL('../api/platform.js', import.meta.url), 'utf8'),
    readFile(new URL('../company/src/pages/DriversPage.jsx', import.meta.url), 'utf8'),
  ])
  assert.match(api, /request\.body\?\.action !== 'REGENERATE'/)
  assert.match(api, /status: 'revoked', revoked_at/)
  assert.match(page, /QR attivo/)
  assert.match(page, /Rigenera QR/)
  assert.match(page, /window\.confirm\('Rigenerare il QR/)
  assert.match(page, /https:\/\/www\.dtosolution\.it/)
  assert.match(page, /function DriverQrDialog/)
  assert.match(page, /node\?\.showModal\(\)/)
  assert.match(page, /<DriverQrDialog qr=\{qr\}/)
  assert.doesNotMatch(api, /token_secret|token_ciphertext/)
})
