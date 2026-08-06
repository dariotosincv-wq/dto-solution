import ButtonLink from '../components/common/ButtonLink.jsx'
import MetaDescription from '../components/common/MetaDescription.jsx'
import PageIntro from '../components/common/PageIntro.jsx'
import SectionHeading from '../components/common/SectionHeading.jsx'

const methodSteps = [
  ['01', 'Osservare', 'Capire il problema e il contesto in cui si presenta.'],
  ['02', 'Progettare', 'Costruire una soluzione semplice e intuitiva.'],
  ['03', 'Testare', 'Utilizzare il prodotto in situazioni reali.'],
  ['04', 'Migliorare', 'Aggiornare il progetto grazie ai feedback.'],
]

const workAreas = [
  ['Documenti e PDF', 'Strumenti per scansione, firma, ricerca, archiviazione e gestione dei documenti.'],
  ['Strumenti per driver', 'Soluzioni pensate per semplificare attività operative, turni, percorsi, veicoli e documentazione.'],
  ['Organizzazione personale', 'Applicazioni per rendere più semplici attività quotidiane come la spesa e la gestione delle liste.'],
  ['Software specialistici', 'Progetti dedicati a settori specifici, come l’analisi e la Poker Intelligence.'],
]

const projects = [
  ['NACScan', '/applicazioni/nacscan'],
  ['Shopping Voice', '/applicazioni/shopping-voice'],
  ['Driver Utility', '/applicazioni/driver-utility'],
  ['Observa', '/software/observa-poker'],
]

function AboutPage() {
  return (
    <article className="about-page">
      <MetaDescription
        title="Chi siamo | DTO Solution"
        canonical="https://dtosolution.it/chi-siamo"
        content="Scopri DTO Solution, il metodo di sviluppo e la filosofia dietro applicazioni e software nati da esigenze reali."
        openGraphUrl="https://dtosolution.it/chi-siamo"
      />

      <section className="page-section about-hero">
        <div className="container narrow-layout">
          <PageIntro eyebrow="DTO Solution" title="Chi siamo">
            <p>DTO Solution è una realtà indipendente dedicata allo sviluppo di applicazioni e software nati da esigenze concrete.</p>
            <p>I progetti non partono da idee astratte, ma da problemi reali incontrati nel lavoro, nella gestione dei documenti, nell’organizzazione quotidiana e nell’utilizzo di strumenti digitali.</p>
          </PageIntro>
        </div>
      </section>

      <section className="section section--surface">
        <div className="container split-section about-copy-section">
          <SectionHeading eyebrow="La nostra filosofia" title="Software concreto, creato per essere usato davvero." />
          <div className="about-copy">
            <p>L’obiettivo di DTO Solution è creare strumenti semplici, accessibili e utili.</p>
            <p>Ogni applicazione viene progettata per ridurre passaggi inutili, semplificare attività ripetitive e offrire soluzioni pratiche a chi la utilizza ogni giorno.</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container split-section about-copy-section">
          <SectionHeading eyebrow="Come nascono i progetti" title="Da un problema reale a un prodotto digitale." />
          <div className="about-copy">
            <p>Molti progetti DTO Solution nascono direttamente dall’esperienza quotidiana: un’attività lenta, un documento difficile da gestire, un’informazione complicata da trovare o un processo che può essere reso più semplice.</p>
            <p>Il problema viene analizzato, trasformato in una soluzione digitale e poi verificato attraverso l’utilizzo reale.</p>
          </div>
        </div>
      </section>

      <section className="section section--surface">
        <div className="container">
          <SectionHeading eyebrow="Il metodo" title="Un processo semplice e continuo." />
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

      <section className="section">
        <div className="container">
          <SectionHeading eyebrow="Le aree di lavoro" title="Competenze applicate a esigenze diverse." />
          <div className="area-grid">
            {workAreas.map(([title, description]) => (
              <article className="content-panel" key={title}>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--surface">
        <div className="container">
          <div className="section-heading-row">
            <SectionHeading eyebrow="I nostri progetti" title="Soluzioni già in evoluzione." />
            <ButtonLink to="/applicazioni" variant="secondary">Scopri le applicazioni</ButtonLink>
          </div>
          <div className="project-links" aria-label="Progetti DTO Solution">
            {projects.map(([name, to]) => (
              <ButtonLink key={name} to={to} variant="text">{name}</ButtonLink>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--cta about-final-cta">
        <div className="container callout">
          <div>
            <p className="eyebrow">DTO Solution</p>
            <h2>Costruiamo soluzioni che servono davvero.</h2>
            <p>DTO Solution continua a sviluppare e migliorare i propri progetti partendo dall’esperienza reale degli utenti.</p>
          </div>
          <div className="button-group">
            <ButtonLink to="/applicazioni">Scopri le applicazioni</ButtonLink>
            <ButtonLink to="/contatti" variant="secondary">Contattaci</ButtonLink>
          </div>
        </div>
      </section>
    </article>
  )
}

export default AboutPage
