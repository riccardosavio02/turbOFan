/**
 * Mappa del flusso sul piano di taglio: per ogni condotto (core, bypass, getto miscelato) una sequenza di
 * punti (Z, raggio di mozzo, raggio d'apice, T totale, P totale) dall'ingresso all'ugello.
 *
 * T e P alle stazioni vengono dal modello di ciclo; all'interno dei moduli sono distribuite schiera per
 * schiera: fan e booster 60/40 del lavoro, compressore HP con la ripartizione della Tab. XXI di CR-165558, turbina HP 56,5% di
 * lavoro al primo stadio (CR-168219 p.71), turbina LP con Δh e rapporti di pressione per stadio della
 * Tab. II del report LPT. I raggi sono quelli delle schiere; nei condotti tra i moduli sono stime.
 */
import type { CycleResult } from './cycle'
import { fanRows, type BladeRowSpec } from '../data/fan'
import { hpcRows } from '../data/hpc'
import { hptRows, lptRows } from '../data/turbines'
import { MIXER, NAC } from '../data/flowpath'
import turb from '../../engines/ge-e3.turbines.json'
import comb from '../../engines/ge-e3.combustor.json'
import hpcSpec from '../../engines/ge-e3.hpc.json'
import { enthalpy, tempFromEnthalpy } from './thermo'

export interface FlowPoint {
  z: number
  rh: number
  rt: number
  T: number
  P: number
}

const CM = 0.01
const row = (rows: BladeRowSpec[], id: string) => rows.find((r) => r.id === id)!
const lerp = (a: number, b: number, w: number) => a + (b - a) * w
/** Interpolazione logaritmica per la pressione (rapporti di pressione costanti per tratto). */
const lerpLog = (a: number, b: number, w: number) => a * (b / a) ** w

/** Raggio di una polilinea [cm] alla quota z [m]. */
function radiusAt(pts: number[][], z: number): number {
  const zc = z / CM
  for (let i = 1; i < pts.length; i++)
    if (zc <= pts[i][0]) return lerp(pts[i - 1][1], pts[i][1], (zc - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0])) * CM
  return pts.at(-1)![1] * CM
}

const NACELLE_INNER = [
  [160, 102.4],
  [250, 100.0],
  [330, 94.5],
  [400, 86.5],
  [NAC.exit, NAC.nozzleR],
]
const CORE_COWL_OUTER = [
  [118, 63.6],
  [160, 62.6],
  [230, 62.0],
  [280, 64.5],
  [MIXER.z0, MIXER.r0],
]

/** Punti di bordo d'attacco e d'uscita di una schiera con T e P assegnati. */
/** Stato totale a monte e a valle di ogni schiera, registrato durante flowPaths (per i triangoli di velocità). */
export interface RowState {
  T1: number
  P1: number
  T2: number
  P2: number
}
let registry: Map<string, RowState> | null = null

function rowPoints(r: BladeRowSpec, T0: number, P0: number, T1: number, P1: number): FlowPoint[] {
  registry?.set(r.id, { T1: T0, P1: P0, T2: T1, P2: P1 })
  const q = r.quad
  return [
    { z: (q.hubLE[0] + q.tipLE[0]) / 2, rh: q.hubLE[1], rt: q.tipLE[1], T: T0, P: P0 },
    { z: (q.hubTE[0] + q.tipTE[0]) / 2, rh: q.hubTE[1], rt: q.tipTE[1], T: T1, P: P1 },
  ]
}

/** Stati delle schiere del flusso primario per un risultato del ciclo. */
export function rowStates(out: CycleResult): Map<string, RowState> {
  registry = new Map()
  flowPaths(out)
  const r = registry
  registry = null
  return r
}

