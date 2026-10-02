/**
 * Modello fuori progetto del GE E3 a flussi misti (impostazione di Mattingly, *Elements of Gas Turbine
 * Propulsion*, cap. 8, "engine performance analysis"):
 *  - capacità di portata W√T/P costante all'ingresso di HPT e LPT (turbine strozzate);
 *  - aree geometriche fisse all'ingresso del mixer (core e bypass) e alla gola dell'ugello;
 *  - al mixer le due correnti hanno la stessa pressione statica (condizione di Kutta);
 *  - rendimenti, perdite, spillamenti e rapporto tra i β del fan (mozzo/bypass) costanti.
 *
 * Taratura: le capacità e le aree si ricavano dal punto di progetto (max climb, CR-168219 Tab. XII).
 * L'unica ipotesi in più è il Mach all'ingresso del mixer lato core in progetto (0,40, valore tipico).
 * Ingresso fuori progetto: condizione di volo e T41 ("manetta"). Incognite: portata corretta del fan,
 * β del fan, BPR (e β dell'HPC, risolto dalla capacità della HPT). Equazioni: capacità della LPT,
 * equilibrio statico al mixer, portata dell'ugello.
 */
import { runCycle, type CycleInput, type CycleResult } from './cycle'
import { ratingInput, type Rating } from './ratings'
import { R_GAS, gamma } from './thermo'
import { fanOnMap, hpcOnMap, type FanScaling, type HpcScaling } from './maps'

/** Funzione di portata W√T/(A·P) per Mach M [√K·s/m... in unità SI: kg·√K/(s·N)]. */
function flowFunction(M: number, g: number): number {
  return Math.sqrt(g / R_GAS) * M * (1 + ((g - 1) / 2) * M * M) ** (-(g + 1) / (2 * (g - 1)))
}

/** Mach subsonico dato W√T/(A·P); se la portata eccede quella sonica restituisce > 1 come penalità. */
function machFromFlow(q: number, g: number): number {
  const qMax = flowFunction(1, g)
  if (q >= qMax) return 1 + (q - qMax) / qMax
  let lo = 0
  let hi = 1
  for (let k = 0; k < 60; k++) {
    const m = (lo + hi) / 2
    if (flowFunction(m, g) < q) lo = m
    else hi = m
  }
  return (lo + hi) / 2
}

const staticP = (Pt: number, M: number, g: number) => Pt * (1 + ((g - 1) / 2) * M * M) ** (-g / (g - 1))

/** Portata che passa da una gola di area A con (Pt, Tt) e pressione esterna Ps. */
function nozzleCapacity(A: number, Pt: number, Tt: number, Ps: number, g: number): number {
  const crit = ((g + 1) / 2) ** (g / (g - 1))
  const M = Pt / Ps >= crit ? 1 : Math.sqrt((2 / (g - 1)) * ((Pt / Ps) ** ((g - 1) / g) - 1))
  return (A * Pt * flowFunction(M, g)) / Math.sqrt(Tt)
}

export interface Calibration {
  base: CycleInput
  hubToBypassPR: number
  Chpt: number
  Clpt: number
  A56: number
  A16: number
  A8: number
  fanRef: FanScaling
  hpcRef: HpcScaling
  /** Usa le mappe dei componenti per i rendimenti di fan e compressore HP. */
  useMaps: boolean
}

const DESIGN_MIXER_MACH = 0.4

/** Grandezze di mixer e ugello di un ciclo, date le aree. */
function exhaust(out: CycleResult, A56: number, A16: number) {
  const s = out.stations
  const g56 = gamma(s['56'].T, s['56'].far)
  const g16 = gamma(s['16'].T)
  const M56 = machFromFlow((s['56'].W * Math.sqrt(s['56'].T)) / (A56 * s['56'].P), g56)
  const M16 = machFromFlow((s['16'].W * Math.sqrt(s['16'].T)) / (A16 * s['16'].P), g16)
  return { M56, M16, Ps56: staticP(s['56'].P, M56, g56), Ps16: staticP(s['16'].P, M16, g16) }
}

