"""Controlli di coerenza interna della specifica engines/ge-e3.json.

Ogni controllo ricalcola una grandezza da dati indipendenti del report
e la confronta con il valore dichiarato, entro una tolleranza esplicita.
"""
import json
from math import pi, sqrt
from pathlib import Path

spec = json.loads((Path(__file__).parent.parent / "engines" / "ge-e3.json").read_text(encoding="utf-8"))
mods = {m["id"]: m for m in spec["modules"]}
cyc = spec["cycle"]

# Atmosfera ISA a 10.67 km, max climb = ISA+10, M0.8
T_amb = 288.15 - 6.5 * 10.67 + 10
T2 = T_amb * (1 + 0.2 * 0.8**2)
P_amb = 101325 * ((288.15 - 6.5 * 10.67) / 288.15) ** 5.2559
P2 = P_amb * (1 + 0.2 * 0.8**2) ** 3.5

checks = []

def check(name, computed, reference, tol):
    err = abs(computed - reference) / abs(reference)
    checks.append((name, computed, reference, err, err <= tol))

hpt, lpt, hpc, fan = mods["hpt"], mods["lpt"], mods["hpc"], mods["fan"]

n_hp = hpt["N_over_sqrtT"]["v"] * sqrt(hpt["T41"]["v"]) * 60 / (2 * pi)
n_lp = lpt["N_over_sqrtT"]["v"] * sqrt(lpt["T49"]["v"]) * 60 / (2 * pi)
check("N_HP [rpm] SI vs unità imperiali (Tab.XVIII)", n_hp, 238.3 * sqrt(2730), 0.001)
check("N_LP [rpm] SI vs unità imperiali (Tab.XXI)", n_lp, 79.79 * sqrt(1901.4), 0.001)

u_tip_c = pi * spec["overall"]["fan_tip_diameter"]["v"] * n_lp / 60 / sqrt(T2 / 288.15)
check("U_tip corretta fan [m/s] da N_LP e D_fan vs 411.5", u_tip_c, fan["corrected_tip_speed_design"]["v"], 0.02)

fan_hub_pr = cyc["fan_hub_PR"]["max_climb"]
eta_hub = (fan_hub_pr ** (0.4 / 1.4) - 1) / (hpc["T25"]["v"] / T2 - 1)
check("eta fan hub da T25/T2 e PR vs Tab.XI", eta_hub, spec["component_performance_max_cruise"]["eta_fan_hub_booster"], 0.01)

check("P25/P2 vs fan hub PR (perdita condotto di transizione)", hpc["P25"]["v"] / P2, fan_hub_pr, 0.03)
check("OPR vs fan_hub_PR x HPC_PR (max climb)", fan_hub_pr * cyc["HPC_PR"]["max_climb"], cyc["OPR"]["max_climb"], 0.03)

w = spec["weights_kg"]
check("Somma pesi moduli vs totale motore base", sum(w[k]["subtotal"] for k in ("fan_booster", "lpt", "core", "misc")), w["basic_engine"], 0)
check("Peso base + installazione vs installato", w["basic_engine"] + w["installation"]["subtotal"], w["installed_engine"], 0)
check("Spinta decollo 39,000 lbf in kN", 39000 * 4.44822e-3, spec["overall"]["thrust_takeoff_final"]["v"], 0.001)

# --- Modulo fan (CR-165148 / CR-168070) ---
fanspec = json.loads((Path(__file__).parent.parent / "engines" / "ge-e3.fan.json").read_text(encoding="utf-8"))
dp, fp = fanspec["design_point"], fanspec["flowpath_stations"]
IN = 2.54

def transcription(row_id, rows, cols):
    """Doppia unità e camber = beta_LE - beta_TE: rileva errori di trascrizione riga per riga."""
    c = {k: i for i, k in enumerate(cols)}
    worst_unit = worst_camber = 0.0
    for r in rows:
        for cm, inch in (("ht_cm", "ht_in"), ("chord_cm", "chord_in"), ("R_cm", "R_in")):
            if cm in c and r[c[inch]] != 0:
                worst_unit = max(worst_unit, abs(r[c[cm]] / IN - r[c[inch]]))
        worst_camber = max(worst_camber, abs(r[c["camber"]] - (r[c["beta_LE"]] - r[c["beta_TE"]])))
    checks.append((f"{row_id}: max scarto cm/in [in]", worst_unit, 0.0, worst_unit, worst_unit <= 0.006))
    checks.append((f"{row_id}: max |camber - (bLE - bTE)| [deg]", worst_camber, 0.0, worst_camber, worst_camber <= 0.03))

for row in fanspec["blade_rows"]:
    if isinstance(row["sections"], dict):
        for t, rows in row["sections"].items():
            transcription(f"{row['id']} tipo {t}", rows, row["columns"])
    else:
        transcription(row["id"], row["sections"], row["columns"])
    sa = row.get("stacking_axis")
    if sa:
        err = max(abs(sa[k] / IN - sa[k + "_in"]) for k in ("R_OD", "R_ID", "Z"))
        checks.append((f"{row['id']}: asse di impilamento cm/in [in]", err, 0.0, err, err <= 0.002))

