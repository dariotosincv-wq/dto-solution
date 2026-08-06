import ButtonLink from '../../components/common/ButtonLink.jsx'
import MetaDescription from '../../components/common/MetaDescription.jsx'

const privacyUrl = 'https://dtosolution.it/applicazioni/shopping-voice/privacy'

const sections = [
  ['titolare-del-trattamento', 'Titolare del trattamento'],
  ['dati-raccolti', 'Dati raccolti'],
  ['dati-non-raccolti', 'Dati NON raccolti'],
  ['riconoscimento-vocale', 'Riconoscimento vocale'],
  ['fotocamera', 'Fotocamera'],
  ['tessere-fedelta', 'Tessere fedeltà'],
  ['founder-pass', 'Founder Pass'],
  ['condivisione-dati', 'Condivisione dati'],
  ['backup', 'Backup'],
  ['servizi-di-terze-parti', 'Servizi di terze parti'],
  ['sicurezza', 'Sicurezza'],
  ['diritti-dell-utente', "Diritti dell'utente"],
  ['contatti', 'Contatti'],
]

function PrivacyEmail() {
  return <a href="mailto:dtosolutions@gmail.com">dtosolutions@gmail.com</a>
}

function ShoppingVoicePrivacyPage() {
  return (
    <article className="page-section privacy-document">
      <MetaDescription
        canonical={privacyUrl}
        content="Privacy Policy ufficiale dell’app Shopping Voice, sviluppata da DTO Solution."
        openGraphUrl={privacyUrl}
      />

      <div className="container narrow-layout">
        <header className="page-intro privacy-document__header">
          <p className="eyebrow">Informativa ufficiale</p>
          <h1>Privacy Policy<br />Shopping Voice</h1>
          <p className="privacy-document__updated">
            <strong>Ultimo aggiornamento:</strong> Agosto 2026
          </p>
        </header>

        <section className="content-panel prose" aria-labelledby="privacy-introduction-title">
          <h2 id="privacy-introduction-title">Privacy Policy - Shopping Voice</h2>
          <p>Grazie per utilizzare Shopping Voice.</p>
          <p>La tutela della tua privacy è importante per DTO Solution.</p>
          <p>Questa informativa descrive quali dati vengono trattati dall’applicazione Shopping Voice e come vengono utilizzati.</p>
        </section>

        <nav className="privacy-toc" aria-labelledby="privacy-toc-title">
          <h2 id="privacy-toc-title">Indice</h2>
          <ol>
            {sections.map(([id, title]) => (
              <li key={id}><a href={`#${id}`}>{title}</a></li>
            ))}
          </ol>
        </nav>

        <div className="privacy-document__content">
          <section id="titolare-del-trattamento">
            <h2>Titolare del trattamento</h2>
            <p><strong>DTO Solution</strong></p>
            <p>Email: <PrivacyEmail /></p>
          </section>

          <section id="dati-raccolti">
            <h2>Dati raccolti</h2>
            <p>Shopping Voice è progettata per funzionare principalmente in locale sul dispositivo dell’utente.</p>
            <p>Le liste della spesa, i reparti personalizzati, i percorsi dei supermercati, le tessere fedeltà e le preferenze vengono salvati esclusivamente sul dispositivo.</p>
            <p>L’app non richiede la creazione di un account.</p>
          </section>

          <section id="dati-non-raccolti">
            <h2>Dati NON raccolti</h2>
            <p>Shopping Voice non raccoglie:</p>
            <ul>
              <li>posizione GPS;</li>
              <li>contatti;</li>
              <li>fotografie personali;</li>
              <li>file audio;</li>
              <li>dati bancari;</li>
              <li>password;</li>
              <li>identificativi pubblicitari;</li>
              <li>dati biometrici;</li>
              <li>cronologia di navigazione;</li>
              <li>dati sanitari.</li>
            </ul>
          </section>

          <section id="riconoscimento-vocale">
            <h2>Riconoscimento vocale</h2>
            <p>La funzione di dettatura utilizza il sistema di riconoscimento vocale disponibile sul dispositivo.</p>
            <p>L’elaborazione della voce dipende esclusivamente dal provider configurato sul telefono (ad esempio Google).</p>
            <p>Shopping Voice non registra, conserva né riceve i file audio pronunciati dall’utente.</p>
          </section>

          <section id="fotocamera">
            <h2>Fotocamera</h2>
            <p>La fotocamera viene utilizzata esclusivamente quando richiesta dall’utente per la scansione dei codici.</p>
            <p>Le immagini non vengono archiviate dall’app.</p>
          </section>

          <section id="tessere-fedelta">
            <h2>Tessere fedeltà</h2>
            <p>Le tessere fedeltà inserite vengono salvate esclusivamente nella memoria del dispositivo.</p>
            <p>DTO Solution non riceve alcuna copia di tali dati.</p>
          </section>

          <section id="founder-pass">
            <h2>Founder Pass</h2>
            <p>L’adesione al programma Founder Pass è completamente facoltativa.</p>
            <p>Qualora l’utente scelga volontariamente di inviare una email a DTO Solution, verranno trattati esclusivamente i dati contenuti nella comunicazione al fine di gestire il programma Founder Pass.</p>
            <p>Le informazioni non saranno cedute a terzi.</p>
          </section>

          <section id="condivisione-dati">
            <h2>Condivisione dati</h2>
            <p>L’app può condividere liste della spesa esclusivamente quando l’utente sceglie volontariamente di utilizzare le funzioni di condivisione del proprio dispositivo.</p>
            <p>Nessuna lista viene inviata automaticamente a DTO Solution.</p>
          </section>

          <section id="backup">
            <h2>Backup</h2>
            <p>Alcuni dati locali potrebbero essere inclusi nei normali backup Android, qualora questa funzione sia attiva sul dispositivo.</p>
          </section>

          <section id="servizi-di-terze-parti">
            <h2>Servizi di terze parti</h2>
            <p>Shopping Voice utilizza esclusivamente i servizi necessari al funzionamento del sistema operativo Android e del Google Play Store.</p>
            <p>L’app non utilizza servizi di analytics, profilazione o pubblicità nella versione attuale.</p>
          </section>

          <section id="sicurezza">
            <h2>Sicurezza</h2>
            <p>I dati vengono conservati principalmente sul dispositivo dell’utente.</p>
            <p>DTO Solution adotta le misure ragionevoli per proteggere i dati trattati.</p>
          </section>

          <section id="diritti-dell-utente">
            <h2>Diritti dell’utente</h2>
            <p>L’utente può in qualsiasi momento:</p>
            <ul>
              <li>eliminare i dati locali disinstallando l’app o cancellandone i dati;</li>
              <li>contattare DTO Solution per qualsiasi richiesta relativa alla privacy.</li>
            </ul>
          </section>

          <section id="contatti">
            <h2>Contatti</h2>
            <p><strong>DTO Solution</strong></p>
            <p>Email: <PrivacyEmail /></p>
          </section>

          <section aria-labelledby="privacy-updates-title">
            <h2 id="privacy-updates-title">Aggiornamenti dell’informativa</h2>
            <p>Questa Privacy Policy potrà essere aggiornata nel tempo in seguito all’introduzione di nuove funzionalità o modifiche legislative.</p>
          </section>
        </div>

        <ButtonLink to="/applicazioni/shopping-voice" variant="secondary">
          Torna a Shopping Voice
        </ButtonLink>
      </div>
    </article>
  )
}

export default ShoppingVoicePrivacyPage
