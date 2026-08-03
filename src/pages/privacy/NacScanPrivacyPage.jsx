import ButtonLink from '../../components/common/ButtonLink.jsx'
import MetaDescription from '../../components/common/MetaDescription.jsx'

const privacyUrl = 'https://dtosolution.it/applicazioni/nacscan/privacy'

const sections = [
  ['titolare-e-contatti', '1. Titolare e contatti'],
  ['descrizione-applicazione', '2. Descrizione dell’applicazione'],
  ['account-e-registrazione', '3. Account e registrazione'],
  ['dati-trattati', '4. Dati trattati dall’applicazione'],
  ['elaborazione-locale', '5. Elaborazione locale dei documenti'],
  ['salvataggio-file', '6. Salvataggio dei file'],
  ['firme', '7. Firme'],
  ['copertura-testo', '8. Funzione di copertura del testo'],
  ['estrazione-testo', '9. Estrazione del testo'],
  ['fotocamera-scansione-file', '10. Fotocamera, scansione e selezione dei file'],
  ['condivisione-documenti', '11. Condivisione dei documenti'],
  ['servizi-google', '12. Servizi Google'],
  ['connessione-internet', '13. Connessione Internet'],
  ['pubblicita-analytics-profilazione', '14. Pubblicità, analytics e profilazione'],
  ['dati-non-raccolti', '15. Dati che DTO Solution non raccoglie'],
  ['backup-sincronizzazioni', '16. Backup e sincronizzazioni del dispositivo'],
  ['conservazione-cancellazione', '17. Conservazione e cancellazione'],
  ['sicurezza', '18. Sicurezza'],
  ['dati-minori', '19. Dati di minori'],
  ['ruolo-utente', '20. Ruolo dell’utente'],
  ['diritti-richieste', '21. Diritti e richieste'],
  ['modifiche-privacy-policy', '22. Modifiche alla Privacy Policy'],
  ['contatti', '23. Contatti'],
]

function PrivacyEmail() {
  return <a href="mailto:dtosolution@gmail.com">dtosolution@gmail.com</a>
}

