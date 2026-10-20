import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('departure queue uses one continuous global order and server-side timeout processing', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20261016220442_operational_departure_queue.sql', import.meta.url), 'utf8')
  assert.match(sql, /unique \(organization_id, operating_date\)/)
  assert.match(sql, /unique \(queue_id, departure_order\)/)
  assert.match(sql, /order by departure_order/)
  assert.match(sql, /departure_wave integer/)
  assert.match(sql, /internal_process_operational_departure_timeouts/)
  assert.match(sql, /status='timed_out'/)
  assert.match(sql, /status='called'/)
  assert.match(sql, /status='departed'/)
  assert.doesNotMatch(sql, /partition by departure_wave/i)
})

test('API exposes driver-scoped confirmation and company-admin start only', async () => {
  const [platform, days] = await Promise.all([
    readFile(new URL('../api/platform.js', import.meta.url), 'utf8'),
    readFile(new URL('../api/_lib/operationalDays.js', import.meta.url), 'utf8'),
  ])
  assert.match(platform, /action === 'departure-confirm'/)
  assert.match(platform, /session\.driver_id/)
  assert.match(platform, /p_origin: 'driver_web'/)
  assert.match(platform, /operational-departure-queue/)
  assert.match(days, /internal_admin_start_operational_departure_queue/)
})

test('global Cron controller is fixed, internal, and supports final recovery', async () => {
  const [finalTimeout, cron] = await Promise.all([
    readFile(new URL('../supabase/migrations/20261016223943_operational_departure_queue_final_timeout.sql', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/migrations/20261016223944_operational_departure_cron_controller.sql', import.meta.url), 'utf8'),
  ])
  assert.match(finalTimeout, /final_timeout_at timestamptz/)
  assert.match(finalTimeout, /interval '10 minutes'/)
  assert.match(finalTimeout, /final_item\.status='departed'/)
  assert.match(cron, /'5 seconds'/)
  assert.match(cron, /checkvan-operational-departure-timeouts/)
  assert.match(cron, /pg_advisory_xact_lock/)
  assert.match(cron, /OPERATIONAL_DEPARTURE_CRON_UNAVAILABLE/)
  assert.match(cron, /revoke all on function public\.internal_refresh_operational_departure_cron\(\) from public, anon, authenticated/)
  assert.doesNotMatch(cron, /p_organization_id.*cron\.schedule/is)
})
