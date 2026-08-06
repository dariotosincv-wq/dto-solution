import ButtonLink from '../../components/common/ButtonLink.jsx'
import MetaDescription from '../../components/common/MetaDescription.jsx'

const privacyUrl = 'https://dtosolution.it/privacy/sito-web'

const sections = [
  ['titolare-del-trattamento', 'Titolare del trattamento'],
  ['dati-di-navigazione', 'Dati di navigazione'],
  ['contatti-email', 'Contatti via email'],
  ['cookie-analytics', 'Cookie e analytics'],
  ['servizi-di-terze-parti', 'Servizi di terze parti'],
  ['conservazione-sicurezza', 'Conservazione e sicurezza'],
  ['diritti-dell-utente', 'Diritti dell’utente'],
  ['modifiche', 'Modifiche all’informativa'],
]

function WebsitePrivacyPage() {
  return (
    <article className="page-section privacy-document">
      <MetaDescription
        title="Privacy del sito web | DTO Solution"
        canonical={privacyUrl}
        content="Informativa sulla privacy relativa alla navigazione del sito web DTO Solution e alle comunicazioni inviate tramite email."
        openGraphUrl={privacyUrl}
      />

      <div className="container narrow-layout">
        <header className="page-intro privacy-document__header">
          <p className="eyebrow">Informativa ufficiale</p>
          <h1>Privacy Policy<br />Sito Web DTO Solution</h1>
          <p className="privacy-document__updated"><strong>Ultimo aggiornamento:</strong> Agosto 2026</p>
        </header>

        <section className="content-panel prose" aria-labelledby="website-privacy-introduction">
          <h2 id="website-privacy-introduction">Informativa sulla privacy</h2>
          <p>Questa informativa descrive il trattamento dei dati connesso alla navigazione del sito DTOSolution.it e alle comunicazioni inviate volontariamente a DTO Solution.</p>
        </section>

        <nav className="privacy-toc" aria-labelledby="website-privacy-index">
          <h2 id="website-privacy-index">Indice</h2>
          <ol>
            {sections.map(([id, title]) => <li key={id}><a href={`#${id}`}>{title}</a></li>)}
          </ol>
        </nav>

        <div className="privacy-document__content">
          <section id="titolare-del-trattamento">
            <h2>Titolare del trattamento</h2>
            <p><strong>DTO Solution</strong></p>
            <p>Email: <a href="mailto:dtosolution@gmail.com">dtosolution@gmail.com</a></p>
            <p>Sito web: <a href="https://dtosolution.it">https://dtosolution.it</a></p>
          </section>

          <section id="dati-di-navigazione">
            <h2>Dati di navigazione</h2>
            <p>Durante la normale navigazione, i sistemi informatici e il servizio di hosting possono trattare dati tecnici necessari a rendere disponibile e proteggere il sito, come indirizzo IP, data e ora della richiesta, pagina richiesta, tipo di browser e informazioni tecniche sul dispositivo.</p>
            <p>Tali dati vengono utilizzati per il funzionamento, la sicurezza e la diagnosi di eventuali problemi tecnici del sito.</p>
          </section>

          <section id="contatti-email">
            <h2>Contatti via email</h2>
            <p>La pagina Contatti non utilizza un modulo che invia dati direttamente ai server di DTO Solution.</p>
            <p>Quando l’utente sceglie volontariamente di scrivere tramite il collegamento email, vengono trattati l’indirizzo del mittente e le informazioni inserite nella comunicazione esclusivamente per rispondere alla richiesta, fornire assistenza o valutare una proposta di collaborazione.</p>
            <p>Si invita a non inviare dati non necessari o informazioni particolarmente sensibili.</p>
          </section>

          <section id="cookie-analytics">
            <h2>Cookie e analytics</h2>
            <p>Nella versione attuale il sito non integra sistemi di analytics, profilazione o pubblicità e non utilizza cookie applicativi per tracciare gli utenti.</p>
            <p>Eventuali funzionalità tecniche gestite dal browser o dall’infrastruttura di hosting restano soggette alle configurazioni dei rispettivi servizi.</p>
          </section>

          <section id="servizi-di-terze-parti">
            <h2>Servizi di terze parti</h2>
            <p>Il sito è distribuito tramite un fornitore di hosting, che può trattare i dati tecnici necessari all’erogazione e alla sicurezza del servizio secondo la propria informativa.</p>
            <p>I collegamenti a siti esterni, come Google Play o i siti ufficiali dei prodotti, conducono a servizi autonomi soggetti alle rispettive informative privacy.</p>
          </section>

          <section id="conservazione-sicurezza">
            <h2>Conservazione e sicurezza</h2>
            <p>Le comunicazioni ricevute vengono conservate per il tempo necessario a gestire la richiesta e gli eventuali rapporti conseguenti, salvo obblighi di legge.</p>
            <p>DTO Solution adotta misure ragionevoli per proteggere i dati trattati, fermo restando che nessun sistema informatico può garantire una sicurezza assoluta.</p>
          </section>

          <section id="diritti-dell-utente">
            <h2>Diritti dell’utente</h2>
            <p>L’utente può richiedere informazioni sul trattamento dei propri dati, la rettifica o la cancellazione quando applicabile, scrivendo a <a href="mailto:dtosolution@gmail.com">dtosolution@gmail.com</a>.</p>
          </section>

          <section id="modifiche">
            <h2>Modifiche all’informativa</h2>
            <p>Questa Privacy Policy potrà essere aggiornata in seguito a modifiche del sito, dei servizi utilizzati o della normativa applicabile. La versione più recente sarà pubblicata su questa pagina.</p>
          </section>
        </div>

        <ButtonLink to="/privacy" variant="secondary">Torna alle Privacy Policy</ButtonLink>
      </div>
    </article>
  )
}

export default WebsitePrivacyPage
