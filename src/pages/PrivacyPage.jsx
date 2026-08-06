import ButtonLink from '../components/common/ButtonLink.jsx'
import MetaDescription from '../components/common/MetaDescription.jsx'
import { applications } from '../data/applications.js'

const visibleApplications = applications.filter((application) => (
  ['nacscan', 'shopping-voice', 'driver-utility'].includes(application.slug)
))

function PrivacyIcon({ type }) {
  const icons = {
    publisher: <><path d="M4 19V9l8-5 8 5v10" /><path d="M8 19v-6h8v6M3 19h18" /></>,
    email: <><path d="M3 6.5 12 13l9-6.5" /><rect x="3" y="5" width="18" height="14" rx="2" /></>,
    website: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14.5 14.5 0 0 1 0 18M12 3a14.5 14.5 0 0 0 0 18" /></>,
    nacscan: <><path d="M7 3H5a2 2 0 0 0-2 2v2M17 3h2a2 2 0 0 1 2 2v2M7 21H5a2 2 0 0 1-2-2v-2M17 21h2a2 2 0 0 0 2-2v-2" /><path d="M8 8h8v8H8z" /></>,
    'shopping-voice': <><path d="M6 8h12l-1 11H7L6 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2M12 11v5M10 13h4" /></>,
    'driver-utility': <><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" /><path d="M5 17H3v-5l2-5h11l3 5h2v5h-2M9 17h6M5 12h14" /></>,
  }

  return (
    <span className="privacy-card__icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {icons[type]}
      </svg>
    </span>
  )
}

function PrivacyPage() {
  return (
    <article className="privacy-page">
      <MetaDescription
        title="Privacy Policy | DTO Solution"
        canonical="https://dtosolution.it/privacy"
        content="Consulta le informative sulla privacy del sito, delle applicazioni e dei servizi sviluppati da DTO Solution."
        openGraphUrl="https://dtosolution.it/privacy"
      />

      <section className="privacy-page__hero">
        <div className="container">
          <p className="eyebrow">Informative</p>
          <h1>Privacy Policy</h1>
          <p>Consulta tutte le informative sulla privacy delle applicazioni e dei servizi sviluppati da DTO Solution.</p>
        </div>
      </section>

      <section className="privacy-page__content">
        <div className="container">
          <aside className="privacy-owner-card" aria-label="Informazioni del titolare">
            <div className="privacy-owner-card__item">
              <PrivacyIcon type="publisher" />
              <p><strong>Sviluppatore e publisher</strong>DTO Solution</p>
            </div>
            <div className="privacy-owner-card__item">
              <PrivacyIcon type="email" />
              <p><strong>Email</strong><a href="mailto:dtosolution@gmail.com">dtosolution@gmail.com</a></p>
            </div>
            <div className="privacy-owner-card__item">
              <PrivacyIcon type="website" />
              <p><strong>Sito ufficiale</strong><a href="https://dtosolution.it">DTOSolution.it</a></p>
            </div>
          </aside>

          <div className="privacy-index">
            <article className="privacy-card privacy-card--website">
              <PrivacyIcon type="website" />
              <p className="eyebrow">Servizio web</p>
              <h2>Sito Web DTO Solution</h2>
              <p>Informativa sulla privacy relativa alla navigazione del sito web DTO Solution e ai dati eventualmente raccolti tramite il modulo Contatti.</p>
              <ButtonLink to="/privacy/sito-web" variant="text">Apri la Privacy Policy</ButtonLink>
            </article>

            {visibleApplications.map((application) => (
              <article className="privacy-card" key={application.slug}>
                <PrivacyIcon type={application.slug} />
                <p className="eyebrow">Applicazione</p>
                <h2>{application.name}</h2>
                <p>Privacy Policy di {application.name}, pubblicata da DTO Solution.</p>
                <ButtonLink to={`/applicazioni/${application.slug}/privacy`} variant="text">
                  Apri la Privacy Policy
                </ButtonLink>
              </article>
            ))}
          </div>
        </div>
      </section>
    </article>
  )
}

export default PrivacyPage
