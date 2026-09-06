import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { canManageVehicles } from '../access.js'
import { createCompanyVehicle, importCompanyVehicles, loadCompanyVehicles, loadVehicleRemovalPlan, removeCompanyVehicle } from '../lib/companySupabase.js'
import { importableFleetRows, parseFleetCsv } from '../lib/fleetCsv.js'
import { removeVehicleOptimistically } from '../lib/fleetRemovalState.js'
import { COMPANY_ROUTES } from '../routes.js'
import { CarFront, Truck, BusFront, Plus, Upload, Eye, Trash2, ShieldCheck } from 'lucide-react'
import { VEHICLE_CATEGORIES } from '../lib/vehicleSort.js'
import './vehicles.css'

const categoryLabels = { LARGE: 'Large', MEDIUM: 'Medium', SMALL: 'Small', EXTRA_SMALL: 'Extra Small' }
const categoryIcons = { LARGE: BusFront, MEDIUM: Truck, SMALL: CarFront, EXTRA_SMALL: CarFront }
const codeOrder = new Intl.Collator('it', { numeric: true, sensitivity: 'base' })

const empty = { internal_code: '', plate: '', silhouette_category: 'SMALL' }
export default function VehiclesPage() {
  const { access, session } = useAuth()
  const [items, setItems] = useState([]), [existing, setExisting] = useState([]), [form, setForm] = useState(empty), [error, setError] = useState('')
  const [preview, setPreview] = useState(null), [importing, setImporting] = useState(false), [removing, setRemoving] = useState(''), [report, setReport] = useState(null)
  const [sort, setSort] = useState('asc')
  const fileRef = useRef(null)
  const refresh = useCallback(() => loadCompanyVehicles(session.access_token).then((result) => { setItems(result.items); setExisting(result.existing ?? result.items) }).catch(() => setError('Catalogo veicoli non disponibile.')), [session.access_token])
  useEffect(() => { if (canManageVehicles(access)) void refresh() }, [access, refresh])
  if (!canManageVehicles(access)) return <Navigate to={COMPANY_ROUTES.dashboard} replace />
  const submit = async (event) => { event.preventDefault(); setError(''); try { await createCompanyVehicle(session.access_token, form); setForm(empty); await refresh() } catch (reason) { setError(reason.message === 'VEHICLE_PLATE_EXISTS' ? 'Targa già presente nell’organizzazione.' : 'Creazione non riuscita.') } }
  const chooseCsv = async (event) => { const file = event.target.files?.[0]; event.target.value = ''; setReport(null); setError(''); if (!file) return; try { setPreview(parseFleetCsv(await file.text(), existing)) } catch (reason) { setPreview(null); setError(reason.message === 'CSV_HEADER_NON_VALIDO' ? 'Header CSV non valido. Usa: codice_mezzo,targa,categoria' : 'File CSV non valido.') } }
  const confirmImport = async () => { const vehicles = importableFleetRows(preview); if (!vehicles.length || importing) return; setImporting(true); setError(''); try { const result = await importCompanyVehicles(session.access_token, vehicles); setReport({ imported: result.imported, skipped: preview.invalid + result.skipped }); setPreview(null); await refresh() } catch { setError('Importazione flotta non riuscita.') } finally { setImporting(false) } }
  const remove = async (vehicle) => { if (removing) return; setRemoving(vehicle.vehicle_id); setError(''); try { const plan = await loadVehicleRemovalPlan(session.access_token, vehicle.vehicle_id); const message = plan.hasHistory ? 'Questo veicolo ha uno storico. Verrà archiviato e non sarà più disponibile nella flotta operativa.' : 'Rimuovere definitivamente questo veicolo?'; if (!window.confirm(message)) return; await removeVehicleOptimistically({ vehicle, items, setItems, setError, request: () => removeCompanyVehicle(session.access_token, vehicle.vehicle_id) }) } catch { /* safe UI error */ } finally { setRemoving('') } }
  const sortedItems = [...items].sort((a, b) => codeOrder.compare(a.internal_code, b.internal_code) * (sort === 'asc' ? 1 : -1))
  return <div className="company-page vehicles-page">
    <header><p className="company-kicker">Parco mezzi</p><h1>Veicoli</h1><p>Anagrafica e mappe danni della tua organizzazione.</p></header>
    <aside className="vehicles-banner" aria-label="La tua flotta sotto controllo">
      <div><strong>Ogni veicolo sotto controllo.</strong><p>Dati sempre aggiornati, più sicurezza per la tua flotta.</p></div>
      <div className="vehicles-banner-art" aria-hidden="true"><img src="/company/vehicle-silhouettes/small-right.png" alt="" /><span><ShieldCheck size={42} /></span></div>
    </aside>
    {error && <p className="notice notice--error">{error}</p>}{report && <p className="notice">{report.imported} veicoli importati · {report.skipped} non importati</p>}
    <form className="vehicle-form vehicles-add" aria-label="Aggiungi un veicolo" onSubmit={submit}>
      <label>Codice mezzo<input aria-label="Codice mezzo" placeholder="Codice mezzo" value={form.internal_code} onChange={(event) => setForm({ ...form, internal_code: event.target.value })} /></label>
      <label>Targa<input aria-label="Targa" placeholder="Targa" value={form.plate} onChange={(event) => setForm({ ...form, plate: event.target.value })} /></label>
      <label>Categoria<select aria-label="Categoria" value={form.silhouette_category} onChange={(event) => setForm({ ...form, silhouette_category: event.target.value })}>{['EXTRA_SMALL', 'SMALL', 'MEDIUM', 'LARGE'].map(category => <option value={category} key={category}>{categoryLabels[category]}</option>)}</select></label>
      <button type="submit"><Plus size={19} aria-hidden="true" />Aggiungi veicolo</button>
      <button type="button" className="button-secondary" onClick={() => fileRef.current?.click()}><Upload size={18} aria-hidden="true" />Importa flotta CSV</button>
      <input ref={fileRef} className="visually-hidden" type="file" accept=".csv,text/csv" onChange={chooseCsv} />
    </form>
    <section className="vehicles-kpis" aria-label="Riepilogo catalogo veicoli">
      <article className="vehicles-kpi" data-category="total"><span className="vehicles-kpi-icon"><CarFront aria-hidden="true" /></span><div><h2>Totale veicoli</h2><strong>{items.length}</strong><small>Nella tua flotta</small></div></article>
      {VEHICLE_CATEGORIES.map(category => { const Icon = categoryIcons[category]; return <article className="vehicles-kpi" data-category={category} key={category}><span className="vehicles-kpi-icon"><Icon aria-hidden="true" /></span><div><h2>{categoryLabels[category]}</h2><strong>{items.filter(vehicle => vehicle.silhouette_category === category).length}</strong><small>Veicoli</small></div></article> })}
    </section>
    {preview && <section className="fleet-preview" aria-label="Anteprima importazione flotta"><header><h2>Anteprima CSV</h2><p>{preview.total} righe lette · {preview.ready} pronte per import · {preview.invalid} con errori o duplicate</p></header><div className="fleet-preview__table"><div className="fleet-preview__head"><span>Riga</span><span>Codice mezzo</span><span>Targa</span><span>Categoria</span><span>Stato</span></div>{preview.rows.map((row) => <div key={row.row}><span>{row.row}</span><span>{row.internal_code || '—'}</span><span>{row.plate || '—'}</span><span>{row.silhouette_category || '—'}</span><span className={row.valid ? 'fleet-valid' : 'fleet-invalid'}>{row.valid ? 'Pronto' : row.errors.join(' · ')}</span></div>)}</div><footer><button type="button" className="button-secondary" onClick={() => setPreview(null)}>Annulla</button><button type="button" disabled={!preview.ready || importing} onClick={confirmImport}>{importing ? 'Importazione…' : `Importa ${preview.ready} veicoli`}</button></footer></section>}
    <section className="vehicles-catalog" aria-labelledby="vehicles-list-title">
      <header><h2 id="vehicles-list-title">Elenco veicoli</h2><span>{items.length} veicoli nel catalogo</span><label>Ordina per<select value={sort} onChange={event => setSort(event.target.value)}><option value="asc">Codice mezzo (A–Z)</option><option value="desc">Codice mezzo (Z–A)</option></select></label></header>
      <table className="vehicles-table">
        <caption className="visually-hidden">Catalogo veicoli della tua organizzazione</caption>
        <thead><tr><th scope="col">Codice mezzo</th><th scope="col">Targa</th><th scope="col">Categoria</th><th scope="col">Stato</th><th scope="col">Azioni</th></tr></thead>
        <tbody>{sortedItems.map(vehicle => <tr data-attention={vehicle.open_report_count > 0 ? 'true' : undefined} key={vehicle.vehicle_id}>
          <th scope="row"><Link to={COMPANY_ROUTES.vehicle(vehicle.vehicle_id)}><strong>{vehicle.internal_code}</strong></Link>{vehicle.open_report_count > 0 && <small className="vehicles-reports">{vehicle.open_report_count} {vehicle.open_report_count === 1 ? 'segnalazione aperta' : 'segnalazioni aperte'}</small>}</th>
          <td data-label="Targa"><span className="vehicles-plate">{vehicle.plate}</span></td>
          <td data-label="Categoria"><span className="vehicles-category" data-category={vehicle.silhouette_category}>{categoryLabels[vehicle.silhouette_category] ?? vehicle.silhouette_category}</span></td>
          <td data-label="Stato"><span className="vehicles-status" data-status={vehicle.status}>{vehicle.status === 'active' ? 'Attivo' : vehicle.status === 'inactive' ? 'Disattivato' : vehicle.status ?? 'Non disponibile'}</span></td>
          <td className="vehicles-row-actions"><Link to={COMPANY_ROUTES.vehicle(vehicle.vehicle_id)} aria-label={`Apri ${vehicle.internal_code}`}><Eye size={17} aria-hidden="true" />Apri</Link><button type="button" aria-label={`Rimuovi ${vehicle.internal_code}`} disabled={removing === vehicle.vehicle_id} onClick={() => void remove(vehicle)}><Trash2 size={16} aria-hidden="true" />{removing === vehicle.vehicle_id ? 'Attendi…' : 'Rimuovi'}</button></td>
        </tr>)}</tbody>
      </table>
      {items.length === 0 && <p className="vehicles-empty">Nessun veicolo nel catalogo.</p>}
    </section>
  </div>
}
