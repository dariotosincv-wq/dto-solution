import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const output = resolve(import.meta.dirname, '../artifacts/driver/dashboard')
mkdirSync(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const checks = []
const errors = []
try {
  const context = await browser.newContext({ locale: 'it-IT' })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('http://127.0.0.1:5173/area-driver')
    await page.getByRole('heading', { level: 1, name: 'AREA DRIVER' }).waitFor()
    await page.evaluate(() => document.fonts.ready)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow ${width}`)
    const cards = await page.locator('.driver-dashboard__tool').evaluateAll(elements => elements.map(element => ({ height: element.getBoundingClientRect().height, x: element.getBoundingClientRect().x })))
    assert.equal(cards.length, 4)
    assert(Math.max(...cards.map(c => c.height)) - Math.min(...cards.map(c => c.height)) < 1, `unequal cards ${width}`)
    assert.equal(new Set(cards.map(c => Math.round(c.x))).size, width <= 540 ? 1 : width <= 1100 ? 2 : 4)
    assert.deepEqual(await page.locator('.driver-dashboard__cta').evaluateAll(links => links.map(link => link.getAttribute('href'))), ['/area-driver/turni', '/area-driver/busta-paga', '/area-driver/backup', '/area-driver/contratto'])
    assert(await page.locator('.driver-dashboard__cta').evaluateAll(links => links.every(link => link.getBoundingClientRect().height >= 44)))
    assert.deepEqual(await page.locator('.driver-dashboard__document a').evaluateAll(links => links.map(link => link.getAttribute('href'))), ['/area-driver/ccnl-logistica-trasporto-merci-spedizione', '/area-driver/accordo-asso-espressi-ultimo-miglio-2025', '/area-driver/normativa'])
    assert.equal(await page.locator('.driver-dashboard__contact').getAttribute('href'), '/contatti')
    await page.getByRole('heading', { name: 'Accordo Assoespressi – Ultimo miglio Amazon', exact: true }).waitFor()
    const menu = page.getByRole('button', { name: 'Apri o chiudi il menu' })
    if (await menu.isVisible()) await menu.click()
    const nav = page.locator('.navigation__areas a')
    assert.deepEqual(await nav.allTextContents().then(values => values.map(v => v.trim())), ['Area Driver', 'Area Aziende', 'Area Enti'])
    assert.equal(await nav.first().getAttribute('aria-current'), 'page')
    if (await menu.isVisible()) await menu.click()
    await page.screenshot({ path: resolve(output, `${width}.png`), fullPage: true })
    checks.push({ width, equalCardHeight: true, noOverflow: true, existingRoutes: true, navbar: true })
  }
  await page.keyboard.press('Tab')
  assert(await page.evaluate(() => document.activeElement !== document.body))
  assert.deepEqual(errors, [])
  writeFileSync(resolve(output, 'checks.json'), JSON.stringify({ checks, errors }, null, 2))
  console.log(JSON.stringify({ checks, errors }))
} finally { await browser.close() }
