import { describe, expect, it } from 'vitest'
import { hptRows, lptRows } from './turbines'
import { hpcRows } from './hpc'
import { section3D } from '../geometry/blade'
import raw from '../../engines/ge-e3.turbines.json'
import cycle from '../../engines/ge-e3.json'

const DEG = Math.PI / 180
const BTU_LBM = 2326 // J/kg
const pitchRadius = (q: { hubLE: number[]; tipLE: number[]; hubTE: number[]; tipTE: number[] }) =>
  (q.hubLE[1] + q.tipLE[1] + q.hubTE[1] + q.tipTE[1]) / 4

describe('turbina HP (CR-167955)', () => {
  it('ha 46/76/48/70 palette e pale (Tab. III–IV)', () => {
    expect(hptRows.map((r) => r.count)).toEqual([46, 76, 48, 70])
  })

  it('ha velocità periferiche dei due stadi coerenti con un unico regime (Tab. III)', () => {
    const [, r1, , r2] = hptRows
    const rpm = (u: number, r: number) => (u / r) * (60 / (2 * Math.PI))
    const n1 = rpm(raw.hpt.tip_speed_takeoff_m_s.stage1, r1.quad.tipLE[1])
    const n2 = rpm(raw.hpt.tip_speed_takeoff_m_s.stage2, r2.quad.tipLE[1])
    expect(Math.abs(n1 / n2 - 1)).toBeLessThan(0.01)
    // Al decollo l'albero HP gira più veloce che a max climb (12.450 rpm, CR-168219).
    expect(n1).toBeGreaterThan(cycle.speeds.N_HP_max_climb.v)
  })

  it('ha larghezze assiali coerenti con la solidità della Tab. IV (entro 10%)', () => {
    const t4 = raw.hpt.table4 as unknown as Record<string, { N: number; AW_over_t: number }>
    for (const r of hptRows) {
      const name = r.id.replace('HPT_', '')
      const aw = ((r.quad.tipTE[0] - r.quad.tipLE[0]) + (r.quad.hubTE[0] - r.quad.hubLE[0])) / 2
      const fromSolidity = (t4[name].AW_over_t * 2 * Math.PI * pitchRadius(r.quad)) / t4[name].N
      expect(Math.abs(aw / fromSolidity - 1)).toBeLessThan(0.1)
    }
  })
})

describe('turbina LP (report di progetto LPT)', () => {
  it('ha il numero di pale della Fig. 6, compreso il rotore 4 acustico da 156 pale', () => {
    const blades = lptRows.filter((r) => r.id !== 'LPT_TF').map((r) => r.count)
    expect(blades).toEqual([72, 120, 102, 122, 96, 122, 114, 156, 120, 110])
    const stage4 = cycle.modules.find((m) => m.id === 'lpt') as unknown as { stage4_blades: { v: number } }
    expect(lptRows.find((r) => r.id === 'LPT_R4')!.count).toBe(stage4.stage4_blades.v)
  })

  it('è collegata alla turbina HP da un condotto di transizione di 7,62 cm (CR-168219 p.82), entro 1 cm', () => {
    const hpExit = hptRows.at(-1)!.quad
    const lpInlet = lptRows[0].quad
    expect(lpInlet.hubLE[1]).toBeGreaterThan(hpExit.hubTE[1] - 0.003)
    expect(Math.abs((lpInlet.tipLE[0] - hpExit.tipTE[0]) * 100 - 7.62)).toBeLessThan(1)
  })

  it('ha raggi medi coerenti con carico Δh/2u² della Tab. II e regime LP di CR-168219 (entro 4%)', () => {
    const st = raw.lpt.table2_stage
    const omega = (cycle.speeds.N_LP_max_climb.v * 2 * Math.PI) / 60
    lptRows
      .filter((r) => r.kind === 'rotor')
      .forEach((r, i) => {
        const u = Math.sqrt((st.dh_btu_lbm[i] * BTU_LBM) / (2 * st.loading_dh_2u2[i]))
        expect(Math.abs(pitchRadius(r.quad) / (u / omega) - 1)).toBeLessThan(0.04)
      })
  })

  it('ha la parete esterna inclinata di circa 25° (CR-168219 p.82)', () => {
    const a = lptRows[0].quad.tipLE
    const b = lptRows[6].quad.tipTE
    const slope = Math.atan2(b[1] - a[1], b[0] - a[0]) / DEG
    expect(slope).toBeGreaterThan(18)
    expect(slope).toBeLessThan(28)
  })
})

describe('motore completo', () => {
  it('ha la lunghezza delle turbomacchine di CR-159584 Tab. I (318 cm) entro il 2%', () => {
    // Dalla flangia anteriore del fan (≈ 8 cm prima del bordo d'attacco, stima) alla flangia posteriore
    // della cassa del turbine frame (CR-168219 Fig. 35).
    const length = (lptRows.at(-1)!.quad.tipTE[0] + 0.08) * 100
    expect(Math.abs(length / raw.envelope_CR159584.turbomachinery_length_fan_flange_to_LPT_aft_frame_flange_cm - 1)).toBeLessThan(0.02)
  })

  it('mette le schiere in ordine assiale senza sovrapposizioni', () => {
    const rows = [...hpcRows, ...hptRows, ...lptRows]
    for (let i = 1; i < rows.length; i++) {
      const prevTE = Math.max(rows[i - 1].quad.hubTE[0], rows[i - 1].quad.tipTE[0])
      const nextLE = Math.min(rows[i].quad.hubLE[0], rows[i].quad.tipLE[0])
      expect(nextLE).toBeGreaterThan(prevTE - 0.003)
    }
  })

  it('genera le pale di turbina con il bordo d\'attacco sulle stazioni', () => {
    for (const r of [...hptRows, ...lptRows]) {
      const pts = section3D(r, 0.5, 41)
      const le = pts[(pts.length - 1) / 2]
      const mid = [(r.quad.hubLE[0] + r.quad.tipLE[0]) / 2, (r.quad.hubLE[1] + r.quad.tipLE[1]) / 2]
      expect(le[0]).toBeCloseTo(mid[0], 3)
      expect(Math.hypot(le[1], le[2])).toBeCloseTo(mid[1], 3)
    }
  })
})
