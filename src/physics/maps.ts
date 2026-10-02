/**
 * Mappe dei componenti digitalizzate dai report (engines/ge-e3.map.*.json) e loro uso nel modello.
 *
 * Le mappe vengono dalle prove al banco; il ciclo usa valori di progetto dell'FPS. Si applica quindi la
 * scalatura classica attorno al punto di riferimento (max climb):
 *   portata: W_map = W · W_ref,map / W_ref,ciclo;   rapporto: (β_map − 1) = (β − 1) · (β_ref,map − 1)/(β_ref,ciclo − 1)
 *   rendimento: η = η_ciclo,progetto · η_map(punto) / η_map(riferimento)
 * In progetto la mappa restituisce quindi esattamente i valori del ciclo; fuori progetto ne dà la variazione.
 */
import fanMap from '../../engines/ge-e3.map.fan.json'
import hpcMap from '../../engines/ge-e3.map.hpc.json'

const LB = 0.45359237
type Pt = [number, number]

function interp(pts: Pt[], x: number): number {
  const s = [...pts].sort((a, b) => a[0] - b[0])
  if (x <= s[0][0]) return s[0][1] + ((s[1][1] - s[0][1]) * (x - s[0][0])) / (s[1][0] - s[0][0])
  for (let i = 1; i < s.length; i++)
    if (x <= s[i][0]) return s[i - 1][1] + ((s[i][1] - s[i - 1][1]) * (x - s[i - 1][0])) / (s[i][0] - s[i - 1][0])
  const n = s.length
  return s[n - 1][1] + ((s[n - 1][1] - s[n - 2][1]) * (x - s[n - 1][0])) / (s[n - 1][0] - s[n - 2][0])
}

/** Distanza (in coordinate normalizzate) tra un punto e una polilinea, con l'ascissa del punto proiettato. */
function project(line: Pt[], p: Pt, sx: number, sy: number) {
  let best = { d: Infinity, x: line[0][0] }
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = [line[i - 1][0] / sx, line[i - 1][1] / sy]
    const [bx, by] = [line[i][0] / sx, line[i][1] / sy]
    const [px, py] = [p[0] / sx, p[1] / sy]
    const t = Math.min(1, Math.max(0, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)))
    const d = Math.hypot(ax + t * (bx - ax) - px, ay + t * (by - ay) - py)
    if (d < best.d) best = { d, x: (ax + t * (bx - ax)) * sx }
  }
  return best
}

export interface MapPoint {
  /** Coordinate del punto nella mappa (unità del grafico originale). */
  flow: number
  pr: number
  /** Velocità corretta [% del 100% della mappa]. */
  speedPct: number
  /** Rendimento letto sulla mappa (rig). */
  etaMap: number
  /** Margine di stallo a portata costante: β_stallo(W)/β − 1. */
  stallMargin: number
  /** Il punto cade fuori dalla zona coperta dalla mappa pubblicata (estrapolazione). */
  outside: boolean
}

/* ---------------- Fan ---------------- */

const fanLines = Object.entries(fanMap.speed_lines)
  .map(([n, v]) => ({ n: Number(n), pr: v.pr as Pt[], eta: v.eta as Pt[] }))
  .sort((a, b) => a.n - b.n)

