import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  addOptimisticDamage,
  damageClickKey,
  optimisticDamage,
  removeOperationalDamage,
  reserveDamageClick,
  restoreOperationalDamage,
  selectDamageTool,
} from '../company/src/lib/damageMapState.js'
import { toggleVehicleStatusOptimistically } from '../company/src/lib/vehicleStatusState.js'

const damage = (status) => ({ damage_id: `damage-${status}`, status, damage_type: 'SCRATCH', vehicle_view: 'FRONT' })

for (const status of ['PENDING', 'CONFIRMED', 'REPAIRED']) {
  test(`manager elimina ${status}: sparisce subito e il rollback lo ripristina`, () => {
    const item = damage(status)
    assert.deepEqual(removeOperationalDamage([item], item.damage_id), [])
    assert.deepEqual(restoreOperationalDamage([], item), [item])
  })
}

test('REMOVE usa REMOVED e conserva audit append-only senza DELETE fisico', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260824183501_allow_admin_remove_pending_damage.sql', import.meta.url), 'utf8')
  assert.match(sql, /p_action='REMOVE'.*old_d\.status in \('PENDING','CONFIRMED','REPAIRED'\).*next_status:='REMOVED'.*event_name:='REMOVED'/s)
  assert.match(sql, /insert into public\.checkvan_vehicle_damage_events/)
  assert.doesNotMatch(sql, /delete\s+from/i)
})

test('Attiva/Disattiva aggiorna subito UI e conferma la risposta backend', async () => {
  const vehicle = { vehicle_id: 'v1', status: 'active' }, states = [], updating = []
  let resolveRequest
  const pending = toggleVehicleStatusOptimistically({
    vehicle,
    setVehicle: (value) => states.push(value),
    setUpdating: (value) => updating.push(value),
    setError: () => {},
    request: () => new Promise((resolve) => { resolveRequest = resolve }),
  })
  assert.equal(states[0].status, 'inactive')
  assert.deepEqual(updating, [true])
  resolveRequest({ ...vehicle, status: 'inactive' })
  assert.equal(await pending, true)
  assert.deepEqual(updating, [true, false])
})

test('failure backend ripristina lo stato veicolo precedente', async () => {
  const vehicle = { vehicle_id: 'v1', status: 'active' }, states = [], errors = []
  const result = await toggleVehicleStatusOptimistically({
    vehicle,
    setVehicle: (value) => states.push(value),
    setUpdating: () => {},
    setError: (value) => errors.push(value),
    request: async () => { throw new Error('backend') },
  })
  assert.equal(result, false)
  assert.equal(states[0].status, 'inactive')
  assert.equal(states.at(-1).status, 'active')
  assert.equal(errors.at(-1), 'Aggiornamento stato veicolo non riuscito.')
})

test('alternanza SCRATCH/DENT rende il tool sincrono già al primo click', () => {
  const toolRef = { current: 'SCRATCH' }, rendered = []
  const sequence = ['SCRATCH', 'DENT', 'SCRATCH', 'DENT', 'SCRATCH', 'DENT']
  const markers = sequence.map((next, index) => {
    selectDamageTool(toolRef, (value) => rendered.push(value), next)
    return optimisticDamage({ vehicleId: 'v1', damageType: toolRef.current, vehicleView: 'FRONT', x: index / 10, y: 0.5, clientId: String(index) })
  })
  assert.deepEqual(markers.map((item) => item.damage_type), sequence)
  assert.deepEqual(rendered, sequence)
})

test('un singolo click riservato non produce un secondo marker', () => {
  const pending = new Set(), key = damageClickKey('FRONT', 'SCRATCH', 0.25, 0.5)
  let items = []
  if (reserveDamageClick(pending, key)) items = addOptimisticDamage(items, damage('PENDING'))
  if (reserveDamageClick(pending, key)) items = addOptimisticDamage(items, damage('PENDING'))
  assert.equal(items.length, 1)
})
