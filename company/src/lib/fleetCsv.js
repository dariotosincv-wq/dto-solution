import { SILHOUETTES } from '../../../api/_lib/companyVehicles.js'

function csvRecords(text) {
  const records = []; let row = [], field = '', quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted && char === '"' && text[index + 1] === '"') { field += '"'; index += 1 }
    else if (char === '"') quoted = !quoted
    else if (!quoted && char === ',') { row.push(field); field = '' }
    else if (!quoted && (char === '\n' || char === '\r')) { if (char === '\r' && text[index + 1] === '\n') index += 1; row.push(field); if (row.some((value) => value.trim())) records.push(row); row = []; field = '' }
    else field += char
  }
  row.push(field); if (row.some((value) => value.trim())) records.push(row)
  if (quoted) throw new Error('CSV_NON_VALIDO')
  return records
}

const key = (value) => value.trim().toUpperCase()
const plateKey = (value) => key(value).replace(/[^A-Z0-9]/g, '')

export function parseFleetCsv(text, existingVehicles = []) {
  const records = csvRecords(String(text).replace(/^\uFEFF/, ''))
  if (!records.length || records[0].map(key).join(',') !== 'CODICE_MEZZO,TARGA,CATEGORIA') throw new Error('CSV_HEADER_NON_VALIDO')
  const existingCodes = new Set(existingVehicles.map((item) => key(item.internal_code)))
  const existingPlates = new Set(existingVehicles.map((item) => plateKey(item.plate)))
  const seenCodes = new Set(), seenPlates = new Set()
  const rows = records.slice(1).map((columns, index) => {
    const internal_code = key(columns[0] ?? ''), plate = key(columns[1] ?? ''), silhouette_category = key(columns[2] ?? '')
    const errors = []
    if (columns.length !== 3) errors.push('Riga incompleta')
    if (!internal_code) errors.push('Codice mezzo obbligatorio')
    if (!plate) errors.push('Targa obbligatoria')
    if (!silhouette_category) errors.push('Categoria obbligatoria')
    else if (!SILHOUETTES.has(silhouette_category)) errors.push('Categoria non valida')
    if (internal_code && seenCodes.has(internal_code)) errors.push('Codice duplicato nel CSV')
    if (plate && seenPlates.has(plateKey(plate))) errors.push('Targa duplicata nel CSV')
    if (internal_code && existingCodes.has(internal_code)) errors.push('Codice già presente')
    if (plate && existingPlates.has(plateKey(plate))) errors.push('Targa già presente')
    seenCodes.add(internal_code); seenPlates.add(plateKey(plate))
    return { row: index + 2, internal_code, plate, silhouette_category, valid: errors.length === 0, errors }
  })
  return {
    rows, total: rows.length, ready: rows.filter((row) => row.valid).length, invalid: rows.filter((row) => !row.valid).length,
    duplicates: rows.filter((row) => row.errors.some((error) => error.includes('duplicat'))).length,
    existing: rows.filter((row) => row.errors.some((error) => error.includes('già presente'))).length,
  }
}

export const importableFleetRows = (preview) => preview.rows.filter((row) => row.valid).map(({ internal_code, plate, silhouette_category }) => ({ internal_code, plate, silhouette_category }))