export function flowPaths(out: CycleResult): { core: FlowPoint[]; bypass: FlowPoint[]; mixed: FlowPoint[] } {
  const s = out.stations
  const core: FlowPoint[] = []

  // Fan (mozzo) e booster: 60% del lavoro al rotore fan, 40% al quarter-stage.
  const T2 = s['2'].T
  const P2 = s['2'].P
  const Tm = lerp(T2, s['23'].T, 0.6)
  const Pm = lerpLog(P2, s['23'].P, 0.6)
  const island = row(fanRows, 'S1_booster_vane').quad.tipLE[1]
  const r1 = row(fanRows, 'R1_fan_rotor').quad
  core.push({ z: r1.hubLE[0], rh: r1.hubLE[1], rt: island, T: T2, P: P2 }, { z: r1.hubTE[0], rh: r1.hubTE[1], rt: island, T: Tm, P: Pm })
  core.push(...rowPoints(row(fanRows, 'S1_booster_vane'), Tm, Pm, Tm, Pm))
  core.push(...rowPoints(row(fanRows, 'R2_quarter_stage'), Tm, Pm, s['23'].T, s['23'].P))
  core.push(...rowPoints(row(fanRows, 'S2IN_core_ogv'), s['23'].T, s['23'].P, s['23'].T, s['23'].P))

  // Condotto a collo d'oca fino all'IGV (raggi stimati, vedi flowpath.ts).
  for (const [zc, rh, rt, w] of [
    [70, 41.5, 47.5, 0.3],
    [82, 31.5, 41.0, 0.7],
  ])
    core.push({ z: zc * CM, rh: rh * CM, rt: rt * CM, T: s['25'].T, P: lerpLog(s['23'].P, s['25'].P, w) })

  // Compressore HP: ripartizione di lavoro e di pressione tra gli stadi dalla Tab. XXI di CR-165558
  // (linea di corrente 7, progetto), normalizzata sui valori totali del ciclo. Gli statori portano la
  // pressione dall'uscita di un rotore all'ingresso del successivo (perdita dello statore).
  const sl7 = hpcSpec.vector_diagrams_SL7.rotors as Record<string, { in: number[]; out: number[] }>
  const T25ref = (hpcSpec.vector_diagrams_SL7 as unknown as { T25_ref?: number }).T25_ref ?? 304.8
  const hRef = (tt: number) => enthalpy(T25ref * tt) - enthalpy(T25ref)
  const r10out = sl7.R10.out
  const fracH = (tt: number) => hRef(tt) / hRef(r10out[2])
  const fracP = (pt: number) => Math.log(pt) / Math.log(r10out[1])
  const h25 = enthalpy(s['25'].T)
  const dhHpc = enthalpy(s['3'].T) - h25
  const lnPr = Math.log(s['3'].P / s['25'].P)
  const at = (v: number[]) => ({
    T: tempFromEnthalpy(h25 + fracH(v[2]) * dhHpc, 0, s['25'].T),
    P: s['25'].P * Math.exp(Math.max(0, fracP(v[1])) * lnPr),
  })
  let prev = { T: s['25'].T, P: s['25'].P }
  for (let i = 0; i < hpcRows.length; i++) {
    const r = hpcRows[i]
    if (r.kind === 'rotor') {
      const d = sl7[r.id.replace('HPC_', '')]
      const a = at(d.in)
      const b = at(d.out)
      core.push(...rowPoints(r, a.T, a.P, b.T, b.P))
      prev = b
    } else {
      const next = hpcRows.slice(i + 1).find((x) => x.kind === 'rotor')
      const b = next ? at(sl7[next.id.replace('HPC_', '')].in) : { T: s['3'].T, P: s['3'].P }
      core.push(...rowPoints(r, prev.T, prev.P, b.T, b.P))
      prev = b
    }
  }
  let T = prev.T
  let P = prev.P

  // Prediffusore e combustore: T sale dalla cupola fino all'ingresso della turbina.
  const pd = comb.prediffuser_Fig90.rows
  const zS10 = hpcRows.at(-1)!.quad.tipTE[0]
  const last = pd.find((r) => r[4] !== null && r[0] === 6.084)!
  core.push({ z: zS10 + (last[0] as number) * CM, rh: (pd[17][1] as number) * CM, rt: (last[4] as number) * CM, T: s['3'].T, P: s['3'].P })
  const outer = comb.geometry.outer_liner
  const inner = comb.geometry.inner_liner
  const zDome = comb.geometry.pilot_dome_face[0][0] * CM
  core.push({ z: zDome, rh: inner[0][1] * CM, rt: outer[0][1] * CM, T: s['3'].T, P: s['3'].P })
  const zHpt = hptRows[0].quad.tipLE[0]
  for (const w of [0.25, 0.5, 0.75]) {
    const z = lerp(zDome, zHpt, w)
    core.push({
      z,
      rh: radiusAt(inner, z),
      rt: radiusAt(outer, z),
      T: lerp(s['3'].T, s['4'].T, Math.min(1, w * 1.6)),
      P: lerpLog(s['3'].P, s['4'].P, w),
    })
  }

  // Turbina HP: 56,5% del lavoro al primo stadio.
  const [hs1, hr1, hs2, hr2] = hptRows
  const far41 = s['41'].far
  const h41 = enthalpy(s['41'].T, far41)
  const T42a = tempFromEnthalpy(lerp(h41, enthalpy(s['42'].T, far41), 0.565), far41, s['41'].T)
  const P42a = lerpLog(s['41'].P, s['42'].P, 0.52)
  core.push(...rowPoints(hs1, s['41'].T, s['41'].P, s['41'].T, s['41'].P))
  core.push(...rowPoints(hr1, s['41'].T, s['41'].P, T42a, P42a))
  core.push(...rowPoints(hs2, T42a, P42a, T42a, P42a))
  core.push(...rowPoints(hr2, T42a, P42a, s['42'].T, s['42'].P))

  // Turbina LP: Δh e rapporti di pressione per stadio dalla Tab. II (normalizzati sul totale del ciclo).
  const tab = turb.lpt.table2_stage
  const dhTot = tab.dh_btu_lbm.reduce((a, b) => a + b, 0)
  const lnPrTot = tab.PR.reduce((a, b) => a + Math.log(b), 0)
  const far49 = s['49'].far
  const h49 = enthalpy(s['49'].T, far49)
  const dh = h49 - enthalpy(s['5'].T, far49)
  const lnP = Math.log(s['49'].P / s['5'].P)
  let accH = 0
  let accP = 0
  T = s['49'].T
  P = s['49'].P
  for (const r of lptRows) {
    if (r.kind === 'rotor') {
      const k = Number(r.id.replace('LPT_R', '')) - 1
      accH += tab.dh_btu_lbm[k] / dhTot
      accP += Math.log(tab.PR[k]) / lnPrTot
      const T1 = tempFromEnthalpy(h49 - accH * dh, far49, T)
      const P1 = s['49'].P * Math.exp(-accP * lnP)
      core.push(...rowPoints(r, T, P, T1, P1))
      T = T1
      P = P1
    } else core.push(...rowPoints(r, T, P, T, P))
  }
  const zMixEnd = (MIXER.z0 + MIXER.length) * CM
  core.push({ z: MIXER.z0 * CM, rh: 0.338, rt: MIXER.r0 * CM - 0.01, T: s['56'].T, P: s['56'].P })
  core.push({ z: zMixEnd, rh: 0.3, rt: MIXER.rMean * CM, T: s['56'].T, P: s['56'].P })

  // Bypass: sopra l'isola, attraverso il fan e le OGV, fino al mixer.
  const ogv = row(fanRows, 'OGV_bypass_III').quad
  const islandTop = 0.7
  const bypass: FlowPoint[] = [
    { z: r1.tipLE[0], rh: islandTop, rt: r1.tipLE[1], T: T2, P: P2 },
    { z: r1.tipTE[0], rh: islandTop, rt: r1.tipTE[1], T: s['13'].T, P: s['13'].P },
    { z: ogv.hubLE[0], rh: ogv.hubLE[1], rt: ogv.tipLE[1], T: s['13'].T, P: s['13'].P },
    { z: ogv.hubTE[0], rh: ogv.hubTE[1], rt: ogv.tipTE[1], T: s['13'].T, P: s['13'].P },
  ]
  for (const zc of [160, 230, 280, MIXER.z0]) {
    const z = zc * CM
    const w = (zc - 100) / (MIXER.z0 - 100)
    bypass.push({ z, rh: radiusAt(CORE_COWL_OUTER, z), rt: radiusAt(NACELLE_INNER, z), T: s['13'].T, P: lerpLog(s['13'].P, s['16'].P, w) })
  }
  bypass.push({ z: zMixEnd, rh: MIXER.rMean * CM, rt: radiusAt(NACELLE_INNER, zMixEnd), T: s['16'].T, P: s['16'].P })

  // Getto miscelato fino all'uscita dell'ugello.
  const centerbody = [
    [MIXER.z0 + MIXER.length, 30.0],
    [370, 27.0],
    [405, 15.5],
    [428, 5.0],
    [NAC.exit, 4.0],
  ]
  const mixed: FlowPoint[] = [zMixEnd, 3.9, 4.15, NAC.exit * CM].map((z) => ({
    z,
    rh: radiusAt(centerbody, z),
    rt: radiusAt(NACELLE_INNER, z),
    T: s['7'].T,
    P: s['7'].P,
  }))
  return { core, bypass, mixed }
}

