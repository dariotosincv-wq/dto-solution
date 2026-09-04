import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { COMPANY_BASE_PATH, COMPANY_ROUTES } from '../company/src/routes.js'

test('all company URLs live below /azienda', () => {
  assert.equal(COMPANY_BASE_PATH, '/azienda')
  assert.deepEqual(Object.values(COMPANY_ROUTES).filter((value) => typeof value === 'string'), [
    '/azienda/login',
    '/azienda/dashboard',
    '/azienda/checkvan',
    '/azienda/ispezioni',
    '/azienda/pdf/verifica',
    '/azienda/pdf/confronta',
    '/azienda/dispositivi',
    '/azienda/veicoli', '/azienda/driver', '/azienda/assegnazioni',
    '/azienda/account',
  ])
  assert.equal(COMPANY_ROUTES.vehicle('vehicle-id'), '/azienda/veicoli/vehicle-id')
})

test('the public router mounts the company app without exposing CheckVan tools', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(source, /<Route path="azienda\/\*" element=\{<CompanyApp \/>\} \/>/)
  assert.doesNotMatch(source, /path="verifica-checkvan"/)
  assert.doesNotMatch(source, /path="confronta-checkvan"/)
  assert.doesNotMatch(source, /import CheckVan(?:Verification|Comparison)Page/)
})

test('public CTA links lead to company login and never directly to CheckVan tools', async () => {
  const publicFiles = await Promise.all([
    '../src/App.jsx',
    '../src/components/layout/PageLayout.jsx',
    '../src/components/layout/Header.jsx',
    '../src/pages/products/DriverUtilityPage.jsx',
  ].map((path) => readFile(new URL(path, import.meta.url), 'utf8')))
  const source = publicFiles.join('\n')
  assert.doesNotMatch(source, /\/(?:verifica-checkvan|confronta-checkvan)/)
  assert.match(source, /to="\/azienda\/login"/)
})

test('public header exposes the company login CTA for desktop and mobile navigation', async () => {
  const [header, styles] = await Promise.all([
    readFile(new URL('../src/components/layout/Header.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles/components.css', import.meta.url), 'utf8'),
  ])
  assert.match(header, /className="navigation__company-cta" to="\/azienda\/login"/)
  assert.match(header, />\s*Area Aziende\s*</)
  assert.match(styles, /\.navigation__company-cta\s*\{[^}]*display:\s*inline-flex/s)
  assert.match(styles, /@media \(max-width: 52rem\)[\s\S]*\.navigation__company-cta\s*\{[^}]*width:\s*100%/)
})

test('public sitemap uses the platform gateway and advertises only current public routes', async () => {
  const [vercelSource, platformSource] = await Promise.all([
    readFile(new URL('../vercel.json', import.meta.url), 'utf8'),
    readFile(new URL('../api/platform.js', import.meta.url), 'utf8'),
  ])
  const rewrites = new Map(JSON.parse(vercelSource).rewrites.map(({ source, destination }) => [source, destination]))
  assert.equal(rewrites.get('/sitemap.xml'), '/api/platform?resource=seo&type=sitemap')
  assert.equal(rewrites.get('/robots.txt'), '/api/platform?resource=seo&type=robots')

  const publicPathsBlock = platformSource.match(/const publicPaths = \[([\s\S]*?)\]/)?.[1]
  assert.ok(publicPathsBlock, 'api/platform.js must define publicPaths')
  const publicPaths = [...publicPathsBlock.matchAll(/'([^']+)'/g)].map((match) => match[1])
  for (const path of ['/verifica-checkvan', '/confronta-checkvan', '/azienda', '/enti', '/super-admin']) {
    assert.ok(!publicPaths.some((publicPath) => publicPath === path || publicPath.startsWith(`${path}/`)), `${path} must remain private or retired`)
  }
  assert.ok(publicPaths.includes('/nacscan'))
  assert.ok(publicPaths.includes('/area-driver'))
})

test('only company login sits outside ProtectedRoute', async () => {
  const source = await readFile(new URL('../company/src/App.jsx', import.meta.url), 'utf8')
  const login = source.indexOf('<Route path="login"')
  const guard = source.indexOf('<Route element={<ProtectedRoute deniedRoles=')
  const fallback = source.indexOf('<Route path="*"')
  assert.ok(login > -1 && login < guard)
  assert.ok(guard > -1 && guard < fallback)
  for (const path of ['dashboard', 'checkvan', 'ispezioni', 'veicoli', 'veicoli/:vehicleId', 'pdf/verifica', 'pdf/confronta', 'dispositivi', 'account']) {
    const route = source.indexOf(`<Route path="${path}"`, guard)
    assert.ok(route > guard && route < fallback, `${path} must remain protected`)
  }
})

test('company navigation and OAuth redirects use the prefixed route catalog', async () => {
  const files = await Promise.all([
    '../company/src/auth/AuthContext.jsx',
    '../company/src/components/ProtectedRoute.jsx',
    '../company/src/components/ToolGuard.jsx',
    '../company/src/components/AppShell.jsx',
    '../company/src/pages/DashboardPage.jsx',
    '../company/src/pages/LoginPage.jsx',
  ].map((path) => readFile(new URL(path, import.meta.url), 'utf8')))
  assert.doesNotMatch(files.join('\n'), /(?:to=|navigate\()[^\n]*(?:['"]\/(?:login|dashboard|ispezioni|pdf|dispositivi|account))/)
  assert.match(files[0], /COMPANY_ROUTES\.dashboard/)
  assert.match(files[1], /COMPANY_ROUTES\.login/)
})

test('session refresh stays loading and protected pages never escape the company prefix', async () => {
  const [auth, devices, inspections] = await Promise.all([
    readFile(new URL('../company/src/auth/AuthContext.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../company/src/pages/DevicesPage.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../company/src/pages/InspectionsPage.jsx', import.meta.url), 'utf8'),
  ])
  const resolveStart = auth.indexOf('const resolve = async (nextSession) =>')
  assert.ok(auth.indexOf('setLoading(true)', resolveStart) > resolveStart)
  assert.doesNotMatch(devices, /to="\/dashboard"/)
  assert.doesNotMatch(inspections, /(?:to="\/dashboard"|navigate\('\/pdf\/confronta')/)
  assert.match(devices, /COMPANY_ROUTES\.dashboard/)
  assert.match(inspections, /COMPANY_ROUTES\.dashboard/)
  assert.match(inspections, /COMPANY_ROUTES\.comparePdf/)
})