r_tip, r_hub = fp["R1_fan_rotor"]["tip_LE"][1] / 100, fp["R1_fan_rotor"]["hub_LE"][1] / 100
rpm_c = dp["inlet_corrected_rpm"]["v"]
check("U_tip corretta fan da App.A (R_tip LE, 3727.7 rpm) vs 411.5", 2 * pi * r_tip * rpm_c / 60, fan["corrected_tip_speed_design"]["v"], 0.01)
check("Rapporto raggi ingresso fan da App.A vs 0.342", r_hub / r_tip, fan["inlet_radius_ratio"]["v"], 0.01)
check("Portata specifica da App.A [kg/s m2] vs 208.9", dp["inlet_corrected_flow_kg_s"]["v"] / (pi * (r_tip**2 - r_hub**2)), fan["specific_flow"]["v"], 0.01)
check("Diametro fan da App.A vs 2.108 m (CR-165148)", 2 * r_tip, dp["fan_tip_diameter_rotor_inlet_m"]["v"], 0.003)
qs = next(r for r in fanspec["blade_rows"] if r["id"] == "R2_quarter_stage")["stacking_axis"]["Z"]
z_le, z_te = fp["R2_quarter_stage"]["tip_LE"][0], fp["R2_quarter_stage"]["hub_TE"][0]
checks.append(("Z impilamento quarter-stage (35.901) dentro LE-TE di App.A", qs, (z_le + z_te) / 2, 0.0, z_le < qs < z_te))
meas = fanspec["measured_performance_CR168070"]
check("U_tip corretta misurata a max climb (CR-168070) vs derivata da CR-168219", meas["corrected_tip_speed_ft_s"][0] * 0.3048, u_tip_c, 0.02)
check("BPR misurato a max climb vs progetto del fan (6.8)", meas["BPR"][0], dp["BPR_design"]["v"], 0.02)

# --- Compressore HP (CR-165558) ---
hpcspec = json.loads((Path(__file__).parent.parent / "engines" / "ge-e3.hpc.json").read_text(encoding="utf-8"))
worst_unit = worst_camber = worst_station = 0.0
nrows = 0
for row in hpcspec["blade_rows"]:
    c = {k: i for i, k in enumerate(row["columns"])}
    for r in row["sections"]:
        nrows += 1
        worst_unit = max(worst_unit, abs(r[c["R_cm"]] / IN - r[c["R_in"]]), abs(r[c["chord_cm"]] / IN - r[c["chord_in"]]))
        if "camber" in c:
            worst_camber = max(worst_camber, abs(r[c["camber"]] - (r[c["beta1"]] - r[c["beta2"]])))
    st = row["stations"]
    r_tip = (st["tip_LE"][1] + st["tip_TE"][1]) / 2
    r_hub = (st["hub_LE"][1] + st["hub_TE"][1]) / 2
    worst_station = max(worst_station, abs(row["sections"][0][c["R_cm"]] - r_tip), abs(row["sections"][-1][c["R_cm"]] - r_hub))
checks.append((f"HPC: max scarto cm/in su {nrows} sezioni [in]", worst_unit, 0.0, worst_unit, worst_unit <= 0.0015))
checks.append(("HPC: max |camber - (b1 - b2)| [deg]", worst_camber, 0.0, worst_camber, worst_camber <= 0.03))
checks.append(("HPC: raggio sezioni estreme vs media stazioni Tab.XXI [cm]", worst_station, 0.0, worst_station, worst_station <= 0.001))
tab = hpcspec["rotor_summary_TabX"]
counts = [r["count"] for r in hpcspec["blade_rows"] if r["type"] == "rotor"]
checks.append(("HPC: pale dei rotori Tab.XXII = Tab.X", float(counts == tab["blades"]), 1.0, 0.0, counts == tab["blades"]))
r1 = next(r for r in hpcspec["blade_rows"] if r["name"] == "R1")
check("HPC: raggio d'apice LE rotore 1, Tab.XXI vs Tab.X [cm]", r1["stations"]["tip_LE"][1], tab["radius_tip_LE_cm"][0], 0.001)
check("HPC: diametro d'ingresso stimato in CR-168219 vs Tab.XXI", hpc["inlet_tip_diameter"]["v"], 2 * r1["stations"]["tip_LE"][1] / 100, 0.02)

ok = True
for name, c, r, err, passed in checks:
    ok &= passed
    print(f"{'OK ' if passed else 'ERR'} {name}: calcolato {c:.4g}, riferimento {r:.4g}" + (f", scarto {err*100:.2f}%" if r else ""))
raise SystemExit(0 if ok else 1)
