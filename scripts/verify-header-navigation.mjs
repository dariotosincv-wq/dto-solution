import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'

const base = process.env.NAVIGATION_TEST_URL || 'http://127.0.0.1:5174'
mkdirSync('artifacts/navigation', { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  for (const width of [320, 375, 768, 1024, 1100, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`${base}/area-driver`)
    const menu = page.locator('.menu-button')
    if (await menu.isVisible()) await menu.click()
    const toggle = page.getByRole('button', { name: 'Driver Utility Web' })
    const areas = page.locator('#utility-navigation')
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false')
    assert.equal(await areas.isVisible(), false)
    await toggle.focus()
    await page.keyboard.press('Enter')
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true')
    assert.deepEqual(await areas.locator('a').evaluateAll(links => links.map(a => a.getAttribute('href'))), ['/area-driver', '/azienda/login', '/enti/login'])
    await page.keyboard.press('Tab')
    assert.equal(await page.locator(':focus').getAttribute('href'), '/area-driver')
    await page.keyboard.press('Escape')
    assert.equal(await areas.isVisible(), false)
    await page.keyboard.press('Space')
    assert.equal(await areas.isVisible(), true)
    assert(await areas.locator('a').evaluateAll(links => links.every(a => a.getBoundingClientRect().height >= 44)))
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await page.screenshot({ path: `artifacts/navigation/${width}.png`, fullPage: false })
    await toggle.click()
    assert.equal(await areas.isVisible(), false)
    const lang = page.locator('.language-switcher')
    assert.equal(await lang.locator('[lang="it"]').getAttribute('href'), 'https://www.dtosolution.it/area-driver')
    assert.equal(await lang.locator('[lang="en"]').getAttribute('href'), 'https://www.dtosolution.com/area-driver')
    await page.getByRole('link', { name: 'NACScan Web', exact: true }).click()
    await page.waitForURL(`${base}/nacscan`)
    await page.locator('.nacscan-app-header h1').waitFor()
    if (await menu.isVisible()) {
      assert.equal(await menu.getAttribute('aria-expanded'), 'false')
      await menu.click()
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false')
      await menu.click()
    }
    console.log(`PASS ${width}px: accordion, keyboard, routes, language links, NACScan PDF page, overflow`)
  }
  for (const destination of ['/area-driver', '/azienda/login', '/enti/login']) {
    await page.goto(`${base}/`)
    await page.getByRole('button', { name: 'Driver Utility Web' }).click()
    await page.locator(`#utility-navigation a[href="${destination}"]`).click()
    await page.waitForURL(`${base}${destination}`)
  }
  assert.deepEqual(errors, [])
} finally { await browser.close() }
