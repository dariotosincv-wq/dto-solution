import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { authenticateSuperAdmin, authenticateSuperAdminIdentity, enforceRateLimit, redactDevice, safeQuery, syncHealth } from '../api/_lib/superAdmin.js'

function clients(admin, user = { id: '11111111-1111-1111-1111-111111111111' }, aal = 'aal2') {
  return {
    dto: { auth: { getUser: async () => ({ data: { user }, error: null }), mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: aal }, error: null }) } } },
    checkvan: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: admin, error: null }) }) }) }) },
  }
}

const request = { headers: { authorization: 'Bearer valid', 'x-forwarded-for': '198.51.100.4' } }
test('active Super Admin is authorized server-side', async () => assert.equal((await authenticateSuperAdmin(request, clients({ status: 'active', display_name: 'Owner', require_mfa: false }))).displayName, 'Owner'))
test('missing session is denied before the role lookup', async () => await assert.rejects(authenticateSuperAdmin({ headers: {} }, clients(null)), (error) => error.status === 401))
test('normal company users and disabled admins receive 403', async () => {
  await assert.rejects(authenticateSuperAdmin(request, clients(null)), (error) => error.status === 403)
  await assert.rejects(authenticateSuperAdmin(request, clients({ status: 'disabled', require_mfa: false })), (error) => error.status === 403)
})
test('MFA-required admin must present aal2', async () => await assert.rejects(authenticateSuperAdmin(request, clients({ status: 'active', require_mfa: true }, undefined, 'aal1')), /MFA_REQUIRED/))
test('active pre-MFA Super Admin identity is recognized without weakening full authorization', async () => {
  const value = await authenticateSuperAdminIdentity(request, clients({ status: 'active', display_name: 'Owner', require_mfa: true }, undefined, 'aal1'))
  assert.equal(value.mfaRequired, true)
  await assert.rejects(authenticateSuperAdmin(request, clients({ status: 'active', require_mfa: true }, undefined, 'aal1')), (error) => error.status === 403 && error.message === 'MFA_REQUIRED')
})
test('non Super Admin receives structured NOT_AUTHORIZED and cannot enter pre-MFA', async () => await assert.rejects(authenticateSuperAdminIdentity(request, clients(null)), (error) => error.status === 403 && error.message === 'NOT_AUTHORIZED'))
test('MFA-required admin with aal2 is authorized', async () => assert.equal((await authenticateSuperAdmin(request, clients({ status: 'active', display_name: 'Owner', require_mfa: true }, undefined, 'aal2'))).mfaRequired, true))
test('query validation rejects IDOR-shaped organization identifiers and clamps limits', () => { const value = safeQuery({ organizationId: "x' or true", limit: 9999, search: 'a'.repeat(100) }); assert.equal(value.organizationId, null); assert.equal(value.limit, 100); assert.equal(value.search.length, 80) })
test('sync health distinguishes normal retry, stale upload and permanent error', () => { const now = Date.parse('2026-08-25T12:00:00Z'); assert.equal(syncHealth({ upload_status:'uploading',upload_started_at:'2026-08-25T11:55:00Z' },now).level,'warning'); assert.equal(syncHealth({ upload_status:'uploading',upload_started_at:'2026-08-25T10:00:00Z' },now).level,'error'); assert.equal(syncHealth({ upload_status:'failed',created_at:'2026-08-25T11:59:00Z' },now).level,'error') })
test('available is synced while recent pending remains informational', () => { const now=Date.parse('2026-08-25T12:00:00Z'); assert.deepEqual(syncHealth({upload_status:'available'},now),{level:'ok',label:'Sincronizzata'}); assert.deepEqual(syncHealth({upload_status:'pending',created_at:'2026-08-25T11:59:00Z'},now),{level:'warning',label:'In attesa dispositivo online'}) })
test('device serialization excludes key material and secrets', () => { const value = redactDevice({ id:'abcdef12-rest', status:'active', public_key_spki_base64:'secret', key_id:'secret' }); assert.equal(JSON.stringify(value).includes('secret'),false); assert.equal(value.label,'Device abcdef12') })
test('rate limiter blocks repeated abuse', () => { const req={headers:{'x-forwarded-for':'203.0.113.77'}}; for(let i=0;i<90;i++) enforceRateLimit(req,1); assert.throws(()=>enforceRateLimit(req,1),/RATE_LIMITED/) })
test('admin surface is unlinked, noindex and service role stays server-only', async () => {
  const [html, app, lib, vercel, migration] = await Promise.all([
    readFile(new URL('../admin/index.html', import.meta.url),'utf8'), readFile(new URL('../admin/src/App.jsx', import.meta.url),'utf8'), readFile(new URL('../admin/src/lib.js', import.meta.url),'utf8'), readFile(new URL('../vercel.json', import.meta.url),'utf8'), readFile(new URL('../supabase/migrations/20260825210000_add_dto_super_admins.sql', import.meta.url),'utf8')])
  assert.match(html,/noindex,nofollow/); assert.doesNotMatch(app+lib,/SERVICE_ROLE|service_role/); assert.match(vercel,/X-Robots-Tag/); assert.match(migration,/enable row level security/i); assert.match(migration,/revoke all.*anon, authenticated/i)
})
test('migration is isolated, one-time, unique and service-role only', async () => { const sql=await readFile(new URL('../supabase/migrations/20260825210000_add_dto_super_admins.sql',import.meta.url),'utf8'); assert.match(sql,/auth_subject uuid primary key/i); assert.match(sql,/status.*check.*active.*disabled/i); assert.match(sql,/require_mfa boolean not null default false/i); assert.match(sql,/created_at timestamptz not null default now\(\)/i); assert.match(sql,/updated_at timestamptz not null default now\(\)/i); assert.match(sql,/enable row level security/i); assert.match(sql,/revoke all.*public, anon, authenticated/i); assert.match(sql,/grant select, insert, update, delete.*service_role/i); assert.doesNotMatch(sql,/alter table public\.checkvan_|drop table|truncate|delete from/i) })
test('public and company navigation do not advertise the Super Admin route', async () => { const files=await Promise.all(['../src/components/layout/Header.jsx','../src/App.jsx','../company/src/components/AppShell.jsx','../company/src/App.jsx'].map(path=>readFile(new URL(path,import.meta.url),'utf8'))); assert.doesNotMatch(files.join('\n'),/super-admin/i) })
test('mutating endpoint requires server authorization and writes audit', async () => { const source=await readFile(new URL('../api/_lib/superAdminHandler.js',import.meta.url),'utf8'); assert.match(source,/authenticateSuperAdmin/); assert.match(source,/auditAdmin/); assert.match(source,/\.eq\('organization_id', organizationId\)/); assert.doesNotMatch(source,/signedUrl|token_digest|public_key_spki_base64/) })
test('license editor confirms, validates, reports errors and refreshes after save', async () => { const [app,lib]=await Promise.all([readFile(new URL('../admin/src/App.jsx',import.meta.url),'utf8'),readFile(new URL('../admin/src/lib.js',import.meta.url),'utf8')]); assert.match(app,/function LicenseEditor/); assert.match(app,/confirm\(/); assert.match(app,/numericCapacity/); assert.match(lib,/Operazione non riuscita/); assert.match(lib,/location\.reload/) })
