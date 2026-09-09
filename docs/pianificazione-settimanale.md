# Pianificazione settimanale Area Aziende

Route: `/azienda/pianificazione/settimanale`. La voce **Giornaliera** riusa
`/azienda/assegnazioni`. Entrambe restano protette dal contesto aziendale esistente.

## Dati e decisioni operative

- Anagrafiche riusate: `checkvan_drivers` e `checkvan_vehicles`.
- `expected_weekly_days`: numero 0–7, inizialmente nullo; selezione rapida 3/4/5
  nell'anagrafica. Nessun contratto viene presunto per i driver esistenti.
- `checkvan_weekly_plans`: una settimana da lunedì per organizzazione, revisione,
  autore e data ultima modifica.
- `checkvan_planned_assignments`: una cella per driver/data, stato, mezzo, rotta,
  note. FK composte impediscono riferimenti ad altre aziende. Mezzo e rotta sono
  facoltativi; assenze e riposi non contengono mezzo o rotta.
- `checkvan_daily_requirements`: fabbisogno facoltativo, con distinzione tra
  assente e zero.
- `checkvan_assignment_overrides`: variazioni effettive complete, indipendenti
  dalla cella pianificata. La cancellazione del piano non elimina una variazione.
- `checkvan_planning_history`: storico con autore, istante, operazione e valori
  precedenti/successivi; l'API può leggerlo ma non modificarlo o cancellarlo.

Pianificate e copertura contano solo **TURNO**. Ferie, permessi, malattia e altro
sono assenze distinte, non turni. Il filtro “Da completare” cerca settimane con
almeno una cella vuota. Un profilo non impostato mostra `—`, senza scostamento.
Scostamenti positivi e negativi sono neutri/informativi; non bloccano il salvataggio.
Conflitti di mezzo, indisponibilità e turni senza mezzo hanno indicatori specifici.
Non essendoci fasce orarie, un mezzo condiviso nello stesso giorno è un conflitto.

La copia prende esclusivamente la settimana precedente e riempie solo celle e
fabbisogni mancanti. Non sostituisce valori esistenti, neppure uno zero o un
fabbisogno esplicitamente cancellato; non copia override o driver archiviati.
Le celle storiche dei driver archiviati restano consultabili e cancellabili.

La griglia è ordinata cognome → nome, con ricerca/filtri locali e 10 driver per
pagina. Un salvataggio sostituisce i soli dati interessati in memoria. Le letture
obsolete vengono annullate quando cambia settimana. Lo stesso lunedì selezionato
nuovamente non causa un caricamento senza fine.

## Giornata operativa: base automatica, non duplicazione

Il piano salvato è immediatamente la base della giornata: non c'è un comando
manuale di generazione né un processo mattutino. Il resolver combina, in ordine:

1. cella pianificata;
2. assegnazione giornaliera esistente (`checkvan_daily_assignments`), che varia il
   mezzo e conserva rotta/note del piano;
3. override esplicito completo, che può anche cancellare la rotta o indicare assenza.

La pagina Giornaliera usa questa stessa risoluzione. Cambiare lì il mezzo aggiorna
l'effettivo e conserva il piano; l'editor settimanale permette anche una variazione
di stato, rotta e note e il ripristino del piano. La funzione storica di copia
giornaliera mantiene il suo comportamento sulle assegnazioni giornaliere salvate.
I bridge giornalieri aggiungono audit e incremento della revisione settimanale.

Le mutazioni settimanali sono atomiche, serializzate per organizzazione e protette
da revisione attesa. Una revisione obsoleta restituisce HTTP 409, conserva il testo
nell'editor e richiede di ricaricare. Il resolver legge revisione e dati in un solo
snapshot SQL. Le API derivano organizzazione e autore dal token autenticato,
verificando ruolo e abilitazione esistenti; non accettano il company ID dal browser.
Le nuove tabelle hanno RLS e accesso riservato al backend, coerente con il catalogo
esistente. Le RPC sono revocate ad anon/authenticated; i trigger audit sono interni.

## Integrazioni future

Nessuna modifica a Driver Utility o all'Area Driver web. Le chiavi stabili
organizzazione/driver/data e gli indici per driver sono già disponibili.

Il futuro endpoint personale dovrà risolvere un token QR casuale opaco (almeno
256 bit), memorizzato come hash revocabile lato server, in una coppia
`organization_id + driver_id`. Il QR non dovrà contenere dati anagrafici o operativi.
Il token identifica il driver: non sostituisce l'autenticazione del dispositivo
né deve consentire di leggere l'intero elenco aziendale. La futura Area Driver
dovrà usare una mappatura autenticata utente/driver, senza accettare un driver ID
arbitrario dal client. Questi endpoint e il ciclo di emissione/revoca token restano
deliberatamente da implementare nella fase dedicata.

Il resolver personale userà la stessa precedenza piano/effettivo e limiterà la query
al driver autenticato. Il contratto `resolveRoute(current, lastKnown)` restituisce
la rotta attuale senza conferma; solo se manca propone l'ultima rotta con
`needs_confirmation: true`. Nessun dato effettivo deve essere riscritto nel piano.

## Migrazione e verifica

Migrazione: `supabase/migrations/20260908164756_weekly_driver_planning.sql`, da
applicare al database **CheckVan** che ospita le anagrafiche, dopo le migrazioni
driver/assegnazioni di agosto. Applicare prima della pubblicazione del codice:
anche il resolver giornaliero richiede il nuovo schema. Non è stata applicata al
database Production né è stato richiesto un deploy in questa attività.

Test locali riproducibili:

```powershell
node --test test/weeklyPlanning.test.js
$env:PLANNING_DB_CONTAINER='supabase_db_dto-solution'
node --test test/weeklyPlanningDatabase.test.js
npm.cmd run dev -- --host 127.0.0.1 --port 5178 --strictPort
# In un altro terminale:
node scripts/verify-weekly-planning.mjs
```

Il test database usa le tabelle locali reali, installa transazionalmente gli
eventuali prerequisiti mancanti e verifica le operazioni come `service_role` e i
divieti come `anon`. Termina con rollback, senza lasciare fixture o migrazioni.
Il test browser intercetta tutte le API aziendali e usa esclusivamente dati fittizi
per 100 driver. Produce screenshot in `artifacts/planning/` per il controllo visivo.

Il riferimento `docs/pianificazione.png` è stato consultato e non alterato:
header chiaro, sidebar scura, card giornaliere, filtri, griglia e palette stati.
Differenze intenzionali: marchio esistente del repository, nessuna identità reale,
scostamenti ambrati anziché errori rossi, card compatte su mobile.

## File dell'intervento

Modificati:

- `api/platform.js`
- `api/_lib/companyDrivers.js`
- `company/src/App.jsx`
- `company/src/routes.js`
- `company/src/components/AppShell.jsx`
- `company/src/lib/companySupabase.js`
- `company/src/pages/DriversPage.jsx`
- `company/src/pages/AssignmentsPage.jsx`
- `test/companyRouting.test.js`

Aggiunti:

- `api/_lib/companyPlanning.js`
- `company/src/lib/weeklyPlanning.js`
- `company/src/pages/WeeklyPlanningPage.jsx`
- `company/src/pages/weekly-planning.css`
- `supabase/migrations/20260908164756_weekly_driver_planning.sql`
- `supabase/tests/weekly_planning.sql`
- `test/weeklyPlanning.test.js`
- `test/weeklyPlanningDatabase.test.js`
- `scripts/verify-weekly-planning.mjs`
- `docs/pianificazione-settimanale.md`

Output di verifica, non codice dell'app: cinque screenshot in `artifacts/planning/`.
