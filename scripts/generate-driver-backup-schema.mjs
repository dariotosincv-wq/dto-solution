// Reads only the already ported DTO vendor files. Never accesses the Android project.
import ts from 'typescript'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { BACKUP_EXCLUDED_FIELDS } from '../src/features/driver/backup/backupPolicy.js'

const root = resolve(import.meta.dirname, '..')
const sources = ['driverPayrollTypes.ts', 'driverPayrollFiscalTypes.ts', 'driverContractProfile.ts']
const paths = sources.map(name => resolve(root, 'vendor/driver-utility/src/lib', name))
const program = ts.createProgram(paths, { strictNullChecks: true, target: ts.ScriptTarget.ES2022, skipLibCheck: true })
const checker = program.getTypeChecker()
const definitions = {}
const seen = new Map()
function convert(type) {
  if (type.isUnion()) {
    const types = type.types.filter(item => !(item.flags & ts.TypeFlags.Undefined))
    return { anyOf: types.map(convert) }
  }
  if (type.isStringLiteral() || type.isNumberLiteral()) return { const: type.value }
  if (type.flags & ts.TypeFlags.BooleanLiteral) return { const: type.intrinsicName === 'true' }
  for (const [flag, name] of [[ts.TypeFlags.String, 'string'], [ts.TypeFlags.Number, 'number'], [ts.TypeFlags.Boolean, 'boolean']]) {
    if (type.flags & flag) return { type: name }
  }
  if (checker.isArrayType(type)) return { type: 'array', items: convert(checker.getTypeArguments(type)[0]) }
  if (!(type.flags & ts.TypeFlags.Object)) throw new Error(`Unsupported backup type: ${checker.typeToString(type)}`)
  if (seen.has(type)) return { ref: seen.get(type) }
  const name = `d${seen.size}`
  seen.set(type, name)
  const schema = { type: 'object', properties: {}, required: [] }
  definitions[name] = schema
  for (const property of checker.getPropertiesOfType(type)) {
    if (BACKUP_EXCLUDED_FIELDS.includes(property.name)) continue
    schema.properties[property.name] = convert(checker.getTypeOfSymbolAtLocation(property, property.valueDeclaration ?? property.declarations[0]))
    if (!(property.flags & ts.SymbolFlags.Optional)) schema.required.push(property.name)
  }
  const index = checker.getIndexTypeOfType(type, ts.IndexKind.String)
  if (index) schema.additionalProperties = convert(index)
  return { ref: name }
}
function namedType(file, name) {
  const symbol = checker.getExportsOfModule(checker.getSymbolAtLocation(program.getSourceFile(file))).find(symbol => symbol.name === name)
  if (!symbol) throw new Error(`Missing original type ${name}`)
  return convert(checker.getDeclaredTypeOfSymbol(symbol))
}
const schema = {
  provenance: { generator: 'scripts/generate-driver-backup-schema.mjs', typescript: ts.version, sources: paths.map((path, index) => ({ file: `vendor/driver-utility/src/lib/${sources[index]}`, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') })) },
  payroll: namedType(paths[0], 'DriverPayrollDataStore'),
  contract: namedType(paths[2], 'DriverContractProfile'),
  definitions,
}
// The real simulator persists estimate.summary (a subtype of PayslipSummary).
// Accept that original subtype too; do not discard its additional counters.
const store = definitions[schema.payroll.ref]
const prediction = definitions[store.properties.predictions.items.ref]
prediction.properties.predictedSummary = { anyOf: [prediction.properties.predictedSummary, namedType(paths[0], 'DriverPayrollEstimateSummary')] }
const output = '// Generated from original TypeScript types; run node scripts/generate-driver-backup-schema.mjs.\nexport default ' + JSON.stringify(schema, null, 2) + '\n'
const target = resolve(root, 'src/features/driver/backup/schema.generated.js')
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== output) throw new Error('Backup schema differs from the original types')
  console.log('Backup schema matches original types and source hashes')
} else writeFileSync(target, output)
