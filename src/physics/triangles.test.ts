import { describe, expect, it } from 'vitest'
import { rotorTriangles } from './triangles'
import { ratingPrediction } from './useCycle'
import hpc from '../../engines/ge-e3.hpc.json'

/**
 * Triangoli calcolati (ciclo a max climb, 98,4% di velocità corretta) contro i triangoli di progetto della
 * Tab. XXI di CR-165558 (linea di corrente 7, 100% di velocità). Tolleranze: U 2% (regime diverso),
 * Cz 10% (media di continuità sulla sezione contro valore locale), angoli relativi 3°.
 */
describe('triangoli di velocità del compressore HP contro CR-165558 Tab. XXI', () => {
  const tr = rotorTriangles(ratingPrediction('max_climb').std)
  for (const [k, v] of Object.entries(hpc.vector_diagrams_SL7.rotors)) {
    it(`rotore ${k.slice(1)}`, () => {
      const t = tr.get('HPC_' + k)!
      const [, , , U1, Cz1, b1] = v.in
      const [, , , , Cz2, b2] = v.out
      expect(Math.abs(t.in.U / U1 - 1)).toBeLessThan(0.02)
      expect(Math.abs(t.in.Vz / Cz1 - 1)).toBeLessThan(0.1)
      expect(Math.abs(t.out.Vz / Cz2 - 1)).toBeLessThan(0.1)
      expect(Math.abs(t.in.beta - b1)).toBeLessThan(3)
      expect(Math.abs(t.out.beta - b2)).toBeLessThan(3)
    })
  }
  it('dà un Mach relativo d\'ingresso transonico ai primi rotori e subsonico agli ultimi (CR-168219 p.52)', () => {
    expect(tr.get('HPC_R1')!.in.Mrel).toBeGreaterThan(1)
    expect(tr.get('HPC_R10')!.in.Mrel).toBeLessThan(0.8)
  })
})

describe('triangoli della turbina LP', () => {
  const tr = rotorTriangles(ratingPrediction('max_climb').std)
  it("ricostruisce l'angolo relativo d'ingresso della Tab. II entro 5° (stadi 1–4)", () => {
    for (const k of [1, 2, 3, 4]) {
      const c = tr.get(`LPT_R${k}`)!.check!
      expect(Math.abs(c.beta1Computed - c.beta1Table)).toBeLessThan(5)
    }
  })
})

describe('bilancio di Eulero nelle turbine (angoli dei report contro salto entalpico del ciclo)', () => {
  const tr = rotorTriangles(ratingPrediction('max_climb').std)
  const ratio = (id: string) => tr.get(id)!.work / tr.get(id)!.workCycle!
  it('turbina LP, stadi 1–3 (Tab. II): entro il 10%', () => {
    for (const k of [1, 2, 3]) expect(Math.abs(ratio(`LPT_R${k}`) - 1)).toBeLessThan(0.1)
  })
  it('turbina HP, stadio 1 (angoli letti sulla Fig. 5 di CR-167955): entro il 15%', () => {
    expect(Math.abs(ratio('HPT_R1') - 1)).toBeLessThan(0.15)
  })
})
