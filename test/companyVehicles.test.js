import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { damageInput, publicVehicle, requireCompanyAdmin, vehicleInput } from '../api/_lib/companyVehicles.js'
import { canManageVehicles } from '../company/src/access.js'
import { addOptimisticDamage, commitOptimisticDamage, damageClickKey, optimisticDamage, rollbackOptimisticDamage } from '../company/src/lib/damageMapState.js'
import { groupCompanyVehicles, sortCompanyVehicles, VEHICLE_CATEGORIES } from '../company/src/lib/vehicleSort.js'

test('vehicle catalog exposes the stable id and explicit silhouette snapshot fields', () => {
  assert.deepEqual(publicVehicle({ id: 'v1', internal_code: 'MEZZO-7', plate: 'AB123CD', silhouette_category: 'MEDIUM', status: 'active' }), {
    vehicle_id: 'v1', internal_code: 'MEZZO-7', plate: 'AB123CD', silhouette_category: 'MEDIUM', status: 'active', archived_at: null, created_at: undefined, updated_at: undefined,
  })
  assert.equal(vehicleInput({ internal_code: ' F7 ', plate: 'ab 123 cd', silhouette_category: 'SMALL' }).plate_normalized, 'AB123CD')
  assert.equal(vehicleInput({ internal_code: 'CITY-1', plate: 'ZA123BC', silhouette_category: 'EXTRA_SMALL' }).silhouette_category, 'EXTRA_SMALL')
  assert.throws(() => vehicleInput({ internal_code: 'F7', plate: 'AB123CD', silhouette_category: 'F7' }), /INVALID_VEHICLE/)
})

test('damage coordinates and types fail closed', () => {
  assert.deepEqual(damageInput({ damage_type: 'SCRATCH', vehicle_view: 'RIGHT', normalized_x: 0.25, normalized_y: 1 }), { damage_type: 'SCRATCH', vehicle_view: 'RIGHT', x: 0.25, y: 1 })
  assert.throws(() => damageInput({ damage_type: 'DENT', vehicle_view: 'TOP', normalized_x: 0.5, normalized_y: 0.5 }), /INVALID_DAMAGE/)
  assert.throws(() => damageInput({ damage_type: 'DENT', vehicle_view: 'FRONT', normalized_x: -0.1, normalized_y: 0.5 }), /INVALID_DAMAGE/)
})

test('vehicle administration is restricted to company administrators', () => {
  assert.doesNotThrow(() => requireCompanyAdmin({ membership: { role: 'COMPANY_ADMIN' }, organization: { id: 'org' } }))
  assert.throws(() => requireCompanyAdmin({ membership: { role: 'UNION_GUEST' }, organization: null }), /COMPANY_ADMIN_REQUIRED/)
})

test('company access response enables vehicle routes only for an entitled COMPANY_ADMIN', () => {
  assert.equal(canManageVehicles({ role: 'COMPANY_ADMIN', capabilities: { useTools: true } }), true)
  assert.equal(canManageVehicles({ role: 'COMPANY_ADMIN', capabilities: { useTools: false } }), false)
  assert.equal(canManageVehicles({ role: 'COMPANY_OPERATOR', capabilities: { useTools: true } }), false)
  assert.equal(canManageVehicles({ role: 'UNION_GUEST', capabilities: { useTools: true } }), false)
})

test('incremental migration is organization-scoped, append-only and server-only', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260823090258_add_checkvan_vehicles_and_damage_history.sql', import.meta.url), 'utf8')
  assert.match(sql, /organization_id=p_organization_id/g)
  assert.match(sql, /reported_by_device_id=p_device_id/)
  assert.match(sql, /old_d\.status<>'PENDING'/)
  assert.match(sql, /insert into public\.checkvan_vehicle_damage_events/g)
  assert.match(sql, /revoke all .* from public,anon,authenticated/is)
  assert.match(sql, /grant execute .* to service_role/is)
  assert.doesNotMatch(sql, /delete\s+from\s+public\.checkvan_vehicle_damage_events/i)
  assert.doesNotMatch(sql, /update\s+public\.checkvan_founder_entitlements/i)
  assert.doesNotMatch(sql, /insert\s+into\s+public\.checkvan_(organizations|licenses|founder_entitlements|area_memberships)/i)
})

test('four silhouette categories map to the definitive PNG assets', async () => {
  const map = await readFile(new URL('../company/src/components/DamageMap.jsx', import.meta.url), 'utf8')
  assert.match(map, /replaceAll\("_", "-"\)/)
  assert.match(map, /\.png/)
  assert.doesNotMatch(map, /vehicle-silhouettes.*\.svg/)
})

test('damage markers render only an inner X or O with an invisible larger hit area', async () => {
  const [map, css] = await Promise.all([
    readFile(new URL('../company/src/components/DamageMap.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../company/src/styles.css', import.meta.url), 'utf8'),
  ])
  assert.match(map, /damage-symbol--\$\{d\.damage_type\.toLowerCase\(\)\}/)
  assert.match(map, /d\.damage_type === "SCRATCH" \? "×" : ""/)
  assert.match(css, /\.damage-marker\{width:2\.75rem;height:2\.75rem;[^}]*border:0;[^}]*background:transparent/)
  assert.match(css, /\.damage-symbol--dent\{[^}]*border:\.25rem solid currentColor;[^}]*border-radius:50%/)
})