/** Punto nella mappa del fan dato portata [lb/s] e β del bypass (già in coordinate della mappa). */
export function fanMapPoint(flow: number, pr: number): MapPoint {
  const sx = 100
  const sy = 0.05
  // Interpolazione continua tra tutte le linee di velocità, con pesi 1/d² sulla distanza normalizzata
  // del punto da ciascuna linea: niente salti quando cambia la linea più vicina (il risolutore di
  // Newton ha bisogno di funzioni continue). Sul tracciato di una linea il risultato è quella linea.
  let sw = 0
  let sn = 0
  let se = 0
  for (const l of fanLines) {
    const pr_ = project(l.pr, [flow, pr], sx, sy)
    const w = 1 / (pr_.d * pr_.d + 1e-6)
    sw += w
    sn += w * l.n
    se += w * interp(l.eta, Math.min(Math.max(pr_.x, l.eta[0][0]), l.eta[l.eta.length - 1][0]))
  }
  const speedPct = sn / sw
  const etaMap = se / sw
  const stallMargin = interp(fanMap.stall_line as Pt[], flow) / pr - 1
  const fl = fanMap.speed_lines as unknown as Record<string, { pr: Pt[] }>
  const outside = flow > Math.max(...fl['105'].pr.map((q) => q[0])) + 5 || flow < 390 || pr > 1.8
  return { flow, pr, speedPct, etaMap, stallMargin, outside }
}

const FAN_REF = fanMapPoint(fanMap.reference.flow, fanMap.reference.pr)

export interface FanScaling {
  /** Portata corretta totale [kg/s] e β bypass del ciclo nel punto di riferimento. */
  W2cRef: number
  prRef: number
}

/** Punto del ciclo → punto della mappa del fan, con il rapporto di rendimento rispetto al riferimento. */
export function fanOnMap(W2c: number, prBypass: number, ref: FanScaling) {
  const flow = (W2c / ref.W2cRef) * fanMap.reference.flow
  const pr = 1 + ((prBypass - 1) * (fanMap.reference.pr - 1)) / (ref.prRef - 1)
  const p = fanMapPoint(flow, pr)
  return { ...p, etaRatio: p.etaMap / FAN_REF.etaMap }
}

/* ---------------- Compressore HP ---------------- */

const hpcStubs = Object.entries(hpcMap.speed_stubs)
  .map(([n, v]) => ({ n: Number(n), pts: v as Pt[] }))
  .sort((a, b) => a.n - b.n)
const hpcOL = hpcMap.operating_line_FPS as Pt[]

/** Intersezione di ogni tratto di linea di velocità con la linea operativa: (portata, % velocità). */
const hpcSpeedOnOL: Pt[] = hpcStubs.map((s) => {
  const [[w0, p0], [w1, p1]] = s.pts
  // bisezione sul parametro del tratto: β del tratto = β della linea operativa
  let lo = 0
  let hi = 1
  for (let k = 0; k < 50; k++) {
    const t = (lo + hi) / 2
    const w = w0 + (w1 - w0) * t
    const p = p0 + (p1 - p0) * t
    if (p > interp(hpcOL, w)) lo = t
    else hi = t
  }
  return [w0 + (w1 - w0) * lo, s.n]
})

export function hpcMapPoint(flow: number, pr: number): MapPoint {
  return {
    flow,
    pr,
    speedPct: interp(hpcSpeedOnOL, flow),
    etaMap: interp(hpcMap.operating_line_efficiency_10B as Pt[], flow),
    stallMargin: interp(hpcMap.stall_line as Pt[], flow) / pr - 1,
    outside: flow < 15 || flow > 122,
  }
}

const HPC_REF_FLOW = 120 // lbm/s: portata corretta di progetto (54,4 kg/s, CR-168219 Tab. XIV)
const HPC_REF = hpcMapPoint(HPC_REF_FLOW, interp(hpcOL, HPC_REF_FLOW))

export interface HpcScaling {
  W25cRef: number
  prRef: number
}

export function hpcOnMap(W25c: number, prHpc: number, ref: HpcScaling) {
  const flow = (W25c / ref.W25cRef) * HPC_REF_FLOW
  const pr = 1 + ((prHpc - 1) * (HPC_REF.pr - 1)) / (ref.prRef - 1)
  const p = hpcMapPoint(flow, pr)
  return { ...p, etaRatio: p.etaMap / HPC_REF.etaMap }
}

export const MAPS = { fan: fanMap, hpc: hpcMap, hpcSpeedOnOL, LB }
