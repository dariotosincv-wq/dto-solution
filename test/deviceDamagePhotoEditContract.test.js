import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const api=readFileSync(new URL('../api/_lib/deviceVehicleDamages.js',import.meta.url),'utf8')
const migration=readFileSync(new URL('../supabase/migrations/20260824143000_allow_driver_pending_damage_photo_edits.sql',import.meta.url),'utf8')

test('replace foto usa lo stesso damage id e due fasi senza CREATE damage',()=>{
  assert.match(api,/PHOTO_REPLACE_CREATE/);assert.match(api,/PHOTO_REPLACE_FINALIZE/)
  assert.match(api,/p_damage_id:damage\.id/);assert.match(api,/damage\.photo_object_path===path/)
})
test('la vecchia foto viene rimossa solo dopo RPC riuscita',()=>{
  const rpc=api.indexOf("internal_device_set_pending_damage_photo"),remove=api.indexOf("remove([oldPath])",rpc)
  assert.ok(rpc>0);assert.ok(remove>rpc)
})
test('replace remove e update rifiutano confirmed lato business',()=>{
  assert.match(api,/damage\.status!=='PENDING'/)
  assert.match(migration,/if old_d\.status<>'PENDING' then raise exception[\s\S]*DAMAGE_NOT_EDITABLE/g)
  assert.match(migration,/reported_by_device_id=p_device_id/g)
})
test('remove foto preserva il damage e registra audit',()=>{
  assert.match(api,/PHOTO_REMOVE/);assert.match(api,/internal_device_remove_pending_damage_photo/)
  assert.match(migration,/photo_bucket=null[\s\S]*photo_upload_status='LEGACY'/)
  assert.match(migration,/checkvan_vehicle_damage_events/)
})
