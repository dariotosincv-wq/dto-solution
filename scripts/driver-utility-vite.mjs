import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
export const driverVendorRoot = resolve(root, 'vendor/driver-utility')
const adapters = resolve(root, 'src/features/driver/adapters')

// Scoped resolution keeps the byte-identical source independent of DTO/NACScan.
export function driverUtilityPlugin({ originalRoutes = false } = {}) {
  return {
    name: 'driver-utility-browser-adapters',
    enforce: 'pre',
    async resolveId(source, importer) {
      if (!importer?.replaceAll('\\', '/').includes('/vendor/driver-utility/')) return null
      if (source.startsWith('@/')) return this.resolve(resolve(driverVendorRoot, 'src', source.slice(2)), importer, { skipSelf: true })
      if (source === '@capacitor/preferences') return resolve(adapters, 'preferences.ts')
      if (['@capacitor/core', '@capacitor/filesystem', '@capacitor/share'].includes(source)) return resolve(adapters, 'native.ts')
      if (source === 'react-router-dom' && !originalRoutes) return resolve(adapters, 'router.ts')
      if (source === '@radix-ui/react-alert-dialog') return resolve(adapters, 'dialog.tsx')
      if (source.startsWith('pdfjs-dist/')) return this.resolve(source.replace('pdfjs-dist/', 'driver-payroll-pdfjs/'), importer, { skipSelf: true })
      return null
    },
  }
}
