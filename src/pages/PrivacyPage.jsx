import PageIntro from '../components/common/PageIntro.jsx'
import ButtonLink from '../components/common/ButtonLink.jsx'
import { applications } from '../data/applications.js'

function PrivacyPage() {
  return (
    <section className="page-section">
      <div className="container">
        <PageIntro eyebrow="Informative" title="Privacy Policy delle applicazioni">
          <p>Seleziona un’applicazione per consultare la relativa pagina dedicata.</p>
          <p>Sviluppatore e publisher: DTO Solution.</p>
          <p>
            Email:{' '}
            <a href="mailto:dtosolution@gmail.com">dtosolution@gmail.com</a>
          </p>
          <p>
            Sito ufficiale:{' '}
            <a href="https://dtosolution.it">https://dtosolution.it</a>
          </p>
        </PageIntro>

        <div className="privacy-index">
          {applications.map((application) => (
            <article className="content-panel privacy-card" key={application.slug}>
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
  )
}

export default PrivacyPage
