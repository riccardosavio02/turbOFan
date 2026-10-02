import { DoubleSide, Plane, Vector3 } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { useView } from '../store'

/** Taglio "da museo": rimuove il quadrante y>0, z>0 rivolto verso la camera iniziale. */
export const cutawayPlanes = [new Plane(new Vector3(0, -1, 0), 0), new Plane(new Vector3(0, 0, -1), 0)]

/**
 * Il raycasting di three.js ignora i piani di taglio: senza questo filtro un clic "attraverso" lo
 * spaccato colpirebbe la metà invisibile della gondola. Se il punto colpito sta nel quadrante tolto
 * (o l'oggetto è nascosto) il clic passa all'oggetto successivo lungo il raggio.
 */
export function passThroughClick(e: ThreeEvent<MouseEvent>, cut?: boolean): boolean {
  if (!e.object.visible) return true
  if (!cut || !useView.getState().cutaway) return false
  return e.point.y > 0 && e.point.z > 0
}

export type MaterialKind = 'titanium' | 'aluminium' | 'composite' | 'casing' | 'spinner' | 'steel' | 'nickel' | 'hot'

const LOOK: Record<MaterialKind, { color: string; metalness: number; roughness: number }> = {
  titanium: { color: '#b4b9c2', metalness: 0.9, roughness: 0.3 },
  aluminium: { color: '#d4d8dd', metalness: 0.85, roughness: 0.35 },
  composite: { color: '#3a3e45', metalness: 0.25, roughness: 0.55 },
  casing: { color: '#c3c7cd', metalness: 0.45, roughness: 0.5 },
  spinner: { color: '#8f959e', metalness: 0.7, roughness: 0.35 },
  steel: { color: '#a7abb0', metalness: 0.9, roughness: 0.4 },
  // Superleghe di nichel delle turbine: tono più caldo e opaco.
  nickel: { color: '#b9a48c', metalness: 0.8, roughness: 0.45 },
  // Parti della sezione calda (combustore, casse, cono): ossidazione bruno-bluastra.
  hot: { color: '#8c7f78', metalness: 0.7, roughness: 0.55 },
}

/** Materiale dal testo del report (es. "Ti-6Al-4V", "alluminio 7075-T73", "FPS: composito grafite"). */
export function materialKindOf(text: string): MaterialKind {
  const t = text.toLowerCase()
  if (t.includes('composit')) return 'composite'
  if (t.includes('allumin')) return 'aluminium'
  if (/(rené|n4|superlega|eutettico|ma754|inco|hastelloy)/.test(t)) return 'nickel'
  if (t.includes('ti')) return 'titanium'
  return 'steel'
}

export function PartMaterial({
  id,
  kind,
  selected,
  cut = false,
  section = false,
}: {
  /** Componente a cui appartiene: serve per evidenziarlo o attenuarlo nella storia guidata. */
  id?: string
  kind: MaterialKind
  selected: boolean
  cut?: boolean
  /** Faccia di taglio: finitura opaca da superficie lavorata. */
  section?: boolean
}) {
  const cutaway = useView((s) => s.cutaway)
  const focus = useView((s) => s.focusIds)
  const look = section ? { ...LOOK[kind], metalness: 0.15, roughness: 0.85 } : LOOK[kind]
  const inFocus = !!focus && !!id && focus.includes(id)
  // Con un fuoco attivo, le parti fuori fuoco diventano "fantasmi" semitrasparenti.
  const ghost = !!focus && !inFocus
  const glow = selected || inFocus
  return (
    <meshStandardMaterial
      {...look}
      side={DoubleSide}
      emissive={glow ? '#ff7a2f' : '#000000'}
      emissiveIntensity={selected ? 0.5 : inFocus ? 0.16 : 0}
      transparent={ghost}
      opacity={ghost ? 0.08 : 1}
      depthWrite={!ghost}
      clippingPlanes={cut && cutaway ? cutawayPlanes : []}
      clipIntersection
    />
  )
}
