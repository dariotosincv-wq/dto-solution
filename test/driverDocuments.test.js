import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { ccnlIndex, ccnlPages } from '../src/data/driverDocuments.js'
import { agreementIndex, agreementPages } from '../src/data/verifiedAgreement.js'
import { searchDocumentPages } from '../src/lib/documentSearch.js'

const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const area = await readFile(new URL('../src/pages/DriverAreaPage.jsx', import.meta.url), 'utf8')
const header = await readFile(new URL('../src/components/layout/Header.jsx', import.meta.url), 'utf8')
const publication = await readFile(new URL('../src/components/driver/DocumentPublicationPage.jsx', import.meta.url), 'utf8')
const styles = await readFile(new URL('../src/styles/pages.css', import.meta.url), 'utf8')

const ccnlText = ccnlPages.flatMap((page) => page.lines).map((line) => typeof line === 'string' ? line : line.text).join(' ')
const agreementText = agreementPages.flatMap((page) => page.lines).join(' ')

test('public router exposes both document publications and no legacy CheckVan tools', () => {
  assert.match(app, /area-driver\/ccnl-logistica-trasporto-merci-spedizione/)
  assert.match(app, /area-driver\/accordo-asso-espressi-ultimo-miglio-2025/)
  assert.doesNotMatch(app, /verifica-checkvan|confronta-checkvan/)
})

test('Area Driver links the two verified documents and leaves legislation disabled', () => {
  assert.match(area, /'\/area-driver\/ccnl-logistica-trasporto-merci-spedizione'/)
  assert.match(area, /'\/area-driver\/accordo-asso-espressi-ultimo-miglio-2025'/)
  assert.match(area, /<button type="button" disabled/)
})

test('main navigation contains Area Driver in desktop and mobile shared navigation', () => {
  assert.match(header, /\{ label: 'Applicazioni'[^]*\{ label: 'Area Driver', to: '\/area-driver' \}[^]*\{ label: 'Chi siamo'/)
  assert.equal((header.match(/navigation\.map/g) || []).length, 1)
  assert.match(header, /navigation--open/)
})

test('CCNL publication contains every source page and searchable contractual terms', () => {
  assert.equal(ccnlPages.length, 137)
  assert.ok(ccnlIndex.length >= 200)
  for (const value of ['6 DICEMBRE 2024', '25 settembre 2025', '31 dicembre 2027', 'Orario di lavoro', 'trasferta', 'Ferie', 'personale viaggiante']) assert.match(ccnlText, new RegExp(value, 'i'))
})

test('Assoespressi publication contains 27 indexed sections and verified key values', () => {
  assert.equal(agreementIndex.length, 27)
  assert.equal(agreementPages.length, 12)
  for (const value of ['26 Maggio 2025', '20,50', '22,50', '23,50', '24,00', '1.200,00', '1.300,00', '30 Aprile 2028']) assert.match(agreementText, new RegExp(value.replace('.', '\\.').replace(',', '\\,'), 'i'))
  for (let section = 1; section <= 27; section += 1) assert.match(agreementText, new RegExp(`\\b${section}\\.`))
  assert.doesNotMatch(agreementText, /00\.S|s\.r\.\]|verràà|indennitàà|evefiti|lavbro|un nese|tutti j mezzi/i)
})

test('publication search is local, reports matching pages and links to source sections', () => {
  assert.match(publication, /useMemo/)
  assert.match(publication, /type="search"/)
  assert.match(publication, /aria-live="polite"/)
  assert.match(publication, /href={`#\$\{item\.id\}`}/)
  assert.doesNotMatch(publication, /fetch\(|supabase|https?:\/\//i)
})

test('CCNL and agreement searches return the pertinent original pages', () => {
  assert.ok(searchDocumentPages(ccnlPages, 'personale viaggiante').some((page) => page.page === 16))
  assert.ok(searchDocumentPages(ccnlPages, 'trasferta').length > 0)
  assert.ok(searchDocumentPages(agreementPages, 'Premio di Risultato').some((page) => page.page === 8))
  assert.ok(searchDocumentPages(agreementPages, 'validità ed applicazione').some((page) => page.page === 12))
  assert.deepEqual(searchDocumentPages(agreementPages, ''), [])
})

test('long-document layout is responsive and provides visible focus styling', () => {
  assert.match(styles, /contract-publication__layout[^}]*grid-template-columns:/)
  assert.match(styles, /contract-publication__tools \{[^}]*position: sticky/s)
  assert.match(styles, /contract-search input:focus-visible/)
  assert.match(styles, /@media \(max-width: 900px\)[^]*contract-publication__layout[^}]*grid-template-columns: 1fr/)
})

test('public data contains no embedded images or signature assets', () => {
  const source = `${ccnlText} ${agreementText}`
  assert.doesNotMatch(source, /data:image|\.png|\.jpe?g|\.webp/i)
})
