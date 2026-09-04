import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = async (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('Super Admin login exposes the existing Google OAuth provider', async () => {
  const [app, lib] = await Promise.all([source('../admin/src/App.jsx'), source('../admin/src/lib.js')])
  assert.match(app, /Continua con Google/)
  assert.match(app, /signInSuperAdminWithGoogle/)
  assert.match(lib, /signInWithOAuth\(\{ provider: 'google'/)
})

test('Google OAuth uses a fixed same-origin Super Admin redirect', async () => {
  const lib = await source('../admin/src/lib.js')
  assert.match(lib, /window\.location\.origin}\/super-admin\/dashboard/)
  assert.doesNotMatch(lib, /redirectTo.*searchParams|redirectTo.*location\.search/)
})

test('OAuth authentication still passes through the server-side Super Admin guard', async () => {
  const [app, lib] = await Promise.all([source('../admin/src/App.jsx'), source('../admin/src/lib.js')])
  assert.match(app, /adminRequest\(next\.access_token, 'access'\)/)
  assert.match(app, /session&&admin\?<Outlet\/>:<Navigate to="\/super-admin\/login"/)
  assert.doesNotMatch(lib, /email.*admin|admin.*email/i)
})

test('login correction does not alter MFA factors or require_mfa', async () => {
  const files = await Promise.all(['../admin/src/App.jsx', '../admin/src/lib.js'].map(source))
  assert.doesNotMatch(files.join('\n'), /unenroll|enroll\(\{ factorType|require_mfa/)
})
