# Turb(OF)an — Piano di progetto

> *Only Fans… and compressors, combustors, turbines and nozzles.*
> Visualizzatore 3D interattivo e didattico di esoreattori, navigabile dal motore intero fino al singolo componente.

---

## Stato (2026-10-01)
- **Fase 0:** estratti CR-168219 (motore), CR-165148/CR-168070 (fan), CR-165558 (HPC), CR-167955 (HPT), report LPT, CR-159584 (dimensioni). CR-169301 (combustore) estratto. CR-168069 (core) estratto: disposizione assiale verificata, lunghezza 316 cm contro 318 del report. Da estrarre: prestazioni HPT (scansione senza testo).
- **Fase 1:** motore completo navigabile in 3D (`npm run dev`): fan, compressore HP a 10 stadi, combustore a doppio anello, turbina HP a 2 stadi, turbina LP a 5 stadi, turbine frame, mixer a 18 lobi, cono di scarico, gondola. Alberi LP e HP con dischi, tamburi, cuscinetti e supporti dei sump, con rapporto di giri reale; spaccato con facce di taglio piene; presa d'aria a diffusore. 77 test (`npm test`) e 43 controlli sui dati (`npm run check:data`).
- **Fase 3 (avviata):** modello di ciclo 0D a gas semi-perfetto in 3 punti di rating, confrontato senza tarature con 14 grandezze dei report (scarti tra 0 e 3,2%); pannello del ciclo con diagramma T–s e tabella delle stazioni; condotto colorato per temperatura o pressione sul piano di taglio. Vedi docs/cycle-model.md.

## 1. Obiettivo

Un'applicazione web (gira nel browser, nessuna installazione) che mostra un esoreattore in 3D e permette di:

- **orbitare e zoomare** con continuità dal motore completo fino a singola schiera, disco, pala;
- **sezionare** il motore (cutaway con piano di taglio, come le sezioni dei musei);
- **esplodere** i moduli lungo l'asse;
- **selezionare** qualunque parte e leggerne dati tecnici e spiegazione;
- **animare** gli alberi (LP/HP) e il flusso, con grandezze termodinamiche per stazione.

Il valore didattico sta nella **gerarchia di dettaglio**: Motore → Modulo → Componente → Parte.

---

## 2. Scelta del motore — DECISA: NASA/GE Energy Efficient Engine (E³)

Il criterio scelto è il motore con **più documentazione tecnica pubblica**, per poter validare il nostro codice contro i dati originali. Il vincitore netto è il **GE E³**: per ogni componente esistono report NASA di progetto e di prova di pubblico dominio. È anche il progenitore tecnologico del GE90. Analisi completa e classifica dei candidati in [`docs/ENGINE_SELECTION.md`](docs/ENGINE_SELECTION.md); elenco delle fonti in [`engines/SOURCES.md`](engines/SOURCES.md).

| Modulo | Configurazione E³ (FPS) |
|---|---|
| Fan | 1 stadio, 32 pale con shroud a metà altezza, + *quarter-stage* booster |
| HPC | 10 stadi, β ≈ 23 |
| Combustore | Anulare a doppio anello |
| HPT | 2 stadi raffreddati |
| LPT | 5 stadi |

Secondo motore (fase 4): P&W E³ (confronto tecnico) oppure Olympus 593 (motore iconico).

> Ogni valore numerico nella specifica porta la fonte (report + pagina, figura o tabella) oppure il flag `estimate`. Il modello resta una **ricostruzione didattica**, ma ancorata a dati originali verificabili.

---

## 3. Idea tecnica chiave: geometria procedurale da parametri ingegneristici

Invece di modellare a mano in Blender (lento e difficile da iterare), **il motore viene generato via codice da un file di specifica** (`engines/ge-e3.json`), esattamente come si farebbe in un preliminary design:

