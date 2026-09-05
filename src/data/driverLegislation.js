// Short editorial summaries checked against official sources on 2026-09-05.
// No contractual text or entitlement calculation is supplied here.
const normattiva = (code, date) => `https://www.normattiva.it/atto/caricaDettaglioAtto?atto.codiceRedazionale=${code}&atto.dataPubblicazioneGazzetta=${date}`
export const driverLegislation = [
  {
    id: 'orario', number: 'D.Lgs. 66/2003', title: 'Orario di lavoro',
    summary: 'Disciplina l’organizzazione dell’orario di lavoro, i periodi di recupero e il lavoro notturno. Prevede esclusioni e deroghe: occorre verificare la disciplina applicabile al proprio rapporto, anche rispetto alla contrattazione collettiva e alle norme speciali.',
    useful: 'Per orientarti su durata del lavoro, pause tra le attività, riposi e ferie, verificando prima il campo di applicazione.',
    topics: ['Durata dell’orario', 'Riposi', 'Pause', 'Ferie', 'Lavoro notturno'],
    source: normattiva('003G0091', '2003-04-14'), sourceLabel: 'Normattiva — D.Lgs. 66/2003',
  },
  {
    id: 'autotrasporto', number: 'D.Lgs. 234/2007', title: 'Orario dei lavoratori mobili dell’autotrasporto',
    summary: 'Regola l’orario delle persone che effettuano operazioni mobili di autotrasporto. L’articolo 2 richiama le attività contemplate dal regolamento (CE) 561/2006 oppure dall’accordo AETR. Non si applica automaticamente a qualunque driver o corriere: vanno verificati attività, veicolo e condizioni del caso concreto.',
    useful: 'Per distinguere orario di lavoro, tempi di disponibilità, riposi intermedi e lavoro notturno quando l’attività rientra nella disciplina speciale.',
    topics: ['Campo di applicazione', 'Orario di lavoro', 'Disponibilità', 'Riposi intermedi', 'Lavoro notturno'],
    source: 'https://www.lavoro.gov.it/documenti-e-norme/normative/Documents/2007/20071119_Dlgs_234.pdf', sourceLabel: 'Ministero del Lavoro — D.Lgs. 234/2007 (PDF)',
    sourceNote: 'Documento ministeriale di pubblicazione: per il caso concreto verifica anche le modifiche successive e i rinvii alla normativa europea vigente.',
  },
  {
    id: 'sicurezza', number: 'D.Lgs. 81/2008', title: 'Salute e sicurezza sul lavoro',
    summary: 'Organizza la prevenzione dei rischi lavorativi e individua obblighi e responsabilità dei soggetti coinvolti, compresi datore di lavoro e lavoratore. Comprende valutazione dei rischi, informazione, formazione e dispositivi di protezione individuale.',
    useful: 'Per consultare i riferimenti su rischi delle mansioni, formazione e protezioni necessarie durante il lavoro. Le misure concrete dipendono dall’attività e dai rischi valutati.',
    topics: ['Obblighi del datore', 'Obblighi del lavoratore', 'Prevenzione', 'Formazione', 'DPI', 'Rischi sul lavoro'],
    source: normattiva('008G0104', '2008-04-30'), sourceLabel: 'Normattiva — D.Lgs. 81/2008',
  },
  {
    id: 'statuto', number: 'Legge 300/1970', title: 'Statuto dei lavoratori',
    summary: 'Contiene disposizioni sulla libertà e dignità dei lavoratori, sui controlli, sulle sanzioni disciplinari e sulla libertà e attività sindacale nei luoghi di lavoro.',
    useful: 'Per individuare i riferimenti in caso di contestazioni disciplinari, controlli sul lavoro o esercizio dei diritti sindacali. Le singole tutele hanno condizioni e ambiti da verificare nel testo vigente.',
    topics: ['Libertà e dignità', 'Disciplina', 'Controlli', 'Attività sindacale', 'Tutele del lavoratore'],
    source: normattiva('070U0300', '1970-05-27'), sourceLabel: 'Normattiva — Legge 300/1970',
  },
  {
    id: 'contratti', number: 'D.Lgs. 81/2015', title: 'Contratti di lavoro e mansioni',
    summary: 'Raccoglie la disciplina di diverse forme contrattuali e interviene sulle mansioni. Per il lavoro subordinato sono pertinenti, secondo il rapporto, le disposizioni su tempo parziale, tempo determinato, somministrazione, lavoro intermittente e apprendistato.',
    useful: 'Per cercare le disposizioni relative alla forma del tuo contratto o alle mansioni assegnate. Questa scheda non determina la legittimità di un singolo contratto o cambio di mansioni.',
    topics: ['Lavoro subordinato', 'Mansioni', 'Tempo parziale', 'Tempo determinato', 'Somministrazione', 'Apprendistato'],
    source: normattiva('15G00095', '2015-06-24'), sourceLabel: 'Normattiva — D.Lgs. 81/2015',
  },
  {
    id: 'trasparenza', number: 'D.Lgs. 152/1997 e successive modifiche', title: 'Informazioni sul rapporto di lavoro',
    summary: 'Prevede informazioni che il datore deve comunicare al lavoratore sulle condizioni del rapporto, tra cui inquadramento, retribuzione, organizzazione dell’orario e contratto collettivo applicato. Il contenuto degli obblighi va verificato nel testo aggiornato.',
    useful: 'Per controllare quali informazioni cercare nei documenti ricevuti all’assunzione o in seguito a variazioni delle condizioni di lavoro, tenendo conto delle regole e delle esclusioni applicabili.',
    topics: ['Informazioni al lavoratore', 'Retribuzione', 'Orario', 'Inquadramento', 'Trasparenza'],
    source: normattiva('097G0188', '1997-06-12'), sourceLabel: 'Normattiva — D.Lgs. 152/1997 aggiornato',
  },
]

export const futureDriverTopics = ['Malattia', 'Infortunio', 'Ferie e permessi', 'Maternità e paternità', 'Controlli e privacy', 'Licenziamento e disciplina', 'Retribuzione e trasparenza', 'Diritti sindacali']
