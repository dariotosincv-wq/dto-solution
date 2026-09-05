# Area Driver — prima integrazione web

Data: 5 settembre 2026. Modifiche esclusivamente in `dto-solution-INTEGRAZIONE`.

**Driver Utility modificato: NO.** Nessuna operazione Git, installazione, build o esecuzione di test nel progetto originale. Nessun commit, push o deploy del sito.

## A. File del sito modificati e aggiunti

- `src/components/layout/Header.jsx`, `src/styles/components.css`: gruppo Area Driver / Area Aziende / Area Enti, CTA equivalenti, stato attivo nelle sottopagine. Il breakpoint del menu passa da 52rem a 68rem per contenere i tre pulsanti senza sovrapposizioni. Gli altri link informativi conservano ordine e destinazioni.
- `src/App.jsx`, `src/components/layout/PageLayout.jsx`: rotte e titoli `/area-driver/turni`, `/area-driver/busta-paga`, `/area-driver/contratto`.
- `src/pages/DriverAreaPage.jsx`: accessi agli strumenti locali, separati dalle funzioni ancora future.
- `src/features/driver/DriverToolsPage.tsx`: contenitore DTO e caricamento differito delle pagine originali.
- `src/features/driver/DriverContractSettings.tsx`: sola sezione contrattuale estratta dalle impostazioni originali, con identiche normalizzazione e operazioni di aggiornamento.
- `src/features/driver/adapters/preferences.ts`: Preferences asincrone su localStorage, con le stesse chiavi e JSON.
- `src/features/driver/adapters/native.ts`: seleziona i rami browser già presenti; eventuali chiamate native accidentali falliscono esplicitamente.
- `src/features/driver/adapters/router.ts`: traduce i percorsi dell'app in percorsi Area Driver e conserva il ritorno browser.
- `src/features/driver/adapters/dialog.tsx`: mantiene i portali Radix nel contenitore degli stili Driver.
- `src/features/driver/driver-tools.css`, `driver-tools.input.css`, `driver-tools.generated.css`: stili DTO e utility Tailwind limitate a `.driver-tools`, senza importare il CSS globale Android o font remoti.
- `scripts/driver-utility-vite.mjs`, `vite.config.js`: risoluzione degli adapter limitata agli import del codice portato. PDF.js 6.1.200 e relativo worker sono risolti tramite alias npm `driver-payroll-pdfjs`, senza cambiare PDF.js di NACScan.
- `scripts/port-driver-utility.mjs`, `scripts/verify-driver-provenance.mjs`: porting e verifica SHA-256. Solo il primo è un comando di copia; non è eseguito durante build o test.
- `vitest.driver.config.mjs`, `scripts/test-driver.mjs`: esecuzione dei test originali con cwd nella copia interna al sito; i test che leggono i propri sorgenti mantengono i percorsi originali.
- `scripts/driver-tailwind.config.cjs`: generazione degli stili isolati.
- `scripts/verify-driver-browser.mjs`, `scripts/verify-driver-pdf.mjs`, `test/driver-browser/fixture.html`, `fixture.ts`: verifiche browser e PDF aggiuntive.
- `test/driverProvenance.test.js`: verifica automatica dell'integrità di tutti i file portati.
- `test/companyRouting.test.js`, `test/entitiesRouting.test.js`, `test/driverDocuments.test.js`: aggiornati soltanto i contratti della navbar del sito, che prima richiedevano il vecchio markup. Non sono test provenienti dall'app.
- `package.json`, `package-lock.json`, `.gitignore`: dipendenze, comandi e esclusione degli artefatti/cache locali.

## B–C. Codice portato, hash e provenienza

La copia si trova in `vendor/driver-utility/`. Il file `provenance.json` elenca **152 file**, con percorso sorgente originale, destinazione e SHA-256; registra data UTC del porting, ordine delle fasi e versioni delle dipendenze.

I **56 file di test e le 4 fixture originali sono stati copiati prima dei moduli funzionali**. Nessun risultato atteso è stato cambiato. I file elencati nel manifest sono byte per byte identici all'originale; gli adapter sono tutti esterni alla copia.

Gruppi portati:

- Pagine `Attendance`, `DriverPayroll`, `DriverWorkPage`, `PageHeader` e componenti UI necessari.
- Hook `useLocalStorage`, profilo contrattuale, festività, generatore PDF ed esportazione.
- `driverPayroll*`: tipi, importazione, estrazione PDF, geometria, parser, normalizzazione, cataloghi, storage, simulazione, motore, confronto, storico, analisi, diagnostica e assistente.
- Intere cartelle `driverPayrollParsers/` e `payrollValidationEngine/`, incluse fixture, controlli e rule engine.
- `monthlyAttendanceSummary`, `payrollAttendanceVerification` e relativi report UI.
- Copie di riferimento di configurazioni, package/lockfile, CSS originale e Settings. Le copie sotto `reference/` non vengono montate nell'applicazione.

Hash di alcuni punti di ingresso:

| Sorgente | SHA-256 |
|---|---|
| `src/pages/Attendance.tsx` | `cebd504389c3dfba77ab2a1f75d117afed58a88ca8678aed178513258caeb6b3` |
| `src/lib/driverPayrollPdfText.ts` | `6d29f260805a09cf9eeb006cb8e170444ca793813b4313cd280b44fbe0eab033` |
| `src/lib/driverPayrollParsers/payslipParserRegistry.ts` | `a7d0baa50f5fde2cdc15888234d3ddad233c20e2e2dec55847eaa14b177cc994` |
| `src/lib/driverPayrollParsers/logisticsLayoutV1Parser.ts` | `a99a4e3b99d1ae3004e1ca4d0e207869d8926fbff10dd6ab2b4327cb648ba6b3` |

