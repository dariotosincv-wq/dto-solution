import { agreementIndex, agreementPages as ocrPages } from './driverDocuments.js'

const replacements = [
  [/\b00\.SS\.?/g, 'OO.SS.'], [/\b00\.55\.?/g, 'OO.SS.'], [/\b00\.5S?\.?/g, 'OO.SS.'],
  [/s\.r\.\]\./g, 's.r.l.'], [/verràà/g, 'verrà'], [/indennitàà/g, 'indennità'], [/\b5 0 6\b/g, '5 o 6'],
  [/evefiti/g, 'eventi'], [/lavbro/g, 'lavoro'], [/un nese/g, 'un mese'], [/tutti j mezzi/g, 'tutti i mezzi'],
  [/\bCc\. Eventuali/g, 'c. Eventuali'], [/\b23; Programmazione.*$/g, '23. Programmazione'],
  [/\b25, Carichi/g, '25. Carichi'], [/\b21: Apprendistato/g, '21. Apprendistato'],
  [/^jp Sicurezza/g, '20. Sicurezza'], [/^È Premio di Risultato/g, '17. Premio di Risultato'],
  [/^2\. Orario di lavoro.*$/g, '4. Orario di lavoro'], [/^27: Validità/g, '27. Validità'],
  [/^6 maggio 2025$/g, '26 maggio 2025'], [/^etto, confermato/g, 'Letto, confermato'],
  [/\. # \/$/g, '.'], [/ \|$/g, ''], [/ \\$/g, ''], [/ }$/g, ''], [/ \{$/g, ''],
  [/ \/$/g, ''], [/ \($/g, ''], [/ <$/g, ''], [/^1\. Premesse AI$/g, '1. Premesse'],
  [/\bCo # 16 Sl$/g, ''], [/\bZ$/g, ''], [/\bX\\$/g, ''],
]

function clean(line) {
  let value = line
  for (const [pattern, replacement] of replacements) value = value.replace(pattern, replacement)
  return value.trim()
}

function verifiedPage(page) {
  let lines = page.lines.map(clean).filter((line) => !/^(?:ANN? ?[ÙUV]|Ml Ck|de L LI dl I RP a|N \) dl Ì gi 777|t \)D Di di Ì|R 4 a Pn|MA © N V|i gp i Iedl|L \| j D I A NL|LA \| plat|LZ EE|7 \+ A JU|[A-ZÀ-ÿ]{0,3}[ |/\\_—#©]{3,}|[nm]{1,2} pz E al)/i.test(line))

  if (page.page === 1) {
    lines = lines.map((line) => line
      .replace("Assoespressi )'", 'Assoespressi')
      .replace(/^data 26/, 'In data 26')
      .replace(/^suito denominati/, 'seguito denominati')
      .replace(/ultimo miglio pe!$/, 'ultimo miglio per')
      .replace(/^AIl Premesso che$/, 'Premesso che')
      .replace(/^f\. 1 processi/, 'f. I processi')
      .replace(/che he:$/, 'che ha')
      .replace(/nuov:$/, 'nuova')
      .replace(/abitudini d$/, 'abitudini di')
      .replace(/condizioni d$/, 'condizioni di')
      .replace(/siano$/, 'siano')
      .replace(/va calibrat$/, 'va calibrato')
      .replace(/spess$/, 'spesso')
      .replace(/sistema di relazion$/, 'sistema di relazioni')
      .replace(/legate all\.$/, 'legate alla')
      .replace(/aziendali co$/, 'aziendali con'))
    lines = lines.map((line) => line.replace(/hanno consolidatc$/, 'hanno consolidato').replace(/dell’Accordc$/, 'dell’Accordo').replace(/lavoro sian$/, 'lavoro siano'))
  }

  if (page.page === 2) {
    lines = lines.map((line) => line
      .replace(/^j\. MI presente/, 'j. Il presente')
      .replace(/Trasporto ul$/, 'Trasporto merci e')
      .replace(/interamer$/, 'interamente')
      .replace(/^7 k_ /, 'k. ')
      .replace(/l'organizzazione «$/, "l'organizzazione del")
      .replace(/salvaguare$/, 'salvaguardia')
      .replace(/^0 della/, 'della')
      .replace(/^1\. È pertanto/, 'l. È pertanto')
      .replace(/trattame$/, 'trattamenti')
      .replace(/che opera$/, 'che operano')
      .replace(/oggetto del’presente/, 'oggetto del presente')
      .replace(/è inquadre$/, 'è inquadrato')
      .replace(/troveranno integr\.$/, 'troveranno integrale')
      .replace(/Trasporto merc$/, 'Trasporto merci e')
      .replace(/del preser$/, 'del presente')
      .replace(/sistema di relazic$/, 'sistema di relazioni')
      .replace(/si manifesteranr$/, 'si manifesteranno,')
      .replace(/^Ì D, soprattutto/, 'soprattutto')
      .replace(/^I a Pr della/, 'della')
      .replace(/\(\{$/, '(ad')
      .replace(/relazioni sindac:$/, 'relazioni sindacali,')
      .replace(/delle eventu$/, 'delle eventuali')
      .replace(/la richiesta$/, 'la richiesta di')
      .replace(/delle trattati$/, 'delle trattative,')
      .replace(/^T:$/, 'Tale')
      .replace(/positiva conclusio$/, 'positiva conclusione')
      .replace(/qualsiasi azio$/, 'qualsiasi azione')
      .replace(/le Parti saran$/, 'le Parti saranno'))
    lines = lines.map((line) => line.replace(/quello di Amazor$/, 'quello di Amazon e').replace(/^T: periodo/, 'Tale periodo'))
  }

  if (page.page === 3) lines = lines.map((line) => line.replace(/^7 Ferma/, 'Ferma').replace(/^d tempi/, 'tempi').replace(/^Po 24/, '24').replace(/^o aziendale/, 'aziendale').replace(/^Y dell'orario/, "dell'orario").replace(/^O sarà/, 'sarà').replace(/^i \[\) ordinario/, 'ordinario').replace(/^Ù \| \| minuti/, 'minuti').replace(/^massimo di 8 ore e 42 minuti/, 'minuti, in aggiunta a 30 minuti di pausa pranzo non retribuita, per un complessivo impegno massimo di 8 ore e 42 minuti').replace(/^N° L'inizio/, "L'inizio").replace(/^te 1 dl —$/, '').replace(/^gi a\./, 'a.').replace(/^I proprie/, 'proprie').replace(/^pa data/, 'data').replace(/^i verticale/, 'verticale'))
  if (page.page === 4) lines = lines.map((line) => line.replace(/^2 A decorrere/, 'a. A decorrere').replace(/^E proprie/, 'proprie').replace(/^i settanta/, 'settanta').replace(/lavorato euro otto,00\)/, 'lavorato (euro otto,00)').replace(/^N lavorato/, 'lavorato').replace(/^Ù €/, '€').replace(/^3 A decorrere/, 'A decorrere').replace(/^Ki I lavorato/, 'lavorato').replace(/^pai 8,00/, '8,00').replace(/^de b\./, 'b.').replace(/^o orizzontale/, 'orizzontale').replace(/^ww 7\./, '7.').replace(/^I Le Parti/, 'Le Parti').replace(/^Ne implementata/, 'implementata').replace(/^ù azienda/, 'azienda').replace(/^Pi di lavoro/, 'di lavoro').replace(/^i nel computo/, 'nel computo'))
  if (page.page === 5) lines = lines.map((line) => line.replace(/\{e d$/, '(c.d.').replace(/^Q la mattina/, 'la mattina').replace(/^È allo stesso/, 'allo stesso').replace(/^y is 10\./, '10.').replace(/^po Le modalità/, 'Le modalità').replace(/^I Amazon/, 'Amazon').replace(/^ì nelle/, 'nelle').replace(/^Roo a\./, 'a.').replace(/^yy dei/, 'dei').replace(/^N particolare/, 'particolare').replace(/^c\. Qualora richiesto dalle OO\.SS\. e loro RSA o RSU verranno effettuati incontri di verifica \($/, 'c. Qualora richiesto dalle OO.SS. e loro RSA o RSU verranno effettuati incontri di verifica'))
  if (page.page === 6) lines = lines.map((line) => line.replace(/^Mi SK$/, '').replace(/^È stanno/, 'stanno').replace(/^cinque\)/, '(cinque)').replace(/^i di vita/, 'di vita').replace(/^Pi riguardanti/, 'riguardanti').replace(/^NI a\./, 'a.').replace(/^Ye prevista/, 'prevista').replace(/^ra indeterminato/, 'indeterminato').replace(/^N Ne filiera/, 'filiera').replace(/^i W b\./, 'b.').replace(/^NO tempo/, 'tempo').replace(/^agi” dal/, 'dal').replace(/^3 preferenza/, 'preferenza').replace(/^13, Flessibilità/, '13. Flessibilità').replace(/^b dell’75%/, 'dell’75%').replace(/^j " il 55%/, 'il 55%').replace(/^AA unità/, 'unità'))
  if (page.page === 7) lines = ['14. Assunzioni', ...lines.map((line) => line.replace(/^4 le medesime/, 'le medesime').replace(/^0 distribuzione/, 'distribuzione').replace(/^4 esercitato/, 'esercitato').replace(/altra azienda pr$/, 'altra azienda,').replace(/^N organizzative/, 'organizzative').replace(/^Ò dell'occupazione/, "dell'occupazione").replace(/istituirà Pe$/, 'istituirà una').replace(/^e otranno/, 'potranno').replace(/^RE scritta/, 'scritta').replace(/^N b\./, 'b.').replace(/^j indeterminato/, 'indeterminato').replace(/^Cc\. Eventuali/, 'c. Eventuali'))]
  if (page.page === 8) lines = lines.map((line) => line.replace(/2025, \/ \$$/, '2025,').replace(/servizio Tale/, 'servizio. Tale').replace(/^parametri collettivi/, '• parametri collettivi').replace(/^nonché da correttori/, '• nonché da correttori').replace(/\(a titoli$/, '(a titolo').replace(/provvedimenti declina\)$/, 'provvedimenti disciplinari').replace(/^destinatari/, 'I destinatari').replace(/^N tempo/, 'a tempo').replace(/2025, de IL a 14 _$/, '2025,').replace(/2026 e CC$/, '2026 e').replace(/^e = €/, '• €').replace(/^So Tale/, 'Tale').replace(/^po driver/, 'driver').replace(/^Xc\] prodotto/, 'prodotto').replace(/^i SP Tale/, 'Tale').replace(/^Rw driver/, 'driver').replace(/^Ri prodotto/, 'prodotto').replace(/^é Con riferimento/, 'Con riferimento').replace(/^À 18\./, '18.').replace(/^Vf In piena/, 'In piena').replace(/^2024\.$/, '2024.'))
  if (page.page === 9) lines = lines.map((line) => line.replace(/^19\. Multe.*$/, '19. Multe').replace(/cinque\) d$/, 'cinque)').replace(/cinque\) z$/, 'cinque)').replace(/ivi compres$/, 'ivi compreso').replace(/^1\. Le aziende confermano, in materia di tutela della salute e sicurezza sul a$/, '1. Le aziende confermano, in materia di tutela della salute e sicurezza sul lavoro,').replace(/^N In tal senso/, 'In tal senso').replace(/^è a garantire/, 'a garantire').replace(/^in materia/, 'In materia').replace(/^N \*/, '•').replace(/^j fisica/, 'fisica').replace(/^a distribuire/, '• a distribuire').replace(/^N sicurezza/, 'sicurezza').replace(/^ad erogare/, '• ad erogare').replace(/^0 salute/, 'salute').replace(/^Aeronautica/, '(Aeronautica').replace(/riduzione d, A$/, 'riduzione dei').replace(/^A coinvolto/, 'coinvolto').replace(/^finanziamento bilaterale o istituzionale\. \| corsi/, 'finanziamento bilaterale o istituzionale. I corsi'))
  if (page.page === 10) lines = lines.map((line) => line.replace(/condizioni d$/, 'condizioni di').replace(/^4a offerto/, 'offerto').replace(/\. Pi$/, '.').replace(/^Pi$/, '').replace(/stabilizzazioni di\/$/, 'stabilizzazioni di').replace(/^N c\./, 'c.').replace(/^DX} suddetti/, 'suddetti').replace(/^SS maggiormente/, 'maggiormente').replace(/^È A questo/, 'A questo').replace(/^do intesa/, 'intesa').replace(/^di RI ricorso/, 'ricorso').replace(/^Ni essere/, 'essere').replace(/^s tipologia/, 'tipologia').replace(/^Ea distribuzione/, 'distribuzione').replace(/^NN aziendale/, 'aziendale').replace(/^PI dell'attività/, "dell'attività").replace(/^7 \* 50%/, '• 50%').replace(/^65%/, '• 65%').replace(/^XS personale/, 'personale'))
  if (page.page === 11) lines = lines.map((line) => line.replace(/^23\. Programmazione.*$/, '23. Programmazione').replace(/organizzazione del lavoro$/, 'organizzazione del lavoro').replace(/^presenza di richiesta da parte delle OO\.SS\./, 'In presenza di richiesta da parte delle OO.SS.').replace(/^24\. Strumenti di lavoro.*$/, '24. Strumenti di lavoro').replace(/^i cronotachigrafo/, 'cronotachigrafo').replace(/^o prestazione/, 'prestazione').replace(/^c\. Inoltre, tutti i mezzi/, 'c. Inoltre, tutti i mezzi').replace(/^Pa telemetria/, 'telemetria').replace(/^NO veicoli/, 'veicoli').replace(/^nd d\./, 'd.').replace(/^i ma alla/, 'ma alla').replace(/^Ri alla/, 'alla').replace(/^N dispositivi/, 'dispositivi').replace(/^De e successive/, 'e successive').replace(/^0\. In ogni caso/, 'In ogni caso').replace(/^i diritto/, 'diritto').replace(/^di coerenza/, 'coerenza').replace(/^i e casellario/, 'e casellario'))

  if (page.page === 12) {
    lines = [
      '26. Verifica Accordo',
      'a. Le Parti si incontreranno con cadenza semestrale ed in ogni caso a richiesta di parte per verificare l’andamento del presente Accordo ovvero la discontinuità.',
      'b. Annualmente, di norma entro il primo quadrimestre, le aziende si impegnano a fornire alle OO.SS. informazioni riguardanti il numero dei lavoratori distinto per tipologia di contratto, anche a tempo pieno e parziale nonché sull’equa distribuzione delle domeniche.',
      '27. Validità ed applicazione',
      'a. Il presente Accordo avrà validità dal 1° maggio 2025 al 30 Aprile 2028.',
      'b. La validità verrà protratta per un ulteriore anno, qualora non venisse presentata richiesta di rinnovo, da parte sindacale o datoriale, entro i sei mesi antecedenti la scadenza.',
      'c. La sottoscrizione del presente Accordo, da parte delle Organizzazioni Sindacali stipulanti il CCNL Logistica, Trasporto merci e Spedizione vigente, comprese tutte le loro articolazioni territoriali ed RSA, delle RSU ove presenti, di tutte le aziende aderenti all’Associazione datoriale e da quest’ultima, rende il presente Accordo immediatamente fruibile a livello territoriale, senza necessità di ulteriori accordi di armonizzazione.',
      'd. Le Parti ribadiscono che i contenuti del presente Accordo sono stati definiti tenendo conto esclusivamente delle specificità degli assetti organizzativi delle aziende di distribuzione aderenti ad Assoespressi nella distribuzione ultimo miglio per Amazon Italia Transport s.r.l. (con l’eccezione del trasporto degli ingombranti – AMXL), fermo restando, per le aziende che non rientrano nel campo di applicazione dello stesso, la libertà sindacale di negoziare qualsivoglia diverso assetto.',
      'e. Il presente Accordo annulla e sostituisce tutti gli Accordi in essere nel territorio nazionale inerenti quanto dal Presente normato.',
      'f. Tutte le aziende che, successivamente all’entrata in vigore del presente Accordo, entreranno a far parte di Assoespressi e opereranno nella distribuzione ultimo miglio per Amazon Italia Transport s.r.l., saranno tenute ad applicare il presente Accordo attraverso formale adesione, trasmessa ad Assoespressi via Posta Elettronica Certificata che consentirà l’immediata applicabilità dell’Accordo stesso.',
      'g. Il presente Accordo sarà sottoposto alle assemblee dei lavoratori e la riserva sarà sciolta entro il 3 luglio 2025.',
      'Letto, confermato e sottoscritto',
      '26 maggio 2025',
      'Le Parti',
      'Assoespressi',
    ]
  }

  return { ...page, lines: lines.filter(Boolean) }
}

export const agreementPages = ocrPages.map(verifiedPage)
export { agreementIndex }
