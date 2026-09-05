import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { driverLegislation, futureDriverTopics } from '../src/data/driverLegislation.js'

test('six legislation cards contain useful summaries and only official source links', () => {
  assert.deepEqual(driverLegislation.map(law => law.number), ['D.Lgs. 66/2003', 'D.Lgs. 234/2007', 'D.Lgs. 81/2008', 'Legge 300/1970', 'D.Lgs. 81/2015', 'D.Lgs. 152/1997 e successive modifiche'])
  for (const law of driverLegislation) {
    const url = new URL(law.source)
    assert.equal(url.protocol, 'https:')
    assert(['www.normattiva.it', 'www.lavoro.gov.it'].includes(url.hostname))
    assert(law.title && law.summary && law.useful && law.sourceLabel && law.topics.length)
  }
  assert.match(driverLegislation[1].summary, /Non si applica automaticamente/)
  assert.equal(futureDriverTopics.length, 8)
})
test('published agreement keeps 2025 date and distinguishes Amazon scope from the general CCNL', () => {
  const text = readFileSync(new URL('../src/pages/AccordoAssoespressiPage.jsx', import.meta.url), 'utf8')
  assert.match(text, /Accordo Assoespressi – Ultimo miglio Amazon/)
  assert.match(text, /26 maggio 2025/)
  assert.match(text, /non il CCNL generale/)
  assert.match(text, /pages: agreementPages/)
})
