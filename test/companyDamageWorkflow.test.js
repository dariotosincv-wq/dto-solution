import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { updateDamageOptimistically } from '../company/src/lib/damageMapState.js'

test('PENDING move conserva damage_id e fa rollback', async () => { const damage={damage_id:'d1',normalized_x:.1,normalized_y:.2},states=[]; await updateDamageOptimistically({items:[damage],damage,changes:{normalized_x:.8,normalized_y:.7},setItems:(v)=>states.push(typeof v==='function'?v(states.at(-1)):v),request:async(v)=>v}); assert.equal(states.at(-1)[0].damage_id,'d1'); assert.equal(states.at(-1).length,1) })
test('change type sostituisce il simbolo sullo stesso damage', async () => { const damage={damage_id:'d1',damage_type:'SCRATCH'},states=[]; await updateDamageOptimistically({items:[damage],damage,changes:{damage_type:'DENT'},setItems:(v)=>states.push(typeof v==='function'?v(states.at(-1)):v),request:async(v)=>v}); assert.deepEqual(states.at(-1),[{damage_id:'d1',damage_type:'DENT'}]) })
test('UI separa move da create e storico esclude PENDING', async () => { const page=await readFile(new URL('../company/src/pages/VehicleDetailPage.jsx',import.meta.url),'utf8'); assert.match(page,/movingRef\.current/); assert.match(page,/onAdd=\{positionDamage\}/); assert.match(page,/\["CONFIRMED", "REPAIRED"\]/); assert.match(page,/Annulla segnalazione/) })
test('nuovo danno richiede foto e consente retry senza marker orfano visibile', async () => { const page=await readFile(new URL('../company/src/pages/VehicleDetailPage.jsx',import.meta.url),'utf8'); assert.match(page,/disabled=\{!draftPhoto \|\| savingDraft\}/); assert.match(page,/Puoi riprovare/); assert.doesNotMatch(page,/addOptimisticDamage/) })
test('manager create-upload-finalize usa client id e stesso damage id', async () => { const client=await readFile(new URL('../company/src/lib/companySupabase.js',import.meta.url),'utf8'); assert.match(client,/action: 'CREATE'/); assert.match(client,/signedUploadUrl/); assert.match(client,/action: 'FINALIZE', damage_id: created\.damage\.damage_id/) })
test('annulla PENDING pulisce la foto dopo audit REMOVED', async () => { const api=await readFile(new URL('../api/platform.js',import.meta.url),'utf8'); assert.match(api,/previous\?\.data\?\.status === 'PENDING'/); assert.match(api,/storage\.from\(previous\.data\.photo_bucket\)\.remove/) })
test('foto manager è visualizzata in overlay', async () => { const page=await readFile(new URL('../company/src/pages/VehicleDetailPage.jsx',import.meta.url),'utf8'); assert.match(page,/setPhotoModal\(/); assert.match(page,/alt="Foto del danno"/) })
test('RPC finalize è company scoped e non pubblica', async () => { const sql=await readFile(new URL('../supabase/migrations/20260824185913_admin_damage_photo_workflow.sql',import.meta.url),'utf8'); assert.match(sql,/organization_id=p_organization_id/); assert.match(sql,/revoke all .* from public,anon,authenticated/s) })

test('mobile espone camera e picker come input distinti', async () => {
  const page=await readFile(new URL('../company/src/pages/VehicleDetailPage.jsx',import.meta.url),'utf8')
  assert.match(page,/cameraInputRef\.current\?\.click\(\)[^>]*>Scatta foto/)
  assert.match(page,/pickerInputRef\.current\?\.click\(\)[^>]*>Scegli foto/)
  assert.match(page,/ref=\{cameraInputRef\}[\s\S]*?capture="environment"/)
  const picker=page.match(/<input ref=\{pickerInputRef\}[\s\S]*?\/>/)?.[0] || ''
  assert.doesNotMatch(picker,/capture=/)
})

test('foto selezionata mantiene una preview stabile con cleanup del blob URL', async () => {
  const page=await readFile(new URL('../company/src/pages/VehicleDetailPage.jsx',import.meta.url),'utf8')
  assert.match(page,/URL\.createObjectURL\(draftPhoto\)/)
  assert.match(page,/URL\.revokeObjectURL\(url\)/)
  assert.match(page,/Foto selezionata/)
  assert.match(page,/src=\{draftPhotoUrl\}/)
})

test('refresh auth della stessa identità non smonta il draft foto', async () => {
  const auth=await readFile(new URL('../company/src/auth/AuthContext.jsx',import.meta.url),'utf8')
  assert.match(auth,/sameIdentity[\s\S]*sessionRef\.current[\s\S]*if \(sameIdentity\) return/)
  assert.match(auth,/accessRef\.current = context/)
})

test('draft conserva tipo coordinate e client id fino a salva o annulla', async () => {
  const page=await readFile(new URL('../company/src/pages/VehicleDetailPage.jsx',import.meta.url),'utf8')
  assert.match(page,/setDraft\(\{ vehicle_id: vehicleId, damage_type: activeTool, vehicle_view: view, normalized_x: x, normalized_y: y, clientId: crypto\.randomUUID\(\), key \}\)/)
  assert.match(page,/createCompanyDamageWithPhoto\(session\.access_token, draft, draftPhoto, draft\.clientId\)/)
  assert.match(page,/catch \{ setError\("Caricamento foto non riuscito\. Puoi riprovare\."\) \}[\s\S]*finally \{ setSavingDraft\(false\) \}/)
})
