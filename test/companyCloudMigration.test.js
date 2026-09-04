import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(new URL('../supabase/migrations/20260822213000_add_company_cloud_incremental.sql', import.meta.url), 'utf8')
const rollback = readFileSync(new URL('../supabase/rollbacks/20260822213000_add_company_cloud_incremental.rollback.sql', import.meta.url), 'utf8')

test('incremental Company Cloud migration does not mutate legacy business rows', () => {
  for (const table of ['checkvan_organizations', 'checkvan_licenses', 'checkvan_founder_entitlements', 'checkvan_area_memberships', 'checkvan_license_audit']) {
    assert.doesNotMatch(migration, new RegExp(`(?:insert\\s+into|update|delete\\s+from)\\s+(?:public\\.)?${table}\\b`, 'i'))
  }
  assert.doesNotMatch(migration, /permanent_recovery/i)
  assert.doesNotMatch(migration, /create\s+(?:or\s+replace\s+)?(?:function|trigger)/i)
})

test('new cloud data stays private and service-role only', () => {
  assert.match(migration, /public\s+is\s+false/i)
  assert.match(migration, /revoke\s+all[\s\S]+from\s+public,\s*anon,\s*authenticated/i)
  assert.match(migration, /enable\s+row\s+level\s+security/gi)
  assert.doesNotMatch(migration, /grant[\s\S]{0,160}\b(?:anon|authenticated)\b/i)
})

test('rollback is guarded against loss of operational data', () => {
  assert.match(rollback, /Rollback refused: Company Cloud tables contain data/)
  assert.match(rollback, /Rollback refused: Company Cloud bucket contains objects/)
  assert.match(rollback, /Rollback refused: Company Cloud license attributes are in use/)
  assert.match(rollback, /Rollback refused: Company Cloud Founder attributes are in use/)
})
