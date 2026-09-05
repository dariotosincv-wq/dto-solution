import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
const root = resolve(import.meta.dirname, '..')
const result = spawnSync(process.execPath, [resolve(root, 'node_modules/vitest/vitest.mjs'), 'run', '--config', resolve(root, 'vitest.driver.config.mjs'), ...process.argv.slice(2)], {
  cwd: resolve(root, 'vendor/driver-utility'),
  stdio: 'inherit',
})
process.exit(result.status ?? 1)
