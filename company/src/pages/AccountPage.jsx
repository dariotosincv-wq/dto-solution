import { Building2, Info, Landmark, Mail, Settings2, UserRound } from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'
import './account.css'

export default function AccountPage() {
  const { session, access } = useAuth()
  const organizationName = access?.organization?.name || 'Organizzazione non assegnata'
  const details = [
    { label: 'Email', value: session?.user?.email || 'Non disponibile', icon: Mail },
    { label: 'Ruolo', value: access?.role || 'Non assegnato', icon: UserRound },
    { label: 'Organizzazione', value: organizationName, icon: Landmark },
  ]

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
    </div>
  )
}
