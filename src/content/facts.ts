/**
 * Numeri citati nei testi: letti dalla specifica (già verificata dai test) o calcolati dai modelli.
 * Nei testi compaiono come {{chiave}}; content.test.ts verifica che ogni segnaposto esista.
 */
import spec from '../../engines/ge-e3.json'
import fan from '../../engines/ge-e3.fan.json'
import hpc from '../../engines/ge-e3.hpc.json'
import turb from '../../engines/ge-e3.turbines.json'
import { ratingPrediction } from '../physics/useCycle'

const it = (x: number, d = 0) => x.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d })
const row = (id: string) => fan.blade_rows.find((r) => r.id === id)!
const fanModule = spec.modules.find((m) => m.id === 'fan') as unknown as { corrected_tip_speed_design: { v: number } }

export function facts(): Record<string, string> {
  const climb = ratingPrediction('max_climb').std
  const to = ratingPrediction('takeoff')
  return {
    fan_d: it(spec.overall.fan_tip_diameter.v, 2),
    thrust_to: it(spec.overall.thrust_takeoff_final.v, 1),
    inlet_l: it(turb.envelope_CR159584.inlet_length_from_fan_face_cm, 0),
    hl_ratio: it(turb.envelope_CR159584.highlight_to_max_diameter, 2),
    fan_blades: String(row('R1_fan_rotor').count),
    fan_tip: it(fanModule.corrected_tip_speed_design.v, 1),
    booster_blades: String(row('R2_quarter_stage').count),
    inner_ogv: String(row('S2IN_core_ogv').count),
    ogv_n: String(row('OGV_bypass').count),
    hpc_stages: String(hpc.rotor_summary_TabX.stage.length),
    t41_climb: it(spec.cycle.T41_HPT_rotor_inlet.max_climb),
    t41_to: it(spec.cycle.T41_HPT_rotor_inlet.takeoff),
    lpt_r4: String(turb.lpt.blade_rows.find((r) => r.name === 'R4')!.count),
    t2: it(climb.stations['2'].T),
    t3: it(climb.stations['3'].T),
    opr_climb: it(spec.cycle.OPR.max_climb, 1),
    bpr_climb: it(spec.cycle.BPR.max_climb, 1),
    to_thrust_pred: it(to.hot.thrust / 1000, 1),
    to_hpc_pred: it(to.std.input.prHpc, 1),
  }
}

/** Sostituisce i segnaposto {{chiave}}; una chiave sconosciuta resta visibile come errore. */
export function fill(text: string, f: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => f[k] ?? `⟦${k}?⟧`)
}
