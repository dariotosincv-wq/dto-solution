import ApplicationGrid from '../components/applications/ApplicationGrid.jsx'
import ButtonLink from '../components/common/ButtonLink.jsx'
import LinkPlaceholder from '../components/common/LinkPlaceholder.jsx'
import PageIntro from '../components/common/PageIntro.jsx'
import { software } from '../data/software.js'

function ApplicationsPage() {
  return (
    <section className="page-section">
      <div className="container">
        <PageIntro eyebrow="Applicazioni" title="Le soluzioni DTO Solution">
          <p>Applicazioni e software sviluppati per risolvere esigenze concrete nel lavoro e nelle attività quotidiane.</p>
        </PageIntro>
        <ApplicationGrid />

        <section className="software-index" aria-labelledby="software-title">
          <div className="section-heading">
            <p className="eyebrow">Software</p>
            <h2 id="software-title">Software</h2>
          </div>

          {software.map((product) => (
            <article className="software-card" key={product.slug}>
              <div className="software-card__media">
                <img src={product.image} alt={product.imageAlt} loading="lazy" decoding="async" />
              </div>
              <div className="software-card__body">
                <p className="status-badge">{product.badge}</p>
                <h3>{product.name}</h3>
                <p>{product.subtitle}</p>
                <p>{product.status}</p>
                <div className="button-group application-card__actions">
                  <ButtonLink to={`/software/${product.slug}`} variant="secondary">
                    Scopri Observa
                  </ButtonLink>
                  {product.officialWebsite ? (
                    <a className="button button--primary" href={product.officialWebsite} target="_blank" rel="noopener noreferrer">
                      Visita il sito ufficiale
                    </a>
                  ) : (
                    <LinkPlaceholder>Link sito ufficiale da inserire</LinkPlaceholder>
                  )}
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </section>
  )
}

export default ApplicationsPage
