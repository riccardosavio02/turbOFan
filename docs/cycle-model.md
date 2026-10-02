# Modello di ciclo 0D

Codice: `src/physics/thermo.ts` (gas), `cycle.ts` (ciclo), `ratings.ts` (punti di funzionamento), `validation.ts` (confronti), `flowmap.ts` (colori sul condotto). Test: `src/physics/cycle.test.ts`.

## Impostazione
- **Gas semi-perfetto:** cp(T, FAR) dai polinomi di Walsh & Fletcher per aria secca e prodotti del cherosene. Entalpia e funzione entropica sono integrate analiticamente; le trasformazioni isentropiche sono risolte con il metodo di Newton. Potere calorifico inferiore 43,124 MJ/kg.
- **Ingressi, tutti dalla specifica e senza tarature:**
  - rapporti di pressione del fan (bypass e mozzo) e dell'HPC, BPR e T41 (CR-168219 Tab. XII);
  - rendimenti, perdite di pressione, raffreddamenti e spillamenti (Tab. XI);
  - perdita del condotto fan → HPC dell'1,8% (CR-165148);
  - portata corretta del fan: 646 kg/s a max climb (CR-168219), quelle di crociera e decollo misurate al banco (CR-168070 Tab. VI).
- **Percorso del flusso:**
  - fan diviso tra bypass e mozzo + booster;
  - HPC con spillamenti al 5° e al 7° stadio;
  - combustore, con il FAR risolto in modo che, dopo la miscela del raffreddamento non caricabile, la temperatura sia T41;
  - HPT con lavoro = lavoro dell'HPC;
  - miscela del raffreddamento caricabile e degli spillamenti all'ingresso della LPT;
  - LPT con lavoro = lavoro del fan;
  - condotti, mixer (efficacia 0,838 tra spinta a flussi separati e a flussi completamente miscelati) e ugello adattato con Cv 0,996.

## Confronto con i report (nessuna taratura)
| Punto | Grandezza | Modello | Report | Scarto |
|---|---|---|---|---|
| Max climb | T25 | 304,9 K | 304,8 K | 0,0% |
| | P25 | 60,68 kPa | 60,47 kPa | +0,3% |
| | OPR | 38,56 | 38,4 | +0,4% |
| | sfc | 0,0548 | 0,0541 | +1,4% |
| | HPT Δh/T41 | 359,7 J/(kg·K) | 355,5 | +1,2% |
| | HPT W√T/P | 0,8674 | 0,8643 | +0,4% |
| | T49 | 1046 K | 1056 K | −0,9% |
| | LPT Δh/T49 | 336,8 J/(kg·K) | 326,5 | +3,2% |
| | LPT W√T/P | 3,983 | 3,936 | +1,2% |
| Max cruise | OPR | 36,51 | 36,5 | 0,0% |
| | sfc | 0,0549 | 0,0540 | +1,7% |
| Decollo | OPR | 32,27 | 32,4 | −0,4% |
| | sfc | 0,0312 | 0,0305 | +2,3% |
| | Spinta | 171,1 kN | 173,5 kN | −1,4% |

Il modello sovrastima leggermente il consumo (+1,4–2,3%) e il lavoro della LPT (+3%). Cause probabili:
- raffreddamenti trattati in modo semplificato (tutti miscelati a monte o a valle di un rotore);
- mixer modellato con un'efficacia invece che con le aree reali;
- rendimenti di crociera usati anche a max climb e al decollo.

## Modello fuori progetto (`src/physics/offdesign.ts`)
Impostazione di Mattingly (*Elements of Gas Turbine Propulsion*, cap. 8), senza mappe dei componenti:
- **Turbine strozzate:** capacità W√T/P costante all'ingresso di HPT e LPT.
- **Geometria fissa:** aree costanti all'ingresso del mixer (lato core e lato bypass) e alla gola dell'ugello.
- **Mixer:** pressioni statiche uguali sui due lati.
- **Componenti:** rendimenti, perdite, spillamenti e rapporto tra i β del fan (mozzo/bypass) costanti.

**Taratura:** capacità e aree si ricavano dal punto di progetto (max climb). L'unica ipotesi in più è il Mach lato core all'ingresso del mixer in progetto, posto a 0,40.
**Ingressi:** condizione di volo e T41 (la «manetta»).
**Incognite:** portata corretta del fan, β del fan, BPR e β dell'HPC (quest'ultimo risolto dalla capacità della HPT).
**Soluzione:** Newton smorzato con jacobiano alle differenze finite. Fuori dall'intorno del progetto la soluzione procede per continuazione, a piccoli passi dalla condizione di progetto.

