import { describe, expect, it } from 'vitest'
import { airfoilContour, camberLine } from './airfoil'
import { bladeAngles, interpolateSection, section3D } from './blade'
import { fanRows } from '../data/fan'

const DEG = Math.PI / 180
const row = (id: string) => fanRows.find((r) => r.id === id)!

describe('profilo alare', () => {
  it('ha lo spessore massimo t/c richiesto', () => {
    const p = { chord: 0.2, staggerDeg: 0, camberDeg: 30, tmc: 0.06 }
    const c = airfoilContour(p, 200)
    const n = (c.length + 1) / 2
    const upper = c.slice(0, n).reverse()
    const lower = c.slice(n - 1)
    const tMax = Math.max(...upper.map(([, y], i) => Math.hypot(y - lower[i][1], upper[i][0] - lower[i][0])))
    expect(tMax / p.chord).toBeCloseTo(0.06, 2)
  })

  it('ha tangenti della linea media a ±camber/2 su LE e TE', () => {
    for (const camber of [6, 35, 81]) {
      expect(Math.atan(camberLine(0, camber).slope) / DEG).toBeCloseTo(camber / 2, 6)
      expect(Math.atan(camberLine(1, camber).slope) / DEG).toBeCloseTo(-camber / 2, 6)
    }
  })
})

describe('coerenza dati CR-165148: corda assiale App. B–D vs bordi App. A', () => {
  // La corda assiale c·cos(stagger) delle tabelle di sezione deve coincidere con la distanza
  // assiale LE→TE della soluzione di flusso. È il presupposto della mappatura sul quadrilatero.
  // Le OGV interne sono escluse: hanno freccia di 60° e le sezioni non giacciono a raggio costante.
  for (const id of ['R1_fan_rotor', 'S1_booster_vane', 'R2_quarter_stage']) {
    for (const [span, le, te] of [
      [0, 'hubLE', 'hubTE'],
      [1, 'tipLE', 'tipTE'],
    ] as const) {
      it(`${id} ${span ? 'apice' : 'mozzo'}`, () => {
        const r = row(id)
        const s = interpolateSection(r.sections, span)
        const fromTable = s.chord * Math.cos(s.staggerDeg * DEG)
        const fromFlow = r.quad[te][0] - r.quad[le][0]
        expect(Math.abs(fromTable / fromFlow - 1)).toBeLessThan(0.01)
      })
    }
  }
})

describe('pala generata', () => {
  it('ha il bordo d\'attacco sui punti LE dell\'App. A, al mozzo e all\'apice', () => {
    for (const r of fanRows) {
      for (const [span, key] of [
        [0, 'hubLE'],
        [1, 'tipLE'],
      ] as const) {
        const pts = section3D(r, span, 41)
        const le = pts[(pts.length - 1) / 2]
        expect(le[0]).toBeCloseTo(r.quad[key][0], 3)
        expect(Math.hypot(le[1], le[2])).toBeCloseTo(r.quad[key][1], 3)
      }
    }
  })
})

describe('numero e disposizione delle pale', () => {
  it('rispetta i conteggi del report', () => {
    expect(row('R1_fan_rotor').count).toBe(32)
    expect(row('S1_booster_vane').count).toBe(60)
    expect(row('R2_quarter_stage').count).toBe(56)
    expect(row('S2IN_core_ogv').count).toBe(64)
    const bypass = fanRows.filter((r) => r.id.startsWith('OGV_bypass_'))
    expect(bypass.reduce((n, r) => n + r.count, 0)).toBe(34)
  })

  it('colloca le OGV di bypass negli intervalli angolari dell\'App. F', () => {
    const ranges: Record<string, [number, number][]> = {
      I: [[10.6, 52.9]],
      II: [[63.5, 116.5]],
      III: [[0, 0], [127.1, 232.9]],
      IV: [[243.5, 296.5]],
      V: [[307.1, 349.4]],
    }
    for (const [type, rs] of Object.entries(ranges)) {
      for (const a of bladeAngles(row(`OGV_bypass_${type}`))) {
        const deg = a / DEG
        expect(rs.some(([lo, hi]) => deg >= lo - 0.05 && deg <= hi + 0.05)).toBe(true)
      }
    }
  })
})
