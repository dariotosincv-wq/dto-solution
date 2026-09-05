# Area Driver: accordo, normativa e backup locale

Data: 5 settembre 2026. Modifiche esclusivamente nel sito DTO Solution. Nessuna modifica al motore originale, ai documenti contrattuali trascritti o a Driver Utility. Nessun commit, push o deploy in questa fase.

## Accordo pubblicato

Denominazione: **Accordo Assoespressi – Ultimo miglio Amazon**.

Il documento effettivamente presente in `src/data/verifiedAgreement.js` è del **26 maggio 2025**; nella premessa richiama l'accordo del 23 novembre 2021 ratificato il 16 febbraio 2022. Il titolo della pagina, la scheda e i metadati indicano l'ambito specifico del personale interessato delle aziende aderenti ad Assoespressi operanti per Amazon Italia Transport S.r.l. Non è presentato come CCNL generale. Il contenuto contrattuale e l'URL esistente rimangono invariati.

## Normativa

Pagina pubblica: `/area-driver/normativa`. Sei schede con sintesi, utilizzo pratico, argomenti, fonte ufficiale e avvertenza; distinta dai due documenti contrattuali.

| Norma | Argomento | Fonte |
| --- | --- | --- |
| D.Lgs. 66/2003 | Orario, riposi, pause, ferie, lavoro notturno | [Normattiva](https://www.normattiva.it/atto/caricaDettaglioAtto?atto.codiceRedazionale=003G0091&atto.dataPubblicazioneGazzetta=2003-04-14) |
| D.Lgs. 234/2007 | Lavoratori mobili dell'autotrasporto; applicabilità da verificare | [Ministero del Lavoro, PDF](https://www.lavoro.gov.it/documenti-e-norme/normative/Documents/2007/20071119_Dlgs_234.pdf) |
| D.Lgs. 81/2008 | Salute e sicurezza | [Normattiva](https://www.normattiva.it/atto/caricaDettaglioAtto?atto.codiceRedazionale=008G0104&atto.dataPubblicazioneGazzetta=2008-04-30) |
| Legge 300/1970 | Statuto dei lavoratori | [Normattiva](https://www.normattiva.it/atto/caricaDettaglioAtto?atto.codiceRedazionale=070U0300&atto.dataPubblicazioneGazzetta=1970-05-27) |
| D.Lgs. 81/2015 | Contratti subordinati e mansioni | [Normattiva](https://www.normattiva.it/atto/caricaDettaglioAtto?atto.codiceRedazionale=15G00095&atto.dataPubblicazioneGazzetta=2015-06-24) |
| D.Lgs. 152/1997 e successive modifiche | Informazioni sul rapporto | [Normattiva](https://www.normattiva.it/atto/caricaDettaglioAtto?atto.codiceRedazionale=097G0188&atto.dataPubblicazioneGazzetta=1997-06-12) |

Verificato anche l'[indice ufficiale del Ministero](https://www.lavoro.gov.it/temi-e-priorita/rapporti-di-lavoro-e-relazioni-industriali/focus-on/norme-contratti-collettivi/pagine/default). Il PDF ministeriale del D.Lgs. 234/2007 è un documento di pubblicazione: la scheda invita a verificare modifiche e rinvii europei vigenti. Nessuna soglia o interpretazione individuale viene calcolata dal sito. Le otto future sezioni richieste sono visibili come approfondimenti in preparazione, senza collegamenti vuoti.

## Backup versione 1

Pagina: `/area-driver/backup`, accessibile dall'Area Driver e dalla navigazione degli strumenti. Download locale con nome `DriverUtility-AreaDriver-Backup-YYYY-MM-DD.json`.

```json
{
  "format": "DriverUtility-AreaDriver-Backup",
  "version": 1,
  "createdAt": "2026-09-05T12:00:00.000Z",
  "data": {
    "attendance": {},
    "driverContractProfile": null,
    "driverPayroll.profiles": null,
    "driverPayroll.contractSources": null,
    "driverPayroll.rules": null,
    "driverPayroll.codes": null,
    "driverPayroll.payslips": null,
    "driverPayroll.predictions": null,
    "driverPayroll.comparisons": null,
    "driverPayroll.learningProfile": null
  }
}
```

`null` indica una chiave assente, distinta da una raccolta vuota `[]` o da `attendance: {}`. Il ripristino sostituisce queste dieci chiavi; non effettua merge e non usa `localStorage.clear()`.

### Inclusioni e parità

- `attendance`: tutte le date, stati e note, compresi giorni con sola nota; nessuna normalizzazione.
- `driverContractProfile`: tipo, ore settimanali e giorni contrattuali originali.
- Otto raccolte del `DriverPayrollDataStore`: profili, fonti, regole, codici, cedolini con righe/importi/unità/avvisi/confidenza/fiscal-v1, simulazioni salvate, confronti salvati e apprendimento.
- Nessuna modifica di importi, precisione, mesi o algoritmi.
- Lo schema strutturale viene generato dai tipi TS già portati nel vendor DTO. Lo script include anche `DriverPayrollEstimateSummary`, perché il simulatore reale salva quel sottotipo in `prediction.predictedSummary`, conservandone i contatori aggiuntivi. Le impronte dei tre file di tipi e la versione TypeScript sono registrate nello schema.

### Esclusioni

- PDF, Blob, ArrayBuffer, base64 e riferimenti temporanei a file.
- `rawTextTemporary`, `rawText`, `rawLine`, `sourceGeometry` e diagnostica temporanea: politica coerente con `BLOCKED_RESULT_KEYS` dell'import service originale.
- Cache/diagnostica e chiavi di reset non usate come raccolte persistenti (`driverPayroll.parserCache`, `temporary`, `tempImports`, ecc.).
- Dati di altre aree, credenziali, account e impostazioni generali estranee.
- Bozze in memoria: importazioni non confermate, simulazioni non salvate e stato temporaneo dell'assistente. I confronti a video sono derivati dai dati ripristinati; la raccolta dei confronti è inclusa quando presente. Non viene introdotta una nuova persistenza per gli stati che l'app non salva.

Lo storico prodotto dall'importazione originale è già depurato dai campi temporanei; il round trip è identico sui quattro cedolini anonimizzati. Eventuali archivi legacy che contengano ancora i campi esclusi li perdono nel backup per scelta esplicita di privacy. I dati locali sorgenti non vengono modificati dall'esportazione.

### Validazione e scrittura

1. Limite 20 MB; controllo formato, versione, timestamp ISO, elenco esatto delle chiavi, calendario delle date e schema completo dei campi annidati.
2. Rifiuto di JSON corrotto, tipi errati, proprietà non previste, chiavi pericolose e annidamento oltre 40 livelli. Non si ricalcolano i dati per renderli validi.
3. Anteprima con conteggi, presenza del profilo e data; nessuna scrittura. Pulsante disabilitato finché non viene selezionata la conferma esplicita della sostituzione, inclusi gli archivi vuoti. Annullamento senza effetti.
4. Nuova validazione alla conferma. Serializzazione di tutti i valori e lettura dello stato precedente prima di scrivere.
5. Scritture sincrone sulle sole chiavi autorizzate. In caso di errore, ripristino dei valori precedenti, anche delle chiavi originariamente assenti. Un errore anche nel rollback viene segnalato distintamente.

Limiti: localStorage non offre transazioni fra chiavi. Il rollback copre errori di scrittura intercettabili, non un arresto del browser o scritture contemporanee da un'altra scheda. La pagina chiede di chiudere gli altri strumenti. Il file non è cifrato, resta sul dispositivo e va custodito dall'utente. Nessun account, cloud, database, API o invio del contenuto a server è stato aggiunto. Gli archivi sono separati per origine/browser.

## Verifiche

- `npm.cmd test`: 296 passati, 0 falliti, 2 skip preesistenti. Include 17 test backup e 2 test normativa/accordo.
- `npm.cmd run test:driver`: 56 file, 688 test originali passati. Il primo avvio in sandbox era bloccato da esbuild; l'esecuzione fuori sandbox nel solo vendor DTO è riuscita.
- `npm.cmd run lint`: passato.
- `npm.cmd run build`: build pubblica e Super Admin passate; avviso già noto sui bundle oltre 500 kB.
- `node scripts/generate-driver-backup-schema.mjs --check`: schema e hash coerenti con i tipi originali.
- `node scripts/verify-driver-provenance.mjs --reference`: 152 file identici, confronto esclusivamente in lettura con Driver Utility.
- `node scripts/verify-driver-pdf.mjs`: quattro fixture/PDF sintetici equivalenti, quattro errori di input verificati. Gli avvisi originali sono preservati.
- `node scripts/verify-driver-browser.mjs`: 11 gruppi passati.
- `node scripts/verify-driver-backup-browser.mjs`: 12 gruppi passati, pagine a 1440/390/320 px, download e ripristino, quattro storici fiscal-v1 prodotti dalla pipeline originale, simulazione salvata dalla UI, conferma/annullamento, errori e reset indipendenti. Nessuna richiesta esterna o errore JavaScript nel contesto di prova.

Per ripetere i browser test avviare Vite su `127.0.0.1:5173`, quindi eseguire prima `verify-driver-pdf.mjs` e poi gli script browser. Usano Chrome headless in un contesto isolato, senza dati personali reali. Report e screenshot sono in `artifacts/driver/` (ignorati da Git).

## Inventario della fase

Modificati: `api/platform.js` (sole due rotte pubbliche della sitemap), `src/App.jsx`, `src/components/layout/PageLayout.jsx`, `src/features/driver/DriverToolsPage.tsx`, `src/pages/AccordoAssoespressiPage.jsx`, `src/pages/DriverAreaPage.jsx`, `src/styles/pages.css`, `test/driverArea.test.js`, `test/driverDocuments.test.js`.

Aggiunti: `src/pages/DriverBackupPage.jsx`, `src/pages/DriverLegislationPage.jsx`, `src/data/driverLegislation.js`, `src/features/driver/backup/backupPolicy.js`, `src/features/driver/backup/driverBackup.js`, `src/features/driver/backup/schema.generated.js`, `scripts/generate-driver-backup-schema.mjs`, `scripts/verify-driver-backup-browser.mjs`, `test/driverBackup.test.js`, `test/driverLegislation.test.js`, questo documento.

Driver Utility modificato: NO
