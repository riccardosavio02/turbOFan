# Estrazione — Turbine, combustore, scarico e gondola

Dati strutturati: [`engines/ge-e3.turbines.json`](../../engines/ge-e3.turbines.json). Test: `src/data/turbines.test.ts`.

A differenza di fan e compressore, i report delle turbine **non tabulano le sezioni delle pale**. La geometria è ricostruita da quattro dati indipendenti, e i test controllano che tornino tra loro:
1. **condotto** (raggi quotati o digitalizzati);
2. **numero di pale**;
3. **angoli di flusso** al mozzo, a metà e all'apice;
4. **solidità e allungamento**.

## Turbina HP — CR-167955
| Dato | Fonte | Uso |
|---|---|---|
| Condotto con raggi quotati, posizioni assiali digitalizzate (±0,2 cm) | Fig. 3 p.9 | Stazioni delle 4 schiere |
| 46 / 76 / 48 / 70 palette e pale, solidità AW/t, allungamento | Tab. III–IV pp.10–12 | Conteggi, controllo delle larghezze |
| Velocità periferiche al decollo: 513,9 e 535,2 m/s | Tab. III | Controllo del regime |
| Angoli di flusso | Fig. 5 p.13 (letture approssimate) | Calettamento e camber |

**Controlli:** le due velocità periferiche, divise per i rispettivi raggi d'apice, danno lo stesso regime entro l'1% (≈ 13.400 rpm al decollo, maggiore dei 12.450 rpm a max climb). Le larghezze assiali del condotto coincidono con quelle ricavate dalla solidità entro il 10%.

## Turbina LP — report di progetto LPT (NTRS 19850002686)
| Dato | Fonte |
|---|---|
| Condotto in pollici (digitalizzato, ±0,15 in) | Fig. 8 p.15 |
| Pale: 72-120, 102-122, 96-122, 114-**156**, 120-110 | Fig. 6 p.12 (Block II) |
| Angoli: uscita statore, ingresso/uscita rotore, swirl, a mozzo/metà/apice | Tab. II p.16 |
| Solidità AW/t e allungamento h/AW per ognuna delle 10 schiere | Tab. III p.17 |

**Controlli:**
- **Raggi vs carico:** il raggio medio di ogni rotore, ricavato dal carico Δh/2u² e dal salto entalpico della Tab. II con il regime LP di CR-168219 (3.479 rpm), coincide con quello digitalizzato entro il 3% su tutti e 5 gli stadi.
- **Larghezze assiali:** le due stime della Tab. III (da AW/t e da h/AW) concordano entro il 10%. Le larghezze lette sulla figura sono più ampie per i rotori, perché le stazioni di calcolo sporgono oltre i bordi; si usano quindi i valori della tabella, centrati sulle schiere della figura.
- **Raccordo con la turbina HP:** il condotto LP parte con gli stessi raggi d'uscita della HP (12,25 in = 31,12 cm; 15,0 in = 38,10 cm), ricavati da un report diverso.
- **Condotto di transizione:** con il piano d'uscita HPT a x = 0 in è lungo 7,2 cm, contro i 7,62 cm di CR-168219 p.82. Una prima ipotesi (x = −2 in) dava 12,3 cm ed è stata scartata grazie a questo test.
- **Parete esterna:** inclinata di circa 23°, contro i 25° dichiarati.

## Combustore — CR-168219 Fig. 22 e p.57–61
Anulare a doppio anello: liner a doppia parete, corpo centrale tra le due zone, **60 swirler** (30 pilota esterni + 30 main interni), 30 iniettori. Posizione e forma sono **stimate** dalla figura, scalata sui raggi noti di uscita HPC e ingresso HPT. Ingresso turbina HP a 33 cm dall'uscita del compressore.

## Dimensioni del motore — CR-159584 Tab. I p.6
| Fan | Diametro max gondola | Presa d'aria | Turbomacchine | Gondola | Ugello |
|---|---|---|---|---|---|
| 210,8 cm | 248,9 cm | 159,0 cm | 318,0 cm | 603,3 cm | 159,0 cm |

La catena di posizionamento (fan → HPC +106 cm → combustore +33 cm → HPT → LPT) porta la flangia del turbine frame a 318 cm dal fan **entro il 4%**, senza aggiustamenti. La gondola è ora costruita su queste quote.

## Stime principali (da sostituire se si trovano dati migliori)
- **Pale delle turbine:** angoli metallici uguali agli angoli di flusso (incidenza e deviazione trascurate), spessori tipici.
- **Angoli della turbina HP:** letti su un grafico; per il rotore 2 il segno dell'angolo d'ingresso è incerto.
- **Liner, mixer (18 lobi), cono di scarico, cofano del core, profili della gondola:** forme ricavate dai disegni.
- **Montanti del turbine frame:** 12 (CR-168219 p.90), con corda e spessore stimati.
- Il report sulle prestazioni HPT (scansione senza testo) e il report sul core (CR-168069) non sono ancora stati estratti.
