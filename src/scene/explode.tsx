/**
 * Vista esplosa: ogni componente appartiene a un modulo che, a esplosione completa, trasla lungo l'asse
 * (dx) o in verticale (dy). Gli spostamenti sono scelti per separare i moduli senza sovrapposizioni;
 * non hanno significato fisico.
 */
import { useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { fanRows } from '../data/fan'
import { hpcRows } from '../data/hpc'
import { hptRows, lptRows } from '../data/turbines'
import { framing, meridionalPoints } from './focus'
import { useView, type CameraGoal } from '../store'

export interface ExplodeModule {
  key: string
  /** Gruppo didattico di components.json con la descrizione del modulo. */
  card: string
  label: string
  dx: number
  dy: number
  ids: string[]
}

const rowIds = (rows: { id: string }[]) => rows.map((r) => r.id)

export const EXPLODE_MODULES: ExplodeModule[] = [
  { key: 'nacelle', card: 'inlet', label: "Gondola e presa d'aria", dx: 0.3, dy: 3.1, ids: ['fan_casing'] },
  { key: 'fan', card: 'fan', label: 'Fan', dx: -1.5, dy: 0, ids: ['R1_fan_rotor', 'fan_shroud', 'spinner_hub', 'lp_fan_disks'] },
  { key: 'booster', card: 'booster', label: 'Booster e isola', dx: -0.75, dy: 0, ids: ['S1_booster_vane', 'R2_quarter_stage', 'island', 'S2IN_core_ogv'] },
  {
    key: 'bypass',
    card: 'bypass',
    label: 'Fan frame e OGV del bypass',
    dx: 0,
    dy: 0,
    ids: [...rowIds(fanRows.filter((r) => r.id.startsWith('OGV_bypass_'))), 'core_cowl'],
  },
  { key: 'hpc', card: 'hpc', label: 'Compressore HP', dx: 0.8, dy: 0, ids: [...rowIds(hpcRows), 'hpc_rotor', 'core_inner'] },
  {
    key: 'combustor',
    card: 'combustor',
    label: 'Combustore',
    dx: 1.65,
    dy: 0,
    ids: ['prediffuser_splitter', 'combustor_dome', 'swirl_cups', 'fuel_nozzles', 'combustor_centerbody', 'combustor_liner'],
  },
  { key: 'hpt', card: 'hpt', label: 'Turbina HP', dx: 2.45, dy: 0, ids: [...rowIds(hptRows), 'hpt_rotor'] },
  { key: 'lpt', card: 'lpt', label: 'Turbina LP', dx: 3.2, dy: 0, ids: [...rowIds(lptRows.filter((r) => r.id !== 'LPT_TF')), 'lpt_rotor'] },
  { key: 'exhaust', card: 'exhaust', label: 'Telaio posteriore, mixer e cono', dx: 4.05, dy: 0, ids: ['LPT_TF', 'mixer', 'centerbody'] },
  { key: 'shafts', card: 'shafts', label: 'Alberi, cuscinetti e supporti', dx: 0.6, dy: -1.35, ids: ['lp_shaft', 'vent_tube', 'bearings', 'sump_supports'] },
]

/** Gusci che attraversano più moduli: nella vista esplosa si nascondono. */
export const SPANNING = ['combustor_casing', 'hot_inner', 'core_nacelle']

const byId = new Map(EXPLODE_MODULES.flatMap((m) => m.ids.map((id) => [id, m] as const)))
export const moduleOf = (id: string) => byId.get(id)

/** Trasla il contenuto secondo l'esplosione corrente (letta a ogni frame, senza ri-render). */
export function Ex({ id, children }: { id: string; children: ReactNode }) {
  const ref = useRef<Group>(null)
  const m = byId.get(id)
  const spanning = SPANNING.includes(id)
  useFrame(() => {
    if (!ref.current) return
    const e = useView.getState().explode
    // I gusci che attraversano più moduli spariscono appena il motore comincia ad aprirsi.
    if (spanning) ref.current.visible = e < 0.02
    if (m) ref.current.position.set(m.dx * e, m.dy * e, 0)
  })
  return <group ref={ref}>{children}</group>
}

/** Inquadratura di un modulo nella sua posizione esplosa. */
export function explodedFraming(m: ExplodeModule, zoom = 1): CameraGoal {
  const g = framing(m.ids, { zoom })
  const sh = (v: [number, number, number]): [number, number, number] => [v[0] + m.dx, v[1] + m.dy, v[2]]
  return { position: sh(g.position), target: sh(g.target) }
}

/** Centro (z) e raggio massimo di un modulo, per le etichette. */
export function moduleAnchor(m: ExplodeModule): [number, number, number] {
  const pts = m.ids.flatMap(meridionalPoints)
  const z = (Math.min(...pts.map((p) => p[0])) + Math.max(...pts.map((p) => p[0]))) / 2
  const r = Math.max(...pts.map((p) => p[1]))
  return [z + m.dx, r + 0.12 + m.dy, 0]
}

/** Animazione morbida dell'esplosione verso il valore richiesto (indipendente dal frame rate). */
export function ExplodeAnimator() {
  useFrame((_, dt) => {
    const { explode, explodeTarget } = useView.getState()
    if (explode === explodeTarget) return
    const k = 1 - Math.exp(-dt * 3.2)
    const next = Math.abs(explodeTarget - explode) < 0.002 ? explodeTarget : explode + (explodeTarget - explode) * k
    useView.setState({ explode: next })
  })
  return null
}

/** Modulo della vista esplosa corrispondente a un gruppo didattico della storia. */
export const moduleForGroup = (group: string) => EXPLODE_MODULES.find((m) => m.card === group)
