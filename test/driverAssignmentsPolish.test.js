import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseDriverCsv, importableDriverRows } from '../company/src/lib/driverCsv.js'
const drivers = readFileSync(new URL('../company/src/pages/DriversPage.jsx', import.meta.url), 'utf8')
const assignments = readFileSync(new URL('../company/src/pages/AssignmentsPage.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../company/src/styles.css', import.meta.url), 'utf8')
test('driver_code CSV reale viene preservato nel payload',()=>{const parsed=parseDriverCsv('driver_code,nome,cognome\nD003,Dario,Tosin');assert.equal(parsed.rows[0].driver_code,'D003');assert.deepEqual(importableDriverRows(parsed),[{driver_code:'D003',first_name:'Dario',last_name:'Tosin'}])})
test('alias storico codice_driver resta compatibile',()=>assert.equal(parseDriverCsv('codice_driver,nome,cognome\nD001,Mario,Rossi').rows[0].driver_code,'D001'))
test('driver page mostra codice reale o Senza codice',()=>{assert.match(drivers,/driver\.driver_code \|\| 'Senza codice'/);assert.match(drivers,/driver-status/)})
test('nuovo flusso DTO non contiene mojibake',()=>{for(const source of [drivers,assignments])assert.doesNotMatch(source,/Ã‚|Ãƒ|Ã¢|â€¦/)})
test('assignment continua a inviare vehicle_id',()=>assert.match(assignments,/saveCompanyAssignment[^\n]+driver_id, vehicle_id/))
test('assignment ha feedback e blocco doppio submit',()=>{assert.match(assignments,/Salvataggio…/);assert.match(assignments,/if \(!vehicle_id \|\| saving\) return/)})
test('layout assignment previene overflow e diventa mobile',()=>{assert.match(styles,/\.assignment-control select\{[^}]*min-width:0/);assert.match(styles,/\.assignment-row\{grid-template-columns:1fr/)})
