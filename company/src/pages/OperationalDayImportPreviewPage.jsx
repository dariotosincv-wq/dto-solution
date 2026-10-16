import { useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, FileText, Link2, RotateCcw, Upload, X } from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'
import { canManageVehicles } from '../access.js'
import { readConvocationDefinitivePdf } from '../lib/convocationDefinitivePdf.js'
import { readAssignmentDeparturePdf } from '../lib/assignmentDeparturePdf.js'
import { buildOperationalDayImportPreview, previewRowId } from '../lib/operationalDayImportPreview.js'
import { normalizeConvocationDriverName } from '../lib/convocationDefinitiveCore.js'
import { confirmOperationalDay, loadCompanyDrivers, loadCompanyVehicles, loadOperationalDayAnomalies, resolveOperationalDayAnomaly, updateCompanyDriver } from '../lib/companySupabase.js'
import { operationalDayAnomalyPayload, prepareOperationalDayConfirmation } from '../lib/operationalDayConfirmation.js'
import { COMPANY_ROUTES } from '../routes.js'
import './operational-day-import.css'

const emptyFiles = { convocation: null, assignment: null }
const emptyDirectory = { drivers: [], vehicles: [], loaded: false }
const label = value => value || '—'

export default function OperationalDayImportPreviewPage() {
  const { access, session } = useAuth()
  const navigate = useNavigate()
  const convocationInput = useRef(null)
  const assignmentInput = useRef(null)
  const [files, setFiles] = useState(emptyFiles)
  const [parsed, setParsed] = useState(null)
  const [directory, setDirectory] = useState(emptyDirectory)
  const [manualLinks, setManualLinks] = useState([])
  const [selectedConvocation, setSelectedConvocation] = useState('')
  const [selectedAssignment, setSelectedAssignment] = useState('')
  const [loading, setLoading] = useState(false)
  const [reactivating, setReactivating] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [confirmationMessage, setConfirmationMessage] = useState('')
  const [savedAnomalies, setSavedAnomalies] = useState([])
  const [anomalyDate, setAnomalyDate] = useState('')
  const [anomalyChoices, setAnomalyChoices] = useState({})
  const confirmationRef = useRef(null)
  const anomalyPayloadRef = useRef(null)

  const preview = useMemo(
    () => parsed ? buildOperationalDayImportPreview({ ...parsed, manual_links: manualLinks }) : null,
    [parsed, manualLinks],
  )
  const prepared = useMemo(
    () => preview && directory.loaded ? prepareOperationalDayConfirmation(preview.rows, directory.drivers, directory.vehicles) : null,
    [preview, directory],
  )

  const clear = () => {
    setFiles(emptyFiles)
    setParsed(null)
    setDirectory(emptyDirectory)
    setManualLinks([])
    setSelectedConvocation('')
    setSelectedAssignment('')
    setLoading(false)
    setReactivating('')
    setConfirming(false)
    setError('')
    setConfirmationMessage('')
    setSavedAnomalies([])
    setAnomalyDate('')
    setAnomalyChoices({})
    confirmationRef.current = null
    anomalyPayloadRef.current = null
    if (convocationInput.current) convocationInput.current.value = ''
    if (assignmentInput.current) assignmentInput.current.value = ''
  }

  if (!canManageVehicles(access)) return <Navigate to={COMPANY_ROUTES.dashboard} replace />

  const loadDirectory = async () => {
    const [driverData, vehicleData] = await Promise.all([
      loadCompanyDrivers(session.access_token),
      loadCompanyVehicles(session.access_token),
    ])
    setDirectory({ drivers: driverData.items || [], vehicles: vehicleData.items || [], loaded: true })
  }

  const choose = (kind, file) => {
    setFiles(current => ({ ...current, [kind]: file || null }))
    setParsed(null)
    setDirectory(emptyDirectory)
    setManualLinks([])
    setError('')
    setConfirmationMessage('')
    confirmationRef.current = null
    anomalyPayloadRef.current = null
  }

  const process = async () => {
    if (!files.convocation || !files.assignment || loading) return
    setLoading(true)
    setError('')
    setConfirmationMessage('')
    setManualLinks([])
    setDirectory(emptyDirectory)
    try {
      const [convocation, assignment] = await Promise.all([
        readConvocationDefinitivePdf(files.convocation),
        readAssignmentDeparturePdf(files.assignment),
      ])
      setParsed({ convocation, assignment })
      await loadDirectory()
    } catch {
      setParsed(null)
      setDirectory(emptyDirectory)
      setError('Impossibile preparare l’anteprima o verificare l’anagrafica. Nessun PDF è stato salvato.')
    } finally {
      setLoading(false)
    }
  }

  const addManualLink = () => {
    if (!selectedConvocation || !selectedAssignment) return
    setManualLinks(links => links.some(link => link.convocation_row_id === selectedConvocation || link.assignment_row_id === selectedAssignment)
      ? links
      : [...links, { id: `${selectedConvocation}|${selectedAssignment}`, convocation_row_id: selectedConvocation, assignment_row_id: selectedAssignment }])
    setSelectedConvocation('')
    setSelectedAssignment('')
  }

  const addSuggestedLink = suggestion => {
    setManualLinks(links => links.some(link => link.convocation_row_id === suggestion.convocation_row_id || link.assignment_row_id === suggestion.assignment_row_id)
      ? links
      : [...links, { id: suggestion.id, convocation_row_id: suggestion.convocation_row_id, assignment_row_id: suggestion.assignment_row_id }])
  }

  const reactivateDriver = async archivedDriver => {
    const name = `${archivedDriver.first_name} ${archivedDriver.last_name}`
    if (reactivating || !window.confirm(`Riattivare ${name}? Sarà modificato solo lo stato del driver esistente.`)) return
    setReactivating(archivedDriver.driver_id)
    setError('')
    try {
      const updated = await updateCompanyDriver(session.access_token, { driver_id: archivedDriver.driver_id, action: 'REACTIVATE' })
      setDirectory(current => ({ ...current, drivers: current.drivers.map(driver => driver.driver_id === updated.driver_id ? updated : driver) }))
    } catch (reason) {
      setError(reason.message === 'DRIVER_NOT_ARCHIVED'
        ? 'Il driver non risulta più archiviato. Aggiorna l’anteprima.'
        : 'Riattivazione non riuscita. Nessun dato della giornata è stato modificato.')
    } finally {
      setReactivating('')
    }
  }

  const confirmDay = async () => {
    if (!preview || !prepared || !prepared.rows.length || confirming) return
    const outcomeAnomalies = preview.outcomes.map((item, index) => ({
      client_row_id: crypto.randomUUID(), reason_code: item.status === 'AMBIGUO' ? 'MATCH_AMBIGUOUS' : 'DRIVER_MISSING',
      driver_name_key: item.driver_name_key || null, vehicle_internal_code_key: null, vehicle_plate_key: null,
      route: null, departure_order: null, departure_group: null, parking_lot_position: null, departure_wave: null, local_index: index,
    }))
    const partial = prepared.unresolved.length + outcomeAnomalies.length > 0
    if (!window.confirm(partial ? `Confermi ${prepared.rows.length} driver validi? ${prepared.unresolved.length + outcomeAnomalies.length} anomalie resteranno aperte.` : `Confermi il salvataggio della giornata ${preview.operational_date}? I PDF non verranno salvati.`)) return
    setConfirming(true)
    setError('')
    setConfirmationMessage('')
    try {
      if (!confirmationRef.current) confirmationRef.current = crypto.randomUUID()
      if (partial && !anomalyPayloadRef.current) anomalyPayloadRef.current = [...operationalDayAnomalyPayload(prepared.unresolved), ...outcomeAnomalies]
      await confirmOperationalDay(session.access_token, {
        action: partial ? 'CONFIRM_PARTIAL' : 'CONFIRM',
        operating_date: preview.operational_date,
        idempotency_key: confirmationRef.current,
        rows: prepared.rows,
        ...(partial ? { anomalies: anomalyPayloadRef.current } : {}),
      })
      setAnomalyDate(preview.operational_date)
      if (partial) setSavedAnomalies((await loadOperationalDayAnomalies(session.access_token, preview.operational_date)).items || [])
      setConfirmationMessage(partial ? 'Driver validi confermati. Le anomalie restano aperte per la risoluzione successiva.' : 'Giornata confermata e salvata nello storico. I PDF non sono stati conservati.')
    } catch {
      setError('Conferma non riuscita. Nessun dato è stato salvato.')
    } finally {
      setConfirming(false)
    }
  }

  const loadSavedAnomalies = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(anomalyDate)) return
    setError('')
    try {
      const [data] = await Promise.all([loadOperationalDayAnomalies(session.access_token, anomalyDate), directory.loaded ? Promise.resolve() : loadDirectory()])
      setSavedAnomalies(data.items || [])
    } catch { setError('Impossibile leggere le anomalie della giornata.') }
  }

  const resolveSavedAnomaly = async (item) => {
    const choice = anomalyChoices[item.id] || {}
    if (!choice.driver_id || !choice.vehicle_id || !window.confirm('Confermare il recupero? Verrà creata una revisione correttiva della giornata.')) return
    try {
      await resolveOperationalDayAnomaly(session.access_token, { action: 'RESOLVE', anomaly_id: item.id, idempotency_key: crypto.randomUUID(), driver_id: choice.driver_id, vehicle_id: choice.vehicle_id })
      await loadSavedAnomalies()
    } catch { setError('Recupero non riuscito: il driver, il mezzo o l’ordine potrebbero essere in conflitto.') }
  }
  const excludeSavedAnomaly = async (item) => {
    const exclusion_reason = window.prompt('Motivo dell’esclusione (obbligatorio):')
    if (!exclusion_reason) return
    try { await resolveOperationalDayAnomaly(session.access_token, { action: 'EXCLUDE', anomaly_id: item.id, exclusion_reason }); await loadSavedAnomalies() }
    catch { setError('Esclusione non riuscita.') }
  }

  const exit = () => {
    clear()
    navigate(COMPANY_ROUTES.assignments)
  }
  const automaticKeys = new Set(preview?.rows.filter(row => !row.manual_confirmation).map(row => row.driver_name_key) ?? [])
  const availableConvocation = parsed?.convocation.rows.filter(row => !automaticKeys.has(normalizeConvocationDriverName(row.driver_name)) && !manualLinks.some(link => link.convocation_row_id === previewRowId('convocation', row))) ?? []
  const availableAssignment = parsed?.assignment.rows.filter(row => !automaticKeys.has(normalizeConvocationDriverName(row.driver_name)) && !manualLinks.some(link => link.assignment_row_id === previewRowId('assignment_departure', row))) ?? []
  const archivedIssues = prepared?.unresolved.filter(item => item.archived_driver) ?? []

  return <div className="company-page operational-import-page">
    <header>
      <p className="company-kicker">Pianificazione</p>
      <h1>Anteprima giornata operativa</h1>
      <p>PDF e risultati restano solo nella memoria di questa pagina. Nessun file, testo estratto, nome file o correzione viene inviato o salvato.</p>
    </header>

    <section className="operational-import-card" aria-labelledby="import-files-title">
      <div><h2 id="import-files-title">PDF della giornata</h2><p>Seleziona entrambi i documenti: la convocazione definitiva e assegnazione/uscita.</p></div>
      <div className="operational-file-grid">
        <label className="operational-file"><FileText aria-hidden="true" /><span><strong>Convocazione definitiva</strong><small>{files.convocation ? 'PDF selezionato in memoria' : 'Nessun PDF selezionato'}</small></span><input ref={convocationInput} type="file" accept="application/pdf" onChange={event => choose('convocation', event.target.files?.[0])} /></label>
        <label className="operational-file"><FileText aria-hidden="true" /><span><strong>Assegnazione / Uscita</strong><small>{files.assignment ? 'PDF selezionato in memoria' : 'Nessun PDF selezionato'}</small></span><input ref={assignmentInput} type="file" accept="application/pdf" onChange={event => choose('assignment', event.target.files?.[0])} /></label>
      </div>
      <div className="operational-import-actions">
        <button type="button" className="operational-primary" disabled={!files.convocation || !files.assignment || loading} onClick={() => void process()}><Upload size={17} />{loading ? 'Elaborazione in memoria…' : 'Elabora anteprima'}</button>
        <button type="button" onClick={clear}><RotateCcw size={17} />Annulla e svuota</button>
        <button type="button" onClick={exit}>Esci dall’anteprima</button>
      </div>
    </section>

    {error && <p className="notice notice--error">{error}</p>}
    {confirmationMessage && <p className="notice notice--success">{confirmationMessage}</p>}

    {preview && <>
      <section className="operational-date-notice"><CheckCircle2 aria-hidden="true" /><div><strong>Data operativa: {preview.operational_date || 'non ricavata'}</strong><span>La data dell’uscita non è verificabile dal contenuto del PDF e non viene dedotta dal nome del file.</span></div></section>
      <section className="operational-summary" aria-label="Riepilogo anteprima">{[['Righe convocazione', preview.summary.convocation_rows], ['Righe uscita', preview.summary.assignment_rows], ['Pronti', prepared?.rows.length ?? 0], ['Anomalie', (prepared?.unresolved.length ?? 0) + preview.summary.missing + preview.summary.ambiguous]].map(([title, value]) => <div key={title}><span>{title}</span><strong>{value}</strong></div>)}</section>

      {archivedIssues.length > 0 && <section className="operational-review operational-archived-drivers" aria-label="Driver archiviati">
        <div><AlertTriangle aria-hidden="true" /><div><h2>Driver archiviati</h2><p>Questi record esistono già nella tua azienda. La riattivazione modifica solo il loro stato e aggiorna questa anteprima senza rileggere i PDF.</p></div></div>
        <ul>{archivedIssues.map(issue => <li key={issue.archived_driver.driver_id}><span><strong>Driver archiviato: {issue.archived_driver.first_name} {issue.archived_driver.last_name}</strong><small>Ordine di partenza {issue.departure_order}</small></span><button type="button" disabled={reactivating === issue.archived_driver.driver_id} onClick={() => void reactivateDriver(issue.archived_driver)}>{reactivating === issue.archived_driver.driver_id ? 'Riattivazione…' : 'Riattiva driver'}</button></li>)}</ul>
      </section>}

      {preview.outcomes.length > 0 && <section className="operational-review" aria-labelledby="review-title">
        <div><AlertTriangle aria-hidden="true" /><div><h2 id="review-title">Righe da verificare</h2><p>{preview.summary.missing} mancanti · {preview.summary.ambiguous} ambigue. I suggerimenti sono temporanei: non viene salvato nulla.</p></div></div>
        {preview.suggestions.length > 0 && <div className="operational-manual-link"><strong>Abbinamenti suggeriti</strong><p>Il nome della convocazione è l’inizio univoco del nome nell’uscita. Verifica e conferma solo quelli corretti.</p>{preview.suggestions.map(suggestion => <button key={suggestion.id} type="button" onClick={() => addSuggestedLink(suggestion)}><Link2 size={17} />Abbina {suggestion.convocation_name} ↔ {suggestion.assignment_name}</button>)}</div>}
        <ul className="operational-outcomes">{preview.outcomes.map((outcome, index) => <li key={`${outcome.status}-${outcome.driver_name_key}-${index}`} className={outcome.status === 'AMBIGUO' ? 'is-ambiguous' : ''}><strong>{outcome.status}</strong><span>{outcome.driver_name || 'Nome non disponibile'}</span><small>{outcome.issues.join(' · ')}</small></li>)}</ul>
        <div className="operational-manual-link">
          <label>Riga convocazione<select value={selectedConvocation} onChange={event => setSelectedConvocation(event.target.value)}><option value="">Seleziona</option>{availableConvocation.map(row => <option key={previewRowId('convocation', row)} value={previewRowId('convocation', row)}>Riga {row.row} · {row.driver_name || 'nome mancante'}</option>)}</select></label>
          <label>Riga uscita<select value={selectedAssignment} onChange={event => setSelectedAssignment(event.target.value)}><option value="">Seleziona</option>{availableAssignment.map(row => <option key={previewRowId('assignment_departure', row)} value={previewRowId('assignment_departure', row)}>Riga {row.row} · {row.driver_name || 'nome mancante'}</option>)}</select></label>
          <button type="button" disabled={!selectedConvocation || !selectedAssignment} onClick={addManualLink}><Link2 size={17} />Conferma abbinamento manuale</button>
        </div>
      </section>}

      <section className="operational-results" aria-labelledby="results-title">
        <header><div><h2 id="results-title">Righe abbinate</h2><p>Ordinate dall’ordine globale di partenza; wave e gruppo sono solo descrittivi.</p></div><button type="button" disabled={!prepared || !prepared.rows.length || confirming || Boolean(confirmationMessage)} onClick={() => void confirmDay()}>{confirming ? 'Conferma in corso…' : confirmationMessage ? 'Giornata confermata' : prepared?.unresolved.length || preview.outcomes.length ? 'Conferma i driver validi' : 'Conferma giornata'}</button></header>
        <div className="operational-table-wrap"><table><thead><tr><th>Driver</th><th>Turno</th><th>Mezzo</th><th>Targa</th><th>Rotta</th><th>Gruppo</th><th>Parking Lot</th><th>Wave</th><th>Ordine</th><th>Stato</th></tr></thead><tbody>{preview.rows.map(row => <tr key={`${row.status}-${row.driver_name_key}-${row.departure_order}`} className={row.manual_confirmation ? 'is-manual' : ''}><th scope="row">{label(row.driver_name)}</th><td>{label(row.shift_type)}</td><td>{label(row.internal_vehicle_code)}</td><td>{label(row.vehicle_plate)}</td><td>{label(row.route)}</td><td>{label(row.departure_group)}</td><td>{label(row.parking_lot_position)}</td><td>{label(row.departure_wave)}</td><td>{label(row.departure_order)}</td><td>{row.manual_confirmation ? <span className="operational-badge operational-badge--manual">Manuale <button type="button" aria-label="Rimuovi abbinamento manuale" onClick={() => setManualLinks(links => links.filter(link => link.id !== row.manual_link_id))}><X size={14} /></button></span> : <span className="operational-badge">Automatico</span>}</td></tr>)}</tbody></table></div>
        {!preview.rows.length && <p className="operational-empty">Non ci sono ancora abbinamenti completi.</p>}
      </section>
    </>}

    <section className="operational-review" aria-labelledby="saved-anomalies-title">
      <div><AlertTriangle aria-hidden="true" /><div><h2 id="saved-anomalies-title">Anomalie giornata</h2><p>Solo metadati normalizzati necessari al recupero; nessun PDF o testo estratto viene conservato.</p></div></div>
      <div className="operational-manual-link"><label>Data giornata<input type="date" value={anomalyDate} onChange={event => setAnomalyDate(event.target.value)} /></label><button type="button" onClick={() => void loadSavedAnomalies()} disabled={!anomalyDate}>Apri anomalie</button></div>
      {savedAnomalies.length > 0 && <ul className="operational-outcomes">{savedAnomalies.map(item => <li key={item.id} className={item.status === 'open' ? 'is-ambiguous' : ''}>
        <strong>{item.status === 'open' ? item.reason_code : item.status === 'resolved' ? 'RISOLTA' : 'ESCLUSA'}</strong>
        <span>{item.driver_name_key || 'Driver non disponibile'}{item.vehicle_internal_code_key || item.vehicle_plate_key ? ` · ${item.vehicle_internal_code_key || ''} ${item.vehicle_plate_key || ''}` : ''}</span>
        <small>Ordine di partenza {item.departure_order ?? 'non disponibile'}{item.exclusion_reason ? ` · ${item.exclusion_reason}` : ''}</small>
        {item.status === 'open' && <div className="operational-manual-link">
          <label>Driver<select value={anomalyChoices[item.id]?.driver_id || ''} onChange={event => setAnomalyChoices(current => ({ ...current, [item.id]: { ...current[item.id], driver_id: event.target.value } }))}><option value="">Seleziona driver attivo</option>{directory.drivers.filter(driver => driver.status === 'active').map(driver => <option key={driver.driver_id} value={driver.driver_id}>{driver.last_name} {driver.first_name}</option>)}</select></label>
          <label>Mezzo<select value={anomalyChoices[item.id]?.vehicle_id || ''} onChange={event => setAnomalyChoices(current => ({ ...current, [item.id]: { ...current[item.id], vehicle_id: event.target.value } }))}><option value="">Seleziona mezzo attivo</option>{directory.vehicles.filter(vehicle => vehicle.status === 'active').map(vehicle => <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>{vehicle.internal_code} · {vehicle.plate}</option>)}</select></label>
          <button type="button" disabled={!anomalyChoices[item.id]?.driver_id || !anomalyChoices[item.id]?.vehicle_id} onClick={() => void resolveSavedAnomaly(item)}>Correggi e recupera</button>
          <button type="button" onClick={() => void excludeSavedAnomaly(item)}>Escludi con motivo</button>
        </div>}
      </li>)}</ul>}
      {anomalyDate && savedAnomalies.length === 0 && <p className="operational-empty">Nessuna anomalia per la data selezionata.</p>}
    </section>
  </div>
}
