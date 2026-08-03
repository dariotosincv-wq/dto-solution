import ApplicationGrid from '../components/applications/ApplicationGrid.jsx'
import BrandLogo from '../components/common/BrandLogo.jsx'
import ButtonLink from '../components/common/ButtonLink.jsx'
import SectionHeading from '../components/common/SectionHeading.jsx'

function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="container hero__grid">
          <div className="hero__content">
            <p className="eyebrow">DTO Solution</p>
            <h1>Sito ufficiale in fase di preparazione.</h1>
            <p className="hero__lead">
              I contenuti ufficiali di presentazione saranno pubblicati dopo la loro approvazione.
            </p>
            <div className="button-group">
              <ButtonLink to="/applicazioni">Scopri le applicazioni</ButtonLink>
              <ButtonLink to="/contatti" variant="secondary">Contatti</ButtonLink>
            </div>
          </div>
          <div className="official-logo-panel">
            <BrandLogo className="brand-logo--showcase" label="DTO Solution" />
          </div>
        </div>
      </section>

      <section className="section section--surface">
        <div className="container split-section">
          <SectionHeading eyebrow="Presentazione" title="DTO Solution">
            <p>Testo di presentazione aziendale da fornire.</p>
          </SectionHeading>
          <div className="content-panel">
            <p>Questa area è predisposta per i contenuti ufficiali relativi a DTO Solution.</p>
            <ButtonLink to="/chi-siamo" variant="text">Vai a Chi siamo</ButtonLink>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHeading eyebrow="Applicazioni" title="I progetti DTO Solution">
            <p>Le descrizioni e le informazioni sullo stato dei progetti saranno aggiunte dopo la conferma.</p>
          </SectionHeading>
          <ApplicationGrid />
        </div>
      </section>

      <section className="section section--cta">
        <div className="container callout">
          <div>
            <p className="eyebrow">Informazioni</p>
            <h2>Vuoi conoscere DTO Solution?</h2>
          </div>
          <ButtonLink to="/contatti">Vai ai contatti</ButtonLink>
        </div>
      </section>
    </>
  )
}

export default HomePage
