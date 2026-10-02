/**
 * I tre punti di rating del GE E3 FPS, costruiti dalla specifica (engines/ge-e3.json, ge-e3.fan.json).
 * Nessun valore è tarato sul risultato: ogni ingresso ha una fonte nel JSON.
 */
import spec from '../../engines/ge-e3.json'
import fan from '../../engines/ge-e3.fan.json'
import type { CycleInput } from './cycle'

export type Rating = 'max_climb' | 'max_cruise' | 'takeoff'

const c = spec.cycle
const k = spec.component_performance_max_cruise
const fanMod = spec.modules.find((m) => m.id === 'fan') as unknown as { corrected_flow: { cycle_match: number } }
const LBM = 0.45359237

/** Portata corretta del fan: max climb dal ciclo (CR-168219 p.41), cruise e takeoff misurate (CR-168070 Tab. VI). */
const W2c: Record<Rating, number> = {
  max_climb: fanMod.corrected_flow.cycle_match,
  max_cruise: fan.measured_performance_CR168070.corrected_total_flow_lbm_s[1] * LBM,
  takeoff: fan.measured_performance_CR168070.corrected_total_flow_lbm_s[2] * LBM,
}

export const RATING_LABEL: Record<Rating, string> = {
  max_climb: 'Salita massima — M0,8, 10,67 km, ISA+10',
  max_cruise: 'Crociera massima — M0,8, 10,67 km (spinta di rating fino a ISA+10)',
  takeoff: 'Decollo — livello del mare, M0 (spinta di rating fino a ISA+15)',
}

export function ratingInput(r: Rating): CycleInput {
  const pt = spec.rating_points[r]
  return {
    name: RATING_LABEL[r],
    mach: pt.mach,
    altM: pt.alt_m,
    dTisa: pt.dT_isa_K,
    W2c: W2c[r],
    BPR: c.BPR[r],
    prFanBypass: c.fan_bypass_PR[r],
    prFanHub: c.fan_hub_PR[r],
    prHpc: c.HPC_PR[r],
    T41: c.T41_HPT_rotor_inlet[r],
    etaFanBypass: k.eta_fan_bypass,
    etaFanHub: k.eta_fan_hub_booster,
    etaHpc: k.eta_hpc_adiabatic,
    etaHpt: k.eta_hpt,
    etaLpt: k.eta_lpt,
    etaComb: k.eta_combustor,
    dpComb: k.dp_combustor,
    dpCoreInlet: fan.design_point.core_duct_pressure_loss.v,
    dpFanDuct: k.dp_fan_duct,
    dpCoreDuct: k.dp_core_duct,
    dpNozzleDuct: k.dp_nozzle_duct,
    coolNonChargeable: k.cooling_nonchargeable_pctW25 / 100,
    coolChargeable: k.cooling_chargeable_pctW25 / 100,
    bleed7: k.bleed_7th_stage_pctW25 / 100,
    bleed5: k.bleed_5th_stage_pctW25 / 100,
    mixerEffectiveness: k.mixer_effectiveness,
    cv: k.nozzle_coefficient,
  }
}