test('optimistic marker commits or rolls back without duplicates', () => {
  const pending = optimisticDamage({ vehicleId: 'v1', damageType: 'SCRATCH', vehicleView: 'FRONT', x: 0.25, y: 0.5, clientId: 'one' })
  const displayed = addOptimisticDamage([], pending)
  assert.equal(displayed[0].saving, true)
  assert.equal(commitOptimisticDamage(displayed, pending.damage_id, { damage_id: 'saved', status: 'CONFIRMED' })[0].damage_id, 'saved')
  assert.deepEqual(rollbackOptimisticDamage(displayed, pending.damage_id), [])
  assert.equal(damageClickKey('FRONT', 'SCRATCH', 0.25, 0.5), damageClickKey('FRONT', 'SCRATCH', 0.25, 0.5))
})

test('photo-gated insertion guards duplicate clicks and exposes retry before marker commit', async () => {
  const detail = await readFile(new URL('../company/src/pages/VehicleDetailPage.jsx', import.meta.url), 'utf8')
  assert.match(detail, /reserveDamageClick\(pendingAdds\.current, key\)/)
  assert.match(detail, /setDraft\(/)
  assert.match(detail, /Puoi riprovare/)
})

test('inactive vehicles stay visible to admin while device catalog stays active-only', async () => {
  const [admin, device, platform, detail] = await Promise.all([
    readFile(new URL('../api/company-vehicles.js', import.meta.url), 'utf8'),
    readFile(new URL('../api/device-vehicles.js', import.meta.url), 'utf8'),
    readFile(new URL('../api/platform.js', import.meta.url), 'utf8'),
    readFile(new URL('../company/src/pages/VehicleDetailPage.jsx', import.meta.url), 'utf8'),
  ])
  assert.doesNotMatch(admin, /\.eq\('status','active'\)/)
  assert.match(device, /\.eq\('status','active'\)/)
  assert.match(platform, /deviceVehicles[\s\S]*?\.eq\('status', 'active'\)/)
  assert.match(detail, /Veicolo disattivato/)
  assert.match(detail, /disabled=\{vehicle\.status !== "active"\}/)
})

test('marker editor validates pending reports and protects confirmed damage', async () => {
  const detail = await readFile(new URL('../company/src/pages/VehicleDetailPage.jsx', import.meta.url), 'utf8')
  assert.match(detail, />Sposta</)
  assert.match(detail, /Cambia tipo/)
  assert.match(detail, /Approva/)
  assert.match(detail, /Rifiuta/)
  assert.match(detail, /Vedi foto/)
  assert.match(detail, /\? "Annulla segnalazione" : "Elimina"/)
  assert.match(detail, /Segna come riparato/)
  assert.match(detail, /action: "REJECT"/)
  assert.match(detail, /action: "APPROVE"/)
  assert.match(detail, /action: "REMOVE"/)
  assert.match(detail, /action: "REPAIR"/)
  assert.match(detail, /REMOVED: "Rimosso"/)
  assert.match(detail, /REPAIRED: "Riparato"/)
})

test('confirmed and repaired damage can be removed from the operational view while audit stays append-only', async () => {
  const [detail, map, sql] = await Promise.all([
    readFile(new URL('../company/src/pages/VehicleDetailPage.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../company/src/components/DamageMap.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/migrations/20260824183501_allow_admin_remove_pending_damage.sql', import.meta.url), 'utf8'),
  ])
  assert.match(sql, /p_action='REMOVE'.*old_d\.status in \('PENDING','CONFIRMED','REPAIRED'\).*next_status:='REMOVED'.*event_name:='REMOVED'/s)
  assert.match(sql, /insert into public\.checkvan_vehicle_damage_events/)
  assert.doesNotMatch(sql, /delete\s+from/i)
  assert.match(detail, /\["CONFIRMED", "REPAIRED"\]\.includes\(d\.status\)/)
  assert.match(detail, /Eliminare questo danno dalla mappa operativa/)
  assert.match(map, /\["PENDING", "CONFIRMED"\]\.includes\(d\.status\)/)
})

test('compact vehicle list uses category priority and natural code ordering', async () => {
  const vehicles = [
    { silhouette_category: 'SMALL', internal_code: 'S1' },
    { silhouette_category: 'LARGE', internal_code: 'L10' },
    { silhouette_category: 'EXTRA_SMALL', internal_code: 'XS1' },
    { silhouette_category: 'LARGE', internal_code: 'L2' },
    { silhouette_category: 'MEDIUM', internal_code: 'M1' },
    { silhouette_category: 'LARGE', internal_code: 'L1' },
  ]
  assert.deepEqual(sortCompanyVehicles(vehicles).map((item) => item.internal_code), ['L1', 'L2', 'L10', 'M1', 'S1', 'XS1'])
  const page = await readFile(new URL('../company/src/pages/VehiclesPage.jsx', import.meta.url), 'utf8')
  assert.deepEqual(VEHICLE_CATEGORIES, ['LARGE', 'MEDIUM', 'SMALL', 'EXTRA_SMALL'])
  const groups = groupCompanyVehicles(vehicles)
  assert.deepEqual(groups.map((group) => group.category), VEHICLE_CATEGORIES)
  assert.deepEqual(groups[0].items.map((item) => item.internal_code), ['L1', 'L2', 'L10'])
  assert.equal(groups.flatMap((group) => group.items).length, vehicles.length)
  assert.match(page, /className="vehicle-categories"/)
  assert.match(page, /className="vehicle-category"/)
  assert.match(page, /className="vehicle-list"/)
  assert.match(page, /className="vehicle-row"/)
  assert.match(page, /to=\{COMPANY_ROUTES\.vehicle\((?:v|vehicle)\.vehicle_id\)\}/)
  assert.match(page, /<strong>\{(?:v|vehicle)\.internal_code\}<\/strong>/)
  assert.match(page, /vehicle-row__plate">\{(?:v|vehicle)\.plate\}/)
  assert.doesNotMatch(page, /\{v\.silhouette_category\} · \{v\.status\}/)
})

test('vehicle category layout has four desktop columns, two tablet columns and one mobile column', async () => {
  const css = await readFile(new URL('../company/src/styles.css', import.meta.url), 'utf8')
  assert.match(css, /\.vehicle-categories\{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/)
  assert.match(css, /@media\(max-width:70rem\)\{\.vehicle-categories\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}\}/)
  assert.match(css, /@media\(max-width:48rem\)\{\.vehicle-categories\{grid-template-columns:1fr\}/)
})

test('REMOVED migration is incremental, append-only and distinct from REPAIRED', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260823110838_distinguish_removed_vehicle_damage.sql', import.meta.url), 'utf8')
  assert.match(sql, /p_action='REMOVE'.*next_status:='REMOVED'.*event_name:='REMOVED'/s)
  assert.match(sql, /p_action='REPAIR'.*next_status:='REPAIRED'.*event_name:='REPAIRED'/s)
  assert.match(sql, /removed_at=case when next_status='REMOVED'/)
  assert.match(sql, /insert into public\.checkvan_vehicle_damage_events/)
  assert.doesNotMatch(sql, /delete\s+from/i)
  assert.doesNotMatch(sql, /update\s+public\.checkvan_(founder_entitlements|licenses|organizations|area_memberships)/i)
  assert.match(sql, /revoke all .* from public,anon,authenticated/is)
  assert.match(sql, /grant execute .* to service_role/is)
})

test('repaired damage can be reopened with confirmation and an append-only event', async () => {
  const [detail, sql] = await Promise.all([
    readFile(new URL('../company/src/pages/VehicleDetailPage.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/migrations/20260823113445_add_repair_reverted_damage_event.sql', import.meta.url), 'utf8'),
  ])
  assert.match(detail, /d\.status === "REPAIRED"/)
  assert.match(detail, /window\.confirm\("Annullare la riparazione\?/) 
  assert.match(detail, /action: "REOPEN"/)
  assert.match(detail, /Annulla riparazione/)
  assert.match(sql, /p_action='REOPEN'.*old_d\.status='REPAIRED'.*next_status:='CONFIRMED'.*event_name:='REPAIR_REVERTED'/s)
  assert.match(sql, /repaired_at=case when next_status='REPAIRED' then now\(\) when event_name='REPAIR_REVERTED' then null/)
  assert.match(sql, /insert into public\.checkvan_vehicle_damage_events/)
  assert.doesNotMatch(sql, /delete\s+from/i)
})

test('vehicle activation control is visible once near the operational tools', async () => {
  const detail = await readFile(new URL('../company/src/pages/VehicleDetailPage.jsx', import.meta.url), 'utf8')
  assert.equal((detail.match(/className="vehicle-disable"/g) ?? []).length, 1)
  assert.equal((detail.match(/Disattiva veicolo/g) ?? []).length, 1)
  assert.equal((detail.match(/Riattiva veicolo/g) ?? []).length, 1)
  assert.ok(detail.indexOf('className="vehicle-controls"') < detail.indexOf('className="damage-tools"'))
  assert.ok(detail.indexOf('className="vehicle-disable"') < detail.indexOf('<DamageMap'))
})

test('incremental silhouette migration only widens the existing check constraint', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260823095604_add_extra_small_vehicle_silhouette.sql', import.meta.url), 'utf8')
  assert.match(sql, /EXTRA_SMALL.*SMALL.*MEDIUM.*LARGE/s)
  assert.match(sql, /validate constraint checkvan_vehicles_silhouette_category_check/i)
  assert.doesNotMatch(sql, /\b(insert|update|delete)\b/i)
})