export function calibrate(): Calibration {
  const base = ratingInput('max_climb')
  const out = runCycle(base)
  const s = out.stations
  const g56 = gamma(s['56'].T, s['56'].far)
  const A56 = (s['56'].W * Math.sqrt(s['56'].T)) / (s['56'].P * flowFunction(DESIGN_MIXER_MACH, g56))
  const Ps = staticP(s['56'].P, DESIGN_MIXER_MACH, g56)
  // Bypass: Mach tale che la statica sia uguale a quella del core, poi l'area che lo dà.
  const g16 = gamma(s['16'].T)
  const M16 = Math.sqrt((2 / (g16 - 1)) * ((s['16'].P / Ps) ** ((g16 - 1) / g16) - 1))
  const A16 = (s['16'].W * Math.sqrt(s['16'].T)) / (s['16'].P * flowFunction(M16, g16))
  const g7 = gamma(s['7'].T, s['7'].far)
  const P8 = s['7'].P * (1 - base.dpNozzleDuct)
  const A8 = s['7'].W / nozzleCapacity(1, P8, s['7'].T, s['0'].P, g7)
  return {
    base,
    hubToBypassPR: base.prFanHub / base.prFanBypass,
    Chpt: out.derived.hptCorrFlow,
    Clpt: out.derived.lptCorrFlow,
    A56,
    A16,
    A8,
    fanRef: { W2cRef: base.W2c, prRef: base.prFanBypass },
    hpcRef: { W25cRef: out.derived.W25c, prRef: base.prHpc },
    useMaps: true,
  }
}

export interface Flight {
  mach: number
  altM: number
  dTisa: number
}

export interface OffDesignResult {
  out: CycleResult
  converged: boolean
  residual: number
  mixer: { M56: number; M16: number }
}

interface Unknowns {
  W2c: number
  prFan: number
  BPR: number
  prHpc: number
}

/** Ciclo con le incognite date; β dell'HPC aggiustato perché la HPT abbia la capacità di progetto. */
function evaluate(cal: Calibration, f: Flight, T41: number, x: Unknowns) {
  // Rendimenti dalle mappe: il fan dipende solo dalle incognite; il compressore HP dalla sua portata
  // corretta, presa dal passo precedente della secante (converge insieme a β_HPC).
  const fanPt = cal.useMaps ? fanOnMap(x.W2c, x.prFan, cal.fanRef) : null
  const etaFanRatio = fanPt ? fanPt.etaRatio : 1
  let W25c = cal.hpcRef.W25cRef
  const etaHpc = (prHpc: number) =>
    cal.useMaps ? cal.base.etaHpc * hpcOnMap(W25c, prHpc, cal.hpcRef).etaRatio : cal.base.etaHpc
  const make = (prHpc: number): CycleInput => ({
    ...cal.base,
    etaFanBypass: cal.base.etaFanBypass * etaFanRatio,
    etaFanHub: cal.base.etaFanHub * etaFanRatio,
    etaHpc: etaHpc(prHpc),
    name: 'Fuori progetto',
    mach: f.mach,
    altM: f.altM,
    dTisa: f.dTisa,
    T41,
    W2c: x.W2c,
    BPR: x.BPR,
    prFanBypass: x.prFan,
    prFanHub: x.prFan * cal.hubToBypassPR,
    prHpc,
  })
  // Secante su β_HPC: capacità HPT ∝ 1/β a parità di portata, quindi converge in pochi passi.
  let p0 = x.prHpc
  const first = runCycle(make(p0))
  W25c = first.derived.W25c
  let r0 = first.derived.hptCorrFlow / cal.Chpt - 1
  let p1 = p0 * (1 + r0)
  let out = runCycle(make(p1))
  W25c = out.derived.W25c
  let r1 = out.derived.hptCorrFlow / cal.Chpt - 1
  for (let k = 0; k < 20 && Math.abs(r1) > 1e-9; k++) {
    const p2 = p1 - (r1 * (p1 - p0)) / (r1 - r0)
    p0 = p1
    r0 = r1
    p1 = Math.min(Math.max(p2, 2), 45)
    out = runCycle(make(p1))
    W25c = out.derived.W25c
    r1 = out.derived.hptCorrFlow / cal.Chpt - 1
  }
  x.prHpc = p1
  const ex = exhaust(out, cal.A56, cal.A16)
  const s = out.stations
  const g7 = gamma(s['7'].T, s['7'].far)
  const cap = nozzleCapacity(cal.A8, s['7'].P * (1 - cal.base.dpNozzleDuct), s['7'].T, s['0'].P, g7)
  const res = [out.derived.lptCorrFlow / cal.Clpt - 1, ex.Ps56 / ex.Ps16 - 1, s['7'].W / cap - 1]
  return { out, ex, res }
}