1. **Profilo meridionale**: linee hub e tip del condotto lungo l'asse x → casse, ogive, condotti tramite *superfici di rivoluzione* (lathe).
2. **Schiere di pale**: per ogni schiera si definiscono numero di pale, corda, spessore, calettamento e svergolamento da hub a tip, famiglia di profili (NACA 65 / DCA per i compressori, profili turbina generici). La pala si genera per *loft* delle sezioni e viene replicata con **instancing** (una geometria, N istanze → prestazioni ottime anche con migliaia di pale).
3. **Dischi, alberi, cuscinetti, camera di combustione, flameholder, petali dell'ugello**: primitive parametriche dedicate.

Vantaggi: cambiare un parametro (es. numero di pale del 1° stadio fan) ricostruisce il modello all'istante, e lo stesso motore grafico serve per qualsiasi turbomacchina.

Esempio di specifica:

```json
{
  "id": "ge-e3",
  "name": "NASA/GE Energy Efficient Engine (E3)",
  "spools": [
    { "id": "LP", "rpm_max": 0, "components": ["fan"] },
    { "id": "HP", "rpm_max": 0, "components": ["hpc"] }
  ],
  "modules": [
    {
      "id": "fan", "type": "compressor", "spool": "LP",
      "stages": [
        { "rotor": { "blades": 0, "hubR": 0, "tipR": 0, "chord": 0, "stagger": [0, 0], "profile": "DCA" },
          "stator": { "vanes": 0, "...": "..." } }
      ]
    }
  ],
  "stations": { "2": { "x": 0 }, "21": { "x": 0 }, "3": { "x": 0 }, "4": { "x": 0 }, "5": { "x": 0 }, "9": { "x": 0 } }
}
```
*(valori a zero = da compilare in fase 0 con le fonti)*

---

## 4. Stack tecnologico

| Ambito | Scelta | Motivo |
|---|---|---|
| Linguaggio | TypeScript | Tipizzazione della specifica del motore |
| Build | Vite | Avvio istantaneo, hot reload |
| 3D | **Three.js** + **React Three Fiber** + **drei** | Standard de facto per 3D web; drei offre camera controls, clipping, outline, ecc. |
| UI | React + Tailwind | Pannelli, albero dei componenti, schede info |
| Stato | Zustand | Selezione, modalità (sezione/esploso), parametri animazione |
| Post-processing | @react-three/postprocessing | Outline del selezionato, SSAO per leggibilità |
| Calcolo ciclo | Modulo TS puro | Ciclo termodinamico 0D per le stazioni |
| Test | Vitest | Test su generatori geometrici e modello di ciclo |
| Deploy | GitHub Pages o Vercel | Gratuito, link condivisibile |

---

## 5. Struttura del repository

```
Turbofan_Project/
├─ engines/                 # Specifiche JSON dei motori + fonti
│  ├─ ge-e3.json
│  └─ SOURCES.md
├─ src/
│  ├─ spec/                 # Tipi TS e validazione (zod) della specifica
│  ├─ geometry/             # Generatori procedurali
│  │  ├─ airfoils.ts        #   NACA65, DCA, profili turbina
│  │  ├─ blade.ts           #   loft della pala con svergolamento
│  │  ├─ bladeRow.ts        #   schiera istanziata
│  │  ├─ revolve.ts         #   superfici di rivoluzione (casse, ogive)
│  │  ├─ disk.ts, shaft.ts, combustor.ts, afterburner.ts, nozzle.ts
│  ├─ scene/                # Componenti R3F: Engine, Module, Component
│  ├─ interaction/          # Selezione, focus camera, sezione, esploso
│  ├─ physics/              # Ciclo 0D, numerazione stazioni SAE ARP755
│  ├─ ui/                   # Albero componenti, pannello info, toolbar
│  └─ content/              # Testi didattici (IT/EN) per ogni componente
├─ public/
└─ PLAN.md
```

---

## 6. Roadmap per fasi