### Interpretazione dei punti di rating (CR-168219 p.33)
Il motore ha spinta costante (flat-rated) fino alla temperatura di flat rating: ISA+10 per salita e crociera, ISA+15 per il decollo. Le T41 della Tab. XII valgono a quella temperatura, mentre sfc e parametri del ciclo valgono in giornata standard. La previsione quindi:
1. calcola il motore alla temperatura di flat rating con la T41 della tabella, ottenendo la spinta di rating;
2. cerca in giornata ISA la T41 che dà la stessa spinta;
3. confronta lì i parametri con la tabella.

Senza questo passaggio, cioè calcolando la crociera in giornata ISA con la T41 di tabella, il modello dava OPR 40,72 contro 36,5 (+11,6%). Con l'interpretazione del flat rating tutti i parametri tornano entro il 2%: è così che l'interpretazione è stata trovata e confermata.

### Previsioni (tarato solo a max climb, rendimenti di fan e HPC dalle mappe)
| Punto | Grandezza | Previsione | Report | Scarto |
|---|---|---|---|---|
| Crociera | OPR | 36,76 | 36,5 | +0,7% |
| | BPR | 6,89 | 6,8 | +1,3% |
| | β fan bypass | 1,643 | 1,64 | +0,2% |
| | β HPC | 22,51 | 22,4 | +0,5% |
| | sfc (ISA) | 0,0529 | 0,0540 | −2,0% |
| | Portata corretta del fan | 637,1 kg/s | 632,8 (misurata al banco, CR-168070) | +0,7% |
| Decollo | OPR | 32,17 | 32,4 | −0,7% |
| | BPR | 7,08 | 7,0 | +1,1% |
| | β fan bypass | 1,560 | 1,56 | 0,0% |
| | β HPC | 20,76 | 20,8 | −0,2% |
| | sfc (ISA) | 0,0300 | 0,0305 | −1,6% |
| | Portata corretta del fan | 588,3 kg/s | 576,1 (misurata al banco) | +2,1% |
| | Spinta (ISA+15) | 174,5 kN | 173,5 | +0,6% |

Con le mappe la previsione di β del fan migliora (da −0,4% a +0,2% in crociera, esatta al decollo), quelle di sfc e portata peggiorano leggermente; tutte restano entro le tolleranze. Le mappe sono descritte in [`docs/extraction/maps_and_triangles.md`](extraction/maps_and_triangles.md).

Le T41 in giornata ISA a spinta di rating sono previsioni del modello, non pubblicate dal report.

**Campo di validità:** T41 da 1200 a 1650 K. Il test verifica convergenza e spinta crescente con T41 al suolo, a 5 km e in crociera. Sotto i 1200 K il risolutore non converge in modo affidabile (verificato a 1100 K) e l'ipotesi di turbine strozzate diventa discutibile ai bassi regimi: per il minimo e l'avviamento servirebbero mappe dei componenti.

## Nota storica: equilibrio al mixer nel ciclo di progetto
Il ciclo di progetto (punti calcolati direttamente dagli ingressi della Tab. XII) non impone l'equilibrio al mixer. Il modello fuori progetto lo impone (pressioni statiche uguali). Con il solo ciclo di progetto il rapporto P56/P16 valeva:

| Punto | P56/P16 |
|---|---|
| Max climb | 0,94 |
| Decollo | 0,93 |
| Max cruise | 1,13 |

Lo scarto in crociera era un indizio della stessa incoerenza: la T41 di tabella vale a ISA+10, non in giornata standard. Nel modello fuori progetto l'equilibrio al mixer è imposto per costruzione.

## Mappa sul condotto
Con lo spaccato attivo, il condotto sezionato si colora di temperatura totale (200–1700 K) o di pressione totale (20–3500 kPa, scala logaritmica). Tra le stazioni del ciclo i valori sono distribuiti schiera per schiera:
- **fan e booster:** 60/40 del lavoro;
- **HPC:** ripartizione di lavoro e pressione per stadio dalla Tab. XXI di CR-165558 (linea di corrente 7), normalizzata sul ciclo;
- **HPT:** 56,5% del lavoro al primo stadio;
- **LPT:** Δh e rapporti di pressione per stadio dalla Tab. II del report LPT.
