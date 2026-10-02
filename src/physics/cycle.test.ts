import { describe, expect, it } from 'vitest'
import { cp, enthalpy, isentropicTemp, atmosphere } from './thermo'
import { runCycle } from './cycle'
import { ratingInput, type Rating } from './ratings'
import { checks, relErr } from './validation'
import { ratingPrediction, calibration } from './useCycle'
import { solveByContinuation, solveOffDesign, T41_RANGE } from './offdesign'

describe('termodinamica', () => {
  it("ha il cp dell'aria delle tabelle (±0,3%)", () => {
    for (const [T, ref] of [
      [300, 1005],
      [1000, 1142],
      [1500, 1210],
    ])
      expect(Math.abs(cp(T) / ref - 1)).toBeLessThan(0.003)
  })
  it('è coerente: dh/dT = cp', () => {
    expect((enthalpy(801) - enthalpy(799)) / 2).toBeCloseTo(cp(800), 1)
  })
  it("dà la compressione isentropica dell'aria (γ ≈ 1,4 a bassa T)", () => {
    expect(isentropicTemp(288.15, 2)).toBeCloseTo(288.15 * 2 ** (0.4 / 1.4), 0)
  })
  it("dà l'atmosfera ISA a 10,67 km", () => {
    const { Ts, Ps } = atmosphere(10670)
    expect(Ts).toBeCloseTo(218.79, 1)
    expect(Ps / 1000).toBeCloseTo(23.84, 1)
  })
})

describe('progetto (max climb) e previsioni fuori progetto vs report', () => {
  for (const r of ['max_climb', 'max_cruise', 'takeoff'] as Rating[]) {
    for (const k of checks(r, ratingPrediction(r)))
      it(`${r}: ${k.label} entro ${(k.tol * 100).toFixed(1)}% (${k.model.toFixed(k.digits)} vs ${k.report})`, () => {
        expect(Math.abs(relErr(k))).toBeLessThan(k.tol)
      })
  }
})

describe('coerenza dei modelli', () => {
  it("conserva la massa: portata all'ugello = aria + combustibile", () => {
    const out = runCycle(ratingInput('max_climb'))
    expect(out.stations['7'].W).toBeCloseTo(out.stations['2'].W + out.fuelFlow, 6)
  })
  it('bilancia le potenze degli alberi (rendimento meccanico 0,995)', () => {
    const out = runCycle(ratingInput('max_climb'))
    expect(out.power.hpt * 0.995).toBeCloseTo(out.power.hpc, 0)
    expect(out.power.lpt * 0.995).toBeCloseTo(out.power.fan, 0)
  })
  it('il fuori progetto ritrova esattamente il punto di progetto', () => {
    const sol = solveOffDesign(calibration(), { mach: 0.8, altM: 10670, dTisa: 10 }, 1517)
    const d = ratingInput('max_climb')
    expect(sol.converged).toBe(true)
    expect(sol.out.input.prHpc).toBeCloseTo(d.prHpc, 3)
    expect(sol.out.input.BPR).toBeCloseTo(d.BPR, 3)
    expect(sol.out.input.W2c).toBeCloseTo(d.W2c, 1)
  })
  it('converge su tutto il campo dichiarato di T41, al suolo e in quota, con spinta crescente', () => {
    for (const f of [
      { mach: 0, altM: 0, dTisa: 0 },
      { mach: 0.8, altM: 10670, dTisa: 0 },
      { mach: 0.5, altM: 5000, dTisa: 0 },
    ]) {
      let prev = 0
      for (let T41 = T41_RANGE.min; T41 <= T41_RANGE.max; T41 += 75) {
        const sol = solveByContinuation(calibration(), f, T41)
        expect(sol.converged).toBe(true)
        expect(sol.out.thrust).toBeGreaterThan(prev)
        prev = sol.out.thrust
      }
    }
  })
})
