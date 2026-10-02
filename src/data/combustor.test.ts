import { describe, expect, it } from 'vitest'
import comb from '../../engines/ge-e3.combustor.json'
import cycle from '../../engines/ge-e3.json'
import { hpcRows } from './hpc'
import { hptRows } from './turbines'
import { NAC } from './flowpath'
import { SHAFTS, structureBodies } from './structure'
import { fanRows } from './fan'

const pd = comb.prediffuser_Fig90
const row = (x: number) => pd.rows.find((r) => r[0] === x)!

describe('combustore (CR-169301)', () => {
  it("ha l'ingresso del prediffusore sui raggi d'uscita del compressore (CR-165558), entro 0,002 cm", () => {
    const s10 = hpcRows.at(-1)!.quad
    expect(Math.abs(pd.inlet_radii_cm.tip - s10.tipTE[1] * 100)).toBeLessThan(0.002)
    expect(Math.abs(pd.inlet_radii_cm.hub - s10.hubTE[1] * 100)).toBeLessThan(0.002)
  })

  it('divide la portata 48/52 come le aree dei due canali allo splitter (entro 1 punto)', () => {
    // Al bordo d'attacco dello splitter (X = 1,676 cm) il flusso è ancora uniforme: la ripartizione
    // della portata deve seguire quella delle aree anulari.
    const [, y1, y2, , y4] = row(1.676) as number[]
    const outer = y4 ** 2 - y2 ** 2
    const inner = y2 ** 2 - y1 ** 2
    expect(Math.abs(outer / (outer + inner) - pd.flow_split.outer_pilot)).toBeLessThan(0.01)
  })

  it("chiude i liner sui raggi d'ingresso della turbina HP (entro 0,5 cm)", () => {
    const vane = hptRows[0].quad
    const outerEnd = comb.geometry.outer_liner.at(-1)!
    const innerEnd = comb.geometry.inner_liner.at(-1)!
    expect(Math.abs(outerEnd[1] - vane.tipLE[1] * 100)).toBeLessThan(0.5)
    expect(Math.abs(innerEnd[1] - vane.hubLE[1] * 100)).toBeLessThan(0.5)
  })

  it('mette gli anelli di swirler tra i liner, pilota sopra il corpo centrale e main sotto', () => {
    const cb = comb.geometry.centerbody.map((p) => p[1])
    const { pilot, main } = comb.geometry.swirler_rings
    expect(pilot.R).toBeGreaterThan(Math.max(...cb))
    expect(main.R).toBeLessThan(Math.min(...cb))
    expect(pilot.R).toBeLessThan(comb.geometry.outer_liner[0][1])
    expect(main.R).toBeGreaterThan(comb.geometry.inner_liner[0][1])
  })

  it('è lunga circa 15 cm dalla cupola al distributore, come un combustore anulare corto', () => {
    const length = hptRows[0].quad.tipLE[0] * 100 - comb.geometry.pilot_dome_face[0][0]
    expect(length).toBeGreaterThan(10)
    expect(length).toBeLessThan(20)
  })
})

describe("presa d'aria", () => {
  /** Portata corretta per unità d'area in funzione del Mach (aria, γ = 1,4, condizioni standard). */
  const flowPerArea = (M: number) => 416.9 * M * (1 + 0.2 * M * M) ** -3
  const machFrom = (wPerA: number) => {
    let lo = 0
    let hi = 1
    for (let i = 0; i < 60; i++) {
      const m = (lo + hi) / 2
      if (flowPerArea(m) < wPerA) lo = m
      else hi = m
    }
    return lo
  }
  const fan = cycle.modules.find((m) => m.id === 'fan') as unknown as { corrected_flow: { cycle_match: number } }
  const W = fan.corrected_flow.cycle_match

  it('ha un Mach in gola tra 0,6 e 0,75 alla portata di max climb', () => {
    const area = Math.PI * (NAC.throatR / 100) ** 2
    const m = machFrom(W / area)
    expect(m).toBeGreaterThan(0.6)
    expect(m).toBeLessThan(0.75)
  })

  it('è un diffusore: la sezione alla faccia del fan è maggiore di quella in gola', () => {
    const q = fanRows[0].quad
    const fanFace = Math.PI * (q.tipLE[1] ** 2 - q.hubLE[1] ** 2)
    const throat = Math.PI * (NAC.throatR / 100) ** 2
    expect(fanFace).toBeGreaterThan(throat)
    expect(machFrom(W / fanFace)).toBeLessThan(machFrom(W / throat))
  })
})

describe('struttura interna', () => {
  it('ha i dischi di tutti i rotori: 2 fan/booster, 10 HPC, 2 HPT, 5 LPT', () => {
    const count = (id: string, rows: number) => {
      const b = structureBodies.find((x) => x.id === id)!
      return [b.profile, ...(b.extra ?? [])].length >= rows
    }
    expect(count('lp_fan_disks', 2)).toBe(true)
    expect(count('hpc_rotor', 10)).toBe(true)
    expect(count('hpt_rotor', 2)).toBe(true)
    expect(count('lpt_rotor', 5)).toBe(true)
  })

  it("non fa intersecare l'albero LP con i fori dei dischi HP", () => {
    const hp = structureBodies.filter((b) => b.spool === 'HP')
    for (const b of hp)
      for (const pr of [b.profile, ...(b.extra ?? [])])
        for (const q of pr) expect(q.p[1]).toBeGreaterThan(SHAFTS.lpOuter)
  })
})
