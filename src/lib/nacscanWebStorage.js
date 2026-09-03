const DATABASE = 'nacscan-web'
const STORE = 'settings'
const HANDLE_KEY = 'save-directory'

function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function access(mode, callback) {
  const db = await database()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode)
    const request = callback(transaction.objectStore(STORE))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => db.close()
  })
}

export const supportsDirectoryPicker = () => typeof window.showDirectoryPicker === 'function'
export async function loadSaveDirectory() { try { return await access('readonly', (store) => store.get(HANDLE_KEY)) || null } catch { return null } }
export async function chooseSaveDirectory() { const handle = await window.showDirectoryPicker({ mode: 'readwrite' }); await access('readwrite', (store) => store.put(handle, HANDLE_KEY)); return handle }
export async function resetSaveDirectory() { try { await access('readwrite', (store) => store.delete(HANDLE_KEY)) } catch { /* Download fallback remains available. */ } }

export async function saveNacScanFile(blob, fileName, handle = null) {
  const directory = handle || await loadSaveDirectory()
  let permission = directory ? await directory.queryPermission({ mode: 'readwrite' }) : 'denied'
  if (directory && permission === 'prompt') permission = await directory.requestPermission({ mode: 'readwrite' })
  if (directory && permission === 'granted') {
    const writable = await (await directory.getFileHandle(fileName, { create: true })).createWritable()
    await writable.write(blob)
    await writable.close()
    return { method: 'directory', label: directory.name }
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return { method: 'download', label: 'Download' }
}
