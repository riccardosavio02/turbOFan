"""Verifica delle citazioni dei contenuti didattici contro il testo dei report NASA.

Ogni affermazione dei testi (src/content/*.json) porta una o più citazioni: documento, pagina del
report e frase originale in inglese. Lo script:
  1. estrae (una volta) il testo di ogni PDF in refs/text/ con pdftotext;
  2. normalizza testo e citazione (minuscole, solo lettere e cifre: l'OCR dei report anni '80
     spezza o incolla le parole, quindi gli spazi non contano);
  3. cerca la citazione nella pagina dichiarata (±2 pagine); se l'OCR ha errori usa un confronto
     approssimato (SequenceMatcher) e richiede una somiglianza >= 0,90;
  4. segnala citazioni assenti, pagine sbagliate e somiglianze basse.

Uso:
  python scripts/verify_claims.py                 verifica tutto
  python scripts/verify_claims.py find DOC "frase" cerca una frase e stampa la pagina del report
"""
import json
import re
import subprocess
import sys
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REFS = ROOT / "refs"
CACHE = REFS / "text"

# Documento → (file PDF, scostamento pagina PDF − pagina stampata del report)
DOCS = {
    "CR-168219": ("CR-168219_FPS_final_design__19900019242.pdf", 14),
    "CR-165148": ("CR-165148_fan_detailed_design__19830008070.pdf", 10),
    "CR-168070": ("CR-168070_fan_performance__19850025828.pdf", 10),
    "CR-165558": ("CR-165558_HPC_detail_design__19850002690.pdf", 9),
    "CR-167955": ("CR-167955_HPT_detailed_design__19850002687.pdf", 9),
    "LPT": ("LPT_detailed_design__19850002686.pdf", 13),
    "CR-169301": ("CR-169301_combustor_design__19900019238.pdf", 15),
    "CR-168069": ("CR-168069_core_design_performance__19900019243.pdf", 26),
    "CR-159584": ("CR-159584_aircraft_integration__19810013521.pdf", 11),
}

norm = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())


def pages(doc: str) -> list[str]:
    pdf, _ = DOCS[doc]
    CACHE.mkdir(parents=True, exist_ok=True)
    txt = CACHE / (Path(pdf).stem + ".txt")
    if not txt.exists():
        subprocess.run(["pdftotext", "-layout", str(REFS / pdf), str(txt)], check=True, capture_output=True)
    return [norm(p) for p in txt.read_text(encoding="utf-8", errors="replace").split("\f")]


def best_match(hay: str, needle: str) -> float:
    """Somiglianza massima della citazione con una finestra del testo della stessa lunghezza."""
    if needle in hay:
        return 1.0
    n = len(needle)
    sm = SequenceMatcher(autojunk=False)
    sm.set_seq2(needle)
    best = 0.0
    step = max(1, n // 8)
    for i in range(0, max(1, len(hay) - n + 1), step):
        sm.set_seq1(hay[i : i + n])
        if sm.real_quick_ratio() <= best or sm.quick_ratio() <= best:
            continue
        best = max(best, sm.ratio())
    return best


def locate(doc: str, quote: str):
    """Pagina PDF con la miglior corrispondenza e il suo punteggio."""
    q = norm(quote)
    best = (0.0, -1)
    for i, p in enumerate(pages(doc)):
        if q in p:
            return 1.0, i + 1
    for i, p in enumerate(pages(doc)):
        s = best_match(p, q)
        if s > best[0]:
            best = (s, i + 1)
    return best


def check(cite: dict):
    doc, quote = cite["doc"], cite["quote"]
    if doc not in DOCS:
        return "ERR", f"documento sconosciuto {doc}"
    page = cite.get("page")
    # Le pagine in numeri romani (frontespizio, abstract) si citano con il numero di pagina del PDF.
    pdf_page = cite["pdfPage"] if "pdfPage" in cite else page + DOCS[doc][1]
    p = pages(doc)
    window = range(max(1, pdf_page - 2), min(len(p), pdf_page + 2) + 1)
    q = norm(quote)
    if len(q) < 25:
        return "ERR", "citazione troppo corta per essere verificabile (< 25 caratteri)"
    exact = [w for w in window if q in p[w - 1]]
    if exact:
        return "OK", f"esatta a pag. PDF {exact[0]}"
    score = max(best_match(p[w - 1], q) for w in window)
    if score >= 0.9:
        return "OK~", f"approssimata ({score:.2f}) entro pag. PDF {window.start}-{window.stop - 1}"
    s, where = locate(doc, quote)
    if s >= 0.9:
        return "PAGE", f"trovata ({s:.2f}) a pag. PDF {where} = pag. report {where - DOCS[doc][1]}, non {page}"
    return "ERR", f"non trovata (miglior somiglianza {s:.2f} a pag. PDF {where})"


def main():
    if len(sys.argv) >= 4 and sys.argv[1] == "find":
        doc, quote = sys.argv[2], sys.argv[3]
        s, where = locate(doc, quote)
        print(f"{doc}: somiglianza {s:.2f} a pag. PDF {where} = pag. report {where - DOCS[doc][1]}")
        return 0
    files = [ROOT / "src" / "content" / "story.json"]  # components.json riusa queste citazioni
    total = bad = 0
    for f in files:
        data = json.loads(f.read_text(encoding="utf-8"))
        for key, cite in data.get("citations", {}).items():
            total += 1
            status, msg = check(cite)
            if status not in ("OK", "OK~"):
                bad += 1
            where = f"p.{cite['page']}" if "page" in cite else f"pdf {cite['pdfPage']}"
            if "visual" in cite and status in ("OK", "OK~"):
                msg += " + valore di tabella verificato sull'immagine: " + cite["visual"]
            print(f"{status:4} {f.name}:{key:24} {cite['doc']} {where:<7} {msg}")
    print(f"\n{total} citazioni verificate, {bad} problemi")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
