import AndroidProductPage from '../../components/products/AndroidProductPage.jsx'
import ButtonLink from '../../components/common/ButtonLink.jsx'
import { getApplicationBySlug } from '../../data/applications.js'
import { useI18n } from '../../i18n/useI18n.js'

const product = getApplicationBySlug('driver-utility')

const features = [
  ['Controlla Mezzi – CheckVan', 'Crea ispezioni di presa e riconsegna del veicolo con identificativo del mezzo, rotta, targa, conducente, azienda e note. Il controllo comprende fino a 14 fotografie guidate, fotografie aggiuntive, firma sullo schermo, posizione GPS e marker informativi applicati alle immagini. Le ispezioni possono essere salvate come bozze, consultate nell’archivio e trasformate in PDF compressi o ad alta qualità.'],
  ['Certificazione dei PDF CheckVan', 'Ogni versione del PDF può essere identificata attraverso impronta digitale e certificazione crittografica. Il sistema consente successivamente di verificare attraverso il sito DTO Solution che il documento corrisponda a quello certificato e non sia stato alterato dopo la sua creazione.'],
  ['Confronto delle ispezioni', 'Il sito DTO Solution mette a disposizione uno strumento dedicato per affiancare le fotografie di due ispezioni dello stesso veicolo. Le immagini possono essere ingrandite e spostate anche in modo sincronizzato, facilitando il confronto visivo tra le condizioni del mezzo in momenti differenti. La valutazione rimane umana.'],
  ['Turni Driver', 'Calendario mensile per registrare giornate lavorate, riposi, ferie, permessi, malattia, infortunio e altri eventi. Include riepiloghi mensili, gestione delle festività e possibilità di esportare il riepilogo in PDF.'],
  ['Busta Paga Driver', 'Importa una o più buste paga PDF, estrae le informazioni riconosciute e permette di conservarne uno storico. Il sistema esegue analisi e controlli di coerenza, confronta quando possibile i dati della busta paga con i turni registrati e segnala gli elementi che richiedono verifica.'],
  ['QR Locali e QR Cloud', 'Scansiona, archivia, ricerca e condivide QR utilizzati durante il lavoro. I QR possono essere organizzati per località e vettore, individuati anche in base alla posizione e, facoltativamente, salvati e recuperati tramite il servizio cloud.'],
  ['Ricerca nei PDF di lavoro', 'Driver Utility può aprire PDF ricevuti sul telefono, cercare automaticamente nome, cognome o alias configurati e portare rapidamente il driver alla corrispondenza trovata nel documento.'],
  ['Foto Giornata', 'Funzione rapida per acquisire e conservare temporaneamente fotografie utili durante la giornata lavorativa, mantenendole separate dalla normale galleria personale.'],
  ['Comandi vocali e strumenti rapidi', 'Nei campi supportati è possibile utilizzare la voce per inserire più velocemente informazioni come mezzo, rotta, targa e note.'],
]

const faqItems = [
  ['Driver Utility è pensata solo per i driver Amazon?', 'No. Diverse funzioni sono state sviluppate partendo da esigenze reali del lavoro di consegna, ma Driver Utility è pensata per poter essere utilizzata anche da driver e realtà operative differenti.'],
  ['Posso utilizzare Driver Utility senza connessione Internet?', 'Sì. Molte delle principali funzioni lavorano direttamente sul dispositivo. La connessione è necessaria solamente per determinati servizi online, come cloud, backup Google Drive, alcuni riconoscimenti e sincronizzazioni.'],
  ['Le fotografie delle ispezioni vengono inviate automaticamente a un server?', 'No. La generazione e la gestione dell’ispezione avvengono sul dispositivo. L’eventuale copia del PDF su Google Drive dipende dalle impostazioni scelte dall’utente.'],
  ['Che cosa significa “PDF certificato”?', 'Driver Utility calcola un’impronta digitale del PDF e crea una certificazione crittografica collegata a quella specifica versione del documento. In questo modo è possibile controllare successivamente se il file sottoposto a verifica corrisponde al documento originariamente certificato.'],
  ['Il sito DTO Solution conserva il PDF quando lo verifico?', 'La certificazione remota non richiede di conservare nel registro il contenuto del PDF: vengono registrati i dati crittografici e i metadati necessari alla verifica.'],
  ['A cosa serve il confronto delle ispezioni CheckVan?', 'Permette di visualizzare affiancate le fotografie di due controlli dello stesso veicolo e di ingrandirle o spostarle per facilitare l’individuazione visiva di eventuali differenze. La valutazione rimane umana: lo strumento facilita il confronto, non decide automaticamente se è presente un danno.'],
  ['Le 14 fotografie CheckVan sono obbligatorie?', 'Dipende dalla configurazione. Driver Utility può richiedere il completamento delle viste previste oppure consentire di proseguire dopo aver segnalato quelle mancanti.'],
  ['Driver Utility può controllare la mia busta paga?', 'Può leggere i PDF supportati, organizzare i dati, confrontarli con altre informazioni disponibili e segnalare possibili incongruenze o elementi da verificare. I risultati automatici non sostituiscono il documento originale né una verifica professionale quando necessaria.'],
  ['Dove vengono conservati i miei dati?', 'Una parte importante dei dati operativi viene conservata localmente sul dispositivo. Alcuni servizi facoltativi utilizzano invece servizi esterni, ad esempio Supabase per specifiche funzioni cloud e Google Drive quando l’utente sceglie di utilizzarlo.'],
  ['Posso condividere i PDF delle ispezioni?', 'Sì. I PDF CheckVan possono essere aperti e condivisi utilizzando le normali funzioni Android e, se configurato, può esserne salvata una copia su Google Drive.'],
].map(([question, answer]) => ({ answer, question }))

