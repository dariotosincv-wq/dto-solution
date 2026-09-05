import schema from './schema.generated.js'
import { BACKUP_EXCLUDED_FIELDS, BACKUP_FORMAT, BACKUP_KEYS, BACKUP_VERSION, MAX_BACKUP_BYTES, PAYROLL_COLLECTIONS } from './backupPolicy.js'

export class DriverBackupError extends Error {
  constructor(code, message) { super(message); this.name = 'DriverBackupError'; this.code = code }
}
const invalid = () => { throw new DriverBackupError('INVALID', 'Backup non valido: il file è corrotto o la struttura dei dati non è compatibile.') }
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const unsafeKeys = new Set(['__proto__', 'constructor', 'prototype'])
const excluded = new Set(BACKUP_EXCLUDED_FIELDS)

function inspectJson(value, depth = 0) {
  if (depth > 40) invalid()
  if (value === null || typeof value === 'boolean') return
  if (typeof value === 'number') { if (!Number.isFinite(value)) invalid(); return }
  if (typeof value === 'string') return
  if (typeof value !== 'object') invalid()
  for (const [key, item] of Object.entries(value)) {
    if (unsafeKeys.has(key)) invalid()
    inspectJson(item, depth + 1)
  }
}

function matches(value, rule) {
  if (rule.ref) return matches(value, schema.definitions[rule.ref])
  if (rule.anyOf) return rule.anyOf.some(option => matches(value, option))
  if (Object.hasOwn(rule, 'const')) return value === rule.const
  if (rule.type === 'array') return Array.isArray(value) && value.every(item => matches(item, rule.items))
  if (rule.type === 'object') {
    return isObject(value) && rule.required.every(key => Object.hasOwn(value, key)) && Object.entries(value).every(([key, item]) => {
      const child = Object.hasOwn(rule.properties, key) ? rule.properties[key] : rule.additionalProperties
      return child && matches(item, child)
    })
  }
  return typeof value === rule.type && (rule.type !== 'number' || Number.isFinite(value))
}

function exactKeys(value, keys) {
  return isObject(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
}

function validDate(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false
  const date = new Date(`${key}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === key
}

function stripTemporary(value) {
  if (Array.isArray(value)) return value.map(stripTemporary)
  if (isObject(value)) return Object.fromEntries(Object.entries(value).filter(([key]) => !excluded.has(key)).map(([key, item]) => [key, stripTemporary(item)]))
  return value
}

export function validateDriverBackup(backup) {
  inspectJson(backup)
  if (!isObject(backup) || backup.format !== BACKUP_FORMAT || !Number.isInteger(backup.version)) invalid()
  if (backup.version !== BACKUP_VERSION) throw new DriverBackupError('VERSION', 'Versione non supportata. Usa un backup versione 1 esportato dall’Area Driver.')
  if (!exactKeys(backup, ['format', 'version', 'createdAt', 'data']) || typeof backup.createdAt !== 'string' || !Number.isFinite(Date.parse(backup.createdAt)) || new Date(backup.createdAt).toISOString() !== backup.createdAt) invalid()
  if (!exactKeys(backup.data, BACKUP_KEYS)) invalid()
  const attendance = backup.data.attendance
  if (attendance !== null && (!isObject(attendance) || !Object.entries(attendance).every(([date, entry]) => validDate(date) && isObject(entry) && typeof entry.status === 'string' && Object.keys(entry).every(key => ['status', 'notes'].includes(key)) && (!Object.hasOwn(entry, 'notes') || typeof entry.notes === 'string')))) invalid()
  const contract = backup.data.driverContractProfile
  if (contract !== null && !matches(contract, schema.contract)) invalid()
  // Null explicitly records an absent key; arrays and all nested fields use the
  // original TS schema. No normalization, recalculation or month conversion.
  const payroll = Object.fromEntries(PAYROLL_COLLECTIONS.map(name => [name, backup.data[`driverPayroll.${name}`] === null ? [] : backup.data[`driverPayroll.${name}`]]))
  if (!matches(payroll, schema.payroll)) invalid()
  const text = JSON.stringify(backup, null, 2)
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) throw new DriverBackupError('SIZE', 'Backup troppo grande: il limite è 20 MB.')
  return backup
}

export function parseDriverBackup(text) {
  if (typeof text !== 'string') invalid()
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) throw new DriverBackupError('SIZE', 'Backup troppo grande: il limite è 20 MB.')
  let parsed
  try { parsed = JSON.parse(text) } catch { invalid() }
  return validateDriverBackup(parsed)
}

export function createDriverBackup(storage, now = new Date()) {
  const data = {}
  for (const key of BACKUP_KEYS) {
    const raw = storage.getItem(key)
    if (raw === null) { data[key] = null; continue }
    let value
    try { value = JSON.parse(raw) } catch { throw new DriverBackupError('LOCAL_DATA', 'Esportazione interrotta: alcuni dati locali non sono validi. Nessun dato è stato modificato.') }
    inspectJson(value)
    data[key] = key.startsWith('driverPayroll.') ? stripTemporary(value) : value
  }
  return validateDriverBackup({ format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: now.toISOString(), data })
}

export function summarizeDriverBackup(backup) {
  validateDriverBackup(backup)
  const entries = Object.values(backup.data.attendance ?? {})
  return [
    ['Giorni registrati', entries.length],
    ['Giorni con note', entries.filter(entry => entry.notes).length],
    ['Profilo contrattuale', backup.data.driverContractProfile === null ? 'Assente' : 'Presente'],
    ...PAYROLL_COLLECTIONS.map((name, index) => [[ 'Profili Payroll', 'Fonti contrattuali', 'Regole salvate', 'Codici salvati', 'Cedolini nello storico', 'Simulazioni salvate', 'Confronti salvati', 'Profili di apprendimento' ][index], backup.data[`driverPayroll.${name}`]?.length ?? 0]),
  ]
}

export function restoreDriverBackup(storage, backup) {
  // Validate again at confirmation; all serialization and reads precede writes.
  validateDriverBackup(backup)
  const next = new Map(BACKUP_KEYS.map(key => [key, backup.data[key] === null ? null : JSON.stringify(backup.data[key])]))
  const previous = new Map(BACKUP_KEYS.map(key => [key, storage.getItem(key)]))
  const attempted = []
  const write = (key, value) => value === null ? storage.removeItem(key) : storage.setItem(key, value)
  try {
    for (const [key, value] of next) {
      if (value === previous.get(key)) continue
      attempted.push(key)
      write(key, value)
    }
  } catch {
    let rollbackFailed = false
    for (const key of attempted.reverse()) {
      try { write(key, previous.get(key)) } catch { rollbackFailed = true }
    }
    throw new DriverBackupError(rollbackFailed ? 'ROLLBACK_FAILED' : 'WRITE_FAILED', rollbackFailed
      ? 'Ripristino interrotto: il browser ha impedito anche il recupero completo dei dati precedenti. Conserva il file di backup e verifica i dati prima di continuare.'
      : 'Ripristino non riuscito: spazio insufficiente o archivio non disponibile. I dati precedenti sono stati ripristinati.')
  }
}

export function backupFilename(backup) { return `${BACKUP_FORMAT}-${backup.createdAt.slice(0, 10)}.json` }
