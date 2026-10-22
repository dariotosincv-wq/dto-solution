import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const migrationUrl = new URL('../supabase/migrations/20261022131500_company_device_assignment_revocation.sql', import.meta.url)
const devicesUrl = new URL('../api/company-devices.js', import.meta.url)
const platformUrl = new URL('../api/platform.js', import.meta.url)
const vercelUrl = new URL('../vercel.json', import.meta.url)
const pageUrl = new URL('../company/src/pages/DevicesPage.jsx', import.meta.url)

test('company device revocation keeps device identity reusable but removes its company binding', async () => {
  const sql = await readFile(migrationUrl, 'utf8')
  assert.match(sql, /drop constraint if exists checkvan_device_assignments_license_id_device_id_key/)
  assert.match(sql, /checkvan_one_active_assignment_per_device[\s\S]*where status = 'active'/)
  assert.match(sql, /internal_admin_revoke_company_device\(\s*p_auth_subject uuid,\s*p_organization_id uuid,\s*p_device_id uuid/s)
  assert.match(sql, /membership\.role = 'COMPANY_ADMIN'/)
  assert.match(sql, /license\.organization_id = p_organization_id/)
  assert.match(sql, /set status = 'revoked', released_at = now\(\)/)
  assert.match(sql, /checkvan_device_driver_sessions/)
  assert.match(sql, /checkvan_device_push_registrations/)
  assert.match(sql, /company_device_revoked/)
  assert.doesNotMatch(sql, /update public\.checkvan_license_devices\s+set status = 'revoked'/i)
  assert.match(sql, /revoke all on function public\.internal_admin_revoke_company_device[\s\S]*from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.internal_admin_revoke_company_device[\s\S]*to service_role/)
})

test('company device endpoint is admin-scoped and routed through the existing gateway', async () => {
  const [endpoint, platform, config] = await Promise.all([readFile(devicesUrl, 'utf8'), readFile(platformUrl, 'utf8'), readFile(vercelUrl, 'utf8')])
  assert.match(endpoint, /\['GET', 'PATCH'\]/)
  assert.match(endpoint, /context\.capabilities\.manageDevices/)
  assert.match(endpoint, /internal_admin_revoke_company_device/)
  assert.match(endpoint, /p_organization_id: context\.organization\.id/)
  assert.match(platform, /resource === 'company-devices'/)
  assert.match(config, /"source": "\/api\/company-devices", "destination": "\/api\/platform\?resource=company-devices"/)
})

test('company UI requires explicit confirmation and never offers client-side company logout', async () => {
  const page = await readFile(pageUrl, 'utf8')
  assert.match(page, /Confermi la revoca di questo dispositivo dall’azienda\?/) 
  assert.match(page, /Il dispositivo non potrà più usare i servizi aziendali/) 
  assert.match(page, /Annulla/) 
  assert.match(page, /Revoca dispositivo/) 
  assert.match(page, /revokeCompanyDevice/) 
  assert.doesNotMatch(page, /logout company|cambia azienda|scollega dispositivo/i)
})
