/**
 * Turbine HP e LP del GE E3 (engines/ge-e3.turbines.json) nel riferimento del motore.
 *
 * I report non tabulano le sezioni delle pale: per ogni sezione si conoscono gli angoli di flusso
 * d'ingresso e d'uscita (Tab. II LPT, Fig. 5 HPT) e la larghezza assiale dal condotto. Da qui:
 *   calettamento γ e camber θ dagli angoli (metallo = flusso: incidenza e deviazione trascurate, stima),
 *   corda = larghezza assiale / cos γ.
 */
import raw from '../../engines/ge-e3.turbines.json'
import type { BladeRowSpec, Meridional, RowQuad, SpanSection } from './fan'
import { meridionalAt } from '../geometry/blade'

const CM = 0.01
const DEG = Math.PI / 180

interface RawRow {
  name: string
  type: 'rotor' | 'stator'
  count: number
  material: string
  cooled: boolean
  stations: Record<'tip_LE' | 'hub_LE' | 'tip_TE' | 'hub_TE', number[]>
  /** [span, in, out, tm_c] con angoli fisici (vedi JSON). */
  angles: number[][]
  note?: string
}

/**
 * Angoli fisici → calettamento e camber nel riferimento della schiera di turbina.
 * Statore: ingresso = −swirl (contro la rotazione), uscita = +α → γ = (in − out)/2 con segno del riferimento.
 * Rotore: ingresso relativo verso la rotazione, uscita relativa contro → γ = (in − out)/2.
 * In entrambi i casi θ = in + out (deviazione totale del flusso).
 */
function section(r: RawRow, q: RowQuad, [span, inA, outA, tmc]: number[]): SpanSection {
  const stagger = (inA - outA) / 2
  const camber = inA + outA
  const axial = meridionalAt(q, span, 1)[0] - meridionalAt(q, span, 0)[0]
  return { span, chord: axial / Math.cos(stagger * DEG), staggerDeg: stagger, camberDeg: camber, tmc, xtm: r.type === 'rotor' ? 0.3 : 0.35 }
}

function build(module: 'hpt' | 'lpt', offsetCm: number, rows: RawRow[], src: string): BladeRowSpec[] {
  const m = ([z, r]: number[]): Meridional => [(z + offsetCm) * CM, r * CM]
  const prefix = module === 'hpt' ? 'HPT' : 'LPT'
  return rows.map((r) => {
    const quad: RowQuad = { hubLE: m(r.stations.hub_LE), hubTE: m(r.stations.hub_TE), tipLE: m(r.stations.tip_LE), tipTE: m(r.stations.tip_TE) }
    const stage = r.name.replace(/\D/g, '')
    const label =
      r.name === 'TF'
        ? 'Montanti del turbine frame'
        : `${r.type === 'rotor' ? 'Rotore' : 'Statore (distributore)'} ${stage}${r.cooled ? ' — raffreddato' : ''}`
    return {
      id: `${prefix}_${r.name}`,
      label,
      kind: r.type,
      spool: r.type === 'rotor' ? (module === 'hpt' ? 'HP' : 'LP') : null,
      module,
      turbine: true,
      count: r.count,
      material: r.material,
      quad,
      sections: r.angles.map((a) => section(r, quad, a)),
      source: src + (r.note ? ` ${r.note}.` : ''),
      table: { columns: ['span', 'angolo_in', 'angolo_out', 'tm_c'], rows: r.angles },
    }
  })
}

export const hptOffset = raw.hpt.placement_cm.v * CM
export const lptOffset = raw.lpt.placement_cm.v * CM
export const hptRows = build('hpt', raw.hpt.placement_cm.v, raw.hpt.blade_rows as RawRow[], raw.hpt.src)
export const lptRows = build('lpt', raw.lpt.placement_cm.v, raw.lpt.blade_rows as RawRow[], raw.lpt.src)
export const envelope = raw.envelope_CR159584
