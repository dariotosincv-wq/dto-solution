# DTO Solution

Prima fase strutturale del sito ufficiale DTO Solution, realizzata con React, Vite e CSS puro.

## Comandi disponibili

```bash
npm install
npm run dev
npm run lint
npm run build
npm run preview
```

## Struttura

- `src/components`: componenti React riutilizzabili
- `src/data`: dati centralizzati delle applicazioni
- `src/pages`: pagine collegate al routing
- `src/styles`: reset, variabili e stili globali, dei componenti e delle pagine

Le applicazioni hanno pagine prodotto e Privacy Policy dedicate. `/privacy` è l’indice delle informative, mentre i software separati dalle applicazioni DTO Solution utilizzano il percorso `/software`.

## Contenuti da completare

Il progetto usa placeholder espliciti finché non saranno disponibili logo, favicon, screenshot, testi, recapiti, stati dei progetti e link Google Play ufficiali.

Per pubblicare la SPA, il server deve reindirizzare le richieste delle rotte applicative a `index.html`.