/** Scale di colore: temperatura lineare (nero → rosso → giallo → bianco), pressione logaritmica (blu → verde → giallo). */
const HEAT = [
  [0, [0.05, 0.03, 0.12]],
  [0.25, [0.35, 0.05, 0.45]],
  [0.5, [0.85, 0.2, 0.25]],
  [0.75, [0.98, 0.6, 0.1]],
  [1, [1, 0.97, 0.75]],
] as const
const PRESS = [
  [0, [0.15, 0.1, 0.45]],
  [0.35, [0.12, 0.42, 0.62]],
  [0.65, [0.2, 0.7, 0.45]],
  [1, [0.98, 0.9, 0.15]],
] as const

function ramp(stops: readonly (readonly [number, readonly number[]])[], x: number): [number, number, number] {
  const v = Math.min(1, Math.max(0, x))
  for (let i = 1; i < stops.length; i++)
    if (v <= stops[i][0]) {
      const w = (v - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0])
      const a = stops[i - 1][1]
      const b = stops[i][1]
      return [lerp(a[0], b[0], w), lerp(a[1], b[1], w), lerp(a[2], b[2], w)]
    }
  return [...stops.at(-1)![1]] as [number, number, number]
}

export const SCALES = {
  T: { min: 200, max: 1700, unit: 'K', label: 'Temperatura totale', color: (T: number) => ramp(HEAT, (T - 200) / 1500) },
  P: {
    min: 20,
    max: 3500,
    unit: 'kPa',
    label: 'Pressione totale',
    color: (P: number) => ramp(PRESS, Math.log(P / 1000 / 20) / Math.log(3500 / 20)),
  },
  /** Colore CSS per la legenda. */
  css: (rgb: [number, number, number]) => `rgb(${rgb.map((c) => Math.round(c * 255)).join(',')})`,
}
