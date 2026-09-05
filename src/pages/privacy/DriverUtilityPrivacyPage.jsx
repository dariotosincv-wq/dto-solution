import ButtonLink from '../../components/common/ButtonLink.jsx'
import MetaDescription from '../../components/common/MetaDescription.jsx'

const privacyUrl = 'https://dtosolution.it/applicazioni/driver-utility/privacy'

const sections = [
  ['titolare-del-trattamento', 'Titolare del trattamento'],
  ['quali-dati-vengono-raccolti', 'Quali dati vengono raccolti'],
  ['archiviazione-locale', 'Archiviazione locale'],
  ['qr-cloud', 'QR Cloud'],
  ['controlla-mezzi', 'Controlla Mezzi'],
  ['backup-su-google-drive', 'Backup su Google Drive'],
  ['ocr-targa', 'OCR targa'],
  ['driver-payroll', 'Driver Payroll'],
  ['driver-pdf-finder', 'Driver PDF Finder'],
  ['foto-giornata', 'Foto Giornata'],
  ['permessi-richiesti', 'Permessi richiesti'],
  ['servizi-di-terze-parti', 'Servizi di terze parti'],
  ['condivisione-dei-dati', 'Condivisione dei dati'],
  ['conservazione-dei-dati', 'Conservazione dei dati'],
  ['sicurezza', 'Sicurezza'],
  ['diritti-dell-utente', 'Diritti dell’utente'],
  ['modifiche-alla-privacy-policy', 'Modifiche alla Privacy Policy'],
]

function PrivacyEmail() {
  return <a href="mailto:dtosolution@gmail.com">dtosolution@gmail.com</a>
}

