import assert from 'node:assert/strict'
import test from 'node:test'
import { handlePublicQrHubs } from '../api/_lib/publicQrHubs.js'

function response() {
  return {
    code: null, body: null, headers: new Map(), ended: false,
    status(code) { this.code = code; return this },
    setHeader(key, value) { this.headers.set(key, value); return this },
    json(body) { this.body = body; return this },
    end() { this.ended = true; return this },
  }
}

test('public QR Hub exposes only the approved public columns through the platform handler', async () => {
  const steps = []
  const query = {
    select(columns) { steps.push(['select', columns]); return this },
    eq(column, value) { steps.push(['eq', column, value]); return this },
    not(column, operator, value) { steps.push(['not', column, operator, value]); return this },
    order(column) { steps.push(['order', column]); return Promise.resolve({ data: [{ id: 'public-qr' }], error: null }) },
  }
  const res = response()
  await handlePublicQrHubs({ method: 'POST', headers: {}, body: { action: 'cities', province: 'mi' } }, res, {
    clients: { checkvan: { from(table) { assert.equal(table, 'qr_locali'); return query } } },
  })
  assert.equal(res.code, 200)
  assert.deepEqual(res.body, { items: [{ id: 'public-qr' }] })
  assert.deepEqual(steps[0], ['select', 'id,pdv,city,province,driver,qr_text,latitude,longitude,accuracy,created_at'])
  assert.equal(steps.some(([operation, value]) => operation === 'select' && /(?:notes|zone|first_name|last_name)/.test(value)), false)
})

test('public QR Hub preserves CORS and rate-limited server-side submission', async () => {
  const optionRes = response()
  await handlePublicQrHubs({ method: 'OPTIONS', headers: { origin: 'capacitor://localhost' } }, optionRes)
  assert.equal(optionRes.code, 204)
  assert.equal(optionRes.headers.get('Access-Control-Allow-Origin'), 'capacitor://localhost')
  assert.equal(optionRes.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS')

  const previousSalt = process.env.QR_HUB_RATE_LIMIT_SALT
  process.env.QR_HUB_RATE_LIMIT_SALT = 'test-only-salt'
  try {
    const calls = []
    const res = response()
    await handlePublicQrHubs({
      method: 'POST', headers: { 'x-forwarded-for': '203.0.113.4' },
      body: { action: 'submit', province: 'MI', city: 'Milano', pdv: 'PDV', driver: 'AM', qr_text: 'synthetic' },
    }, res, {
      clients: { checkvan: { rpc(name, args) { calls.push([name, args]); return Promise.resolve({ data: [{ id: 'submitted' }], error: null }) } } },
    })
    assert.equal(res.code, 201)
    assert.deepEqual(res.body, { item: { id: 'submitted' } })
    assert.equal(calls[0][0], 'internal_submit_public_qr_hub')
    assert.match(calls[0][1].p_rate_key, /^[a-f0-9]{64}$/)
    assert.notEqual(calls[0][1].p_rate_key, '203.0.113.4')
  } finally {
    if (previousSalt === undefined) delete process.env.QR_HUB_RATE_LIMIT_SALT
    else process.env.QR_HUB_RATE_LIMIT_SALT = previousSalt
  }
})

test('public QR Hub rejects unsupported methods and does not expose a public write bypass', async () => {
  const res = response()
  await handlePublicQrHubs({ method: 'GET', headers: {}, body: {} }, res)
  assert.equal(res.code, 405)
  assert.deepEqual(res.body, { error: 'METHOD_NOT_ALLOWED' })
})
