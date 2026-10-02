# Turb(OF)an

**L'anatomia di un turbofan ricostruita in 3D dai documenti tecnici originali della NASA.**

Turb(OF)an è un sito didattico interattivo sul **NASA/GE Energy Efficient Engine (E³)**, il turbofan sviluppato da NASA e General Electric tra la fine degli anni '70 e l'inizio degli anni '80. Il modello 3D è generato dai dati dei report di progetto e di prova di pubblico dominio, e un modello termodinamico ne calcola il ciclo.

- **Storia:** un percorso guidato. Il motore si presenta intero, poi si apre in una vista esplosa: mentre scorri, la camera vola sul modulo descritto e lo evidenzia. Per il ciclo termodinamico il motore si richiude.
- **Esplora:** il modello libero, con l'elenco dei componenti, i comandi di vista e il ciclo termodinamico, da cui puoi muovere la manetta e le condizioni di volo.

> Ricostruzione didattica **non ufficiale**, non affiliata a NASA o General Electric.

## Rigore e verificabilità
Ogni affermazione del sito deve essere riconducibile a una fonte.

| Livello | Come è verificato | Comando |
|---|---|---|
| **Dati estratti** (oltre 300 sezioni di pala, stazioni del condotto, ciclo) | Doppia unità cm/in, relazioni interne (camber = β₁ − β₂), confronto tra tabelle indipendenti dello stesso report e tra report diversi | `npm run check:data` |
| **Geometria e modelli** | Test automatici contro i valori pubblicati, ad esempio la lunghezza delle turbomacchine (316 contro 318 cm), le previsioni fuori progetto (scarto massimo 2,1%) e i triangoli di velocità del compressore HP (angoli entro 3°) | `npm test` |
| **Testi** | Ogni paragrafo cita la frase originale in inglese con report e pagina; lo script la ritrova nel testo del PDF | `npm run check:claims` |

Dove i report non danno un dato, il modello usa una **stima dichiarata**: forme dei profili alari delle turbine, dischi, alberi, alcune superfici. Il pannello di ogni componente indica cosa è dato e cosa è stimato.

## Fonti
I 13 report NASA (Contractor Reports, contratto NAS3-20643) sono elencati in [`engines/SOURCES.md`](engines/SOURCES.md), con i link a [NTRS](https://ntrs.nasa.gov). Per scaricarli in `refs/`:

```sh
sh scripts/fetch_refs.sh
```

L'estrazione di ogni report è documentata in [`docs/extraction/`](docs/extraction/), il modello di ciclo in [`docs/cycle-model.md`](docs/cycle-model.md).

## Sviluppo
Richiede Node 20+ e, per i controlli, Python 3 con `pdftotext` (poppler).

```sh
npm install
npm run dev            # http://localhost:5173
npm test               # test di geometria, modelli e contenuti
npm run check:data     # controlli sui dati estratti
npm run check:claims   # verifica delle citazioni (richiede i PDF in refs/)
npm run build          # sito statico in dist/
```

## Struttura
```
engines/            specifiche del motore (JSON) con la fonte di ogni valore
docs/               resoconti di estrazione, modello di ciclo, piano
scripts/            download dei report, controlli sui dati, verifica delle citazioni
src/data/           caricamento dei dati e superfici di rivoluzione
src/geometry/       profili alari, pale, mixer, rivoluzione
src/physics/        termodinamica, ciclo di progetto, fuori progetto, mappe sul condotto
src/content/        testi della storia e schede dei componenti, con citazioni
src/scene/          scena 3D (React Three Fiber)
src/pages/          pagine Storia ed Esplora
```

## Licenza
Il codice è distribuito con licenza [MIT](LICENSE). I report NASA citati sono documenti governativi statunitensi di pubblico dominio e non sono ridistribuiti in questo repository.
