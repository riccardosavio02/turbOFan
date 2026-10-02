/**
 * Confronto tra i modelli e i valori pubblicati. Ogni voce: valore calcolato, valore del report, fonte e
 * tolleranza usata dai test. Max climb: ciclo di progetto (ingressi dalla Tab. XII, nessuna taratura).
 * Crociera e decollo: PREVISIONI del modello fuori progetto tarato solo a max climb.
 */
import spec from '../../engines/ge-e3.json'
import fan from '../../engines/ge-e3.fan.json'
import type { CycleResult } from './cycle'
import type { Rating } from './ratings'

export interface Check {
  label: string
  unit: string
  model: number
  report: number
  src: string
  tol: number
  digits: number
}

export interface Prediction {
  /** Giornata standard (parametri del ciclo, sfc). */
  std: CycleResult
  /** Temperatura di flat rating con la T41 della tabella (spinta di rating). */
  hot: CycleResult
}

const hpc = spec.modules.find((m) => m.id === 'hpc') as unknown as Record<string, { v: number }>
const hpt = spec.modules.find((m) => m.id === 'hpt') as unknown as Record<string, { v: number }>
const lpt = spec.modules.find((m) => m.id === 'lpt') as unknown as Record<string, { v: number }>
const c = spec.cycle
const LBM = 0.45359237

export function checks(r: Rating, p: Prediction): Check[] {
  const out = p.std
  const s = out.stations
  const i = out.input
  if (r === 'max_climb')
    return [
      { label: 'T25 ingresso compressore', unit: 'K', model: s['25'].T, report: hpc.T25.v, src: 'CR-168219 Tab. XIV', tol: 0.005, digits: 1 },
      { label: 'P25 ingresso compressore', unit: 'kPa', model: s['25'].P / 1000, report: hpc.P25.v / 1000, src: 'CR-168219 Tab. XIV', tol: 0.01, digits: 2 },
      { label: 'Rapporto di pressione globale', unit: '', model: out.derived.OPR, report: c.OPR[r], src: 'CR-168219 Tab. XII', tol: 0.01, digits: 2 },
      { label: 'Consumo specifico', unit: 'kg/(N·h)', model: out.sfc, report: c.sfc_uninstalled[r], src: 'CR-168219 Tab. XII', tol: 0.025, digits: 4 },
      { label: 'Lavoro HPT Δh/T41', unit: 'J/(kg·K)', model: out.derived.hptDhOverT, report: hpt.dh_over_T.v, src: 'CR-168219 Tab. XVIII', tol: 0.02, digits: 1 },
      { label: 'Portata corretta HPT W√T/P', unit: 'g·√K/(s·Pa)', model: out.derived.hptCorrFlow, report: hpt.corrected_flow_WsqrtT_P.v, src: 'CR-168219 Tab. XVIII', tol: 0.01, digits: 4 },
      { label: 'T49 ingresso LPT', unit: 'K', model: s['49'].T, report: lpt.T49.v, src: 'CR-168219 Tab. XXI', tol: 0.02, digits: 1 },
      { label: 'Lavoro LPT Δh/T49', unit: 'J/(kg·K)', model: out.derived.lptDhOverT, report: lpt.dh_over_T.v, src: 'CR-168219 Tab. XXI', tol: 0.04, digits: 1 },
      { label: 'Portata corretta LPT W√T/P', unit: 'g·√K/(s·Pa)', model: out.derived.lptCorrFlow, report: lpt.corrected_flow_WsqrtT_P.v, src: 'CR-168219 Tab. XXI', tol: 0.02, digits: 3 },
    ]
  const k = r === 'max_cruise' ? 1 : 2
  const list: Check[] = [
    { label: 'Rapporto di pressione globale', unit: '', model: out.derived.OPR, report: c.OPR[r], src: 'CR-168219 Tab. XII', tol: 0.015, digits: 2 },
    { label: 'Rapporto di diluizione BPR', unit: '', model: i.BPR, report: c.BPR[r], src: 'CR-168219 Tab. XII', tol: 0.02, digits: 2 },
    { label: 'β fan, bypass', unit: '', model: i.prFanBypass, report: c.fan_bypass_PR[r], src: 'CR-168219 Tab. XII', tol: 0.01, digits: 3 },
    { label: 'β compressore HP', unit: '', model: i.prHpc, report: c.HPC_PR[r], src: 'CR-168219 Tab. XII', tol: 0.01, digits: 2 },
    { label: 'Consumo specifico (giornata ISA)', unit: 'kg/(N·h)', model: out.sfc, report: c.sfc_uninstalled[r], src: 'CR-168219 Tab. XII', tol: 0.02, digits: 4 },
    {
      label: 'Portata corretta del fan',
      unit: 'kg/s',
      model: i.W2c,
      report: fan.measured_performance_CR168070.corrected_total_flow_lbm_s[k] * LBM,
      src: 'CR-168070 Tab. VI (misura al banco)',
      // Al banco la portata misurata superava quella prevista dell'1,4–3,5% a tutte le velocità
      // (CR-168070 p.13): il confronto tra ciclo FPS e rig non può essere più stretto di così.
      tol: 0.025,
      digits: 1,
    },
  ]
  if (r === 'takeoff')
    list.push({
      label: 'Spinta al decollo (ISA+15)',
      unit: 'kN',
      model: p.hot.thrust / 1000,
      report: spec.overall.thrust_takeoff_final.v,
      src: 'CR-168219 p.32',
      tol: 0.01,
      digits: 1,
    })
  return list
}

export const relErr = (k: Check) => k.model / k.report - 1
