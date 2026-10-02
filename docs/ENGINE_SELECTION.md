# Scelta del motore di riferimento

**Data:** 2026-10-01
**Criterio:** quantità e qualità di documentazione tecnica **pubblica e verificabile**, utile a ricostruire la geometria (profilo meridionale, schiere, profili alari) e a validare il nostro codice contro i dati originali.

## Esito: NASA/GE Energy Efficient Engine (E³)

Il **GE E³** è il turbofan meglio documentato al mondo nel pubblico dominio. Lo ha sviluppato General Electric con la NASA Lewis (programma ACEE, 1978–1985, contratto NAS3-20643). Ogni componente ha un proprio *detailed design report* e un *performance report* (test di rig), pubblicati come NASA Contractor Report. Sono opere finanziate dal governo USA, liberamente scaricabili da NTRS.

È anche il **progenitore tecnologico del GE90**: il compressore HP a 10 stadi con rapporto 23:1 e la camera di combustione a doppio anello nascono qui.

### Configurazione (dai report, da confermare voce per voce in fase 0)

| Modulo | Configurazione | Dati già trovati |
|---|---|---|
| Fan | 1 stadio + *quarter-stage* booster | 32 pale in titanio, AR 2.597, shroud a 55% dell'altezza, rapporto raggi all'ingresso 0.342, U_tip corretto 411.5 m/s, portata specifica 208.9 kg/s·m² |
| HPC | 10 stadi | β = 22.6, η_ad 86.1% / η_pol 90.6% (obiettivo), portata corretta 53.5 kg/s |
| Combustore | Anulare a doppio anello (*double-annular*) | — |
| HPT | 2 stadi, raffreddata | dati di raffreddamento per schiera (vedi DLR 2023) |
| LPT | 5 stadi | η = 91.5% a M0.8 / 10.67 km; 156 pale al 4° stadio |

### Perché è adatto al nostro scopo
1. **Validazione:** ogni nostro numero (raggi, numero di pale, β di stadio, triangoli di velocità, T e p alle stazioni) è confrontabile con una tabella o una figura dei report.
2. **Completezza:** sono coperti tutti i moduli, non solo uno.
3. **Comunità attiva:** il motore è ancora usato come caso di riferimento, per esempio dal DLR nel 2023 (modelli 0D/1D della HPT).
4. **Nessun problema di proprietà intellettuale:** si tratta di documenti pubblici, non di CAD del costruttore.
5. **Coerenza col nome Turb(OF)an:** è un turbofan ad alto rapporto di diluizione con un fan molto evidente, ideale per la didattica.

## Classifica dei candidati

| # | Motore | Documentazione pubblica | Geometria ricostruibile | Note |
|---|---|---|---|---|
| 1 | **NASA/GE E³** | ★★★★★ Report di progetto per ogni componente | Alta | **Scelto** |
| 2 | NASA/P&W E³ | ★★★★ FPS e HPT detailed design (CR-174701, CR-165608) | Media-alta | Ottimo secondo motore per un confronto GE vs P&W |
| 3 | P&W JT9D | ★★★ Report NASA su prestazioni e deterioramento, modello NPSS pubblico (NASA T-MATS) | Media | Buono per validare il ciclo, meno per la geometria |
| 4 | GE90 | ★★ NASA CR-2000-209951 (CFD 3D a 49 schiere) | Bassa | Geometria proprietaria, solo figure |
| 5 | RR/Snecma Olympus 593 | ★★ Libri, sezioni museali, schede prestazionali; manuali di revisione RR protetti da copyright e frammentari | Bassa-media | Ottimo candidato per la fase 4 come motore "iconico" |
| 6 | CFM56 / GEnx | ★ Solo dati generali | Bassa | Proprietari |
| 7 | Eurojet EJ200 | ★ Solo dati generali | Bassa | Motore militare in servizio |

## Conseguenza per la roadmap
- **Motore 1 (fasi 0–3):** GE E³, nella versione *Flight Propulsion System* (FPS), cioè il motore di volo completo. Dove serve, si integra con i dati della versione di test ICLS.
- **Motore 2 (fase 4):** da decidere tra P&W E³ (confronto tecnico) e Olympus 593 (motore iconico, con geometria in parte stimata).
