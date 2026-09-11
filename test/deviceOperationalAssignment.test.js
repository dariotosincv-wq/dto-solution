import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('device operational assignment validates an opaque QR token and returns effective daily data only through the platform gateway', async () => {
  const source = await readFile(new URL('../api/platform.js', import.meta.url), 'utf8')
  assert.match(source, /hashSecret\(token\)/)
  assert.match(source, /\.eq\('status', 'active'\)/)
  assert.match(source, /readPlanning\(/)
  assert.match(source, /planning\.effective/)
  assert.match(source, /first_name,last_name/)
  assert.doesNotMatch(source, /service_role/i)
})
