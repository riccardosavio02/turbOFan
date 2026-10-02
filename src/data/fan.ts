/**
 * Dati del modulo fan del GE E3 (engines/ge-e3.fan.json) convertiti in strutture tipizzate, in metri.
 * Nessun numero geometrico è definito qui: tutto arriva dal JSON, che cita report e pagina.
 */
import raw from '../../engines/ge-e3.fan.json'
import type { SectionParams } from '../geometry/airfoil'

const CM = 0.01

/** Punto meridionale [Z assiale, R raggio] in metri. */
export type Meridional = [number, number]

/** Quadrilatero meridionale di una schiera: bordi d'attacco e d'uscita al mozzo e all'apice. */
export interface RowQuad {
  hubLE: Meridional
  hubTE: Meridional
  tipLE: Meridional
  tipTE: Meridional
}

/** Sezione della schiera a una frazione di altezza `span` (0 = mozzo, 1 = apice). */
export interface SpanSection extends SectionParams {
  span: number
}

export type RowKind = 'rotor' | 'stator'
export type Spool = 'LP' | 'HP' | null

export interface BladeRowSpec {
  id: string
  label: string
  kind: RowKind
  /** Albero a cui è calettata la schiera (null = statica). */
  spool: Spool
  /** Modulo del motore, per il catalogo. */
  module: string
  /** Schiera di turbina: il flusso è accelerato e la curvatura delle pale è opposta a quella del compressore. */
  turbine?: boolean
  count: number
  material: string
  quad: RowQuad
  sections: SpanSection[]
  /** Posizione angolare di ogni paletta [rad]; se assente, passo uniforme. */
  angles?: number[]
  source: string
  /** Righe di tabella originali, per il pannello informativo. */
  table: { columns: string[]; rows: number[][] }
}

type Station = { tip_LE: number[]; tip_TE: number[]; hub_LE: number[]; hub_TE: number[] }
const stations = raw.flowpath_stations as unknown as Record<string, Station>

const m = (p: number[]): Meridional => [p[0] * CM, p[1] * CM]
function quadOf(id: string): RowQuad {
  const s = stations[id]
  return { hubLE: m(s.hub_LE), hubTE: m(s.hub_TE), tipLE: m(s.tip_LE), tipTE: m(s.tip_TE) }
}

interface RawRow {
  id: string
  count: number
  material: string
  src: string
  columns: string[]
  sections: number[][] | Record<string, number[][]>
}
const rawRows = raw.blade_rows as unknown as RawRow[]
const rowById = (id: string) => rawRows.find((r) => r.id === id)!

/** Tabelle in % di altezza (App. B–E): 0% = mozzo sull'asse di impilamento. */
function sectionsByPercent(r: RawRow): SpanSection[] {
  const c = Object.fromEntries(r.columns.map((k, i) => [k, i]))
  return (r.sections as number[][]).map((s) => ({
    span: s[c.pct_ht] / 100,
    chord: s[c.chord_cm] * CM,
    staggerDeg: s[c.stagger],
    camberDeg: s[c.camber],
    tmc: s[c.tm_c],
  }))
}

/** Tabelle per raggio (App. F): la frazione di altezza si misura lungo il bordo d'attacco. */
function sectionsByRadius(rows: number[][], columns: string[], quad: RowQuad): SpanSection[] {
  const c = Object.fromEntries(columns.map((k, i) => [k, i]))
  const r0 = quad.hubLE[1]
  const r1 = quad.tipLE[1]
  return rows.map((s) => ({
    span: (s[c.R_cm] * CM - r0) / (r1 - r0),
    chord: s[c.chord_cm] * CM,
    staggerDeg: s[c.stagger],
    camberDeg: s[c.camber],
    tmc: s[c.tm_c],
  }))
}

function percentRow(id: string, quadId: string, label: string, kind: RowKind): BladeRowSpec {
  const r = rowById(id)
  return {
    id,
    label,
    kind,
    spool: kind === 'rotor' ? 'LP' : null,
    module: 'fan',
    count: r.count,
    material: r.material,
    quad: quadOf(quadId),
    sections: sectionsByPercent(r),
    source: r.src,
    table: { columns: r.columns, rows: r.sections as number[][] },
  }
}

/**
 * OGV del bypass: un'unica schiera che attraversa due tubi di flusso dell'App. A
 * (S2OUT sotto, OGV sopra). Il mozzo è quello di S2OUT, l'apice quello di OGV.
 */
const bypassQuad: RowQuad = {
  hubLE: quadOf('S2OUT_bypass_ogv_lower').hubLE,
  hubTE: quadOf('S2OUT_bypass_ogv_lower').hubTE,
  tipLE: quadOf('OGV_bypass_upper').tipLE,
  tipTE: quadOf('OGV_bypass_upper').tipTE,
}

/** Paletta k (1..34) → tipo I–V, secondo la tabella dell'App. F. */
function bypassVaneType(k: number): string {
  if (k >= 2 && k <= 6) return 'I'
  if (k >= 7 && k <= 12) return 'II'
  if (k >= 24 && k <= 29) return 'IV'
  if (k >= 30 && k <= 34) return 'V'
  return 'III'
}

function bypassRows(): BladeRowSpec[] {
  const r = rowById('OGV_bypass')
  const types = r.sections as Record<string, number[][]>
  const pitch = (2 * Math.PI) / r.count
  return Object.entries(types).map(([type, rows]) => {
    const angles: number[] = []
    for (let k = 1; k <= r.count; k++) if (bypassVaneType(k) === type) angles.push((k - 1) * pitch)
    return {
      id: `OGV_bypass_${type}`,
      label: `OGV bypass — tipo ${type}`,
      kind: 'stator' as const,
      spool: null,
      module: 'fan',
      count: angles.length,
      material: r.material,
      quad: bypassQuad,
      sections: sectionsByRadius(rows, r.columns, bypassQuad),
      angles,
      source: r.src,
      table: { columns: r.columns, rows },
    }
  })
}

export const fanRows: BladeRowSpec[] = [
  percentRow('R1_fan_rotor', 'R1_fan_rotor', 'Rotore fan', 'rotor'),
  percentRow('S1_booster_vane', 'S1_booster_vane', 'Statore 1 booster', 'stator'),
  percentRow('R2_quarter_stage', 'R2_quarter_stage', 'Rotore quarter-stage', 'rotor'),
  percentRow('S2IN_core_ogv', 'S2IN_core_ogv', 'OGV interne (core)', 'stator'),
  ...bypassRows(),
]

export const fanDesignPoint = raw.design_point
export const fanStations = Object.fromEntries(
  Object.keys(stations)
    .filter((k) => !k.startsWith('$'))
    .map((k) => [k, quadOf(k)]),
) as Record<string, RowQuad>
/** Altezza dello shroud a metà pala del rotore fan, frazione dell'altezza. */
export const fanShroudSpan =
  (rowById('R1_fan_rotor') as unknown as { part_span_shroud_pct_height: { v: number } }).part_span_shroud_pct_height.v / 100
