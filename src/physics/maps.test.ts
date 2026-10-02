import { describe, expect, it } from 'vitest'
import { fanMapPoint, hpcMapPoint, fanOnMap } from './maps'
import fanMap from '../../engines/ge-e3.map.fan.json'
import hpcMap from '../../engines/ge-e3.map.hpc.json'
import fanSpec from '../../engines/ge-e3.fan.json'
import spec from '../../engines/ge-e3.json'
import { calibration } from './useCycle'

const LB = 0.45359237
const tab = fanSpec.measured_performance_CR168070

describe('mappa del fan (CR-168070 Fig. 3) contro i dati misurati', () => {
  it('colloca il punto di max climb al 97,8% di velocità corretta (CR-168070 Fig. 4), entro 0,5 punti', () => {
    const p = fanMapPoint(fanMap.reference.flow, fanMap.reference.pr)
    expect(Math.abs(p.speedPct - fanMap.reference.corrected_speed_pct)).toBeLessThan(0.5)
  })

  it('dà i rendimenti misurati della Tab. VI ai tre punti di rating, entro 0,008', () => {
    ;(['max_climb', 'max_cruise', 'takeoff'] as const).forEach((r, i) => {
      const [w, pr] = fanMap.rating_points_TabVI[r]
      expect(Math.abs(fanMapPoint(w, pr).etaMap - tab.bypass_eta_momentum_avg[i])).toBeLessThan(0.008)
    })
  })

  it('dà al decollo un margine di stallo di circa il 15% a portata costante (CR-168070 p.13)', () => {
    const [w, pr] = fanMap.rating_points_TabVI.takeoff
    expect(Math.abs(fanMapPoint(w, pr).stallMargin - fanMap.facts.takeoff_stall_margin_constant_flow.v)).toBeLessThan(0.02)
  })

  it('ha i punti di rating della Tab. VI coerenti con portate e β tabulati', () => {
    ;(['max_climb', 'max_cruise', 'takeoff'] as const).forEach((r, i) => {
      expect(fanMap.rating_points_TabVI[r][0]).toBe(tab.corrected_total_flow_lbm_s[i])
      expect(fanMap.rating_points_TabVI[r][1]).toBe(tab.bypass_PR[i])
    })
  })

  it('nel punto di progetto del ciclo restituisce il rendimento di progetto (rapporto 1)', () => {
    const c = calibration()
    const p = fanOnMap(c.fanRef.W2cRef, c.fanRef.prRef, c.fanRef)
    expect(p.etaRatio).toBeCloseTo(1, 6)
  })
})

describe('mappa del compressore HP (CR-168069 Fig. 91)', () => {
  const hpc = spec.modules.find((m) => m.id === 'hpc') as unknown as Record<string, { v: number }>
  const W = (hpc.corrected_flow.v / LB) // lbm/s
  it('colloca la portata di progetto (54,4 kg/s) al 98,4% di velocità corretta (CR-168219 Tab. XIV), entro 1,5 punti', () => {
    expect(Math.abs(hpcMapPoint(W, 23.0).speedPct - hpc.corrected_speed_pct_at_match.v)).toBeLessThan(1.5)
  })
  it('ha la linea operativa FPS che passa per il punto di progetto (β 23,0 a 120 lbm/s, Tab. XIV), entro il 3%', () => {
    const ol = hpcMap.operating_line_FPS as [number, number][]
    const i = ol.findIndex((q) => q[0] >= W)
    const pr = ol[i - 1][1] + ((ol[i][1] - ol[i - 1][1]) * (W - ol[i - 1][0])) / (ol[i][0] - ol[i - 1][0])
    expect(Math.abs(pr / hpc.PR.v - 1)).toBeLessThan(0.03)
  })
})
