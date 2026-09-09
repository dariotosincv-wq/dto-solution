import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('QR management distinguishes an active QR from explicit regeneration', async () => {
  const [api, page, share] = await Promise.all([
    readFile(new URL('../api/platform.js', import.meta.url), 'utf8'),
    readFile(new URL('../company/src/pages/DriversPage.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../company/src/lib/driverQrShare.js', import.meta.url), 'utf8'),
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
  assert.match(page, /Condividi QR/)
  assert.match(page, /Scarica QR/)
  assert.match(page, /Copia link/)
  assert.match(share, /navigator\.share/)
  assert.match(share, /navigator\.canShare/)
  assert.match(share, /dto-solution-qr-driver\.png/)
  assert.match(share, /https:\/\/www\.dtosolution\.it/)
  assert.doesNotMatch(api, /token_secret|token_ciphertext/)
})
