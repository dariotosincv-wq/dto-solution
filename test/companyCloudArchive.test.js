import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const archive = read('api/_lib/cloudArchive.js')
const platform = read('api/platform.js')
const finalize = read('api/device-inspection-finalize.js')
const migration = read('supabase/migrations/20260912074101_company_google_drive_archive.sql')
const account = read('company/src/pages/AccountPage.jsx')
const env = read('.env.example')

test('archivio Google Drive mantiene token e tenant esclusivamente lato server', () => {
  assert.match(archive, /aes-256-gcm/)
  assert.match(archive, /state_hash/)
  assert.match(archive, /https:\/\/www\.googleapis\.com\/auth\/drive\.file/)
  assert.match(migration, /enable row level security/g)
  assert.match(migration, /revoke all on public\.checkvan_cloud_connections/)
  assert.doesNotMatch(account, /GOOGLE_DRIVE_CLIENT_SECRET|GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY/)
})

test('gateway consolidato copre OAuth, retry ed export senza una nuova function', () => {
  assert.match(platform, /resource === 'company-cloud'/)
  assert.match(platform, /action === 'OAUTH_START'/)
  assert.match(platform, /action === 'EXPORT'/)
  assert.match(platform, /action === 'RETRY'/)
  assert.match(finalize, /syncInspectionToGoogleDrive/)
})

test('la configurazione server-side documenta soltanto variabili non pubbliche', () => {
  assert.match(env, /^GOOGLE_DRIVE_CLIENT_ID=/m)
  assert.match(env, /^GOOGLE_DRIVE_CLIENT_SECRET=/m)
  assert.match(env, /^GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY=/m)
  assert.doesNotMatch(env, /^VITE_GOOGLE_DRIVE_/m)
})