Il marcatore `logistics-v1-fix-2026-07-26-02` è invariato. La pipeline resta:

`extractStructuredTextFromPayslipPdf → parsePayslip → detectPayslipFormat → parseLogisticsLayoutV1Payslip / parseGenericPayslip`.

## D–E. Verifiche

- Test originali: **688 passati, 0 falliti**, in 56 file.
- Test del sito, incluso il nuovo controllo hash: **277 passati, 0 falliti, 2 saltati** su 279 casi. I due casi saltati sono test di integrazione preesistenti.
- Browser: **10 gruppi di verifiche passati**, senza errori JavaScript. Navbar a 1440, 1100, 1024, 390 e 320 px; ordine e URL delle CTA, stessa altezza/padding/tipografia, stato attivo nella sottopagina e assenza di overflow. Verificati anche salvataggio/ricaricamento presenze, note, date, reset di un solo mese, download PDF, profilo contrattuale, schede Payroll e importazione PDF dalla UI con conferma e storico fiscal-v1.
- PDF.js reale nel browser: **4 PDF sintetici ricavati dalle fixture anonimizzate originali**, compreso novembre su due pagine. Il confronto fra fixture strutturata e PDF estratto coincide per parser, righe e semantica, riepiloghi, confidenza, warning, guardia economica, dati fiscali e validazioni economiche/fiscali.
- Nel confronto PDF sono esclusi ID e timestamp variabili, testo temporaneo e i campi di geometria/provenienza esplicitamente rimossi dalla funzione `clean` dell'harness. Non si dichiara un'identità binaria dei PDF o delle loro coordinate estratte: il parser continua a ricevere la geometria reale, senza modificarne tolleranze o algoritmi.
- Verificati sul reader reale anche file vuoto, tipo errato, PDF senza testo e PDF invalido; conservati i codici di errore originali.
- Importazioni dell'harness: profilo `PRODUCTION`, dati persistiti privi di testo grezzo e diagnostica temporanea; nessuna richiesta esterna durante la lettura dei PDF.
- Lint e build locale del sito verificati. Restano gli avvisi di dimensione dei chunk; non è stato eseguito un deploy.

I PDF di riferimento personali originali non erano disponibili. I documenti generati sono soltanto fixture sintetiche, salvate sotto `artifacts/driver/`, e non sostituiscono una verifica su un corpus reale o sull'APK Android.

I primi tentativi hanno rilevato un problema nell'ambiente jest-dom e una fusione delle celle nel generatore PDF di test. È stata allineata la dipendenza di test al lockfile originale e corretto il generatore sintetico per preservare le celle. Nessun algoritmo o aspettativa originale è stato cambiato. I risultati finali sono nei report, non in quei tentativi preliminari.

## F. Equivalenza dimostrata

È dimostrata l'identità del codice portato e il superamento dei casi originali: stati e note, chiavi `attendance`, date locali, conteggi, festività, profilo contrattuale, riepiloghi, parser attivo, cataloghi, regole, unità, fiscal-v1, storico, confronto, simulatore e assistente locale.

Sono conservati anche i comportamenti apparentemente insoliti: mesi 0-based/1-based nei rispettivi moduli, 8 ore teoriche nel chiamante del simulatore, trattamento di “Lavorato < 4 ore”, assenza OCR, warning, confidenza e controlli sperimentali non abilitati in produzione.

L'equivalenza è circoscritta ai casi verificati; non è una certificazione universale di tutti i cedolini o dell'APK installato.

## G–H. Differenze e lavoro residuo

- Persistenza nel browser invece di Preferences Android. Gli archivi sono locali all'origine e al profilo browser, senza trasferimento automatico dei dati dell'app.
- Download browser invece di condivisione nativa; il PDF originale Payroll continua a non essere archiviato.
- React 19.2.8 e Router 7.18.2 del sito, contro React 18.3.1 e Router 6.30.1 dell'app. I 688 test originali passano nel runtime del sito. Le altre dipendenze principali del porting sono allineate e registrate nel manifest.
- UI originale ospitata nel contenitore DTO, con stili isolati e routing web. È una prima integrazione, non il completamento del design finale.
- Per ampliare la prova di parità servono cedolini reali autorizzati e l'identificazione della versione dell'APK da confrontare. Da verificare ulteriormente Safari/Firefox, quote/esaurimento storage e uso prolungato su più schede.
- Non sono stati introdotti cloud, account, database o Supabase per Turni/Payroll. Il provider di autenticazione globale già esistente del sito non è stato modificato.
- Non sono stati aggiunti OCR, sincronizzazione Android/browser, migrazioni di archivi personali o disponibilità offline completa del sito.

## Riproduzione nel solo progetto DTO

```text
npm ci
npm run verify:driver
npm run test:driver
npm test
npm run lint
npm run build
```

Per rigenerare gli stili dopo un futuro adattamento UI: `npm run driver:styles`.

Per i controlli browser: avviare il dev server a `127.0.0.1:5173`, quindi `npm run test:driver:browser` (Chrome installato). Vengono usati contesti browser di test separati dai dati personali. I report JSON, gli screenshot e i PDF sintetici sono in `artifacts/driver/`, esclusa da Git. Gli harness sotto `test/driver-browser` non sono inclusi nella build pubblica.

`node scripts/verify-driver-provenance.mjs --reference` aggiunge il confronto in sola lettura con i sorgenti originali. La normale build e i normali test non dipendono dalla presenza della cartella Driver Utility.

**I. Driver Utility modificato: NO.**
