import ApplicationGrid from '../components/applications/ApplicationGrid.jsx'
import ButtonLink from '../components/common/ButtonLink.jsx'
import MediaPlaceholder from '../components/common/MediaPlaceholder.jsx'
import PageIntro from '../components/common/PageIntro.jsx'
import { software } from '../data/software.js'

function ApplicationsPage() {
  return (
    <section className="page-section">
      <div className="container">
        <PageIntro eyebrow="Applicazioni" title="I progetti DTO Solution">
          <p>Dettagli, funzionalità e stato dei progetti saranno pubblicati dopo la conferma.</p>
        </PageIntro>
        <ApplicationGrid />

        <section className="software-index" aria-labelledby="software-title">
          <div className="section-heading">
            <p className="eyebrow">Software</p>
            <h2 id="software-title">Progetti software separati</h2>
            <div className="section-heading__copy">
              <p>Questa sezione è distinta dalle applicazioni DTO Solution.</p>
            </div>
          </div>

          {software.map((product) => (
            <article className="software-card" key={product.slug}>
              <MediaPlaceholder label={product.logoLabel} compact />
              <div className="software-card__body">
                <p className="eyebrow">Progetto separato</p>
                <h3>{product.name}</h3>
                <p>Descrizione da fornire.</p>
                <ButtonLink to={`/software/${product.slug}`} variant="text">
                  Apri la scheda
                </ButtonLink>
              </div>
            </article>
          ))}
        </section>
      </div>
    </section>
  )
}

export default ApplicationsPage
