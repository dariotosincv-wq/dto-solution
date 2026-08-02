import './App.css'

const apps = [
  {
    name: 'NACScan',
    description:
      'Scansiona, compila, firma e gestisci PDF direttamente dal tuo smartphone.',
    status: 'Disponibile su Google Play',
  },
  {
    name: 'Driver Utility',
    description:
      'Strumenti pratici per driver: turni, QR locali, foto giornata e controllo mezzi.',
    status: 'In fase di sviluppo e test',
  },
  {
    name: 'CheckVan Pro',
    description:
      'Ispezioni fotografiche dei mezzi con PDF automatici e gestione ordinata delle verifiche.',
    status: 'Prossimamente',
  },
]

function App() {
  return (
    <div className="site">
      <header className="header">
        <a className="brand" href="#home" aria-label="DTO Solution">
          <span className="brand-mark">DTO</span>
          <span>Solution</span>
        </a>

        <nav className="nav" aria-label="Navigazione principale">
          <a href="#apps">App</a>
          <a href="#about">Chi siamo</a>
          <a href="#privacy">Privacy</a>
          <a href="#contact">Contatti</a>
        </nav>
      </header>

      <main>
        <section className="hero" id="home">
          <div className="hero-content">
            <p className="eyebrow">Soluzioni digitali nate da problemi reali</p>

            <h1>
              Applicazioni semplici,
              <span> utili ogni giorno.</span>
            </h1>

            <p className="hero-text">
              DTO Solution sviluppa strumenti pratici per il lavoro, la gestione
              dei documenti e le attività quotidiane.
            </p>

            <div className="hero-actions">
              <a className="button primary" href="#apps">
                Scopri le app
              </a>
              <a className="button secondary" href="#contact">
                Contattaci
              </a>
            </div>
          </div>

          <div className="hero-card" aria-hidden="true">
            <div className="hero-logo">DTO</div>
            <p>Software concreto.</p>
            <span>Creato per essere usato davvero.</span>
          </div>
        </section>

        <section className="section" id="apps">
          <div className="section-heading">
            <p className="eyebrow">Le nostre applicazioni</p>
            <h2>Strumenti pensati per semplificare.</h2>
            <p>
              Ogni progetto nasce da un'esigenza reale e viene migliorato
              attraverso l'utilizzo quotidiano.
            </p>
          </div>

          <div className="app-grid">
            {apps.map((app) => (
              <article className="app-card" key={app.name}>
                <div className="app-icon">{app.name.charAt(0)}</div>
                <h3>{app.name}</h3>
                <p>{app.description}</p>
                <span className="app-status">{app.status}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="section about" id="about">
          <div>
            <p className="eyebrow">DTO Solution</p>
            <h2>Tecnologia concreta, senza complicazioni inutili.</h2>
          </div>

          <div className="about-copy">
            <p>
              Sviluppiamo applicazioni Android e soluzioni web con un obiettivo
              preciso: far risparmiare tempo e rendere più semplici le attività
              di ogni giorno.
            </p>
            <p>
              Le nostre idee partono dall'esperienza diretta e vengono
              trasformate in strumenti chiari, affidabili e facili da usare.
            </p>
          </div>
        </section>

        <section className="section privacy" id="privacy">
          <div>
            <p className="eyebrow">Privacy e trasparenza</p>
            <h2>I dati degli utenti vengono trattati con attenzione.</h2>
          </div>

          <p>
            Le privacy policy delle applicazioni DTO Solution saranno
            disponibili in questa sezione e collegate direttamente dalle pagine
            del Google Play Store.
          </p>
        </section>

        <section className="contact" id="contact">
          <p className="eyebrow">Contatti</p>
          <h2>Hai un'idea o vuoi maggiori informazioni?</h2>
          <p>Scrivici e raccontaci cosa ti serve.</p>
          <a className="button primary" href="mailto:info@dtosolution.it">
            info@dtosolution.it
          </a>
        </section>
      </main>

      <footer className="footer">
        <div className="brand footer-brand">
          <span className="brand-mark">DTO</span>
          <span>Solution</span>
        </div>
        <p>© 2026 DTO Solution. Tutti i diritti riservati.</p>
      </footer>
    </div>
  )
}

export default App