### Fase 0 — Estrazione dati dai report NASA (GE E³)
- Download dei report elencati in `engines/SOURCES.md` nella cartella `refs/`.
- Estrazione dei dati: profilo meridionale (coordinate hub/tip, digitalizzando le figure dove servono), numero di pale e corde per schiera, angoli metallici, β e η di stadio, giri, dati di ciclo alle stazioni (spinta, BPR, OPR, T4).
- Stima con regole di progetto (solidità, allungamento, triangoli di velocità) solo dove i report sono adimensionali o lacunosi, sempre con flag `estimate`.
- Output: `engines/ge-e3.json` + tabelle di riferimento in `engines/reference/`.
- ✅ *Criterio di completamento:* test automatici che confrontano geometria e ciclo generati dal nostro codice con le tabelle dei report, entro tolleranze dichiarate.

### Fase 1 — MVP navigabile
- Scaffold Vite + React + R3F + TypeScript.
- Generatore del condotto (lathe di hub/tip) e casse esterne.
- Schiere di pale semplificate (lastre svergolate) istanziate.
- Camera orbitale con zoom fluido, illuminazione PBR, materiali metallici differenziati (Ti per fan/HPC, superleghe Ni per turbine, ceramici/TBC).
- **Sezione** con piano di taglio regolabile.
- ✅ *Criterio di completamento:* l'E³ riconoscibile, navigabile, sezionabile a 60 fps.

### Fase 2 — Dettaglio e gerarchia
- Pale con profili veri (loft di sezioni NACA65/DCA, profili turbina con bordo d'uscita spesso).
- Dischi, alberi coassiali LP/HP, cuscinetti, camera di combustione anulare con iniettori, NGV, postbruciatore con flameholder, ugello C-D a petali.
- **Albero dei componenti** cliccabile, **focus camera** sul componente selezionato, outline.
- **LOD**: i dettagli fini (fori di raffreddamento, root a coda di rondine/abete) compaiono solo zoomando.
- Pannello info: funzione, materiale, dati, schema.

### Fase 3 — Funzioni didattiche
- **Vista esplosa** animata per moduli.
- **Rotazione degli alberi** con rapporto di velocità LP/HP realistico (rallentata).
- **Ciclo termodinamico 0D**: calcolo di T e p alle stazioni 0–9 con input regolabili (Mach di volo, quota, manetta, PB on/off); colorazione del condotto e particelle del flusso secondo T o p.
- **Diagramma T-s** e **h-s** collegato al 3D (clic su una stazione → evidenziata nel motore).
- **Tour guidati**: percorsi passo-passo ("segui una particella d'aria", "perché il bypass", "come funziona il postbruciatore").

### Fase 4 — Secondo motore: P&W E³ oppure Olympus 593
- Specifica `olympus593.json` (7+7 stadi).
- Componenti specifici: presa d'aria a rampe variabili, ugello secondario e invertitore di spinta a secchi.
- Selettore motore e **confronto affiancato** (stessa scala).

### Fase 5 — Rifinitura e pubblicazione
- Prestazioni su dispositivi mobili, controlli touch.
- Bilingue IT/EN.
- Deploy pubblico e pagina "about" con fonti e disclaimer.

---

## 7. Rischi e mitigazioni

| Rischio | Mitigazione |
|---|---|
| Dati mancanti o adimensionali nei report | Distinguere sempre *dato pubblico* da *stima*; geometria parametrica facilmente correggibile |
| Prestazioni con migliaia di pale | Instancing, LOD, geometrie condivise, clipping lato GPU |
| Aspetto "giocattolo" | Materiali PBR, environment map, SSAO, profili alari veri e proporzioni corrette |
| Marchi e proprietà intellettuale | Nessun logo Rolls-Royce/Eurojet, dicitura "ricostruzione didattica non ufficiale" |
| Scope creep | Ogni fase ha un criterio di completamento; l'MVP è solo la fase 1 |

---

## 8. Decisioni aperte

1. ~~Motore di partenza~~ → **GE E³** (deciso)
2. **Stack:** web con Three.js (raccomandato) oppure desktop (Unity/Unreal, più resa grafica ma meno condivisibile)?
3. **Lingua dei contenuti:** solo italiano, o italiano + inglese fin da subito?
4. **Repository:** inizializzare git e creare un repo GitHub per il deploy?