function DriverUtilityPage() {
  const { t } = useI18n()

  return (
    <AndroidProductPage
      product={product}
      description={<div className="product-prose">
        <p>Driver Utility è un’app Android pensata per semplificare il lavoro quotidiano dei driver e riunire in un unico strumento attività che normalmente richiedono applicazioni, documenti e procedure separate.</p>
        <p>Permette di documentare le condizioni dei mezzi prima e dopo l’utilizzo, organizzare turni e documenti di lavoro, gestire QR locali, analizzare le buste paga e accedere rapidamente alle informazioni utili durante la giornata.</p>
        <p>Particolare attenzione è dedicata a CheckVan, il sistema di ispezione fotografica dei veicoli: le verifiche possono essere documentate attraverso fotografie guidate, dati del mezzo, firma, posizione GPS e PDF certificati, creando una documentazione più chiara e verificabile sia per il driver sia per chi gestisce i mezzi.</p>
        <p>Driver Utility nasce dall’esperienza diretta nel lavoro su strada ed è progettata con un obiettivo semplice: ridurre operazioni ripetitive, organizzare meglio le informazioni e fornire strumenti pratici utilizzabili direttamente dallo smartphone.</p>
      </div>}
      features={<div className="product-feature-list">{features.map(([title, copy]) => <section key={title}><h3>{title}</h3><p>{copy}</p></section>)}</div>}
      technicalInformation={<div className="product-prose product-technical-list">
        <p>Driver Utility è un’applicazione Android sviluppata con tecnologie web moderne integrate con le funzionalità native dello smartphone.</p>
        <p>L’app utilizza direttamente, quando necessario e previa autorizzazione, fotocamera, GPS, microfono, filesystem, condivisione Android e scanner QR.</p>
        <p>Gran parte delle funzioni operative e dei dati viene gestita localmente sul dispositivo, permettendo di continuare a utilizzare le principali funzionalità anche in assenza di connessione. Internet viene utilizzato per specifici servizi opzionali o remoti, tra cui QR Cloud, sincronizzazione delle certificazioni CheckVan, riconoscimento online della targa, backup su Google Drive e aggiornamenti tramite Google Play.</p>
        <p>I PDF CheckVan vengono generati direttamente sul dispositivo. Per la certificazione viene calcolata un’impronta SHA-256 del documento e utilizzata una firma crittografica ECDSA P-256/SHA-256, con chiave privata protetta dal sistema Android. Il registro remoto conserva i dati necessari alla certificazione, non il contenuto del PDF.</p>
        <p>La copia dei PDF CheckVan su Google Drive è facoltativa. Le buste paga e gli altri PDF compatibili vengono analizzati localmente; eventuali risultati automatici o controlli di coerenza non sostituiscono la verifica del documento originale.</p>
      </div>}
      faqItems={faqItems}
    >
      <section className="product-download" aria-labelledby="checkvan-verification-title">
        <div>
          <p className="eyebrow">{t('Verifica CheckVan', 'CheckVan verification')}</p>
          <h2 id="checkvan-verification-title">
            {t('Controlla un documento CheckVan', 'Check a CheckVan document')}
          </h2>
          <p>{t(
            'Verifica localmente se un PDF corrisponde a un documento registrato da Driver Utility.',
            'Check locally whether a PDF matches a document registered by Driver Utility.',
          )}</p>
        </div>
        <ButtonLink to="/verifica-checkvan">
          {t('Verifica documento CheckVan', 'Verify CheckVan document')}
        </ButtonLink>
      </section>
      <section className="product-download" aria-labelledby="checkvan-comparison-title">
        <div>
          <p className="eyebrow">{t('Confronto CheckVan', 'CheckVan comparison')}</p>
          <h2 id="checkvan-comparison-title">{t('Confronta due ispezioni CheckVan', 'Compare two CheckVan inspections')}</h2>
          <p>{t('Visualizza affiancate le fotografie guidate di due ispezioni, direttamente nel browser.', 'View guided photographs from two inspections side by side, directly in your browser.')}</p>
        </div>
        <ButtonLink to="/confronta-checkvan">{t('Confronta ispezioni CheckVan', 'Compare CheckVan inspections')}</ButtonLink>
      </section>
    </AndroidProductPage>
  )
}

export default DriverUtilityPage
