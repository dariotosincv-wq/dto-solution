import ApplicationGrid from '../components/applications/ApplicationGrid.jsx'
import ButtonLink from '../components/common/ButtonLink.jsx'
import MetaDescription from '../components/common/MetaDescription.jsx'
import SectionHeading from '../components/common/SectionHeading.jsx'

const methodSteps = [
  ['01', 'Ascolto del problema', 'Individuiamo un’esigenza reale da risolvere.'],
  ['02', 'Progettazione', 'Trasformiamo il problema in uno strumento semplice e concreto.'],
  ['03', 'Utilizzo sul campo', 'Il software viene provato in situazioni reali.'],
  ['04', 'Miglioramento continuo', 'I feedback degli utenti guidano l’evoluzione del progetto.'],
]

function HomePage() {
  return (
    <>
      <MetaDescription
        title="DTO Solution | Applicazioni e software nati da problemi reali"
        canonical="https://dtosolution.it/"
        content="DTO Solution sviluppa applicazioni Android e software concreti per semplificare il lavoro, i documenti e le attività quotidiane."
        openGraphUrl="https://dtosolution.it/"
      />

      <section className="hero hero--compact">
        <div className="container home-hero">
          <div className="hero__content">
            <p className="eyebrow">DTO SOLUTION</p>
            <h1>Soluzioni digitali<br />nate da problemi reali.</h1>
            <div className="hero__lead">
              <p>DTO Solution sviluppa applicazioni e software nati da esigenze concrete, pensati per semplificare il lavoro e le attività quotidiane.</p>
              <p>Ogni progetto viene utilizzato sul campo e migliorato continuamente grazie ai feedback degli utenti.</p>
            </div>
            <div className="button-group">
              <ButtonLink to="/applicazioni">Scopri le applicazioni</ButtonLink>
              <ButtonLink to="/chi-siamo" variant="secondary">Chi siamo</ButtonLink>
            </div>
          </div>

          <div className="home-hero__visual" aria-label="Prodotti DTO Solution">
            <figure className="device device--phone device--driver">
              <img
                src="/home-hero/driver-utility-screen.jpg"
                alt="Schermata di Driver Utility"
                width="921"
                height="2048"
                decoding="async"
                fetchPriority="high"
              />
            </figure>

            <figure className="device device--laptop">
              <div className="device__screen">
                <img
                  src="/home-hero/observa-screen.jpg"
                  alt="Dashboard ufficiale Observa"
                  width="1200"
                  height="800"
                  decoding="async"
                  fetchPriority="high"
                />
              </div>
              <div className="device__base" aria-hidden="true" />
            </figure>

            <figure className="device device--phone device--nacscan">
              <img
                src="/home-hero/nacscan-screen.jpg"
                alt="Schermata di NACScan"
                width="921"
                height="2048"
                decoding="async"
                fetchPriority="high"
              />
            </figure>
          </div>
        </div>
      </section>

      <section className="section section--surface home-projects">
        <div className="container">
          <div className="section-heading-row">
            <SectionHeading eyebrow="Applicazioni" title="Le soluzioni DTO Solution">
              <p>Applicazioni e software sviluppati per risolvere esigenze concrete nel lavoro e nelle attività quotidiane.</p>
            </SectionHeading>
            <ButtonLink to="/applicazioni" variant="secondary">Scopri tutte le applicazioni</ButtonLink>
          </div>
          <ApplicationGrid />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHeading eyebrow="Il nostro metodo" title="Dal problema reale alla soluzione digitale.">
            <p>Ogni progetto DTO Solution nasce da un’esigenza concreta e viene sviluppato attraverso un processo semplice: osservazione, progettazione, utilizzo sul campo e miglioramento continuo.</p>
          </SectionHeading>
          <ol className="method-grid">
            {methodSteps.map(([number, title, description]) => (
              <li className="method-card" key={number}>
                <span className="method-card__number" aria-hidden="true">{number}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section section--cta">
        <div className="container callout">
          <div>
            <p className="eyebrow">Contatti</p>
            <h2>Hai un’idea o un problema da risolvere?</h2>
            <p>Raccontaci la tua esigenza. Potrebbe diventare il prossimo progetto DTO Solution.</p>
          </div>
          <ButtonLink to="/contatti">Contattaci</ButtonLink>
        </div>
      </section>
    </>
  )
}

export default HomePage
