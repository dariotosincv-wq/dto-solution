import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import QRCode from 'qrcode'
import { useAuth } from '../auth/AuthContext.jsx'
import { canManageDevices } from '../access.js'
import { createEnrollmentToken, loadCompanyDevices } from '../lib/companySupabase.js'
import { COMPANY_ROUTES } from '../routes.js'

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

  return <div className="company-page"><header><p className="company-kicker">Licensing</p><h1>Dispositivi</h1><p>Gestisci gli slot collegati alla licenza CheckVan Pro.</p></header>
    <section className="device-summary"><div><strong>{summary.active} / {summary.capacity}</strong><span>{summary.available} slot disponibili</span></div><button type="button" onClick={refresh} disabled={loading}>{loading ? 'Aggiornamento…' : 'Aggiorna'}</button><button type="button" onClick={createActivation} disabled={creating || summary.available < 1}>{creating ? 'Creazione…' : 'Attiva nuovo dispositivo'}</button></section>
    {error && <p className="notice notice--error" role="alert">{error}</p>}
    <section className="table-card"><h2>Dispositivi registrati</h2>{devices?.items?.length ? <ul className="device-list">{devices.items.map((device) => <li key={device.id}><div><strong>{device.label}</strong><small>ID {device.id.slice(0, 8)}…</small></div><span>{device.status}</span><dl><div><dt>Assegnato</dt><dd>{formatDate(device.assignedAt)}</dd></div><div><dt>Ultima convalida</dt><dd>{formatDate(device.lastValidatedAt)}</dd></div>{device.releasedAt && <div><dt>Rilasciato</dt><dd>{formatDate(device.releasedAt)}</dd></div>}</dl></li>)}</ul> : !loading && <p>Nessun dispositivo assegnato.</p>}</section>
    {activation && <div className="activation-modal" role="dialog" aria-modal="true" aria-labelledby="activation-title"><section><header><div><p className="company-kicker">Codice monouso</p><h2 id="activation-title">Attiva nuovo dispositivo</h2></div><button type="button" aria-label="Chiudi" onClick={closeActivation}>×</button></header><p>Scansiona questo QR da Driver Utility → CheckVan Pro.</p><img src={qr} alt="QR di attivazione CheckVan Pro" /><p className="activation-expiry">Valido per 24 ore · Utilizzabile una sola volta</p><label>Codice manuale<code>{activation.token}</code></label><button type="button" onClick={copyToken}>{copied ? 'Codice copiato' : 'Copia codice'}</button><small>Lo slot viene occupato soltanto quando il dispositivo completa l’enrollment.</small></section></div>}
  </div>
}
