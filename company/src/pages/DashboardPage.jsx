import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { canManageDevices, canUseTools } from '../access.js'
import { COMPANY_ROUTES } from '../routes.js'

const labels = { active_trial: 'Trial attiva', active_license: 'Licenza attiva', tester: 'Accesso Tester', founder: 'Accesso Founder', union_guest: 'Invito attivo', organization_suspended: 'Organizzazione sospesa', organization_closed: 'Organizzazione chiusa', license_suspended: 'Licenza sospesa', revoked: 'Licenza revocata', expired: 'Licenza scaduta', not_started: 'Licenza non ancora attiva', no_license: 'Nessuna licenza', no_organization: 'Organizzazione non disponibile' }
export default function DashboardPage() {
  const { access, error } = useAuth(); const tools = canUseTools(access); const devices = access?.devices ?? { active: 0, capacity: 0 }
  return <div className="company-page"><header><p className="company-kicker">CheckVan Pro</p><h1>{access?.organization?.name || 'Area Aziende'}</h1><p>Licenze, dispositivi e strumenti PDF in un’unica area riservata.</p></header>
    {error && <p className="notice notice--error">Impossibile verificare i permessi. Gli strumenti restano bloccati.</p>}
    <section className="status-grid"><article><span>Licenza</span><strong>{labels[access?.state] || 'Accesso non disponibile'}</strong><small>{tools ? 'Strumenti operativi disponibili' : 'Strumenti operativi bloccati'}</small></article>{access?.role !== 'UNION_GUEST' && <article><span>Dispositivi</span><strong>{devices.active} / {devices.capacity}</strong><small>{devices.available} slot disponibili</small>{canManageDevices(access) && <Link to={COMPANY_ROUTES.devices}>Gestisci dispositivi</Link>}</article>}</section>
    <h2>Strumenti</h2><section className="tool-grid"><article><h3>Ispezioni cloud</h3><p>Consulta i PDF sincronizzati automaticamente dai dispositivi aziendali.</p>{access?.capabilities?.viewInspections ? <Link to={COMPANY_ROUTES.inspections}>Apri archivio</Link> : <span>Non disponibile</span>}</article><article><h3>Verifica PDF</h3><p>Controlla l’impronta di uno o più documenti CheckVan.</p>{tools ? <Link to={COMPANY_ROUTES.verifyPdf}>Apri strumento</Link> : <span>Non disponibile</span>}</article><article><h3>Confronta ispezioni</h3><p>Visualizza fianco a fianco le fotografie di due ispezioni.</p>{tools ? <Link to={COMPANY_ROUTES.comparePdf}>Apri strumento</Link> : <span>Non disponibile</span>}</article></section>
  </div>
}
