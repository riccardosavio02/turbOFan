/**
 * Triangoli di velocità a metà altezza dei rotori (fan, compressore HP, turbine HP e LP).
 *
 * Grandezze per ogni rotore, all'ingresso (1) e all'uscita (2) al raggio di metà portata:
 *   U = ω·r (regime dell'albero);  Vz dalla continuità W = ρ·Vz·A, con ρ statica iterata dallo stato totale;
 *   compressore HP: Vθ1 dall'angolo di flusso all'uscita della schiera fissa precedente e raggi della linea
 *   di corrente 7 (Tab. XXI di CR-165558); fan: ingresso assiale. Vθ2 dal lavoro (Euler:
 *   Δh = U2·Vθ2 − U1·Vθ1, con Δh dal ciclo);
 *   turbina LP: angoli di flusso della Tab. II del report LPT (dato), solo i moduli delle velocità sono calcolati.
 * Angoli dall'asse; per i compressori β positivo contro il verso di rotazione, α nel verso di rotazione.
 */
import type { CycleResult } from './cycle'
import { rowStates } from './flowmap'
import { R_GAS, cp as cpOf, enthalpy } from './thermo'
import { fanRows, type BladeRowSpec } from '../data/fan'
import { hpcRows } from '../data/hpc'
import { hptRows, lptRows } from '../data/turbines'
import { interpolateSection } from '../geometry/blade'
import { fanOnMap, hpcOnMap } from './maps'
import { calibration } from './useCycle'
import { runCycle } from './cycle'
import spec from '../../engines/ge-e3.json'
import hpcSpec from '../../engines/ge-e3.hpc.json'
import turb from '../../engines/ge-e3.turbines.json'

const DEG = Math.PI / 180

export interface Velocities {
  U: number
  Vz: number
  Vt: number
  V: number
  Wrel: number
  alpha: number
  beta: number
  Mabs: number
  Mrel: number
  r: number
}

export interface RotorTriangles {
  id: string
  label: string
  rpm: number
  in: Velocities
  out: Velocities
  /** Angoli metallici della pala a metà altezza (fan, HPC) o angoli di flusso del report (LPT). */
  metal?: { beta1: number; beta2: number }
  incidence?: number
  deviation?: number
  deHaller: number
  /** Lavoro specifico di Eulero U1·Vθ1 − U2·Vθ2 (in valore assoluto) [J/kg]. */
  work: number
  /** Solo turbine: salto entalpico della schiera dal ciclo [J/kg], per il confronto con il lavoro di Eulero. */
  workCycle?: number
  kind: 'compressor' | 'turbine'
  source: string
  /** Solo turbina LP: angolo relativo d'ingresso ricalcolato vs Tab. II. */
  check?: { beta1Computed: number; beta1Table: number; swirlOutTable: number; alphaOutComputed: number }
}

/** Raggio a metà portata (media quadratica di mozzo e apice): la linea di corrente che divide l'area in due. */
const pitch = (a: number[], b: number[]) => Math.sqrt((a[1] ** 2 + b[1] ** 2) / 2)

/** Stato statico e velocità assiale a partire da totale, portata, area e componente tangenziale. */
function axialFromContinuity(W: number, A: number, Tt: number, Pt: number, Vt: number, far = 0) {
  const c = cpOf(Tt, far)
  const g = c / (c - R_GAS)
  let Vz = 150
  for (let k = 0; k < 60; k++) {
    const V2 = Vz * Vz + Vt * Vt
    const T = Tt - V2 / (2 * c)
    const P = Pt * (T / Tt) ** (g / (g - 1))
    const rho = P / (R_GAS * T)
    const next = W / (rho * A)
    if (Math.abs(next - Vz) < 1e-6) break
    Vz = 0.5 * Vz + 0.5 * next
  }
  const T = Tt - (Vz * Vz + Vt * Vt) / (2 * c)
  return { Vz, T, a: Math.sqrt(g * R_GAS * T) }
}

