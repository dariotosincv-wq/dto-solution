import test from 'node:test'
import assert from 'node:assert/strict'
import { DRIVER_QR_SHARE_TEXT, driverQrLink, driverQrPngFile } from '../company/src/lib/driverQrShare.js'

test('QR sharing reuses the current access path and produces one PNG file', async () => {
  const originalFetch = globalThis.fetch, originalFile = globalThis.File
  class TestFile {
    constructor(parts, name, options) { this.parts = parts; this.name = name; this.type = options.type }
  }
  globalThis.fetch = async dataUrl => ({ blob: async () => ({ dataUrl }) })
  globalThis.File = TestFile
  try {
    const image = 'data:image/png;base64,current-qr'
    const file = await driverQrPngFile(image)
    assert.equal(driverQrLink('/area-operativa/access/current-token'), 'https://www.dtosolution.it/area-operativa/access/current-token')
    assert.equal(file.name, 'dto-solution-qr-driver.png')
    assert.equal(file.type, 'image/png')
    assert.equal(file.parts[0].dataUrl, image)
    assert.match(DRIVER_QR_SHARE_TEXT, /QR personale DTO Solution/)
  } finally {
    globalThis.fetch = originalFetch
    globalThis.File = originalFile
  }
})
