import { Building2, Cloud, FolderOpen, Info, Landmark, Mail, RefreshCw, Settings2, Unplug, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import { cloudArchiveAction, loadCloudArchive } from '../lib/companySupabase.js'
import './account.css'

export default function AccountPage() {
  const { session, access } = useAuth()
  const [archive, setArchive] = useState(null), [archiveBusy, setArchiveBusy] = useState(false), [archiveMessage, setArchiveMessage] = useState(''), [includeHistory, setIncludeHistory] = useState(false)
  const organizationName = access?.organization?.name || 'Organizzazione non assegnata'
  const details = [
    { label: 'Email', value: session?.user?.email || 'Non disponibile', icon: Mail },
    { label: 'Ruolo', value: access?.role || 'Non assegnato', icon: UserRound },
    { label: 'Organizzazione', value: organizationName, icon: Landmark },
  ]
  const refreshArchive = async () => { if (!session?.access_token) return; try { setArchive(await loadCloudArchive(session.access_token)) } catch { setArchiveMessage('Archivio Cloud temporaneamente non disponibile.') } }
  useEffect(() => { void refreshArchive() }, [session?.access_token])
  const act = async (action, payload = {}) => { setArchiveBusy(true); setArchiveMessage(''); try { const result = await cloudArchiveAction(session.access_token, action, payload); if (result.authorizationUrl) { window.location.assign(result.authorizationUrl); return } setArchive(result.connected === false ? result : await loadCloudArchive(session.access_token)); setArchiveMessage(action === 'DISCONNECT' ? 'Google Drive scollegato. I file già copiati rimangono nel Drive.' : action === 'VERIFY' ? 'Collegamento attivo.' : action === 'RETRY' ? `${result.synced} sincronizzati, ${result.alreadyPresent} già presenti, ${result.failed} non riusciti.` : 'Impostazione aggiornata.') } catch (error) { setArchiveMessage(error.message === 'CLOUD_ARCHIVE_NOT_CONFIGURED' ? 'Google Drive non è ancora configurato. Contatta l’amministratore DTO Solution.' : 'Operazione non riuscita. Riprova.') } finally { setArchiveBusy(false) } }

  return (
    <div className="company-page account-page">
      <header className="account-heading">
        <div>
          <nav className="account-breadcrumb" aria-label="Breadcrumb">
            <span>Area Aziende</span><span aria-hidden="true">›</span><strong>Account</strong>
          </nav>
          <h1>Account</h1>
          <p>Le informazioni del tuo account aziendale</p>
        </div>
        <div className="account-illustration" aria-hidden="true">
          <Settings2 /><UserRound /><Building2 />
        </div>
      </header>

      <section className="account-card" aria-labelledby="account-organization">
        <header>
          <span className="account-company-icon"><Building2 aria-hidden="true" /></span>
          <div>
            <p className="account-card-kicker">Account aziendale</p>
            <h2 id="account-organization">{organizationName}</h2>
          </div>
        </header>
        <dl className="account-details">
          {details.map(({ label, value, icon: Icon }) => (
            <div key={label}>
              <dt><Icon aria-hidden="true" />{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <aside className="account-info" aria-label="Informazioni account">
        <Info aria-hidden="true" />
        <div>
          <strong>Informazioni account</strong>
          <p>I dati visualizzati sono associati alla sessione aziendale attiva. Per aggiornamenti, contatta l’amministratore della tua organizzazione.</p>
        </div>
      </aside>
      <section className="account-cloud" aria-labelledby="cloud-archive-title">
        <header><span className="account-company-icon"><Cloud aria-hidden="true" /></span><div><p className="account-card-kicker">Archivio Cloud</p><h2 id="cloud-archive-title">Google Drive</h2><p>Collega il tuo spazio cloud e salva automaticamente una copia dei documenti generati da DTO Solution.</p></div></header>
        {!archive ? <p>Caricamento archivio cloud…</p> : !archive.connected ? <div className="account-cloud-actions"><p>DTO Solution salva una copia dei documenti selezionati nel cloud collegato dalla tua azienda.</p><label className="account-cloud-history"><input type="checkbox" checked={includeHistory} onChange={event => setIncludeHistory(event.target.checked)}/> Sincronizza anche le ispezioni già presenti</label><button type="button" disabled={archiveBusy} onClick={() => act('OAUTH_START', { include_history: includeHistory })}>Collega Google Drive</button></div> : <>
          <dl className="account-cloud-details"><div><dt>Stato</dt><dd>{archive.status === 'active' ? 'Google Drive collegato' : 'Nuova autorizzazione richiesta'}</dd></div><div><dt>Cartella selezionata</dt><dd>{archive.folderName}</dd></div><div><dt>Ultima sincronizzazione</dt><dd>{archive.lastSyncAt ? new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(archive.lastSyncAt)) : 'Nessuna sincronizzazione'}</dd></div><div><dt>Documenti</dt><dd>{archive.synced} sincronizzati · {archive.pending} in attesa</dd></div></dl>
          <div className="account-cloud-actions"><label className="account-cloud-history"><input type="checkbox" checked={archive.backupEnabled} disabled={archiveBusy} onChange={event => void act('SET_SETTINGS', { backup_enabled: event.target.checked, backup_pickup: archive.backupPickup, backup_return: archive.backupReturn })}/> Backup automatico documenti CheckVan</label><button type="button" disabled={archiveBusy} onClick={() => act('VERIFY')}><RefreshCw size={16}/>Verifica collegamento</button><button type="button" disabled={archiveBusy} onClick={() => { const name = window.prompt('Nome della nuova cartella Google Drive', 'DTO Solution'); if (name) void act('CREATE_FOLDER', { folder_name: name }) }}><FolderOpen size={16}/>Cambia cartella</button>{archive.pending > 0 && <button type="button" disabled={archiveBusy} onClick={() => act('RETRY')}>Riprova sincronizzazione</button>}<button type="button" className="account-cloud-danger" disabled={archiveBusy} onClick={() => { if (window.confirm('Scollegare Google Drive? I file già copiati non verranno eliminati.')) void act('DISCONNECT') }}><Unplug size={16}/>Disconnetti</button></div>
          <p className="account-cloud-note">Puoi scollegare Google Drive in qualsiasi momento. I file già copiati rimarranno nel tuo Drive.</p>
        </>}
        {archiveMessage && <p className="notice" role="status">{archiveMessage}</p>}
      </section>
    </div>
  )
}
