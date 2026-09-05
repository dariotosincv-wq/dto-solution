// Select the original browser download branches. Native calls must never run.
export const Capacitor = {
  isNativePlatform: () => false,
  getPlatform: () => 'web',
}
export const Directory = { Cache: 'CACHE' }
const unavailable = async () => { throw new Error('Native file operations are unavailable in the browser') }
export const Filesystem = {
  mkdir: unavailable,
  writeFile: unavailable,
  getUri: unavailable,
  deleteFile: unavailable,
}
export const Share = { share: unavailable }
