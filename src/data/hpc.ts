/**
 * Compressore HP del GE E3 (engines/ge-e3.hpc.json, NASA CR-165558) nel riferimento del motore.
 * Le coordinate del report HPC sono traslate di `placement.z_offset_cm` (stima, vedi JSON).
 */
import raw from '../../engines/ge-e3.hpc.json'
import type { BladeRowSpec, Meridional, RowQuad, SpanSection } from './fan'

const CM = 0.01
export const hpcOffset = raw.placement.z_offset_cm.v * CM

interface RawRow {
  id: string
  name: string
  type: 'rotor' | 'stator'
  count: number
  material: string
  variable: boolean
  airfoil_family?: string
  stations: Record<'tip_LE' | 'hub_LE' | 'tip_TE' | 'hub_TE', number[]>
  src: string
  columns: string[]
  sections: number[][]
}
const rawRows = raw.blade_rows as unknown as RawRow[]

const m = ([z, r]: number[]): Meridional => [z * CM + hpcOffset, r * CM]

/**
 * Camber di un profilo NACA 65 dal coefficiente di portanza di progetto CLO (solo IGV):
 * per la linea media a=1.0 l'angolo di camber vale circa 25°·CLO (stima).
 */
const camberFromCL0 = (cl0: number) => 25 * cl0

function sections(r: RawRow, q: RowQuad): SpanSection[] {
  const c = Object.fromEntries(r.columns.map((k, i) => [k, i]))
  // Le sezioni stanno al raggio medio LE/TE della loro linea di corrente.
  const rHub = (q.hubLE[1] + q.hubTE[1]) / 2
  const rTip = (q.tipLE[1] + q.tipTE[1]) / 2
  return r.sections.map((s) => ({
    span: (s[c.R_cm] * CM - rHub) / (rTip - rHub),
    chord: s[c.chord_cm] * CM,
    staggerDeg: s[c.stagger],
    camberDeg: 'camber' in c ? s[c.camber] : camberFromCL0(s[c.CLO]),
    tmc: s[c.tm_c],
    xtm: s[c.pct_c_tm] / 100,
  }))
}

export const hpcRows: BladeRowSpec[] = rawRows.map((r) => {
  const quad: RowQuad = {
    hubLE: m(r.stations.hub_LE),
    hubTE: m(r.stations.hub_TE),
    tipLE: m(r.stations.tip_LE),
    tipTE: m(r.stations.tip_TE),
  }
  const stage = r.name.replace(/\D/g, '')
  const label =
    r.name === 'IGV'
      ? 'IGV (calettamento variabile)'
      : `${r.type === 'rotor' ? 'Rotore' : 'Statore'} ${stage}${r.variable ? ' (variabile)' : ''}`
  return {
    id: r.id,
    label,
    kind: r.type,
    spool: r.type === 'rotor' ? 'HP' : null,
    module: 'hpc',
    count: r.count,
    material: r.material,
    quad,
    sections: sections(r, quad),
    source: r.src + (r.airfoil_family ? `. Famiglia di profili: ${r.airfoil_family}` : ''),
    table: { columns: r.columns, rows: r.sections },
  }
})

/** Stazioni in ordine assiale, per costruire mozzo e cassa del compressore. */
export const hpcQuads = hpcRows.map((r) => r.quad)
