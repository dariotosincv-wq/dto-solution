import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const migrationPath = fileURLToPath(new URL(
  '../supabase/migrations/20260831100816_harden_legacy_qr_and_integrity_access.sql',
  import.meta.url,
))
const migration = readFileSync(migrationPath, 'utf8').toLowerCase()

test('legacy company tables are deny-by-default without deleting data', () => {
  for (const table of ['aziende', 'dipendenti', 'turni']) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`))
    assert.match(migration, new RegExp(`revoke all privileges on table public\\.${table} from public, anon, authenticated`))
    assert.doesNotMatch(migration, new RegExp(`(?:drop|truncate) table public\\.${table}`))
  }
  assert.doesNotMatch(migration, /update\s+public\.aziende/)
  assert.doesNotMatch(migration, /delete\s+from\s+public\.aziende/)
})

test('QR Cloud cannot retain globally permissive anonymous policies', () => {
  assert.match(migration, /revoke all privileges on table public\.qr_locali from public, anon, authenticated/)
  assert.match(migration, /drop policy if exists qr_locali_anon_select_intermediate/)
  assert.match(migration, /drop policy if exists qr_locali_anon_insert_intermediate/)
  assert.match(migration, /drop policy if exists qr_locali_anon_update_intermediate/)
  assert.doesNotMatch(migration, /create policy[\s\S]*using\s*\(true\)/)
  assert.doesNotMatch(migration, /create policy[\s\S]*with check\s*\(true\)/)
})

test('unverified integrity registrations are no longer executable by client roles', () => {
  assert.match(migration, /revoke all on function public\.register_checkvan_device_key[\s\S]*from public, anon, authenticated/)
  assert.match(migration, /revoke all on function public\.register_checkvan_document_certification[\s\S]*from public, anon, authenticated/)
  assert.match(migration, /grant execute on function public\.verify_checkvan_document_hash\(text\) to anon/)
})