function make(U: number, Vz: number, Vt: number, a: number, r: number, turbine = false): Velocities {
  // Componente relativa: compressori Wθ = U − Vθ (contro la rotazione); turbine Wθ = Vθ − U.
  const Wt = turbine ? Vt - U : U - Vt
  const V = Math.hypot(Vz, Vt)
  const Wrel = Math.hypot(Vz, Wt)
  return { U, Vz, Vt, V, Wrel, alpha: Math.atan2(Vt, Vz) / DEG, beta: Math.atan2(Wt, Vz) / DEG, Mabs: V / a, Mrel: Wrel / a, r }
}

/** Regimi fisici degli alberi: progetto da CR-168219 (Tab. XVIII, XXI), fuori progetto in proporzione alla velocità corretta letta sulle mappe. */
export function shaftSpeeds(out: CycleResult) {
  const cal = calibration()
  const des = designRun()
  const fan = fanOnMap(out.input.W2c, out.input.prFanBypass, cal.fanRef)
  const fan0 = fanOnMap(des.input.W2c, des.input.prFanBypass, cal.fanRef)
  const hpc = hpcOnMap(out.derived.W25c, out.input.prHpc, cal.hpcRef)
  const hpc0 = hpcOnMap(des.derived.W25c, des.input.prHpc, cal.hpcRef)
  const nLP = spec.speeds.N_LP_max_climb.v * (fan.speedPct / fan0.speedPct) * Math.sqrt(out.stations['2'].T / des.stations['2'].T)
  const nHP = spec.speeds.N_HP_max_climb.v * (hpc.speedPct / hpc0.speedPct) * Math.sqrt(out.stations['25'].T / des.stations['25'].T)
  return { nLP, nHP }
}
let des: CycleResult | null = null
const designRun = () => (des ??= runCycle(calibration().base))

function metalAt(row: BladeRowSpec, which: 'beta1' | 'beta2'): number | undefined {
  const raw = (hpcSpec.blade_rows as { id: string; columns: string[]; sections: number[][] }[]).find((r) => r.id === row.id)
  if (!raw || !raw.columns.includes(which)) return undefined
  const c = raw.columns.indexOf(which)
  const R = raw.columns.indexOf('R_cm')
  const s = [...raw.sections].sort((a, b) => a[R] - b[R])
  const sl = (hpcSpec.vector_diagrams_SL7.rotors as Record<string, { in: number[] }>)[row.id.replace('HPC_', '')]
  const rm = sl ? sl.in[0] : pitch(row.quad.hubLE, row.quad.tipLE) * 100
  const i = Math.max(1, s.findIndex((q) => q[R] >= rm))
  const w = (rm - s[i - 1][R]) / (s[i][R] - s[i - 1][R])
  return s[i - 1][c] + (s[i][c] - s[i - 1][c]) * w
}

function compressorRotor(
  row: BladeRowSpec,
  st: { T1: number; P1: number; T2: number; P2: number },
  W: number,
  rpm: number,
  alpha1: number,
  metal?: { beta1: number; beta2: number },
  radii?: [number, number],
): RotorTriangles {
  const q = row.quad
  const omega = (rpm * 2 * Math.PI) / 60
  const r1 = radii?.[0] ?? pitch(q.hubLE, q.tipLE)
  const r2 = radii?.[1] ?? pitch(q.hubTE, q.tipTE)
  const A1 = Math.PI * (q.tipLE[1] ** 2 - q.hubLE[1] ** 2)
  const A2 = Math.PI * (q.tipTE[1] ** 2 - q.hubTE[1] ** 2)
  const U1 = omega * r1
  const U2 = omega * r2
  const work = enthalpy(st.T2) - enthalpy(st.T1)
  // Ingresso: Vθ1 = Vz·tan α1, iterato con la continuità.
  let Vt1 = 0
  let s1 = axialFromContinuity(W, A1, st.T1, st.P1, 0)
  for (let k = 0; k < 20; k++) {
    Vt1 = s1.Vz * Math.tan(alpha1 * DEG)
    s1 = axialFromContinuity(W, A1, st.T1, st.P1, Vt1)
  }
  const Vt2 = (work + U1 * Vt1) / U2
  const s2 = axialFromContinuity(W, A2, st.T2, st.P2, Vt2)
  const tin = make(U1, s1.Vz, Vt1, s1.a, r1)
  const tout = make(U2, s2.Vz, Vt2, s2.a, r2)
  return {
    id: row.id,
    label: row.label,
    rpm,
    in: tin,
    out: tout,
    metal,
    incidence: metal ? tin.beta - metal.beta1 : undefined,
    deviation: metal ? tout.beta - metal.beta2 : undefined,
    deHaller: tout.Wrel / tin.Wrel,
    work,
    kind: 'compressor',
    source: '',
  }
}

