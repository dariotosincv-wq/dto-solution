import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { canViewInspections } from '../access.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { cloudArchiveAction, createInspectionDownload, loadCloudArchive, loadCompanyInspections } from '../lib/companySupabase.js'
import { COMPANY_ROUTES } from '../routes.js'

import { FileText, Download, GitCompareArrows, ArrowDownToLine, ArrowUpFromLine, RotateCcw, ShieldCheck, Cloud } from 'lucide-react'
import './inspections.css'

const typeLabel = (value) => value === 'pickup' ? 'Presa' : 'Riconsegna'
const formatDate = (value) => new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const driverName = (item) => [item.driverFirstName, item.driverLastName].filter(Boolean).join(' ').trim()
const plateKey = (value) => String(value ?? '').replace(/[^a-z0-9]/gi, '').toUpperCase()
const vehicleKey = (item) => item.vehiclePlate ? `plate:${plateKey(item.vehiclePlate)}` : item.vehicleDescription ? `vehicle:${item.vehicleDescription}` : ''

export default function InspectionsPage() {
  const { access, session } = useAuth()
  const navigate = useNavigate()
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', plate: '', inspectionType: '' })
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  const [sort, setSort] = useState('newest')
  const [selected, setSelected] = useState([]); const [preparing, setPreparing] = useState(false)
  const [cloudArchive, setCloudArchive] = useState(null); const [exporting, setExporting] = useState(false); const [feedback, setFeedback] = useState('')
  const [quickFilter, setQuickFilter] = useState(null)
  const refresh = useCallback(async (next) => { setLoading(true); setError(''); try { const result = await loadCompanyInspections(session.access_token, next); setItems(result.items) } catch { setError('Non è stato possibile caricare le ispezioni.') } finally { setLoading(false) } }, [session.access_token])
  useEffect(() => {
    // Initial loading synchronizes the portal with the external CheckVan API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (canViewInspections(access)) refresh({})
  }, [access, refresh])
  useEffect(() => { if (canViewInspections(access)) void loadCloudArchive(session.access_token).then(setCloudArchive).catch(() => setCloudArchive({ connected: false })) }, [access, session.access_token])
  if (!canViewInspections(access)) return <Navigate to={COMPANY_ROUTES.dashboard} replace />
  const submit = (event) => { event.preventDefault(); setSelected([]); setQuickFilter(null); refresh(filters) }
  const download = async (item) => { try { const { url } = await createInspectionDownload(session.access_token, item.id); window.location.assign(url) } catch { setError('Download temporaneamente non disponibile.') } }
  const filteredItems = quickFilter ? items.filter(item => quickFilter.type === 'vehicle' ? vehicleKey(item) === quickFilter.value : driverName(item).toLocaleLowerCase('it') === quickFilter.value) : items
  const selectedItems = filteredItems.filter((item) => selected.includes(item.id)); const selectedVehicle = selectedItems[0]?.vehiclePlate || selectedItems[0]?.vehicleDescription || ''
  const sameVehicle = (item) => !selectedVehicle || (item.vehiclePlate || item.vehicleDescription || '') === selectedVehicle
  const toggle = (item) => setSelected((current) => current.includes(item.id) ? current.filter((value) => value !== item.id) : current.length < 2 && sameVehicle(item) ? [...current, item.id] : current)
  const firstSelected = selected[0] ? filteredItems.find((item) => item.id === selected[0]) : null
  const selectedVehicleKey = firstSelected?.vehiclePlate || firstSelected?.vehicleDescription || ''
  const compatibleInspection = firstSelected && [...filteredItems].filter((item) => {
    const itemVehicleKey = item.vehiclePlate || item.vehicleDescription || ''
    const isCompatibleType = firstSelected.inspectionType === 'pickup' ? item.inspectionType === 'return' : item.inspectionType === 'pickup'
    return itemVehicleKey === selectedVehicleKey && isCompatibleType && (firstSelected.inspectionType === 'pickup' ? new Date(item.inspectedAt) > new Date(firstSelected.inspectedAt) : new Date(item.inspectedAt) < new Date(firstSelected.inspectedAt))
  }).sort((left, right) => firstSelected.inspectionType === 'pickup' ? new Date(left.inspectedAt) - new Date(right.inspectedAt) : new Date(right.inspectedAt) - new Date(left.inspectedAt))[0]
  const applyQuickFilter = (type, value, label) => { setSelected([]); setQuickFilter({ type, value, label }) }
  const compare = async () => { setPreparing(true); setError(''); try { const chosen = [...selectedItems].sort((left, right) => new Date(left.inspectedAt) - new Date(right.inspectedAt)); const files = await Promise.all(chosen.map(async (item) => { const { url } = await createInspectionDownload(session.access_token, item.id); const response = await fetch(url); if (!response.ok) throw new Error('DOWNLOAD_FAILED'); const blob = await response.blob(); return new File([blob], `checkvan-${item.vehiclePlate}-${item.inspectedAt}.pdf`, { type: 'application/pdf' }) })); navigate(COMPANY_ROUTES.comparePdf, { state: { files, cloudItems: chosen } }) } catch { setError('Non è stato possibile preparare il confronto.') } finally { setPreparing(false) } }
  const exportCloud = async () => { setExporting(true); setError(''); setFeedback(''); try { const result = await cloudArchiveAction(session.access_token, 'EXPORT', { inspection_ids: selected }); setFeedback(`${result.synced} esportati, ${result.alreadyPresent} già presenti, ${result.failed} falliti.`); setCloudArchive(await loadCloudArchive(session.access_token)) } catch (reason) { setError(reason.message === 'CLOUD_NOT_CONNECTED' ? 'Collega Google Drive da Account.' : 'Esportazione cloud non riuscita.') } finally { setExporting(false) } }
  const displayed = [...filteredItems].sort((a, b) => (new Date(b.inspectedAt) - new Date(a.inspectedAt)) * (sort === 'newest' ? 1 : -1))
  return <div className="company-page inspections-page">
    <header><p className="company-kicker">Cloud CheckVan</p><h1>Ispezioni</h1><p>Consulta le ispezioni sincronizzate dai dispositivi della tua organizzazione.</p></header>
    <aside className="inspections-banner"><div><strong>Tutte le ispezioni,<br/>sempre disponibili.</strong><p>Accedi rapidamente ai documenti, confronta i rilievi e mantieni sotto controllo la flotta.</p></div><div className="inspections-art" aria-hidden="true"><img src="/company/vehicle-silhouettes/small-right.png" alt=""/><span><ShieldCheck size={40}/></span></div></aside>
    <form className="inspection-filters inspections-filter-bar" onSubmit={submit}>
      <label>Dal<input type="date" value={filters.dateFrom} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })}/></label>
      <label>Al<input type="date" value={filters.dateTo} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })}/></label>
      <label>Targa<input value={filters.plate} onChange={(event) => setFilters({ ...filters, plate: event.target.value })}/></label>
      <label>Tipo<select aria-label="Tipo" value={filters.inspectionType} onChange={(event) => setFilters({ ...filters, inspectionType: event.target.value })}><option value="">Tutti</option><option value="pickup">Presa</option><option value="return">Riconsegna</option></select></label>
      <button type="submit" disabled={loading}>Filtra</button><button type="button" className="inspections-clear" onClick={() => { setFilters({dateFrom:'',dateTo:'',plate:'',inspectionType:''}); setQuickFilter(null) }}><RotateCcw size={16} aria-hidden="true"/>Pulisci filtri</button>
    </form>
    {error && <p className="notice notice--error" role="alert">{error}</p>}
    {feedback && <p className="notice" role="status">{feedback}</p>}
    {quickFilter && <p className="inspections-quick-filter" role="status">Filtro attivo: {quickFilter.type === 'vehicle' ? 'targa' : 'driver'} <strong>{quickFilter.label}</strong><button type="button" onClick={() => setQuickFilter(null)}>Rimuovi filtro</button></p>}
    <section className="inspections-kpis" aria-label="Riepilogo documenti caricati">{[['Totale ispezioni',items.length,FileText],['Presa',items.filter(item => item.inspectionType === 'pickup').length,ArrowDownToLine],['Riconsegna',items.filter(item => item.inspectionType === 'return').length,ArrowUpFromLine]].map(([label,count,Icon]) => <article key={label}><span><Icon aria-hidden="true"/></span><div><h2>{label}</h2><strong>{loading || error ? '—' : count}</strong><small>Nei documenti caricati</small></div></article>)}</section>
    <section className="inspections-catalog" aria-labelledby="inspections-title">
      <header><h2 id="inspections-title">Documenti disponibili{!loading && !error ? ` (${displayed.length})` : ''}</h2><label>Ordina per<select value={sort} onChange={event => setSort(event.target.value)}><option value="newest">Data più recente</option><option value="oldest">Data meno recente</option></select></label></header>
      <div className="inspections-compare"><span>{selected.length ? `Seleziona un'altra ispezione dello stesso mezzo (${selected.length}/2).` : 'Seleziona due documenti per il confronto.'}</span><div className="inspections-compare-actions">{cloudArchive?.connected ? <button type="button" disabled={!selected.length || exporting || loading} onClick={exportCloud}><Cloud size={18} aria-hidden="true"/>{exporting ? 'Esportazione…' : `Esporta nel cloud${selected.length ? ` (${selected.length})` : ''}`}</button> : <small>Collega Google Drive da Account per esportare nel cloud.</small>}<button type="button" disabled={selected.length !== 2 || preparing || loading || selectedItems.length !== 2} onClick={compare}><GitCompareArrows size={18} aria-hidden="true"/>{preparing ? 'Preparazione…' : 'Confronta selezionate'}</button></div></div>
      {loading ? <p className="inspections-empty" role="status">Caricamento…</p> : displayed.length ? <table className="inspections-table"><caption className="visually-hidden">Ispezioni sincronizzate della tua organizzazione</caption><thead><tr><th scope="col"><span className="visually-hidden">Selezione</span></th><th scope="col">Data</th><th scope="col">Targa / Mezzo</th><th scope="col">Driver</th><th scope="col">Tipo</th><th scope="col">Documento</th></tr></thead><tbody>{displayed.map(item => <tr key={item.id}>
        <td className="inspections-selection"><label title={!selected.includes(item.id) && !sameVehicle(item) ? 'Seleziona un’ispezione dello stesso mezzo' : ''}><input type="checkbox" aria-label={`Seleziona ${item.vehiclePlate || item.vehicleDescription || 'ispezione'} ${formatDate(item.inspectedAt)}`} checked={selected.includes(item.id)} disabled={!selected.includes(item.id) && (selected.length >= 2 || !sameVehicle(item))} onChange={() => toggle(item)}/><span>Seleziona</span></label></td>
        <th scope="row">{formatDate(item.inspectedAt)}</th>
        <td data-label="Targa / Mezzo">{item.vehiclePlate || item.vehicleDescription ? <button type="button" className="inspections-filter-link" onClick={() => applyQuickFilter('vehicle', vehicleKey(item), item.vehiclePlate || item.vehicleDescription)}>{item.vehiclePlate && <strong>{item.vehiclePlate}</strong>}{item.vehicleDescription && <small>{item.vehicleDescription}</small>}</button> : '—'}</td>
        <td data-label="Driver">{driverName(item) ? <button type="button" className="inspections-filter-link" onClick={() => applyQuickFilter('driver', driverName(item).toLocaleLowerCase('it'), driverName(item))}>{driverName(item)}</button> : '—'}</td>
        <td data-label="Tipo"><span className="inspections-type" data-type={item.inspectionType}>{typeLabel(item.inspectionType)}</span>{compatibleInspection?.id === item.id && <small className="inspections-suggestion">Corrispondenza suggerita</small>}</td>
        <td className="inspections-download"><button type="button" onClick={() => download(item)}><Download size={17} aria-hidden="true"/>Scarica PDF</button></td>
      </tr>)}</tbody></table> : !error && <p className="inspections-empty">Nessuna ispezione trovata.<small>{quickFilter ? 'Rimuovi il filtro rapido per tornare alla lista completa.' : 'Prova a modificare i filtri.'}</small></p>}
    </section>
  </div>
}
