import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { canManageVehicles } from '../access.js'
import { createCompanyDriver, createDriverOperationalQr, importCompanyDrivers, loadCompanyDrivers, updateCompanyDriver } from '../lib/companySupabase.js'
import { importableDriverRows, parseDriverCsv } from '../lib/driverCsv.js'
import { COMPANY_ROUTES } from '../routes.js'

import { Users, UserCheck, Archive, Plus, Upload, ShieldCheck, QrCode } from 'lucide-react'
import './drivers.css'

const alphabet = new Intl.Collator('it', { sensitivity: 'base', numeric: true })
const empty = { driver_code: '', first_name: '', last_name: '' }
export default function DriversPage() {
  const { access, session } = useAuth()
  const [items, setItems] = useState([]), [form, setForm] = useState(empty), [error, setError] = useState(''), [preview, setPreview] = useState(null), [busy, setBusy] = useState(false), [qr, setQr] = useState(null)
  const [sort, setSort] = useState('surname-asc'), [search, setSearch] = useState(''), [status, setStatus] = useState('all')
  const fileRef = useRef(null)
  const refresh = useCallback(() => loadCompanyDrivers(session.access_token).then((value) => setItems(value.items)).catch(() => setError('Anagrafica driver non disponibile.')), [session.access_token])
  useEffect(() => { if (canManageVehicles(access)) void refresh() }, [access, refresh])
  if (!canManageVehicles(access)) return <Navigate to={COMPANY_ROUTES.dashboard} replace />
  const submit = async (event) => { event.preventDefault(); if (busy) return; setBusy(true); setError(''); try { await createCompanyDriver(session.access_token, form); setForm(empty); await refresh() } catch (reason) { setError(reason.message === 'DRIVER_CODE_EXISTS' ? 'Codice driver già presente.' : 'Creazione non riuscita.') } finally { setBusy(false) } }
  const chooseCsv = async (event) => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; try { setPreview(parseDriverCsv(await file.text(), items)); setError('') } catch { setError('CSV non valido. Usa: driver_code,nome,cognome') } }
  const confirmImport = async () => { if (busy) return; setBusy(true); try { await importCompanyDrivers(session.access_token, importableDriverRows(preview)); setPreview(null); await refresh() } catch { setError('Importazione driver non riuscita.') } finally { setBusy(false) } }
  const archive = async (driver) => { if (!window.confirm(`Archiviare ${driver.first_name} ${driver.last_name}? Lo storico resterà disponibile.`)) return; await updateCompanyDriver(session.access_token, { driver_id: driver.driver_id, action: 'ARCHIVE' }); await refresh() }
  const setProfile = async (driver, value) => {
    if (busy) return
    setBusy(true); setError('')
    try {
      const updated = await updateCompanyDriver(session.access_token, { driver_id: driver.driver_id, action: 'PROFILE', expected_weekly_days: value === '' ? null : Number(value) })
      setItems(current => current.map(item => item.driver_id === driver.driver_id ? updated : item))
    } catch { setError('Aggiornamento del profilo non riuscito.') } finally { setBusy(false) }
  }
  const generateQr = async (driver) => { if (busy) return; setBusy(true); setError(''); try { const result = await createDriverOperationalQr(session.access_token, driver.driver_id); const QRCode = (await import('qrcode')).default; setQr({ driver, path: result.access_path, image: await QRCode.toDataURL(`${window.location.origin}${result.access_path}`, { width: 360, margin: 2 }) }) } catch { setError('Generazione QR non riuscita.') } finally { setBusy(false) } }
  const shareQr = () => { const message = `Accesso personale DTO Solution. Usa questo link/QR per accedere alla tua Area Operativa: ${window.location.origin}${qr.path}`; window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer') }
  const query = search.trim().toLocaleLowerCase('it')
  const displayed = items.filter(driver => (status === 'all' || driver.status === status) && (!query || [driver.last_name, driver.first_name, driver.driver_code, `${driver.last_name} ${driver.first_name}`].some(value => (value ?? '').toLocaleLowerCase('it').includes(query)))).sort((a, b) => {
    const primary = sort === 'name-asc' ? 'first_name' : 'last_name'
    const secondary = primary === 'last_name' ? 'first_name' : 'last_name'
    return (alphabet.compare(a[primary], b[primary]) || alphabet.compare(a[secondary], b[secondary])) * (sort === 'surname-desc' ? -1 : 1)
  })
  return <div className="company-page driver-directory">
    <header><p className="company-kicker">Organizzazione</p><h1>Driver</h1><p>Anagrafica autisti per assegnazioni e ispezioni.</p></header>
    <aside className="drivers-banner"><div><strong>Il tuo team di autisti, sempre con te.</strong><p>Gestisci i driver, assegna i veicoli e monitora le attività.</p></div><div className="drivers-art" aria-hidden="true"><img src="/company/vehicle-silhouettes/small-right.png" alt="" /><span><ShieldCheck size={40}/></span></div></aside>
    {error && <p className="notice notice--error">{error}</p>}
    <form className="vehicle-form drivers-add" aria-label="Aggiungi un driver" onSubmit={submit}>
      <label>Codice driver (opzionale)<input aria-label="Codice driver" placeholder="Codice driver" value={form.driver_code} onChange={(e) => setForm({ ...form, driver_code: e.target.value })}/></label>
      <label>Nome<input aria-label="Nome" placeholder="Nome" required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })}/></label>
      <label>Cognome<input aria-label="Cognome" placeholder="Cognome" required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })}/></label>
      <button disabled={busy}><Plus size={18} aria-hidden="true"/>Aggiungi driver</button><button type="button" className="button-secondary" onClick={() => fileRef.current?.click()}><Upload size={18} aria-hidden="true"/>Importa CSV</button>
      <input ref={fileRef} className="visually-hidden" type="file" accept=".csv,text/csv" onChange={chooseCsv}/>
    </form>
    <section className="drivers-kpis" aria-label="Riepilogo driver">
      <article><span><Users aria-hidden="true"/></span><div><h2>Totale driver</h2><strong>{items.length}</strong><small>Nella tua organizzazione</small></div></article>
      <article><span><UserCheck aria-hidden="true"/></span><div><h2>Attivi</h2><strong>{items.filter(driver => driver.status === 'active').length}</strong><small>Driver operativi</small></div></article>
      <article><span><Archive aria-hidden="true"/></span><div><h2>Archiviati</h2><strong>{items.filter(driver => driver.status === 'archived').length}</strong><small>Storico conservato</small></div></article>
    </section>
    {preview && <section className="fleet-preview"><h2>Anteprima CSV</h2><p>{preview.total} righe · {preview.ready} pronte · {preview.invalid} non valide/duplicate</p><div className="driver-preview-list">{preview.rows.map((row) => <div key={row.row}><span>{row.row}</span><strong>{row.first_name} {row.last_name}</strong><small>{row.driver_code || 'Senza codice'}</small><em>{row.valid ? 'Pronto' : row.errors.join(', ')}</em></div>)}</div><button disabled={!preview.ready || busy} onClick={() => void confirmImport()}>Importa {preview.ready} driver</button></section>}
    <section className="drivers-catalog" aria-labelledby="drivers-title">
      <header><h2 id="drivers-title">Elenco driver</h2><span>{displayed.length} di {items.length} driver</span><label>Ordina per<select value={sort} onChange={event => setSort(event.target.value)}><option value="surname-asc">Cognome A–Z</option><option value="surname-desc">Cognome Z–A</option><option value="name-asc">Nome A–Z</option></select></label></header>
      <div className="drivers-filters"><label>Cerca driver<input type="search" placeholder="Cognome, nome o codice" value={search} onChange={event => setSearch(event.target.value)}/></label><label>Stato<select value={status} onChange={event => setStatus(event.target.value)}><option value="all">Tutti</option><option value="active">Attivi</option><option value="archived">Archiviati</option></select></label></div>
      <table className="drivers-table"><caption className="visually-hidden">Driver della tua organizzazione</caption><thead><tr><th scope="col">Cognome</th><th scope="col">Nome</th><th scope="col">Codice</th><th scope="col">Stato</th><th scope="col">Giornate settimanali previste</th><th scope="col">Azioni</th></tr></thead><tbody>
        {displayed.map(driver => <tr key={driver.driver_id}><th scope="row">{driver.last_name}<span className="drivers-mobile-name"> {driver.first_name}</span></th><td className="drivers-first-name">{driver.first_name}</td><td data-label="Codice">{driver.driver_code || 'Senza codice'}</td><td data-label="Stato"><span className="drivers-badge" data-status={driver.status}>{driver.status === 'active' ? 'Attivo' : driver.status === 'archived' ? 'Archiviato' : driver.status}</span></td><td data-label="Giornate settimanali previste"><select aria-label={`Giornate settimanali previste di ${driver.last_name} ${driver.first_name}`} value={driver.expected_weekly_days ?? ''} disabled={busy} onChange={event => void setProfile(driver, event.target.value)}><option value="">Da impostare</option>{[3,4,5,0,1,2,6,7].map(days => <option key={days} value={days}>{days} giorni</option>)}</select></td><td className="drivers-actions">{driver.status === 'active' && <><button type="button" onClick={() => void generateQr(driver)}><QrCode size={16} aria-hidden="true"/>Genera QR</button><button type="button" aria-label={`Archivia ${driver.last_name} ${driver.first_name}`} onClick={() => void archive(driver)}><Archive size={16} aria-hidden="true"/>Archivia</button></>}</td></tr>)}
      </tbody></table>
      {!displayed.length && <p className="drivers-empty">{items.length ? 'Nessun driver corrisponde alla ricerca.' : 'Nessun driver in anagrafica.'}</p>}
    </section>{qr && <dialog className="planning-editor" open><div><header><div><h2>QR personale</h2><p>{qr.driver.first_name} {qr.driver.last_name}</p></div><button type="button" onClick={() => setQr(null)}>×</button></header><img src={qr.image} alt="QR per accesso personale Area Operativa" width="280" height="280"/><p>Rigenerando il QR, quello precedente viene revocato.</p><div className="button-group"><button type="button" onClick={shareQr}>Condividi su WhatsApp</button><a className="button button--secondary" href={qr.image} download="dto-area-operativa-qr.png">Scarica QR</a></div></div></dialog>}
  </div>
}
