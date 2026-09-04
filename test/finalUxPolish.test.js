import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const pageUrl = new URL('../company/src/pages/VehicleDetailPage.jsx', import.meta.url)
const fleetUrl = new URL('../company/src/pages/VehiclesPage.jsx', import.meta.url)
test('Vedi foto apre subito modal in loading', async()=>{const s=await readFile(pageUrl,'utf8');assert.match(s,/setPhotoModal\(\{ damageId: damage\.damage_id, status: "loading"/);assert.match(s,/Caricamento foto…/)})
test('X chiude modal con hit area dedicata', async()=>{const s=await readFile(pageUrl,'utf8');assert.match(s,/className="damage-photo-close"/);assert.match(s,/setPhotoModal\(null\)/)})
test('backdrop chiude e click interno non propaga', async()=>{const s=await readFile(pageUrl,'utf8');assert.match(s,/event\.target === event\.currentTarget/);assert.match(s,/event\.stopPropagation\(\)/)})
test('ESC chiude modal', async()=>{const s=await readFile(pageUrl,'utf8');assert.match(s,/event\.key === "Escape"/);assert.match(s,/removeEventListener\("keydown"/)})
test('errore foto mostra retry', async()=>{const s=await readFile(pageUrl,'utf8');assert.match(s,/Impossibile caricare la foto\. Riprova\./);assert.match(s,/>Riprova</)})
test('request e URL firmato sono deduplicati e a scadenza', async()=>{const s=await readFile(pageUrl,'utf8');assert.match(s,/photoRequests\.current\.get/);assert.match(s,/photoCache\.current\.get/);assert.match(s,/expiresAt > Date\.now\(\)/)})
test('file input CSV è nascosto ma pilotato dal pulsante', async()=>{const [p,css]=await Promise.all([readFile(fleetUrl,'utf8'),readFile(new URL('../company/src/styles.css',import.meta.url),'utf8')]);assert.match(p,/fileRef\.current\?\.click\(\)/);assert.match(p,/className="visually-hidden" type="file"/);assert.match(css,/\.visually-hidden\{position:absolute!important/)})
test('preview e import batch restano invariati', async()=>{const s=await readFile(fleetUrl,'utf8');assert.match(s,/setPreview\(parseFleetCsv/);assert.match(s,/importCompanyVehicles/);assert.match(s,/Anteprima CSV/)})
