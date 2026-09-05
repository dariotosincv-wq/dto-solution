import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { capabilitiesFor } from '../api/_lib/companyLicensingCore.js'
import { ENTITIES_BASE_PATH, ENTITIES_ROUTES } from '../entities/src/routes.js'

test('all entity URLs live below /enti', () => {
  assert.equal(ENTITIES_BASE_PATH, '/enti')
  assert.deepEqual(Object.values(ENTITIES_ROUTES), ['/enti/login', '/enti/verifica', '/enti/confronta'])
})

test('entity tools are authenticated, role-restricted and reuse the existing PDF components', async () => {
  const source = await readFile(new URL('../entities/src/App.jsx', import.meta.url), 'utf8')
  const login = source.indexOf('<Route path="login"')
  const guard = source.indexOf('<ProtectedRoute allowedRoles={ENTITY_ROLES}')
  const verify = source.indexOf('<Route path="verifica"', guard)
  const compare = source.indexOf('<Route path="confronta"', guard)
  assert.ok(login > -1 && login < guard)
  assert.ok(verify > guard && compare > guard)
  assert.match(source, /const ENTITY_ROLES = \['UNION_GUEST'\]/)
  assert.match(source, /import CheckVanVerificationPage from '\.\.\/\.\.\/src\/pages\/CheckVanVerificationPage\.jsx'/)
  assert.match(source, /import CheckVanComparisonPage from '\.\.\/\.\.\/src\/pages\/CheckVanComparisonPage\.jsx'/)
  assert.doesNotMatch(source, /path="(?:dashboard|checkvan|ispezioni|dispositivi|account)"/)
})

test('UNION_GUEST has only document tool capability', () => {
  assert.deepEqual(capabilitiesFor('UNION_GUEST', false), {
    useTools: true,
    manageDevices: false,
    viewInspections: false,
    deleteInspections: false,
  })
})

test('entity shell exposes only verification and comparison', async () => {
  const source = await readFile(new URL('../entities/src/components/EntitiesShell.jsx', import.meta.url), 'utf8')
  assert.match(source, /ENTITIES_ROUTES\.verify/)
  assert.match(source, /ENTITIES_ROUTES\.compare/)
  assert.doesNotMatch(source, /(?:Dispositivi|Trial|Licenz|Dashboard|Account)/i)
})

test('public desktop and mobile navigation exposes Area Enti login', async () => {
  const [app, header, styles] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/layout/Header.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles/components.css', import.meta.url), 'utf8'),
  ])
  assert.match(app, /<Route path="enti\/\*" element=\{<EntitiesApp \/>\} \/>/)
  assert.match(header, /label: 'Area Enti', to: '\/enti\/login'/)
  assert.match(styles, /@media \(max-width: 68rem\)[\s\S]*\.navigation__area-cta\s*\{[^}]*width:\s*100%/)
})

test('UNION_GUEST is rejected by company routes while trial-eligible users without membership remain allowed', async () => {
  const source = await readFile(new URL('../company/src/App.jsx', import.meta.url), 'utf8')
  assert.match(source, /<ProtectedRoute deniedRoles=\{\['UNION_GUEST'\]\} unauthorizedRoute="\/enti\/verifica"/)
  assert.doesNotMatch(source, /allowedRoles=/)
})
