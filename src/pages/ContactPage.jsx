import ButtonLink from '../components/common/ButtonLink.jsx'
import MetaDescription from '../components/common/MetaDescription.jsx'
import { useI18n } from '../i18n/useI18n.js'

function ContactIcon({ type }) {
  const paths = {
    email: <><path d="M3 6.5 12 13l9-6.5" /><rect x="3" y="5" width="18" height="14" rx="2" /></>,
    website: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14.5 14.5 0 0 1 0 18M12 3a14.5 14.5 0 0 0 0 18" /></>,
    applications: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
  }

  return (
    <span className="contact-card__icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {paths[type]}
      </svg>
    </span>
  )
}

function ContactPage() {
  const { isEnglish } = useI18n()
  const primaryWebsite = isEnglish ? 'https://www.dtosolution.com' : 'https://www.dtosolution.it'
  const primaryLabel = isEnglish ? 'DTOSolution.com' : 'DTOSolution.it'
  const secondaryWebsite = isEnglish ? 'https://www.dtosolution.it' : 'https://www.dtosolution.com'
  const secondaryLabel = isEnglish ? 'DTOSolution.it' : 'DTOSolution.com'

  return (
    <article className="contact-page">
      <MetaDescription
        title="Contatti | DTO Solution"
        canonical="https://dtosolution.it/contatti"
        content="Contatta DTO Solution per assistenza, informazioni o proposte di collaborazione."
        openGraphUrl="https://dtosolution.it/contatti"
      />

      <section className="contact-hero">
        <div className="container">
          <p className="eyebrow">DTO SOLUTION</p>
          <h1>Contattaci</h1>
          <div className="contact-hero__copy">
            <p>Hai una domanda, hai bisogno di assistenza o vuoi parlarci di un progetto?</p>
            <p>Siamo felici di sentirti.</p>
          </div>
        </div>
      </section>

      <section className="contact-content" aria-label="Recapiti DTO Solution">
        <div className="container">
          <div className="contact-grid">
            <article className="contact-card">
              <ContactIcon type="email" />
              <h2>Email</h2>
              <p>Per assistenza, informazioni o proposte di collaborazione.</p>
              <a className="contact-card__address" href="mailto:dtosolution@gmail.com">dtosolution@gmail.com</a>
              <a className="button button--primary" href="mailto:dtosolution@gmail.com">Scrivi una mail</a>
            </article>

            <article className="contact-card">
              <ContactIcon type="website" />
              <h2>Sito ufficiale</h2>
              <a className="contact-card__domain" href={primaryWebsite} data-i18n-ignore="true">{primaryLabel}</a>
              <p className="contact-card__secondary-domain">
                Disponibile anche su <a href={secondaryWebsite} data-i18n-ignore="true">{secondaryLabel}</a>
              </p>
              <a className="button button--primary" href={primaryWebsite}>Visita il sito</a>
            </article>

            <article className="contact-card">
              <ContactIcon type="applications" />
              <h2>Le nostre applicazioni</h2>
              <p>Scopri le applicazioni e i software sviluppati da DTO Solution.</p>
              <ButtonLink to="/applicazioni">Esplora le applicazioni</ButtonLink>
            </article>
          </div>

          <section className="contact-callout" aria-labelledby="contact-callout-title">
            <div>
              <p className="eyebrow">Il nostro approccio</p>
              <h2 id="contact-callout-title">Software nato da problemi reali.</h2>
              <p>DTO Solution sviluppa applicazioni Android e software desktop progettati per rendere più semplici attività concrete, quotidiane e professionali.</p>
            </div>
            <ButtonLink to="/chi-siamo" variant="secondary">Scopri chi siamo</ButtonLink>
          </section>
        </div>
      </section>
    </article>
  )
}

export default ContactPage
