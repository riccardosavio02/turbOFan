import { describe, expect, it } from 'vitest'
import { hpcRows, hpcOffset } from './hpc'
import { interpolateSection, section3D } from '../geometry/blade'
import raw from '../../engines/ge-e3.hpc.json'

const DEG = Math.PI / 180
const row = (name: string) => hpcRows.find((r) => r.id === `HPC_${name}`)!

describe('compressore HP — conteggi (CR-165558 Tab. X e XXII)', () => {
  it('ha IGV + 10 rotori + 10 statori', () => {
    expect(hpcRows.filter((r) => r.kind === 'rotor')).toHaveLength(10)
    expect(hpcRows.filter((r) => r.kind === 'stator')).toHaveLength(11)
  })
  it('ha i numeri di pale della Tab. X', () => {
    const counts = hpcRows.filter((r) => r.kind === 'rotor').map((r) => r.count)
    expect(counts).toEqual(raw.rotor_summary_TabX.blades)
  })
  it('ha IGV e statori 1–4 a calettamento variabile (CR-168219 p.45)', () => {
    const variable = (raw.blade_rows as { name: string; variable: boolean }[]).filter((r) => r.variable).map((r) => r.name)
    expect(variable).toEqual(['IGV', 'S1', 'S2', 'S3', 'S4'])
  })
})

describe('compressore HP — coerenza tra Tab. XXI (stazioni) e Tab. XXII (sezioni)', () => {
  // Le sezioni di progetto finale stanno sulla linea di corrente con raggio medio LE/TE:
  // la frazione di altezza delle sezioni estreme deve valere 0 e 1.
  it('pone le sezioni estreme esattamente al mozzo e all\'apice', () => {
    for (const r of hpcRows) {
      const spans = r.sections.map((s) => s.span)
      expect(Math.min(...spans)).toBeCloseTo(0, 3)
      expect(Math.max(...spans)).toBeCloseTo(1, 3)
    }
  })

  // Corda assiale c·cos(stagger) vs distanza assiale LE→TE. Tolleranza 6%: le stazioni sono del
  // progetto originale, le sezioni del progetto finale (alcune schiere ricalettate).
  for (const r of hpcRows.filter((x) => x.id !== 'HPC_IGV')) {
    for (const [span, le, te] of [
      [0, 'hubLE', 'hubTE'],
      [1, 'tipLE', 'tipTE'],
    ] as const) {
      if (r.id === 'HPC_R1' && span === 1) continue
      it(`${r.id} ${span ? 'apice' : 'mozzo'}`, () => {
        const s = interpolateSection(r.sections, span)
        const ratio = (s.chord * Math.cos(s.staggerDeg * DEG)) / (r.quad[te][0] - r.quad[le][0])
        expect(Math.abs(ratio - 1)).toBeLessThan(0.06)
      })
    }
  }

  it("spiega lo scarto all'apice del rotore 1 con il ricalettamento 62,71° → 65,21°", () => {
    const r = row('R1')
    const s = interpolateSection(r.sections, 1)
    const dz = r.quad.tipTE[0] - r.quad.tipLE[0]
    const finalRatio = (s.chord * Math.cos(s.staggerDeg * DEG)) / dz
    // Calettamento d'apice del progetto originale: CR-165558 Tab. XXI p.113.
    const originalRatio = (s.chord * Math.cos(62.71 * DEG)) / dz
    expect(finalRatio).toBeLessThan(0.92)
    expect(Math.abs(originalRatio - 1)).toBeLessThan(0.03)
  })
})

describe('compressore HP — geometria', () => {
  it('ha la velocità periferica corretta di progetto di 456 m/s all\'apice del rotore 1 (CR-168219 p.48)', () => {
    const rTip = row('R1').quad.tipLE[1]
    const rpm = raw.design_point.corrected_speed_100pct_rpm.v
    expect((2 * Math.PI * rTip * rpm) / 60).toBeCloseTo(456, -1)
  })

  it('colloca il bordo d\'attacco delle pale sulle stazioni', () => {
    for (const r of hpcRows) {
      const pts = section3D(r, 1, 41)
      const le = pts[(pts.length - 1) / 2]
      expect(le[0]).toBeCloseTo(r.quad.tipLE[0], 3)
      expect(Math.hypot(le[1], le[2])).toBeCloseTo(r.quad.tipLE[1], 3)
    }
  })

  it('sta dietro il fan, con il bordo d\'attacco IGV a circa 1 m dal fan', () => {
    expect(row('IGV').quad.tipLE[0]).toBeGreaterThan(0.9)
    expect(row('IGV').quad.tipLE[0]).toBeLessThan(1.1)
    expect(hpcOffset).toBeGreaterThan(0)
  })
})
