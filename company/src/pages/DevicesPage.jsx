import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import QRCode from 'qrcode'
import { CheckCircle2, Copy, Info, Monitor, Plus, RefreshCw, Smartphone, Users } from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'
import { canManageDevices } from '../access.js'
import { createEnrollmentToken, loadCompanyDevices } from '../lib/companySupabase.js'
import { COMPANY_ROUTES } from '../routes.js'
import './devices.css'

function formatDate(value) {
  return value ? new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Mai'
}

export default function DevicesPage() {
  const { access, session } = useAuth()
  const [devices, setDevices] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  const [activation, setActivation] = useState(null); const [qr, setQr] = useState(''); const [creating, setCreating] = useState(false); const [copied, setCopied] = useState(false)
  const refresh = useCallback(async () => { setLoading(true); setError(''); try { setDevices(await loadCompanyDevices(session.access_token)) } catch { setError('Non è stato possibile aggiornare l’elenco dei dispositivi.') } finally { setLoading(false) } }, [session.access_token])
  useEffect(() => {
    // The first device read is an external API synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (canManageDevices(access)) refresh()
  }, [access, refresh])
  if (!canManageDevices(access)) return <Navigate to={COMPANY_ROUTES.dashboard} replace />

  const createActivation = async () => {
    setCreating(true); setError('')
    try {
      const result = await createEnrollmentToken(session.access_token)
      const dataUrl = await QRCode.toDataURL(result.qrPayload, { errorCorrectionLevel: 'M', margin: 2, width: 320 })
      setQr(dataUrl); setActivation(result)
    } catch (reason) { setError(reason.message === 'NO_DEVICE_SLOTS' ? 'Tutti gli slot della licenza sono già occupati.' : 'Non è stato possibile creare il codice di attivazione.') }
    finally { setCreating(false) }
  }
  const closeActivation = () => { setActivation(null); setQr(''); setCopied(false) }
  const copyToken = async () => { await navigator.clipboard.writeText(activation.token); setCopied(true) }
  const summary = devices ?? access.devices
  const items = devices?.items ?? []
  const registered = items.length
  const active = typeof summary?.active === 'number' ? summary.active : items.filter(device => device.status === 'active').length
  const inactive = Math.max(0, registered - active)
  const capacity = summary?.capacity ?? 0

  return <div className="company-page devices-page"><header className="devices-heading"><div><p className="company-kicker">Area Aziende</p><h1>Dispositivi</h1><p>Gestisci gli slot collegati alla licenza CheckVan Pro.</p></div><div className="devices-illustration" aria-hidden="true"><Monitor/><Smartphone/><CheckCircle2/></div></header>
    <section className="devices-kpis" aria-label="Riepilogo dispositivi"><article data-tone="blue"><span><Monitor/></span><div><strong>{registered} / {capacity}</strong><b>Dispositivi registrati</b><small>{summary?.available ?? 0} slot disponibili</small></div></article><article data-tone="green"><span><CheckCircle2/></span><div><strong>{active}</strong><b>Dispositivi attivi</b><small>{registered ? `${Math.round(active / registered * 100)}% dei registrati` : 'Nessun dispositivo registrato'}</small></div></article><article data-tone="slate"><span><Monitor/></span><div><strong>{inactive}</strong><b>Dispositivi non attivi</b><small>{registered ? `${Math.round(inactive / registered * 100)}% dei registrati` : '—'}</small></div></article><article data-tone="purple"><span><Users/></span><div><strong>{capacity}</strong><b>Slot totali</b><small>Inclusi nella licenza</small></div></article></section>
    {error && <p className="notice notice--error" role="alert">{error}</p>}
    <section className="devices-table-card"><header><div><h2>Dispositivi registrati</h2><p>Elenco dei dispositivi che hanno utilizzato la licenza CheckVan Pro.</p></div><div className="devices-actions"><button type="button" className="devices-refresh" onClick={refresh} disabled={loading}><RefreshCw size={18}/>{loading ? 'Aggiornamento…' : 'Aggiorna'}</button><button type="button" className="devices-create" onClick={createActivation} disabled={creating || (summary?.available ?? 0) < 1}><Plus size={19}/>{creating ? 'Creazione…' : 'Attiva nuovo dispositivo'}</button></div></header>{items.length ? <div className="devices-table-wrap"><table className="devices-table"><thead><tr><th>Dispositivo</th><th>ID</th><th>Assegnato</th><th>Ultima convalida</th><th>Stato</th></tr></thead><tbody>{items.map(device => <tr key={device.id}><td data-label="Dispositivo"><span className="devices-device"><Monitor size={19}/><strong>{device.label}</strong></span></td><td data-label="ID"><code>{device.id.slice(0, 8)}…</code></td><td data-label="Assegnato">{formatDate(device.assignedAt)}</td><td data-label="Ultima convalida">{formatDate(device.lastValidatedAt)}</td><td data-label="Stato"><span className="devices-status" data-status={device.status}>{device.status === 'active' ? 'Attivo' : device.status}</span></td></tr>)}</tbody></table></div> : !loading && <p className="devices-empty">Nessun dispositivo assegnato.</p>}<footer>Mostrati {items.length} di {items.length} dispositivi</footer></section>
    <aside className="devices-info"><Info size={23}/><div><strong>Informazioni</strong><p>Ogni dispositivo attivo occupa uno slot della licenza CheckVan Pro. Uno slot si libera quando il dispositivo viene disattivato tramite le funzioni previste.</p></div></aside>
    {activation && <div className="activation-modal" role="dialog" aria-modal="true" aria-labelledby="activation-title"><section><header><div><p className="company-kicker">Codice monouso</p><h2 id="activation-title">Attiva nuovo dispositivo</h2></div><button type="button" aria-label="Chiudi" onClick={closeActivation}>×</button></header><p>Scansiona questo QR da Driver Utility → CheckVan Pro.</p><img src={qr} alt="QR di attivazione CheckVan Pro" /><p className="activation-expiry">Valido per 24 ore · Utilizzabile una sola volta</p><label>Codice manuale<code>{activation.token}</code></label><button type="button" onClick={copyToken}>{copied ? 'Codice copiato' : 'Copia codice'}</button><small>Lo slot viene occupato soltanto quando il dispositivo completa l’enrollment.</small></section></div>}
  </div>
}
