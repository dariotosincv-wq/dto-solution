import test from 'node:test'
import assert from 'node:assert/strict'
import { nextRomeMidnight } from '../api/_lib/deviceDriverIdentity.js'

test('driver proof expires at the next Europe/Rome midnight, including summer time', () => {
  assert.equal(nextRomeMidnight(new Date('2026-07-01T20:15:00.000Z')).toISOString(), '2026-07-01T22:00:00.000Z')
})

test('driver proof expires at the next Europe/Rome midnight, including winter time', () => {
  assert.equal(nextRomeMidnight(new Date('2026-12-01T20:15:00.000Z')).toISOString(), '2026-12-01T23:00:00.000Z')
})
