const ROOT_NAME = 'NACScan'
const SCOPE = 'https://www.googleapis.com/auth/drive.file openid email profile'
const STATE_KEY = 'nacscan.google-drive.preferences'
let accessToken = ''

export function loadDriveState(storage = localStorage) {
  try { return { connected: false, enabled: false, ...JSON.parse(storage.getItem(STATE_KEY) || '{}') } }
  catch { return { connected: false, enabled: false } }
}

function saveDriveState(state, storage = localStorage) { storage.setItem(STATE_KEY, JSON.stringify(state)); return state }
export function driveIsConfigured() { return Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID) }

function loadGoogleIdentity() {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = resolve
    script.onerror = () => reject(new Error('GOOGLE_IDENTITY_UNAVAILABLE'))
    document.head.appendChild(script)
  })
}

function requestToken(prompt = '') {
  return new Promise((resolve, reject) => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) { reject(new Error('GOOGLE_CLIENT_ID_MISSING')); return }
    window.google.accounts.oauth2.initTokenClient({ client_id: clientId, scope: SCOPE, callback: (response) => response.error ? reject(new Error(response.error)) : resolve(response.access_token) }).requestAccessToken({ prompt })
  })
}

async function api(url, options = {}) {
  if (!accessToken) { await loadGoogleIdentity(); accessToken = await requestToken('') }
  const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${accessToken}`, ...(options.headers || {}) } })
  if (response.status === 401) { accessToken = ''; throw new Error('REAUTHORIZATION_REQUIRED') }
  if (!response.ok) throw new Error(`DRIVE_${response.status}`)
  return response.json()
}

const escapeQuery = (value) => value.replaceAll("'", "\\'")
async function findFolder(parentId, name) {
  const parent = parentId ? ` and '${escapeQuery(parentId)}' in parents` : ''
  const query = `trashed=false and mimeType='application/vnd.google-apps.folder' and name='${escapeQuery(name)}'${parent}`
  const result = await api(`https://www.googleapis.com/drive/v3/files?spaces=drive&fields=files(id,name)&q=${encodeURIComponent(query)}`)
  return result.files?.[0] || null
}
async function ensureFolder(parentId, name) {
  const found = await findFolder(parentId, name)
  if (found) return found
  return api('https://www.googleapis.com/drive/v3/files?fields=id,name', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', ...(parentId ? { parents: [parentId] } : {}) }) })
}

export async function connectGoogleDrive() {
  await loadGoogleIdentity()
  accessToken = await requestToken('consent')
  const profile = await api('https://openidconnect.googleapis.com/v1/userinfo')
  const root = await ensureFolder(null, ROOT_NAME)
  return saveDriveState({ connected: true, enabled: true, accountId: profile.sub, email: profile.email, name: profile.name, rootId: root.id, rootName: ROOT_NAME })
}

export function disconnectGoogleDrive() {
  if (accessToken && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(accessToken, () => {})
  accessToken = ''
  localStorage.removeItem(STATE_KEY)
  return { connected: false, enabled: false }
}

function safeFolderName(value, fallback) {
  const sanitized = value.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').replace(/[. ]+$/g, '').trim()
  return (sanitized || fallback).slice(0, 80)
}

export function resolveDriveArchivePath(company, documentType, date = new Date(), language = 'it') {
  const months = {
    it: ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'],
    en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
    es: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
    fr: ['Janvier','Fevrier','Mars','Avril','Mai','Juin','Juillet','Aout','Septembre','Octobre','Novembre','Decembre'],
    de: ['Januar','Februar','Marz','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'],
  }
  const month = (months[language] || months.it)[date.getMonth()]
  return [safeFolderName(company, 'Azienda'), safeFolderName(documentType, 'Documenti'), String(date.getFullYear()), month, String(date.getDate()).padStart(2, '0')]
}

export function createAndroidCompatiblePdfName(pages, now = new Date()) {
  const first = pages[0]
  if (first?.kind === 'pdf' && first.name) {
    const base = first.name.replace(/\.pdf$/i, '') || 'documento'
    const signed = pages.some((page) => page.annotations?.some((annotation) => annotation.type === 'signature'))
    return `${base}-${signed ? 'firmato' : 'modificato'}.pdf`
  }
  const pad = (value, length = 2) => String(value).padStart(length, '0')
  return `nacscan-documento-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}-${pad(now.getMilliseconds(), 3)}.pdf`
}

export async function uploadNacScanPdf(blob, fileName, segments) {
  const state = loadDriveState()
  if (!state.rootId) throw new Error('ROOT_MISSING')
  let parentId = state.rootId
  for (const segment of segments) parentId = (await ensureFolder(parentId, segment)).id
  const query = `trashed=false and '${escapeQuery(parentId)}' in parents`
  const existing = await api(`https://www.googleapis.com/drive/v3/files?spaces=drive&fields=files(name)&q=${encodeURIComponent(query)}`)
  const names = new Set((existing.files || []).map((file) => file.name.toLocaleLowerCase()))
  const dot = fileName.lastIndexOf('.')
  const base = dot > 0 ? fileName.slice(0, dot) : fileName
  const extension = dot > 0 ? fileName.slice(dot) : ''
  let finalName = fileName
  for (let suffix = 2; names.has(finalName.toLocaleLowerCase()); suffix += 1) finalName = `${base} (${suffix})${extension}`
  const boundary = `nacscan_${crypto.randomUUID()}`
  const metadata = JSON.stringify({ name: finalName, parents: [parentId] })
  const body = new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`, blob, `\r\n--${boundary}--\r\n`])
  return api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body })
}
