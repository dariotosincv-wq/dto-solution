import { defineConfig } from 'vitest/config'
import { driverUtilityPlugin, driverVendorRoot } from './scripts/driver-utility-vite.mjs'

export default defineConfig({
  root: driverVendorRoot,
  plugins: [driverUtilityPlugin({ originalRoutes: true })],
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    maxWorkers: 2,
  },
})
