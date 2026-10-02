/**
 * Gruppi di componenti e inquadrature della camera calcolate dalla geometria (non posizioni scritte a mano):
 * per ogni insieme di componenti si prendono estensione assiale e raggio massimo, e la camera guarda
 * dentro lo spaccato da una direzione fissa, a una distanza che contiene tutto il gruppo.
 */
import { fanRows, type BladeRowSpec } from '../data/fan'
import { hpcRows } from '../data/hpc'
import { hptRows, lptRows } from '../data/turbines'
import { fanBodies, MIXER, combustorGeometry, type RevolvedBody } from '../data/flowpath'
import { structureBodies } from '../data/structure'
import { shroudRing } from '../data/shroud'
import type { CameraGoal } from '../store'

const rows: BladeRowSpec[] = [...fanRows, ...hpcRows, ...hptRows, ...lptRows]
const bodies: RevolvedBody[] = [...fanBodies, ...structureBodies, shroudRing]

/** Punti meridionali (Z, R) [m] di un componente. */
export function meridionalPoints(id: string): [number, number][] {
  const r = rows.find((x) => x.id === id)
  if (r) return [r.quad.hubLE, r.quad.hubTE, r.quad.tipLE, r.quad.tipTE]
  const b = bodies.find((x) => x.id === id)
  if (b) return [b.profile, ...(b.extra ?? [])].flat().map((q) => q.p)
  if (id === 'mixer') return [[MIXER.z0 / 100, (MIXER.rMean + MIXER.amplitude) / 100], [(MIXER.z0 + MIXER.length) / 100, 0.5]]
  if (id === 'swirl_cups') return [combustorGeometry.swirlers.pilot, combustorGeometry.swirlers.main].map((s) => [s.Z / 100, s.R / 100])
  if (id === 'fuel_nozzles') return combustorGeometry.fuelNozzleStem.map(([z, r]) => [z / 100, r / 100])
  return []
}

export const ids = {
  rows: (pred: (r: BladeRowSpec) => boolean) => rows.filter(pred).map((r) => r.id),
}

/** Gruppi usati dalla storia e dal menu: nomi didattici → componenti. */
export const GROUPS: Record<string, string[]> = {
  inlet: ['fan_casing'],
  fan: ['R1_fan_rotor', 'fan_shroud', 'spinner_hub', 'lp_fan_disks'],
  booster: ['S1_booster_vane', 'R2_quarter_stage', 'island', 'S2IN_core_ogv'],
  bypass: [...ids.rows((r) => r.id.startsWith('OGV_bypass_')), 'core_cowl', 'core_nacelle'],
  hpc: [...ids.rows((r) => r.module === 'hpc'), 'hpc_rotor', 'core_inner'],
  combustor: ['prediffuser_splitter', 'combustor_dome', 'swirl_cups', 'fuel_nozzles', 'combustor_centerbody', 'combustor_liner'],
  hpt: [...ids.rows((r) => r.module === 'hpt'), 'hpt_rotor'],
  lpt: [...ids.rows((r) => r.module === 'lpt' && r.id !== 'LPT_TF'), 'lpt_rotor'],
  shafts: ['lp_shaft', 'vent_tube', 'bearings', 'sump_supports', 'lp_fan_disks', 'hpc_rotor', 'hpt_rotor', 'lpt_rotor'],
  exhaust: ['LPT_TF', 'mixer', 'centerbody', 'core_nacelle'],
}

/** Direzione da cui la camera guarda dentro lo spaccato (quadrante y > 0, z > 0 rimosso). */
const VIEW_DIR = (() => {
  const d = [-0.32, 0.42, 0.85]
  const n = Math.hypot(...d)
  return d.map((v) => v / n) as [number, number, number]
})()

export function framing(componentIds: string[], { zoom = 1, fov = 38 } = {}): CameraGoal {
  const pts = componentIds.flatMap(meridionalPoints)
  if (!pts.length) return { position: [-3.6, 2.6, 6.8], target: [1.3, 0, 0] }
  const z0 = Math.min(...pts.map((p) => p[0]))
  const z1 = Math.max(...pts.map((p) => p[0]))
  const rMax = Math.max(...pts.map((p) => p[1]))
  const zc = (z0 + z1) / 2
  // Bersaglio leggermente dentro il quadrante tagliato, dove si vede la sezione.
  const target: [number, number, number] = [zc, 0.3 * rMax, 0.3 * rMax]
  const size = Math.max((z1 - z0) / 2, rMax * 0.9, 0.12)
  const dist = (1.35 * size) / Math.tan(((fov / 2) * Math.PI) / 180) / zoom
  return { position: [target[0] + VIEW_DIR[0] * dist, target[1] + VIEW_DIR[1] * dist, target[2] + VIEW_DIR[2] * dist], target }
}

/** Tutti gli identificativi noti, per i test di coerenza dei contenuti. */
export const ALL_IDS = new Set([...rows.map((r) => r.id), ...bodies.map((b) => b.id), 'mixer', 'swirl_cups', 'fuel_nozzles'])
