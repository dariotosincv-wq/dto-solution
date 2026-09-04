const split = (line, separator) => line.split(separator).map((value) => value.trim().replace(/^"|"$/g, ''))
export function parseDriverCsv(source, existing = []) {
  const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim()), separator = (lines[0]?.match(/;/g)?.length ?? 0) > (lines[0]?.match(/,/g)?.length ?? 0) ? ';' : ','
  const headers = split(lines.shift() || '', separator).map((value) => value.toLowerCase())
  if (!['nome', 'cognome'].every((value) => headers.includes(value))) throw new Error('CSV_HEADER_NON_VALIDO')
  const seen = new Set(existing.map((row) => row.driver_code?.toUpperCase()).filter(Boolean))
  const rows = lines.map((line, index) => { const values = split(line, separator), get = (key) => values[headers.indexOf(key)]?.trim() || '', first_name = get('nome'), last_name = get('cognome'), driver_code = (get('driver_code') || get('codice_driver')).toUpperCase(), errors = []; if (!first_name) errors.push('Nome mancante'); if (!last_name) errors.push('Cognome mancante'); if (driver_code && seen.has(driver_code)) errors.push('Codice duplicato'); if (driver_code) seen.add(driver_code); return { row: index + 2, first_name, last_name, driver_code, valid: errors.length === 0, errors } })
  return { rows, total: rows.length, ready: rows.filter((row) => row.valid).length, invalid: rows.filter((row) => !row.valid).length }
}
export const importableDriverRows = (preview) => preview?.rows.filter((row) => row.valid).map(({ first_name, last_name, driver_code }) => ({ first_name, last_name, driver_code })) ?? []
