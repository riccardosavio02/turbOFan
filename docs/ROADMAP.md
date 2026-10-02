# Proposte di miglioramento

Ordinate per valore didattico e scientifico rispetto allo sforzo. **[dati]** = i dati sono già nei report scaricati; **[nuovo]** = servono fonti nuove.

## A. Fedeltà del modello termodinamico
1. ✅ **Mappe dei componenti** (fatto: mappa del fan e del compressore HP nel modello fuori progetto; resta da estenderle a minimo e avviamento) [dati]: la mappa del bypass del fan è in CR-168070 («Fan Bypass Component Performance Map»), quelle del compressore HP in CR-168069 («HP Compressor Performance Map», «Front Block» e «Rear Block Performance Map»). Sostituirebbero le ipotesi di turbine strozzate e rendimenti costanti, ed estenderebbero il fuori progetto a minimo, avviamento e transitori, con la linea di funzionamento e il margine di stallo disegnati sulla mappa.
2. **Calettamento degli statori variabili** [dati]: la legge di calettamento in funzione del regime è in CR-168069 («Comparison of Compressor Stator Schedule») e servirebbe per i bassi regimi.
3. **Raffreddamenti dettagliati** [dati]: le portate della HPT sono in CR-167955 (tabella «Cooling and Leakage Flows») e, misurate, in CR-168069 («HP Turbine Cooling Flows, Temperatures, and Pressures»). Servirebbero per modellare il rientro dei raffreddamenti schiera per schiera e ridurre lo scarto del 3% sul lavoro della LPT.
4. **Prestazioni installate e missione** [dati]: resistenza della gondola, spillamenti cliente ed estrazione di potenza (CR-159584, CR-168219). Darebbero il consumo installato (−16,9% sul CF6-50C) e un profilo di missione con il consumo di combustibile.

## B. Fedeltà della geometria
5. **Profili alari reali** [dati parziali]: famiglie DCA/MCA per le schiere transoniche e NACA 65 con la vera legge di spessore per le subsoniche; la posizione dello spessore massimo e lo spessore del bordo d'uscita sono già nelle tabelle HPC. Servirebbe anche l'impilamento vero (asse di impilamento delle tabelle del fan e lean delle OGV).
6. **Pale delle turbine dalle sezioni disegnate** [dati]: le figure «Airfoil Shapes and Velocity Distributions» di CR-167955 e le sezioni dei profili del report LPT, digitalizzate al posto della costruzione dagli angoli di flusso.
7. **Dischi e alberi dai disegni** [dati]: sezioni dei rotori HPT (CR-167955, figure dei singoli dischi), LPT (Fig. 6 del report LPT, già usata per i numeri di pale) e del compressore (CR-165558, «Rotor Design Features») al posto dei profili stimati.
8. **Report delle prestazioni HPT** [dati, scansione senza testo]: lettura con OCR per le prestazioni misurate al banco della turbina.

## C. Didattica
9. ✅ **Triangoli di velocità interattivi** (fatto per fan, compressore HP e turbina LP; turbina HP da aggiungere) [dati]: per ogni schiera e altezza, dalle tabelle già estratte (fan App. A, HPC Tab. XXI, LPT Tab. II). Un clic su una pala mostra triangoli d'ingresso e d'uscita, angoli metallici, incidenza e deviazione. È il complemento naturale del modello 3D.
10. **Particelle lungo il condotto**: animazione di particelle di core e bypass con velocità e colore dal ciclo, per «seguire una particella d'aria».
11. **Vista esplosa** dei moduli lungo l'asse.
12. **Confronto con il CF6-50C** [nuovo]: il motore di riferimento del programma, per mostrare da dove viene il 16,9%.
13. **Versione inglese**, con citazioni originali già in inglese.
14. **Domande di verifica** a fine capitolo, per uso in aula.

## D. Qualità del sito e pubblicazione
15. **Prestazioni grafiche**: livelli di dettaglio per distanza e unione delle schiere statiche. Oggi ci sono circa 3,4 milioni di triangoli, fluidi su una scheda grafica ma pesanti su smartphone di fascia bassa.
16. **Integrazione continua su GitHub** (Actions): test, controlli sui dati e verifica delle citazioni a ogni modifica; i PDF si scaricano da NTRS durante il controllo. Pubblicazione automatica su GitHub Pages.
17. **Accessibilità**: navigazione da tastiera nel menu e testi alternativi per il 3D; per chi preferisce meno animazioni, voli della camera ridotti (prefers-reduced-motion).
18. **Revisione esterna**: invito a docenti o studenti a segnalare errori tramite le «issue» di GitHub, con un modello di segnalazione che chiede la fonte.

## E. Estensioni
19. **Secondo motore: P&W E³**, il gemello del programma, con report analoghi su NTRS, per un confronto tra due scuole di progetto.
20. **Rapporto di prova dell'ICLS** [nuovo]: le prestazioni del dimostratore completo, se reperibili su NTRS, per validare il motore intero e non solo il core.