function NacScanPrivacyPage() {
  return (
    <article className="page-section privacy-document">
      <MetaDescription
        canonical={privacyUrl}
        content="Informativa sulla privacy ufficiale dell’app NACSCAN sviluppata da DTO Solution."
        openGraphUrl={privacyUrl}
      />

      <div className="container narrow-layout">
        <header className="page-intro privacy-document__header">
          <p className="eyebrow">Informativa ufficiale</p>
          <h1>Privacy Policy di NACSCAN</h1>
          <p className="privacy-document__updated">
            <strong>Ultimo aggiornamento:</strong> 3 agosto 2026
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
          <section id="titolare-e-contatti">
            <h2>1. Titolare e contatti</h2>
            <p>NACSCAN è sviluppata e distribuita da DTO Solution, sviluppatore indipendente.</p>
            <p>Per domande relative alla presente Privacy Policy o al funzionamento dell’app è possibile scrivere a:</p>
            <p><PrivacyEmail /></p>
            <p><strong>Nome dell’app:</strong> NACSCAN</p>
            <p><strong>Identificativo Android:</strong> com.dariot.app.nacscan</p>
          </section>

          <section id="descrizione-applicazione">
            <h2>2. Descrizione dell’applicazione</h2>
            <p>NACSCAN è un’applicazione Android che consente di:</p>
            <ul>
              <li>scansionare documenti;</li>
              <li>acquisire fotografie;</li>
              <li>importare immagini e PDF;</li>
              <li>creare documenti PDF;</li>
              <li>visualizzare e modificare PDF;</li>
              <li>aggiungere testo;</li>
              <li>compilare moduli;</li>
              <li>inserire firme grafiche;</li>
              <li>coprire visivamente alcune parti del documento;</li>
              <li>ruotare e raddrizzare le pagine;</li>
              <li>estrarre il testo digitale presente nei PDF;</li>
              <li>salvare e condividere documenti.</li>
            </ul>
            <p>L’app è progettata per funzionare prevalentemente in locale sul dispositivo dell’utente.</p>
          </section>

          <section id="account-e-registrazione">
            <h2>3. Account e registrazione</h2>
            <p>NACSCAN non richiede:</p>
            <ul>
              <li>creazione di un account;</li>
              <li>registrazione;</li>
              <li>login;</li>
              <li>password;</li>
              <li>indirizzo e-mail;</li>
              <li>numero di telefono;</li>
              <li>autenticazione tramite social network.</li>
            </ul>
            <p>NACSCAN non dispone di un database remoto degli utenti.</p>
          </section>

          <section id="dati-trattati">
            <h2>4. Dati trattati dall’applicazione</h2>
            <p>NACSCAN può elaborare i contenuti scelti o creati direttamente dall’utente, tra cui:</p>
            <ul>
              <li>immagini e fotografie di documenti;</li>
              <li>file PDF;</li>
              <li>testo digitale contenuto nei PDF;</li>
              <li>testo inserito manualmente;</li>
              <li>testo estratto dai PDF;</li>
              <li>firme disegnate dall’utente;</li>
              <li>nomi assegnati alle firme;</li>
              <li>aree di copertura;</li>
              <li>nomi dei file;</li>
              <li>formato, dimensione e numero delle pagine;</li>
              <li>coordinate e posizione degli elementi inseriti;</li>
              <li>preferenze dell’app;</li>
              <li>lingua selezionata;</li>
              <li>dimensione e colore predefiniti del testo;</li>
              <li>testo configurato per la ricerca automatica nei PDF.</li>
            </ul>
            <p>I documenti scelti dall’utente possono contenere dati personali o informazioni riservate, ad esempio nomi, indirizzi, firme, fotografie, dati lavorativi, fiscali, bancari, sanitari o relativi a terzi.</p>
            <p>DTO Solution non accede, non consulta e non riceve automaticamente tali contenuti.</p>
          </section>

          <section id="elaborazione-locale">
            <h2>5. Elaborazione locale dei documenti</h2>
            <p>Le principali operazioni effettuate da NACSCAN avvengono localmente sul dispositivo, tra cui:</p>
            <ul>
              <li>visualizzazione dei PDF;</li>
              <li>creazione dei PDF;</li>
              <li>inserimento del testo;</li>
              <li>compilazione;</li>
              <li>inserimento delle firme;</li>
              <li>applicazione delle coperture;</li>
              <li>rotazione e raddrizzamento;</li>
              <li>ricerca testuale;</li>
              <li>estrazione del testo digitale;</li>
              <li>preparazione dei file per il salvataggio o la condivisione.</li>
            </ul>
            <p>NACSCAN non invia automaticamente documenti, immagini, firme o testo a server gestiti da DTO Solution.</p>
            <p>Non esiste un servizio cloud NACSCAN.</p>
          </section>

          <section id="salvataggio-file">
            <h2>6. Salvataggio dei file</h2>
            <p>Quando l’utente sceglie di salvare un documento, i file vengono normalmente archiviati sul dispositivo nella cartella:</p>
            <p><strong>Documenti/NACSCAN</strong></p>
            <p>Possono essere salvati:</p>
            <ul>
              <li>PDF creati mediante scansione o immagini;</li>
              <li>PDF modificati;</li>
              <li>PDF compilati;</li>
              <li>PDF firmati;</li>
              <li>file TXT contenenti il testo estratto.</li>
            </ul>
            <p>Durante alcune operazioni possono essere create copie temporanee nella cache dell’app, ad esempio per:</p>
            <ul>
              <li>importare file da altre applicazioni;</li>
              <li>aprire documenti;</li>
              <li>preparare un PDF per la condivisione.</li>
            </ul>
            <p>La cache è gestita dal sistema operativo e può essere rimossa automaticamente da Android oppure cancellata dall’utente attraverso le impostazioni del dispositivo.</p>
          </section>

          <section id="firme">
            <h2>7. Firme</h2>
            <p>L’utente può disegnare e salvare una o più firme.</p>
            <p>Una firma salvata può comprendere:</p>
            <ul>
              <li>immagine grafica della firma;</li>
              <li>nome scelto dall’utente;</li>
              <li>identificativo generato localmente;</li>
              <li>data di creazione;</li>
              <li>indicazione della firma predefinita.</li>
            </ul>
            <p>Le firme vengono memorizzate localmente nelle preferenze dell’app e non vengono inviate automaticamente a DTO Solution.</p>
            <p>Le firme inserite da NACSCAN sono immagini grafiche. Non costituiscono una firma elettronica qualificata, non utilizzano certificati digitali e non applicano una firma crittografica al PDF.</p>
          </section>

          <section id="copertura-testo">
            <h2>8. Funzione di copertura del testo</h2>
            <p>La funzione “Copri testo” applica una copertura grafica bianca sopra la parte selezionata del documento.</p>
            <p>Questa funzione non deve essere considerata uno strumento di cancellazione definitiva o di redazione crittograficamente sicura.</p>
            <p>Il contenuto originale sottostante potrebbe rimanere presente nella struttura del PDF e potrebbe essere recuperabile con strumenti esterni.</p>
            <p>Per documenti altamente riservati, l’utente deve utilizzare strumenti professionali specificamente progettati per la redazione sicura dei PDF.</p>
          </section>

          <section id="estrazione-testo">
            <h2>9. Estrazione del testo</h2>
            <p>NACSCAN può estrarre il testo digitale già presente all’interno di un PDF.</p>
            <p>L’estrazione viene effettuata localmente sul dispositivo.</p>
            <p>La funzione non utilizza un servizio cloud e non invia il testo a DTO Solution.</p>
            <p>NACSCAN non esegue automaticamente OCR sulle immagini contenute nei PDF. Se il documento è costituito esclusivamente da immagini e non contiene un livello testuale digitale, il testo potrebbe non essere estraibile.</p>
          </section>

          <section id="fotocamera-scansione-file">
            <h2>10. Fotocamera, scansione e selezione dei file</h2>
            <p>NACSCAN può utilizzare:</p>
            <ul>
              <li>l’app fotocamera del dispositivo;</li>
              <li>Google ML Kit Document Scanner;</li>
              <li>il selettore Android di immagini e documenti;</li>
              <li>i sistemi Android di condivisione e apertura dei file.</li>
            </ul>
            <p>L’accesso avviene in seguito a un’azione volontaria dell’utente.</p>
            <p>L’app non richiede accesso indiscriminato a tutti i file presenti sul dispositivo e utilizza gli URI e i selettori messi a disposizione dal sistema operativo Android.</p>
          </section>

          <section id="condivisione-documenti">
            <h2>11. Condivisione dei documenti</h2>
            <p>La condivisione avviene esclusivamente su iniziativa dell’utente.</p>
            <p>Quando l’utente seleziona “Condividi”, NACSCAN passa il documento o il testo al menu di condivisione Android.</p>
            <p>L’utente sceglie autonomamente l’app destinataria, ad esempio:</p>
            <ul>
              <li>applicazione e-mail;</li>
              <li>applicazione di messaggistica;</li>
              <li>servizio cloud;</li>
              <li>applicazione di archiviazione;</li>
              <li>altra applicazione compatibile.</li>
            </ul>
            <p>Dal momento della condivisione, i dati vengono trattati secondo le condizioni e la Privacy Policy dell’applicazione scelta dall’utente.</p>
            <p>DTO Solution non controlla il trattamento effettuato da tali applicazioni esterne.</p>
          </section>

          <section id="servizi-google">
            <h2>12. Servizi Google</h2>
            <p>NACSCAN utilizza alcuni componenti forniti da Google.</p>
            <h3>Google ML Kit Document Scanner</h3>
            <p>Viene utilizzato per offrire la funzione di scansione dei documenti, incluso il rilevamento del documento, il ritaglio e gli strumenti messi a disposizione dal servizio.</p>
            <p>Google Play Services potrebbe collegarsi ai server Google per installare o aggiornare i componenti tecnici necessari.</p>
            <h3>Google Play In-App Updates</h3>
            <p>NACSCAN può verificare tramite Google Play se è disponibile una nuova versione dell’app e permettere all’utente di installare l’aggiornamento.</p>
            <p>Google Play può trattare informazioni tecniche necessarie alla verifica e alla distribuzione dell’aggiornamento, secondo la propria Privacy Policy.</p>
            <h3>Photo Picker Android</h3>
            <p>Su alcuni dispositivi, Google Play Services può installare o aggiornare il componente necessario alla selezione delle immagini.</p>
            <p>Dal codice di NACSCAN non risulta un caricamento intenzionale dei documenti dell’utente sui server Google attraverso tali funzioni.</p>
          </section>

          <section id="connessione-internet">
            <h2>13. Connessione Internet</h2>
            <p>NACSCAN dispone del permesso di accesso a Internet principalmente per:</p>
            <ul>
              <li>verificare la disponibilità degli aggiornamenti su Google Play;</li>
              <li>scaricare e installare gli aggiornamenti;</li>
              <li>permettere il funzionamento o l’aggiornamento dei componenti Google Play Services e Google ML Kit.</li>
            </ul>
            <p>L’app non utilizza la connessione Internet per caricare automaticamente documenti, immagini, testo o firme su un server NACSCAN.</p>
          </section>

          <section id="pubblicita-analytics-profilazione">
            <h2>14. Pubblicità, analytics e profilazione</h2>
            <p>Nella versione attuale NACSCAN non integra:</p>
            <ul>
              <li>pubblicità;</li>
              <li>Google AdMob;</li>
              <li>identificatori pubblicitari;</li>
              <li>sistemi di profilazione;</li>
              <li>Google Analytics;</li>
              <li>Firebase Analytics;</li>
              <li>Crashlytics;</li>
              <li>strumenti proprietari di telemetria;</li>
              <li>sistemi di tracciamento del comportamento;</li>
              <li>cookie pubblicitari;</li>
              <li>pixel di marketing.</li>
            </ul>
            <p>DTO Solution non raccoglie statistiche personali sull’utilizzo dell’app attraverso un proprio servizio remoto.</p>
          </section>

          <section id="dati-non-raccolti">
            <h2>15. Dati che DTO Solution non raccoglie</h2>
            <p>DTO Solution non raccoglie automaticamente tramite NACSCAN:</p>
            <ul>
              <li>nome e cognome dell’utente;</li>
              <li>indirizzo e-mail;</li>
              <li>numero di telefono;</li>
              <li>indirizzo di residenza;</li>
              <li>posizione geografica;</li>
              <li>contatti;</li>
              <li>password;</li>
              <li>credenziali;</li>
              <li>identificatore pubblicitario;</li>
              <li>cronologia di utilizzo;</li>
              <li>dati di pagamento;</li>
              <li>contenuto dei PDF;</li>
              <li>fotografie dei documenti;</li>
              <li>firme salvate;</li>
              <li>testo estratto;</li>
              <li>testo inserito nei documenti.</li>
            </ul>
          </section>

          <section id="backup-sincronizzazioni">
            <h2>16. Backup e sincronizzazioni del dispositivo</h2>
            <p>Le impostazioni Android dell’utente possono prevedere sistemi di backup o sincronizzazione.</p>
            <p>Alcuni dati locali dell’app, comprese preferenze e firme, potrebbero essere inclusi nei backup Android se tale funzione è attiva sul dispositivo.</p>
            <p>I file salvati nella cartella Documenti/NACSCAN potrebbero inoltre essere sincronizzati da applicazioni o servizi cloud installati e configurati direttamente dall’utente.</p>
            <p>Tali operazioni non vengono avviate né controllate da DTO Solution.</p>
          </section>

          <section id="conservazione-cancellazione">
            <h2>17. Conservazione e cancellazione</h2>
            <p>DTO Solution non conserva copie dei documenti dell’utente su propri server.</p>
            <p>I dati locali restano sul dispositivo fino a quando:</p>
            <ul>
              <li>l’utente cancella i file;</li>
              <li>l’utente elimina firme o preferenze;</li>
              <li>l’utente svuota la cache;</li>
              <li>il sistema operativo elimina i dati temporanei;</li>
              <li>l’app viene disinstallata;</li>
              <li>un servizio di backup o sincronizzazione gestito dall’utente conserva una copia.</li>
            </ul>
            <p>Per eliminare i PDF o i TXT salvati, l’utente può utilizzare il gestore file del dispositivo e cancellare i contenuti della cartella Documenti/NACSCAN.</p>
            <p>Le firme salvate possono essere eliminate dalle impostazioni dell’app.</p>
            <p>I dati dell’app possono inoltre essere eliminati dalle impostazioni Android o disinstallando NACSCAN.</p>
          </section>

          <section id="sicurezza">
            <h2>18. Sicurezza</h2>
            <p>NACSCAN utilizza i meccanismi di protezione, isolamento e condivisione sicura dei file forniti da Android.</p>
            <p>Tuttavia, nessun sistema informatico può garantire una sicurezza assoluta.</p>
            <p>L’utente è responsabile della protezione del proprio dispositivo, dell’eventuale blocco dello schermo, dei backup configurati e della scelta delle applicazioni con cui condivide i documenti.</p>
          </section>

          <section id="dati-minori">
            <h2>19. Dati di minori</h2>
            <p>NACSCAN non è progettata specificamente per raccogliere dati di minori e non dispone di account o sistemi di registrazione.</p>
            <p>L’app può comunque essere utilizzata per elaborare documenti che contengono dati di minori, scelti direttamente dall’utente.</p>
            <p>In tali casi, l’utente deve assicurarsi di disporre delle autorizzazioni e dei presupposti necessari per trattare tali informazioni.</p>
          </section>

          <section id="ruolo-utente">
            <h2>20. Ruolo dell’utente</h2>
            <p>L’utente decide autonomamente:</p>
            <ul>
              <li>quali documenti aprire;</li>
              <li>quali immagini importare;</li>
              <li>quali informazioni inserire;</li>
              <li>quali firme salvare;</li>
              <li>quali file conservare;</li>
              <li>quali documenti condividere;</li>
              <li>con quali applicazioni condividerli.</li>
            </ul>
            <p>L’utente è responsabile di avere il diritto di utilizzare e trattare i documenti e i dati personali eventualmente contenuti al loro interno.</p>
          </section>

          <section id="diritti-richieste">
            <h2>21. Diritti e richieste</h2>
            <p>Poiché DTO Solution non riceve e non conserva sui propri server i documenti o i dati inseriti nell’app, nella maggior parte dei casi non dispone materialmente dei dati da consultare, modificare o cancellare.</p>
            <p>L’utente può gestire direttamente i dati locali tramite NACSCAN, il gestore file e le impostazioni Android.</p>
            <p>Per informazioni o richieste relative alla presente Privacy Policy è possibile scrivere a:</p>
            <p><PrivacyEmail /></p>
          </section>

          <section id="modifiche-privacy-policy">
            <h2>22. Modifiche alla Privacy Policy</h2>
            <p>La presente Privacy Policy può essere aggiornata in caso di:</p>
            <ul>
              <li>aggiunta di nuove funzionalità;</li>
              <li>introduzione di servizi online;</li>
              <li>integrazione di pubblicità o analytics;</li>
              <li>modifiche tecniche;</li>
              <li>modifiche normative;</li>
              <li>modifiche ai servizi di terze parti.</li>
            </ul>
            <p>La data dell’ultimo aggiornamento sarà indicata all’inizio del documento.</p>
            <p>In caso di modifiche rilevanti, la nuova versione sarà resa disponibile sul sito ufficiale e attraverso l’app o la relativa pagina Google Play.</p>
          </section>

          <section id="contatti">
            <h2>23. Contatti</h2>
            <address>
              <strong>DTO Solution</strong><br />
              Applicazione: NACSCAN<br />
              E-mail: <PrivacyEmail /><br />
              Sito web: <a href="https://dto-solution.it">https://dto-solution.it</a>
            </address>
          </section>
        </div>

        <ButtonLink to="/applicazioni/nacscan" variant="secondary">
          Torna a NACSCAN
        </ButtonLink>
      </div>
    </article>
  )
}

export default NacScanPrivacyPage
