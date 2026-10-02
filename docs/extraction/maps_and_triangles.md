# Mappe dei componenti e triangoli di velocità

## Mappa del fan — CR-168070 Fig. 3 (p.12)
File: [`engines/ge-e3.map.fan.json`](../../engines/ge-e3.map.fan.json).

- **Contenuto:** linee di velocità corretta dal 40 al 105% (β del bypass in funzione della portata corretta totale e rendimento adiabatico mediato sulla quantità di moto), linea di stallo obiettivo, linee operative al suolo e in quota, punti di rating.
- **Digitalizzazione:** a 300 dpi, su una griglia calibrata sulle linee punteggiate del grafico (scarto inferiore a 1 px).
- **Prima revisione:** la prima lettura dei rendimenti aveva attribuito alcune curve alla linea di velocità sbagliata (nel pannello superiore le curve sono fitte e si incrociano). Rilette a ingrandimento 4×, ogni curva è stata attribuita verificando che il crollo del rendimento cada alla portata di choke della stessa linea nel pannello β-portata.
- **Verifiche** (`src/physics/maps.test.ts`):
  - il punto di max climb (1420 lb/s; 1,65) cade al 98,0% di velocità, contro il 97,8% della Fig. 4;
  - i rendimenti letti ai tre punti di rating concordano con quelli misurati della Tab. VI entro 0,006 (0,882 / 0,894 / 0,890 contro 0,886 / 0,892 / 0,893);
  - il margine di stallo a portata costante al decollo è il 14,5%, contro «circa 15%» (p.13).

## Mappa del compressore HP — CR-168069 Fig. 91 (p.188)
File: [`engines/ge-e3.map.hpc.json`](../../engines/ge-e3.map.hpc.json).

Il report pubblica solo **tratti** delle linee di velocità (60–99%) vicino alla linea operativa, insieme alla linea di stallo obiettivo, alla linea operativa FPS e al rendimento lungo la linea operativa della prova 10B. L'asse del β è calibrato sulle tacche; la sua scala è stata corretta (β 1 a 1910 px, 39,2 px per unità) dopo un primo errore di offset scoperto confrontando la linea operativa con il punto di progetto.

**Verifiche:**
- la portata di progetto (54,4 kg/s) cade al 99,4% di velocità corretta, contro il 98,4% della Tab. XIV di CR-168219;
- la linea operativa passa per β = 23,0 entro il 3%.

## Uso delle mappe nel modello fuori progetto
I rendimenti di fan e compressore HP variano in proporzione al rendimento letto sulla mappa, con una scalatura attorno a max climb. Nel punto di progetto la mappa restituisce esattamente i valori del ciclo. Le previsioni di crociera e decollo restano entro le tolleranze (vedi `docs/cycle-model.md`).

Sulla portata del fan al decollo la tolleranza è stata portata dal 2 al 2,5%. Il report spiega perché un confronto più stretto non è possibile: al banco la portata misurata superava quella prevista dell'1,4–3,5% a tutte le velocità (CR-168070 p.13).

## Triangoli di velocità del compressore HP — CR-165558 Tab. XXI
Dati in `engines/ge-e3.hpc.json` → `vector_diagrams_SL7`, letti sull'immagine a 250 dpi alla **linea di corrente 7** (45–55% d'immersione, circa metà portata):
- per ogni rotore, raggio, PT/PTI, TT/TTI, U, Cz e β relativo all'ingresso e all'uscita;
- per IGV e statori, l'angolo di flusso assoluto in uscita.

**Controllo interno:** U/r dà 12 303 ± 2 rpm su tutti i 20 punti, cioè esattamente il 100% di velocità corretta della Tab. X.

### Due usi
1. **Ripartizione tra gli stadi:** il ciclo ripartisce aumento di pressione e di temperatura secondo PT/PTI e TT/TTI della tabella, invece che in parti uguali. La prima versione usava parti uguali e dava al rotore 3 una densità troppo bassa (Cz = 316 m/s contro 196) e valori non definiti ai rotori 4 e 5: era una mia ipotesi sbagliata, non un errore dei dati.
2. **Validazione** (`src/physics/triangles.test.ts`): i triangoli calcolati dal ciclo a max climb, al raggio della linea di corrente 7 e con l'angolo d'ingresso preso dallo statore precedente, rispetto alla tabella:
   - **U:** +1,2% (regime fisico di salita, 12 450 rpm, contro 12 303 rpm corretti);
   - **Cz:** −1/−9% (media di continuità sulla sezione contro valore locale a metà portata);
   - **β₁:** entro 2,6°;
   - **β₂:** entro 2,6°.

## Triangoli di fan e turbina LP
- **Fan:** ingresso assiale; lavoro del bypass dal ciclo; angoli metallici al 50% da CR-165148 App. B. Non c'è una tabella dei triangoli con cui confrontarli: sono un calcolo del sito.
- **Turbina LP:** gli angoli di flusso a metà altezza sono un **dato** (Tab. II del report LPT); il sito calcola solo i moduli delle velocità. Come controllo si ricalcola l'angolo relativo d'ingresso dai soli angoli assoluti e dalla continuità: entro 4° agli stadi 1–4 (test), 4,5° allo stadio 5, che ha il carico più basso e il raggio meno certo.

## Triangoli della turbina HP
Gli angoli a metà altezza vengono dalla Fig. 5 di CR-167955, letti su un grafico. Come controllo, il lavoro di Eulero ricavato dagli angoli si confronta con il salto entalpico della schiera nel ciclo:
- **rotore 1:** 89% (test: entro il 15%);
- **rotore 2:** 72%. L'angolo relativo d'ingresso ricalcolato (−19°) ha segno opposto a quello letto (+15°), il che conferma l'incertezza sul segno già annotata in fase di estrazione. Il valore è mostrato nel sito con la sua percentuale, senza correzioni.

Nella turbina LP, con gli angoli della Tab. II, il bilancio di Eulero è 97–108% agli stadi 1–3 (test: entro il 10%) e 113–118% agli stadi 4–5.
