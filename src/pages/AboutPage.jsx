import BrandLogo from '../components/common/BrandLogo.jsx'
import PageIntro from '../components/common/PageIntro.jsx'

function AboutPage() {
  return (
    <section className="page-section">
      <div className="container narrow-layout">
        <PageIntro eyebrow="DTO Solution" title="Chi siamo">
          <p>Il testo ufficiale di presentazione sarà inserito dopo l’approvazione.</p>
        </PageIntro>
        <div className="official-logo-panel official-logo-panel--compact">
          <BrandLogo className="brand-logo--showcase" label="DTO Solution" />
        </div>
        <div className="content-panel prose">
          <h2>Presentazione</h2>
          <p>Contenuto aziendale da fornire.</p>
        </div>
      </div>
    </section>
  )
}

export default AboutPage
