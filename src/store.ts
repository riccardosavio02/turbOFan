import { create } from 'zustand'
import type { Rating } from './physics/ratings'

export interface CustomPoint {
  mach: number
  altM: number
  dTisa: number
  T41: number
}

export type FlowMapMode = 'none' | 'T' | 'P'

interface ViewState {
  selected: string | null
  hidden: Record<string, boolean>
  cutaway: boolean
  spinning: boolean
  /** Colorazione del condotto sul piano di taglio. */
  flowMap: FlowMapMode
  /** Punto di funzionamento: uno dei rating oppure il punto libero. */
  rating: Rating | 'custom'
  custom: CustomPoint
  cycleOpen: boolean
  /** Componenti evidenziati (gli altri diventano semitrasparenti); null = nessun fuoco. */
  focusIds: string[] | null
  /** Obiettivo della camera: la camera ci vola sopra con un'animazione. */
  cameraGoal: CameraGoal | null
  /** Grado di esplosione della vista esplosa, da 0 (assemblato) a 1. */
  explode: number
  /** Valore verso cui l'esplosione si muove con un'animazione morbida. */
  explodeTarget: number
  /** Se falso (pagine guidate) i clic sul modello non selezionano nulla. */
  pickable: boolean
  select: (id: string | null) => void
  toggleHidden: (id: string) => void
  setCutaway: (v: boolean) => void
  setSpinning: (v: boolean) => void
  setFlowMap: (m: FlowMapMode) => void
  setRating: (r: Rating | 'custom') => void
  setCustom: (c: Partial<CustomPoint>) => void
  setCycleOpen: (v: boolean) => void
  setFocus: (ids: string[] | null) => void
  flyTo: (g: CameraGoal | null) => void
  /** Applica in un colpo solo lo stato di una scena della storia. */
  setScene: (s: Partial<Pick<ViewState, 'focusIds' | 'cameraGoal' | 'cutaway' | 'hidden' | 'flowMap' | 'spinning' | 'rating' | 'explodeTarget'>>) => void
}

export interface CameraGoal {
  position: [number, number, number]
  target: [number, number, number]
}

export const useView = create<ViewState>((set) => ({
  selected: null,
  hidden: {},
  cutaway: true,
  spinning: true,
  flowMap: 'none',
  rating: 'max_climb',
  custom: { mach: 0.8, altM: 10670, dTisa: 0, T41: 1450 },
  cycleOpen: false,
  pickable: true,
  explode: 0,
  explodeTarget: 0,
  select: (id) => set((s) => (s.pickable || id === null ? { selected: id } : {})),
  toggleHidden: (id) => set((s) => ({ hidden: { ...s.hidden, [id]: !s.hidden[id] } })),
  setCutaway: (cutaway) => set({ cutaway }),
  setSpinning: (spinning) => set({ spinning }),
  // La mappa si vede sul piano di taglio: attivarla attiva anche lo spaccato.
  setFlowMap: (flowMap) => set((s) => ({ flowMap, cutaway: flowMap === 'none' ? s.cutaway : true })),
  setRating: (rating) => set({ rating }),
  setCustom: (c) => set((s) => ({ custom: { ...s.custom, ...c }, rating: 'custom' })),
  setCycleOpen: (cycleOpen) => set({ cycleOpen }),
  focusIds: null,
  cameraGoal: null,
  setFocus: (focusIds) => set({ focusIds }),
  flyTo: (cameraGoal) => set({ cameraGoal }),
  setScene: (scene) => set(scene),
}))
