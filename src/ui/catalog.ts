import { fanRows, type BladeRowSpec } from '../data/fan'
import { hpcRows } from '../data/hpc'
import { hptRows, lptRows } from '../data/turbines'
import { fuelNozzleInfo, mixerInfo, swirlerInfo } from '../scene/Extras'
import { structureBodies } from '../data/structure'
import { fanBodies } from '../data/flowpath'
import { shroudRing } from '../data/shroud'

export interface CatalogGroup {
  title: string
  items: { id: string; label: string; detail?: string }[]
}

const row = (id: string) => fanRows.find((r) => r.id === id)!
const item = (id: string) => ({ id, label: row(id).label, detail: `${row(id).count} pale` })
const body = (id: string) => {
  const b = [...fanBodies, ...structureBodies, shroudRing].find((x) => x.id === id)!
  return { id, label: b.label }
}

const rowItem = (r: BladeRowSpec) => ({ id: r.id, label: r.label, detail: `${r.count} ${r.kind === 'rotor' ? 'pale' : 'palette'}` })

export const catalog: CatalogGroup[] = [
  {
    title: 'Fan — albero di bassa pressione',
    items: [item('R1_fan_rotor'), body('fan_shroud'), item('R2_quarter_stage'), body('spinner_hub')],
  },
  {
    title: 'Fan — statori',
    items: [
      { ...item('S1_booster_vane'), detail: `${row('S1_booster_vane').count} palette` },
      { ...item('S2IN_core_ogv'), detail: `${row('S2IN_core_ogv').count} palette` },
      ...fanRows
        .filter((r) => r.id.startsWith('OGV_bypass_'))
        .map((r) => ({ id: r.id, label: r.label, detail: `${r.count} palette` })),
    ],
  },
  {
    title: 'Compressore HP (10 stadi)',
    items: hpcRows.map(rowItem),
  },
  {
    title: 'Combustore (doppio anello)',
    items: [
      body('prediffuser_splitter'),
      body('combustor_dome'),
      { id: swirlerInfo.id, label: swirlerInfo.label },
      { id: fuelNozzleInfo.id, label: fuelNozzleInfo.label },
      body('combustor_centerbody'),
      body('combustor_liner'),
    ],
  },
  { title: 'Turbina HP (2 stadi)', items: hptRows.map(rowItem) },
  { title: 'Alberi, dischi e cuscinetti', items: structureBodies.map((b) => body(b.id)) },
  { title: 'Turbina LP (5 stadi)', items: lptRows.map(rowItem) },
  {
    title: 'Strutture e scarico',
    items: [
      body('island'),
      body('core_cowl'),
      body('core_inner'),
      body('combustor_casing'),
      body('hot_inner'),
      body('core_nacelle'),
      { id: mixerInfo.id, label: mixerInfo.label },
      body('centerbody'),
      body('fan_casing'),
    ],
  },
]
