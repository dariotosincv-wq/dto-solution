import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, relative, dirname, join } from 'node:path'
import { createHash } from 'node:crypto'

// This command only READS the reference directory. All destinations are in DTO.
const destinationRoot = resolve(import.meta.dirname, '..')
const sourceRoot = 'C:/Users/dario/Desktop/PROGETTI APP/APP FINITE/DRIVER UTILITY'
const target = resolve(destinationRoot, 'vendor/driver-utility')
const files = new Set()
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)])
const relevant = walk(join(sourceRoot, 'src')).map(file => relative(sourceRoot, file).replaceAll('\\', '/')).filter(file =>
  /^src\/lib\/(driverPayroll|payrollValidationEngine\/)/.test(file) ||
  /^src\/lib\/(driverContractProfile|italianHolidays|monthlyAttendanceSummary|payrollAttendanceVerification|pdfGenerator|attendancePdfExport)\./.test(file) ||
  /^src\/pages\/(Attendance|DriverPayroll|DriverWorkPage)\./.test(file) ||
  /^src\/components\/payroll\//.test(file))
relevant.forEach(file => files.add(file))
files.add('src/test/setup.ts')
const sha = data => createHash('sha256').update(data).digest('hex')
const entries = []
const copy = (file, to = file) => {
  const output = resolve(target, to)
  if (!output.startsWith(target + '\\') && !output.startsWith(target + '/')) throw new Error('Destination outside DTO vendor directory')
  const bytes = readFileSync(join(sourceRoot, file))
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, bytes)
  entries.push({ source: file, destination: relative(destinationRoot, output).replaceAll('\\', '/'), sha256: sha(bytes), kind: /\.(test|spec)\./.test(file) ? 'original-test' : file.includes('/fixtures/') ? 'original-fixture' : 'original-source' })
}
// Deliberate first phase: original tests and fixtures BEFORE functional modules.
for (const file of files) if (/\.(test|spec)\./.test(file) || file.includes('/fixtures/')) copy(file)
const unresolved = new Set()
for (const file of files) {
  if (!/\.(ts|tsx|js|jsx)$/.test(file)) continue
  const content = readFileSync(join(sourceRoot, file), 'utf8')
  for (const match of content.matchAll(/(?:from\s*|import\s*\()(['"])([^'"]+)\1/g)) {
    const specifier = match[2]
    if (!specifier.startsWith('.') && !specifier.startsWith('@/')) continue
    const base = specifier.startsWith('@/') ? join(sourceRoot, 'src', specifier.slice(2)) : resolve(sourceRoot, dirname(file), specifier)
    const resolved = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'].map(ext => base + ext).find(candidate => existsSync(candidate) && !readdirSafe(candidate))
    if (resolved) files.add(relative(sourceRoot, resolved).replaceAll('\\', '/'))
    else unresolved.add(file + ': ' + specifier)
  }
}
function readdirSafe(path) { try { readdirSync(path); return true } catch { return false } }
if (unresolved.size) throw new Error([...unresolved].join('\n'))
for (const file of files) if (!entries.some(entry => entry.source === file)) copy(file)
for (const file of ['package.json', 'package-lock.json', 'vitest.config.ts', 'tailwind.config.ts', 'src/index.css', 'src/pages/Settings.tsx']) copy(file, 'reference/' + file)
const lock = JSON.parse(readFileSync(join(sourceRoot, 'package-lock.json'), 'utf8'))
const dependencies = Object.fromEntries(['react', 'react-dom', 'react-router-dom', 'pdfjs-dist', 'jspdf', 'vitest', 'jsdom', '@capacitor/preferences'].map(name => [name, lock.packages['node_modules/' + name]?.version]))
const dtoLock = JSON.parse(readFileSync(join(destinationRoot, 'package-lock.json'), 'utf8'))
const runtimeDependencyComparison = ['react', 'react-dom', 'react-router-dom', 'pdfjs-dist', 'jspdf', 'lucide-react', 'sonner', 'class-variance-authority', 'clsx', 'tailwind-merge', '@radix-ui/react-slot', '@radix-ui/react-alert-dialog', '@radix-ui/react-label', '@radix-ui/react-tabs', 'vitest', 'jsdom', '@testing-library/jest-dom', 'tailwindcss', 'tailwindcss-animate'].map(name => ({ name, original: lock.packages['node_modules/' + name]?.version, dto: dtoLock.packages['node_modules/' + (name === 'pdfjs-dist' ? 'driver-payroll-pdfjs' : name)]?.version, ...(name === 'pdfjs-dist' ? { dtoPackageAlias: 'driver-payroll-pdfjs', scope: 'Driver Utility imports only; existing DTO pdfjs-dist remains unchanged' } : {}) }))
writeFileSync(join(target, 'provenance.json'), JSON.stringify({ sourceRoot, portedAt: new Date().toISOString(), policy: 'Reference read-only. Original files copied byte-for-byte; browser adaptations live outside vendor.', copyOrder: 'Original tests and fixtures first; functional modules second.', dependencies, runtimeDependencyComparison, files: entries.sort((a,b) => a.source.localeCompare(b.source)) }, null, 2) + '\n')
console.log(JSON.stringify({ files: entries.length, tests: entries.filter(e => e.kind === 'original-test').length, fixtures: entries.filter(e => e.kind === 'original-fixture').length, dependencies }))