/** Risolve il punto di funzionamento (Newton con jacobiano alle differenze finite). */
export function solveOffDesign(cal: Calibration, f: Flight, T41: number, guess?: Unknowns): OffDesignResult & { x: Unknowns } {
  const x: Unknowns = guess
    ? { ...guess }
    : { W2c: cal.base.W2c, prFan: cal.base.prFanBypass, BPR: cal.base.BPR, prHpc: cal.base.prHpc }
  const keys = ['W2c', 'prFan', 'BPR'] as const
  let ev = evaluate(cal, f, T41, x)
  let norm = Math.hypot(...ev.res)
  for (let it = 0; it < 50 && norm > 1e-7; it++) {
    const J: number[][] = [[], [], []]
    keys.forEach((k, j) => {
      const h = Math.abs(x[k]) * 1e-4
      const xp = { ...x, [k]: x[k] + h }
      const r = evaluate(cal, f, T41, xp).res
      for (let i = 0; i < 3; i++) J[i][j] = (r[i] - ev.res[i]) / h
    })
    const dx = solve3(J, ev.res.map((v) => -v))
    // Passo smorzato: dimezza finché il residuo non diminuisce.
    let lambda = 1
    for (let t = 0; t < 8; t++) {
      const xt = { ...x }
      keys.forEach((k, j) => (xt[k] = x[k] + lambda * dx[j]))
      xt.prFan = Math.min(Math.max(xt.prFan, 1.01), 2.2)
      xt.BPR = Math.min(Math.max(xt.BPR, 0.5), 20)
      xt.W2c = Math.min(Math.max(xt.W2c, 100), 900)
      const et = evaluate(cal, f, T41, xt)
      const nt = Math.hypot(...et.res)
      if (nt < norm || t === 7) {
        Object.assign(x, xt)
        ev = et
        norm = nt
        break
      }
      lambda /= 2
    }
  }
  return { out: ev.out, // Residuo relativo di capacità e pressioni: 1e-4 = 0,01%, ben sotto la precisione dei dati.
    converged: norm < 1e-4, residual: norm, mixer: { M56: ev.ex.M56, M16: ev.ex.M16 }, x }
}

function solve3(A: number[][], b: number[]): number[] {
  const m = A.map((row, i) => [...row, b[i]])
  for (let c = 0; c < 3; c++) {
    let p = c
    for (let r = c + 1; r < 3; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r
    ;[m[c], m[p]] = [m[p], m[c]]
    for (let r = 0; r < 3; r++)
      if (r !== c) {
        const f = m[r][c] / m[c][c]
        for (let k = c; k < 4; k++) m[r][k] -= f * m[c][k]
      }
  }
  return [0, 1, 2].map((i) => m[i][3] / m[i][i])
}

/** Condizioni di volo dei punti di rating. */
export function ratingFlight(r: Rating): Flight {
  // Condizione nominale (giornata ISA per crociera e decollo, ISA+10 per la salita di progetto).
  const i = ratingInput(r)
  return { mach: i.mach, altM: i.altM, dTisa: i.dTisa }
}

/**
 * Previsione di un punto di rating secondo le regole di CR-168219 p.33: la T41 della Tab. XII vale alla
 * temperatura di flat rating (crociera ISA+10, decollo ISA+15), dove il motore dà la spinta di rating;
 * in giornata standard la spinta resta la stessa (flat rating) con una T41 più bassa, e sfc e parametri
 * del ciclo si leggono lì. La salita è il punto di progetto (ISA+10) e coincide con la taratura.
 */
export function predictRating(cal: Calibration, r: Rating, T41table: number) {
  const f = ratingFlight(r)
  const flatDT = r === 'takeoff' ? 15 : 10
  const hot = solveOffDesign(cal, { ...f, dTisa: flatDT }, T41table)
  if (r === 'max_climb') return { hot, std: hot, T41std: T41table }
  const F = hot.out.thrust
  let lo = T41table - 300
  let hi = T41table
  let guess = hot.x
  let std = hot
  for (let k = 0; k < 30; k++) {
    const T = (lo + hi) / 2
    std = solveOffDesign(cal, { ...f, dTisa: 0 }, T, guess)
    guess = std.x
    if (std.out.thrust < F) lo = T
    else hi = T
  }
  return { hot, std, T41std: (lo + hi) / 2 }
}

/** Campo di T41 in cui le ipotesi (turbine strozzate, rendimenti costanti) sono ragionevoli. */
export const T41_RANGE = { min: 1200, max: 1650 }

/**
 * Soluzione robusta per continuazione: si parte dal punto di progetto e si cambiano a piccoli passi
 * prima la condizione di volo e poi T41, usando ogni soluzione come stima iniziale della successiva.
 */
export function solveByContinuation(cal: Calibration, f: Flight, T41: number) {
  const design = { mach: cal.base.mach, altM: cal.base.altM, dTisa: cal.base.dTisa, T41: cal.base.T41 }
  const target = { ...f, T41 }
  const steps = 8
  let sol = solveOffDesign(cal, f, T41)
  if (sol.converged) return sol
  let guess = solveOffDesign(cal, design, design.T41).x
  for (let k = 1; k <= steps; k++) {
    const w = k / steps
    const p = {
      mach: design.mach + (target.mach - design.mach) * w,
      altM: design.altM + (target.altM - design.altM) * w,
      dTisa: design.dTisa + (target.dTisa - design.dTisa) * w,
      T41: design.T41 + (target.T41 - design.T41) * w,
    }
    sol = solveOffDesign(cal, p, p.T41, guess)
    guess = sol.x
  }
  return sol
}
