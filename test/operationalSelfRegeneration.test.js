import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('self QR regeneration is atomic, revokes prior sessions, and audits no raw secret', async () => {
  const migration = await readFile(new URL('../supabase/migrations/20261016215253_driver_operational_qr_self_regeneration.sql', import.meta.url), 'utf8')
  assert.match(migration, /create table public\.checkvan_driver_access_events/)
  assert.match(migration, /pg_advisory_xact_lock/)
  assert.match(migration, /update public\.checkvan_driver_access_tokens set status='revoked'/)
  assert.match(migration, /update public\.checkvan_driver_access_sessions set expires_at=now\(\)/)
  assert.match(migration, /insert into public\.checkvan_driver_access_events/)
  assert.match(migration, /revoke all on function public\.internal_driver_regenerate_operational_qr\(text, text\) from public, anon, authenticated/)
  assert.doesNotMatch(migration, /token_secret|access_path|p_new_token_secret/i)
})

test('driver area creates the QR only in memory and handles cancelled native sharing', async () => {
  const page = await readFile(new URL('../src/pages/OperationalAreaPage.jsx', import.meta.url), 'utf8')
  assert.match(page, /operational-access\?action=regenerate/)
  assert.match(page, /setQr\(\{ image \}\)/)
  assert.match(page, /navigator\.share/)
  assert.match(page, /Condivisione annullata/)
  assert.match(page, /Rigenera il mio QR/)
  assert.match(page, /Salva QR/)
  assert.match(page, /download="dto-solution-qr-personale\.png"/)
  assert.match(page, /Invia via email/)
  assert.match(page, /Condividi/)
  assert.doesNotMatch(page, /localStorage|sessionStorage|indexedDB/)
})