function DriverUtilityPrivacyPage() {
  return (
    <article className="page-section privacy-document">
      <MetaDescription
        canonical={privacyUrl}
        content="Privacy Policy ufficiale di Driver Utility: dati trattati, archiviazione, servizi cloud, permessi e diritti dell’utente."
        openGraphUrl={privacyUrl}
      />

      <div className="container narrow-layout">
        <header className="page-intro privacy-document__header">
          <h1>Privacy Policy – Driver Utility</h1>
          <p className="privacy-document__updated">
            <strong>Ultimo aggiornamento:</strong> 04 agosto 2026
          </p>
        </header>

        <nav className="privacy-toc" aria-labelledby="privacy-toc-title">
          <h2 id="privacy-toc-title">Indice</h2>
          <ol>
            {sections.map(([id, title]) => (
              <li key={id}>
                <a href={`#${id}`}>{title}</a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="privacy-document__content">
          <section id="titolare-del-trattamento">
            <h2>Titolare del trattamento</h2>
            <p><strong>DTO Solution</strong></p>
            <p>Email: <strong><PrivacyEmail /></strong></p>
            <p>Driver Utility è progettata per aiutare autisti e aziende nella gestione delle attività quotidiane, come ispezioni dei veicoli, gestione QR, turni, documenti PDF e altre funzioni operative.</p>
            <p>La presente informativa descrive quali dati vengono trattati e con quali finalità.</p>
          </section>

          <section id="quali-dati-vengono-raccolti">
            <h2>Quali dati vengono raccolti</h2>
            <p>A seconda delle funzionalità utilizzate, l'app può trattare:</p>
            <ul>
              <li>Nome e cognome inseriti dall'utente</li>
              <li>Alias</li>
              <li>Nome azienda</li>
              <li>Dati relativi ai turni</li>
              <li>Fotografie</li>
              <li>PDF caricati dall'utente</li>
              <li>Immagini dei QR</li>
              <li>Coordinate GPS</li>
              <li>Targhe dei veicoli</li>
              <li>Note inserite manualmente</li>
              <li>Dati delle ispezioni dei veicoli</li>
              <li>Informazioni tecniche necessarie al funzionamento dell'app</li>
            </ul>
            <p>L'app non raccoglie automaticamente dati che non siano necessari alle funzionalità utilizzate.</p>
          </section>

          <section id="archiviazione-locale">
            <h2>Archiviazione locale</h2>
            <p>La maggior parte dei dati viene salvata esclusivamente sul dispositivo dell'utente.</p>
            <p>Ad esempio:</p>
            <ul>
              <li>Turni</li>
              <li>Fotografie</li>
              <li>Storico delle ispezioni</li>
              <li>PDF elaborati</li>
              <li>Impostazioni</li>
              <li>Cronologia locale</li>
              <li>Dati del modulo Busta Paga</li>
            </ul>
            <p>Tali dati rimangono sul dispositivo salvo esplicita condivisione o utilizzo delle funzioni cloud.</p>
          </section>

          <section id="qr-cloud">
            <h2>QR Cloud</h2>
            <p>La funzione <strong>QR Cloud</strong> utilizza Supabase per sincronizzare l'archivio dei QR.</p>
            <p>Quando questa funzione viene utilizzata possono essere inviati:</p>
            <ul>
              <li>Testo del QR</li>
              <li>Città</li>
              <li>Provincia</li>
              <li>Punto vendita</li>
              <li>Coordinate GPS</li>
              <li>Eventuali note</li>
              <li>Dati necessari alla sincronizzazione</li>
            </ul>
            <p>L'immagine del QR non viene caricata: viene salvato solamente il contenuto necessario per poterla rigenerare.</p>
          </section>

          <section id="controlla-mezzi">
            <h2>Controlla Mezzi</h2>
            <p>La funzione <strong>Controlla Mezzi</strong> permette di creare report fotografici del veicolo.</p>
            <p>Possono essere raccolti:</p>
            <ul>
              <li>Fotografie del mezzo</li>
              <li>Fotografie della targa</li>
              <li>Firma</li>
              <li>Coordinate GPS</li>
              <li>Note</li>
              <li>Nome del conducente</li>
              <li>Nome del veicolo</li>
              <li>Data e ora dell'ispezione</li>
            </ul>
            <p>I dati vengono normalmente salvati sul dispositivo.</p>
          </section>

          <section id="backup-su-google-drive">
            <h2>Backup su Google Drive</h2>
            <p>Se l'utente sceglie di collegare il proprio account Google, può attivare il backup dei PDF delle ispezioni su Google Drive.</p>
            <p>L'utilizzo di questa funzione è facoltativo.</p>
            <p>I dati vengono caricati esclusivamente nell'account Google autorizzato dall'utente.</p>
          </section>

          <section id="ocr-targa">
            <h2>OCR targa</h2>
            <p>Quando viene utilizzato il riconoscimento automatico della targa, l'immagine della targa viene inviata al servizio Google Cloud Vision esclusivamente per l'elaborazione OCR.</p>
            <p>Questa funzione è facoltativa.</p>
          </section>

          <section id="driver-payroll">
            <h2>Driver Payroll</h2>
            <p>Il modulo <strong>Busta Paga Driver</strong> elabora i PDF direttamente sul dispositivo.</p>
            <p>L'elaborazione avviene localmente.</p>
            <p>I PDF della busta paga non vengono inviati ai server di DTO Solution.</p>
            <p>L'app salva solamente le informazioni elaborate necessarie allo storico, eliminando il PDF originale dal processo di archiviazione.</p>
          </section>

          <section id="driver-pdf-finder">
            <h2>Driver PDF Finder</h2>
            <p>Il modulo Driver PDF Finder permette di cercare automaticamente il proprio nome nei PDF.</p>
            <p>L'elaborazione viene effettuata localmente.</p>
            <p>I PDF non vengono inviati ai server di DTO Solution.</p>
          </section>

          <section id="foto-giornata">
            <h2>Foto Giornata</h2>
            <p>Le fotografie vengono salvate sul dispositivo.</p>
            <p>Non vengono caricate automaticamente su servizi cloud.</p>
          </section>

          <section id="permessi-richiesti">
            <h2>Permessi richiesti</h2>
            <p>L'app può richiedere i seguenti permessi:</p>
            <ul>
              <li>Fotocamera</li>
              <li>Posizione GPS</li>
              <li>Microfono (solo per la dettatura vocale)</li>
              <li>Accesso ai file</li>
              <li>Connessione Internet</li>
            </ul>
            <p>Ogni permesso viene utilizzato esclusivamente per le funzionalità che lo richiedono.</p>
          </section>

          <section id="servizi-di-terze-parti">
            <h2>Servizi di terze parti</h2>
            <p>L'app può utilizzare i seguenti servizi:</p>
            <ul>
              <li>Google Drive</li>
              <li>Google Login</li>
              <li>Google Cloud Vision</li>
              <li>Google Play Services</li>
              <li>Supabase</li>
            </ul>
            <p>L'utilizzo di tali servizi è soggetto anche alle rispettive informative privacy.</p>
          </section>

          <section id="condivisione-dei-dati">
            <h2>Condivisione dei dati</h2>
            <p>DTO Solution non vende dati personali.</p>
            <p>I dati vengono condivisi esclusivamente:</p>
            <ul>
              <li>Con i servizi richiesti dall'utente (ad esempio Google Drive)</li>
              <li>Quando l'utente utilizza volontariamente la funzione di condivisione Android</li>
              <li>Quando utilizza le funzioni cloud dell'app</li>
            </ul>
          </section>

          <section id="conservazione-dei-dati">
            <h2>Conservazione dei dati</h2>
            <p>I dati rimangono sul dispositivo fino alla loro eliminazione da parte dell'utente o secondo le impostazioni di conservazione previste da alcune funzionalità dell'app.</p>
            <p>Nel caso delle funzioni cloud, i dati rimangono archiviati fino alla loro eliminazione. I dati personali eventualmente archiviati nei servizi cloud di DTO Solution possono essere eliminati su richiesta dell'utente.</p>
          </section>

          <section id="sicurezza">
            <h2>Sicurezza</h2>
            <p>Sono adottate misure ragionevoli per proteggere i dati trattati.</p>
            <p>Tuttavia nessun sistema informatico può garantire una sicurezza assoluta.</p>
          </section>

          <section id="diritti-dell-utente">
            <h2>Diritti dell'utente</h2>
            <p>L'utente può:</p>
            <ul>
              <li>Eliminare i dati salvati localmente</li>
              <li>Interrompere l'utilizzo delle funzioni cloud</li>
              <li>Richiedere la cancellazione dei dati personali eventualmente archiviati nei servizi cloud di DTO Solution scrivendo a <PrivacyEmail />.</li>
              <li>Revocare il collegamento con Google Drive</li>
              <li>Richiedere informazioni scrivendo a:</li>
            </ul>
            <p><strong>DTO Solution</strong></p>
            <p>Email: <strong><PrivacyEmail /></strong></p>
          </section>

          <section id="modifiche-alla-privacy-policy">
            <h2>Modifiche alla Privacy Policy</h2>
            <p>La presente Privacy Policy può essere aggiornata in qualsiasi momento per riflettere modifiche dell'app o cambiamenti normativi.</p>
            <p>La versione più recente sarà sempre disponibile all'interno dell'app e sul <a href="https://dtosolution.it">sito ufficiale di DTO Solution</a>.</p>
          </section>
        </div>

        <ButtonLink to="/applicazioni/driver-utility" variant="secondary">
          Torna a Driver Utility
        </ButtonLink>
      </div>
    </article>
  )
}

export default DriverUtilityPrivacyPage
