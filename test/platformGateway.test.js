import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('Vercel gateway preserves all vehicle and SEO public paths within the Hobby function limit', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'))
  const ignored = await readFile(new URL('../.vercelignore', import.meta.url), 'utf8')
  const routes = new Map(config.rewrites.map(({ source, destination }) => [source, destination]))
  assert.match(routes.get('/api/company-vehicles'), /resource=company-vehicles/)
  assert.match(routes.get('/api/company-vehicle-damages'), /resource=company-damages/)
  assert.match(routes.get('/api/device-vehicles'), /resource=device-vehicles/)
  assert.match(routes.get('/api/device-vehicle-damages'), /resource=device-damages/)
  assert.match(routes.get('/api/super-admin'), /resource=super-admin/)
  for (const file of ['api/company-vehicles.js', 'api/company-vehicle.js', 'api/company-vehicle-damages.js', 'api/company-damage-photo.js', 'api/device-vehicles.js', 'api/device-vehicle-damages.js', 'api/seo.js', 'api/company-drivers.js', 'api/company-assignments.js', 'api/device-driver-assignments.js']) assert.match(ignored, new RegExp(file.replaceAll('.', '\\.')))
  assert.match(ignored, /api\/super-admin\.js/)
  const platform = await readFile(new URL('../api/platform.js', import.meta.url), 'utf8')
  const wrapper = await readFile(new URL('../api/device-vehicle-damages.js', import.meta.url), 'utf8')
  assert.match(platform, /from '\.\/_lib\/deviceVehicleDamages\.js'/)
  assert.match(platform, /_lib\/superAdminHandler\.js/)
  assert.match(wrapper, /from '\.\/_lib\/deviceVehicleDamages\.js'/)
})

test('device gateway accepts only safe Capacitor origins and signed-request headers', async () => {
  const platform = await readFile(new URL('../api/platform.js', import.meta.url), 'utf8')
  assert.match(platform, /deviceOrigins = new Set\(\['http:\/\/localhost', 'https:\/\/localhost', 'capacitor:\/\/localhost'\]\)/)
  for (const header of ['content-type', 'x-checkvan-device-id', 'x-checkvan-key-id', 'x-checkvan-timestamp', 'x-checkvan-request-id', 'x-checkvan-signature']) assert.match(platform, new RegExp(header))
  assert.match(platform, /request\.method === 'OPTIONS'/)
  assert.match(platform, /response\.status\(204\)\.end\(\)/)
  assert.match(platform, /ORIGIN_NOT_ALLOWED/)
  assert.doesNotMatch(platform, /Access-Control-Allow-Origin', '\*'/)
})

test('device gateway verifies signatures against public paths instead of the internal Vercel rewrite', async () => {
  const platform = await readFile(new URL('../api/platform.js', import.meta.url), 'utf8')
  assert.match(platform, /authenticateDeviceRequest\(request, clients, '\/api\/device-vehicles'\)/)
  assert.match(platform, /authenticateDeviceRequest\(req, value, '\/api\/device-vehicle-damages'\)/)
})
