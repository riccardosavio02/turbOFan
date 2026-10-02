# Fonti — NASA/GE Energy Efficient Engine (E³)

Tutti i report sono scaricabili da NASA NTRS (https://ntrs.nasa.gov). Lo stato indica a che punto siamo con l'estrazione dei dati.

| Ruolo | Titolo | Report | NTRS | Pag. | File locale (`refs/`) | Stato |
|---|---|---|---|---|---|---|
| Motore completo (progetto finale) | Flight Propulsion System Final Design and Analysis | CR-168219 | [19900019242](https://ntrs.nasa.gov/citations/19900019242) | 174 | `CR-168219_FPS_final_design__19900019242.pdf` | **estratto** → [docs/extraction/CR-168219.md](../docs/extraction/CR-168219.md) |
| Motore completo (preliminare) | Preliminary Design and Integration Studies | CR-135444 | [19780023165](https://ntrs.nasa.gov/citations/19780023165) | 401 | `CR-135444_preliminary_design__19780023165.pdf` | scaricato |
| Integrazione velivolo | FPS Aircraft/Engine Integration Evaluation | CR-159584 | [19810013521](https://ntrs.nasa.gov/citations/19810013521) | 312 | `CR-159584_aircraft_integration__19810013521.pdf` | **estratto** → [docs/extraction/turbines_combustor_nacelle.md](../docs/extraction/turbines_combustor_nacelle.md) |
| Fan + booster | Fan Test Hardware Detailed Design Report | CR-165148 | [19830008070](https://ntrs.nasa.gov/citations/19830008070) | 147 | `CR-165148_fan_detailed_design__19830008070.pdf` | **estratto** → [docs/extraction/CR-165148_CR-168070.md](../docs/extraction/CR-165148_CR-168070.md) |
| Fan + booster | Fan and Quarter-Stage Component Performance Report | CR-168070 | [19850025828](https://ntrs.nasa.gov/citations/19850025828) | 78 | `CR-168070_fan_performance__19850025828.pdf` | **estratto** (Tab. VI–VII; mappa Fig. 3 → [maps_and_triangles.md](../docs/extraction/maps_and_triangles.md)) |
| HPC | High Pressure Compressor Detail Design Report | CR-165558 | [19850002690](https://ntrs.nasa.gov/citations/19850002690) | 169 | `CR-165558_HPC_detail_design__19850002690.pdf` | **estratto** → [docs/extraction/CR-165558.md](../docs/extraction/CR-165558.md) |
| HPC | HPC Test Hardware Detailed Design Report | — | [19900019254](https://ntrs.nasa.gov/citations/19900019254) | 295 | `HPC_test_hardware_design__19900019254.pdf` | scaricato |
| Combustore | Combustor Test Hardware Detailed Design Report | CR-169301 | [19900019238](https://ntrs.nasa.gov/citations/19900019238) | 497 | `CR-169301_combustor_design__19900019238.pdf` | **estratto** → [docs/extraction/CR-169301.md](../docs/extraction/CR-169301.md) |
| HPT | High Pressure Turbine Test Hardware Detailed Design Report | CR-167955 | [19850002687](https://ntrs.nasa.gov/citations/19850002687) | 194 | `CR-167955_HPT_detailed_design__19850002687.pdf` | **estratto** → [docs/extraction/turbines_combustor_nacelle.md](../docs/extraction/turbines_combustor_nacelle.md) |
| HPT | HPT Component Test Performance Report | — | [19900019237](https://ntrs.nasa.gov/citations/19900019237) | 180 | `HPT_performance_SCANNED__19900019237.pdf` | scaricato — **solo scansione, nessun testo** |
| LPT | Low Pressure Turbine Test Hardware Detailed Design Report | — | [19850002686](https://ntrs.nasa.gov/citations/19850002686) | 187 | `LPT_detailed_design__19850002686.pdf` | **estratto** → [docs/extraction/turbines_combustor_nacelle.md](../docs/extraction/turbines_combustor_nacelle.md) |
| LPT | The aerodynamic design and performance of the NASA/GE E3 LPT | AIAA 84-1162 (Cherry & Dengler, 1984) | [19840061399](https://ntrs.nasa.gov/citations/19840061399) | — | — | non disponibile su NTRS (solo abstract); opzionale, sovrapposto al report di progetto LPT |
| Core | Core Design and Performance Report | CR-168069 | [19900019243](https://ntrs.nasa.gov/citations/19900019243) | 533 | `CR-168069_core_design_performance__19900019243.pdf` | **estratto** → [docs/extraction/CR-168069.md](../docs/extraction/CR-168069.md) |
| Controlli | Controls and Accessories Detail Design Report | CR-168017 | [19850021645](https://ntrs.nasa.gov/citations/19850021645) | 159 | `CR-168017_controls_accessories__19850021645.pdf` | scaricato |

Totale: 13 report, circa 3.400 pagine, 141 MB. I PDF sono esclusi da git (`.gitignore`); si riscaricano con lo script `scripts/fetch_refs.sh`.

**Nota sulla qualità:** sono scansioni degli anni '80 con un livello di testo OCR. Il testo è in genere leggibile, ma le tabelle numeriche e i simboli sono spesso corrotti. I valori numerici vanno quindi sempre verificati sull'immagine della pagina, non solo sul testo estratto.

## Letteratura secondaria
- Ciepluch, Davis, Gray, *Results of NASA's Energy Efficient Engine Program*, J. Propulsion and Power 3(6), 1987.
- Wehrel & Carvalho (DLR), *Cooling Model Calibration … Using the NASA E3 — Part I*, IGTC 2023 — [PDF](https://elib.dlr.de/219237/1/IGTC-2023-0059_Wehrel.pdf)
- Carvalho et al. (DLR), *… Part II: 1D Turbine Modeling*, IGTC 2023.

## Convenzioni
- Ogni valore in `ge-e3.json` porta il campo `src`, con l'ID del report più pagina, figura o tabella, oppure `"estimate"` accompagnato da una nota sul metodo di stima.
- Numerazione delle stazioni: SAE ARP755.