/** Triangoli di tutti i rotori disponibili per un risultato del ciclo. */
export function rotorTriangles(out: CycleResult): Map<string, RotorTriangles> {
  const res = new Map<string, RotorTriangles>()
  const states = rowStates(out)
  const { nLP, nHP } = shaftSpeeds(out)
  const s = out.stations

  // Fan, metà altezza: lato bypass (portata totale nel rotore), ingresso assiale.
  const fan = fanRows.find((r) => r.id === 'R1_fan_rotor')!
  const fs = interpolateSection(fan.sections, 0.5)
  void fs
  const fanMetal = { beta1: fanMid('beta_LE'), beta2: fanMid('beta_TE') }
  const tf = compressorRotor(fan, { T1: s['2'].T, P1: s['2'].P, T2: s['13'].T, P2: s['13'].P }, s['2'].W, nLP, 0, fanMetal)
  tf.source = 'Angoli metallici a metà altezza: CR-165148 App. B. Lavoro dal ciclo (corrente di bypass), ingresso assiale.'
  res.set(fan.id, tf)

  // Compressore HP: rotori 1–10.
  const Wc = s['25'].W
  // Angolo d'ingresso di ogni rotore: angolo di flusso all'uscita della schiera fissa precedente
  // (IGV o statore), linea di corrente 7 della Tab. XXI di CR-165558.
  const alphaExit = hpcSpec.vector_diagrams_SL7.stator_exit_alpha as unknown as Record<string, number>
  let alpha1 = alphaExit.IGV
  for (const r of hpcRows) {
    if (r.kind === 'stator') {
      const a = alphaExit[r.id.replace('HPC_', '')]
      if (a !== undefined) alpha1 = a
      continue
    }
    const b1 = metalAt(r, 'beta1')
    const b2 = metalAt(r, 'beta2')
    // Raggi della linea di corrente 7 della Tab. XXI (circa metà portata): dato del report.
    const sl = hpcSpec.vector_diagrams_SL7.rotors[r.id.replace('HPC_', '') as keyof typeof hpcSpec.vector_diagrams_SL7.rotors]
    const t = compressorRotor(
      r,
      states.get(r.id)!,
      Wc,
      nHP,
      alpha1,
      b1 !== undefined && b2 !== undefined ? { beta1: b1, beta2: b2 } : undefined,
      [sl.in[0] / 100, sl.out[0] / 100],
    )
    t.source =
      (r.id === 'HPC_R1'
        ? "Angolo d'ingresso: uscita dell'IGV, CR-165558 Tab. XXI. "
        : "Angolo d'ingresso: angolo di flusso all'uscita dello statore precedente, CR-165558 Tab. XXI. ") +
      'Angoli metallici del rotore: CR-165558 Tab. XXII. Lavoro dal ciclo, ripartito tra gli stadi secondo la Tab. XXI.'
    res.set(r.id, t)
  }

  /**
   * Rotore di turbina: angolo assoluto d'ingresso (uscita del distributore) e angolo relativo d'uscita sono
   * dati del report; le velocità assiali vengono dalla continuità e U dal regime dell'albero.
   */
  function turbineRotor(r: BladeRowSpec, rpm: number, W: number, far: number, alphaIn: number, beta2: number, beta1Ref: number, source: string) {
    const st = states.get(r.id)!
    const q = r.quad
    const omega = (rpm * 2 * Math.PI) / 60
    const r1 = pitch(q.hubLE, q.tipLE)
    const r2 = pitch(q.hubTE, q.tipTE)
    const A1 = Math.PI * (q.tipLE[1] ** 2 - q.hubLE[1] ** 2)
    const A2 = Math.PI * (q.tipTE[1] ** 2 - q.hubTE[1] ** 2)
    let s1 = axialFromContinuity(W, A1, st.T1, st.P1, 0, far)
    let Vt1 = 0
    for (let j = 0; j < 20; j++) {
      Vt1 = s1.Vz * Math.tan(alphaIn * DEG)
      s1 = axialFromContinuity(W, A1, st.T1, st.P1, Vt1, far)
    }
    const U1 = omega * r1
    const U2 = omega * r2
    // Uscita: angolo relativo → Vθ2 = U2 − Vz·tan β2 (β2 positivo contro la rotazione).
    let s2 = axialFromContinuity(W, A2, st.T2, st.P2, 0, far)
    let Vt2 = 0
    for (let j = 0; j < 20; j++) {
      Vt2 = U2 - s2.Vz * Math.tan(beta2 * DEG)
      s2 = axialFromContinuity(W, A2, st.T2, st.P2, Vt2, far)
    }
    const tin = make(U1, s1.Vz, Vt1, s1.a, r1, true)
    const tout = make(U2, s2.Vz, Vt2, s2.a, r2, true)
    return {
      id: r.id,
      label: r.label,
      rpm,
      in: tin,
      out: tout,
      metal: { beta1: beta1Ref, beta2 },
      deHaller: tout.Wrel / tin.Wrel,
      work: U1 * Vt1 - U2 * Vt2,
      workCycle: enthalpy(st.T1, far) - enthalpy(st.T2, far),
      kind: 'turbine' as const,
      source,
    }
  }

  // Turbina HP: angoli di flusso letti sulla Fig. 5 di CR-167955 (letture approssimate, vedi JSON).
  const hptAng = Object.fromEntries(
    (turb.hpt.blade_rows as { name: string; angles: number[][] }[]).map((b) => [b.name, b.angles.find((a) => a[0] === 0.5)!]),
  )
  const hptSrc =
    "Angoli di flusso a metà altezza: CR-167955 Fig. 5 (letture approssimate dal grafico; per il rotore 2 il segno dell'angolo d'ingresso è incerto). Velocità assiali dalla continuità, U dal regime HP."
  const hr = hptRows.filter((x) => x.kind === 'rotor')
  res.set(hr[0].id, turbineRotor(hr[0], nHP, s['41'].W, s['41'].far, hptAng.S1[2], hptAng.R1[2], hptAng.R1[1], hptSrc))
  res.set(hr[1].id, turbineRotor(hr[1], nHP, s['41'].W, s['41'].far, hptAng.S2[2], hptAng.R2[2], hptAng.R2[1], hptSrc))

  // Turbina LP: angoli di flusso della Tab. II (dato).
  const tab = turb.lpt.table2 as Record<string, { a: number[]; b1: number[]; b2: number[]; sw: number[] }>
  for (const r of lptRows.filter((x) => x.kind === 'rotor')) {
    const t2 = tab[r.id.replace('LPT_R', '')]
    const t = turbineRotor(
      r,
      nLP,
      s['49'].W,
      s['49'].far,
      t2.a[1],
      t2.b2[1],
      t2.b1[1],
      'Angoli di flusso a metà altezza: report LPT Tab. II (dato). Velocità assiali dalla continuità, U dal regime LP.',
    )
    res.set(r.id, { ...t, check: { beta1Computed: t.in.beta, beta1Table: t2.b1[1], swirlOutTable: t2.sw[1], alphaOutComputed: -t.out.alpha } })
  }
  return res

  function fanMid(col: 'beta_LE' | 'beta_TE') {
    const raw = (fanSpecRows() as { id: string; columns: string[]; sections: number[][] }[]).find((x) => x.id === 'R1_fan_rotor')!
    const c = raw.columns.indexOf(col)
    const p = raw.columns.indexOf('pct_ht')
    const a = raw.sections.find((x) => x[p] === 50)!
    return a[c]
  }
}

import fanSpec from '../../engines/ge-e3.fan.json'
const fanSpecRows = () => fanSpec.blade_rows
