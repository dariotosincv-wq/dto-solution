import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { canViewInspections } from '../access.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { createInspectionDownload, loadCompanyInspections } from '../lib/companySupabase.js'
import { COMPANY_ROUTES } from '../routes.js'

const typeLabel = (value) => value === 'pickup' ? 'Presa' : 'Riconsegna'
const formatDate = (value) => new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

export default function InspectionsPage() {
  const { access, session } = useAuth()
  const navigate = useNavigate()
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', plate: '', inspectionType: '' })
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  const [selected, setSelected] = useState([]); const [preparing, setPreparing] = useState(false)
  const refresh = useCallback(async (next) => { setLoading(true); setError(''); try { const result = await loadCompanyInspections(session.access_token, next); setItems(result.items) } catch { setError('Non è stato possibile caricare le ispezioni.') } finally { setLoading(false) } }, [session.access_token])
  useEffect(() => {
    // Initial loading synchronizes the portal with the external CheckVan API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (canViewInspections(access)) refresh({})
  }, [access, refresh])
  if (!canViewInspections(access)) return <Navigate to={COMPANY_ROUTES.dashboard} replace />
  const submit = (event) => { event.preventDefault(); refresh(filters) }
  const download = async (item) => { try { const { url } = await createInspectionDownload(session.access_token, item.id); window.location.assign(url) } catch { setError('Download temporaneamente non disponibile.') } }
  const toggle = (id) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length < 2 ? [...current, id] : current)
  const compare = async () => { setPreparing(true); setError(''); try { const chosen = items.filter((item) => selected.includes(item.id)); const files = await Promise.all(chosen.map(async (item) => { const { url } = await createInspectionDownload(session.access_token, item.id); const response = await fetch(url); if (!response.ok) throw new Error('DOWNLOAD_FAILED'); const blob = await response.blob(); return new File([blob], `checkvan-${item.vehiclePlate}-${item.inspectedAt}.pdf`, { type: 'application/pdf' }) })); navigate(COMPANY_ROUTES.comparePdf, { state: { files } }) } catch { setError('Non è stato possibile preparare il confronto.') } finally { setPreparing(false) } }
  return <div className="company-page"><header><p className="company-kicker">Cloud CheckVan</p><h1>Ispezioni</h1><p>Consulta le ispezioni sincronizzate dai dispositivi della tua organizzazione.</p></header>
    <form className="inspection-filters" onSubmit={submit}><label>Dal<input type="date" value={filters.dateFrom} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })} /></label><label>Al<input type="date" value={filters.dateTo} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })} /></label><label>Targa<input value={filters.plate} onChange={(event) => setFilters({ ...filters, plate: event.target.value })} /></label><label>Tipo<select value={filters.inspectionType} onChange={(event) => setFilters({ ...filters, inspectionType: event.target.value })}><option value="">Tutti</option><option value="pickup">Presa</option><option value="return">Riconsegna</option></select></label><button type="submit" disabled={loading}>Filtra</button></form>
    {error && <p className="notice notice--error" role="alert">{error}</p>}
    <section className="table-card"><div className="inspection-heading"><h2>Documenti disponibili</h2><button type="button" disabled={selected.length !== 2 || preparing} onClick={compare}>{preparing ? 'Preparazione…' : 'Confronta selezionate'}</button></div>{loading ? <p>Caricamento…</p> : items.length ? <div className="inspection-table"><div className="inspection-table__head"><span>Data</span><span>Targa / mezzo</span><span>Tipo</span><span>Documento</span></div>{items.map((item) => <article key={item.id}><span><label className="inspection-select"><input type="checkbox" checked={selected.includes(item.id)} disabled={!selected.includes(item.id) && selected.length >= 2} onChange={() => toggle(item.id)} />{formatDate(item.inspectedAt)}</label></span><span><strong>{item.vehiclePlate}</strong><small>{item.vehicleDescription || '—'}</small></span><span>{typeLabel(item.inspectionType)}</span><span><button type="button" onClick={() => download(item)}>Scarica PDF</button></span></article>)}</div> : <p>Nessuna ispezione trovata.</p>}</section>
  </div>
}
