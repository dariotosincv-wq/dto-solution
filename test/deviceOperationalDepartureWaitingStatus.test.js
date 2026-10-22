import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const migration = new URL('../supabase/migrations/20261022153000_device_operational_departure_waiting_status.sql', import.meta.url)

test('device waiting-status RPC returns an aggregate only and counts active predecessors', async () => {
  const sql = await readFile(migration, 'utf8')
  assert.match(sql, /create or replace function public\.internal_device_driver_departure_status/i)
  assert.match(sql, /preceding_item\.departure_order < queue_item\.departure_order/i)
  assert.match(sql, /preceding_item\.status in \('waiting', 'called'\)/i)
  assert.match(sql, /'queue_status', queue_row\.status/i)
  assert.match(sql, /'position', queue_item\.departure_order/i)
  assert.match(sql, /'drivers_ahead', ahead_count/i)
  assert.doesNotMatch(sql, /to_jsonb\(queue_item\)|to_jsonb\(confirmed_row\)/i)
})

test('device waiting-status RPC scopes both the queue and the confirmed pre-start row to the verified organization and driver', async () => {
  const sql = await readFile(migration, 'utf8')
  assert.match(sql, /item_value\.organization_id = p_organization_id/i)
  assert.match(sql, /item_value\.driver_id = p_driver_id/i)
  assert.match(sql, /row_value\.organization_id = p_organization_id/i)
  assert.match(sql, /row_value\.driver_id = p_driver_id/i)
  assert.match(sql, /day_value\.status = 'confirmed'/i)
})
