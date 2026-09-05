# Driver Payroll Engine - Quality Report STEP 11

## Moduli verificati

- `driverPayrollTypes.ts`
- `driverPayrollStorage.ts`
- `driverPayrollCodes.ts`
- `driverPayrollAttendance.ts`
- `driverPayrollCompanyProfiles.ts`
- `driverPayrollRules.ts`
- `driverPayrollEngine.ts`
- `driverPayrollPdfText.ts`
- `driverPayrollPdfLayout.ts`
- `driverPayrollParsers/*`
- `driverPayrollImportService.ts`
- `driverPayrollAnalysis.ts`
- `driverPayrollComparison.ts`
- `driverPayrollCcnlRules.json`
- `driverPayrollRuleExplanationEngine.ts`
- `driverPayrollSimulator.ts`
- `driverPayrollAssistant.ts`
- `pages/DriverPayroll.tsx`

## Bug trovati

- I parser `generic` e `logisticsLayoutV1` usavano `month ?? 1` e `year ?? currentYear` quando il periodo non era riconosciuto.
- Il vecchio parser testuale aveva lo stesso fallback implicito su gennaio/anno corrente.
- Alcune label UI mostravano un periodo parziale invece di una dicitura esplicita per il periodo mancante.

## Bug corretti

- Rimosso il fallback silenzioso a gennaio/anno corrente nei parser Payroll.
- Gli ID tecnici delle buste senza periodo usano ora `period_unknown`.
- La UI mostra `Periodo non riconosciuto`.
- L'analisi ordina i periodi validi prima dei periodi mancanti e non usa mesi mancanti come gennaio.
- Aggiunti test per gennaio 2026, febbraio 2026, dicembre 2025, PDF senza periodo e import multiplo con mesi diversi.

## Punti ancora da verificare

- Verifica visuale manuale su device Android reale.
- Verifica con PDF reali di provider diversi.
- Verifica con storico reale di almeno 24 buste.

## Limitazioni fiscali

- Il motore non calcola formule fiscali complete.
- Malattia, infortunio, trattenute variabili, addizionali e conguagli restano da verificare.
- Il Riepilogo del mese espone solo presenze e componenti note; non calcola un netto o lordo futuro completo.

## Limitazioni parser

- OCR locale non implementato.
- Layout non riconosciuti ricadono su parser generico con warning.
- Il periodo deve comparire in forma mese + anno per essere confermato.

## Limitazioni dati Turni Driver

- Il simulatore legge la chiave locale `attendance`.
- Sono supportati solo gli stati gia presenti in Turni Driver.
- Ore straordinarie e importi orari richiedono input manuale quando non gia disponibili.

## Conferma privacy

- Il flusso Payroll non usa Supabase, Cloud, fetch esterni, OpenAI, Gemini o Firebase AI.
- Il PDF originale non viene salvato nello storico Payroll.
- `rawTextTemporary` e `rawLine` vengono rimossi prima del salvataggio.
- I test usano dati fittizi.

## Checklist release

- Import PDF locale: pronto con warning per dati mancanti.
- Storico locale: pronto.
- Analisi storico: pronta per dati locali.
- Confronto previsto/reale: pronto per dati disponibili.
- Rule Explanation Engine: pronto come base estendibile.
- Simulatore: pronto come stima locale.
- Assistente locale: pronto come assistente informativo, non consulenziale.
- Release finale: pronta per test reale su telefono, con attenzione ai PDF reali e ai casi fiscali complessi.
