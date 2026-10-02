import { useLayoutEffect, useMemo, useRef } from 'react'
import { CylinderGeometry, Matrix4, Quaternion, Vector3, type InstancedMesh } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { MIXER, combustorGeometry } from '../data/flowpath'
import { buildMixerGeometry } from '../geometry/mixer'
import { useView } from '../store'
import { PartMaterial, passThroughClick } from './materials'

const CM = 0.01

function useSelectable(id: string, cut = false) {
  const selected = useView((s) => s.selected === id)
  const hidden = useView((s) => s.hidden[id])
  const select = useView((s) => s.select)
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (passThroughClick(e, cut)) return
    e.stopPropagation()
    select(id)
  }
  return { selected, hidden, onClick }
}

export const mixerInfo = {
  id: 'mixer',
  label: 'Mixer a 18 lobi',
  note: "Mescola il flusso caldo del core con quello freddo del bypass prima dell'ugello unico: vale il 2,9% di sfc (CR-168219 Tab. XXIII, p.104). 18 lobi smerlati in Inco 718 (p.102). Lunghezza e ampiezza dei lobi stimate dalla Fig. 39.",
}

export function Mixer() {
  const { selected, hidden, onClick } = useSelectable('mixer', true)
  const geometry = useMemo(
    () =>
      buildMixerGeometry({
        z0: MIXER.z0 * CM,
        length: MIXER.length * CM,
        r0: MIXER.r0 * CM,
        rMean: MIXER.rMean * CM,
        amplitude: MIXER.amplitude * CM,
        lobes: MIXER.lobes,
      }),
    [],
  )
  return (
    <mesh geometry={geometry} visible={!hidden} onClick={onClick}>
      <PartMaterial id="mixer" kind="hot" selected={selected} cut />
    </mesh>
  )
}

export const swirlerInfo = {
  id: 'swirl_cups',
  label: 'Swirler della cupola (60)',
  note: '60 swirl cup identici su due anelli: 30 pilota (esterno) e 30 main (interno), con swirler primario assiale e secondario radiale controrotanti (CR-168219 p.61, CR-169301 Fig. 1). Raggi e posizione digitalizzati dalla Fig. 1 di CR-169301.',
}

/** Anelli pilota e main [cm], digitalizzati dalla Fig. 1 di CR-169301. */
const SWIRL_RINGS = [combustorGeometry.swirlers.pilot, combustorGeometry.swirlers.main]

/** 2 anelli × 30 swirl cup, assiali, sulla cupola del combustore. */
export function SwirlCups() {
  const { selected, hidden, onClick } = useSelectable('swirl_cups', true)
  const ref = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => new CylinderGeometry(1.6 * CM, 2.2 * CM, 2.6 * CM, 20).rotateZ(-Math.PI / 2), [])
  useLayoutEffect(() => {
    const mesh = ref.current!
    const m = new Matrix4()
    const q = new Quaternion()
    const one = new Vector3(1, 1, 1)
    let k = 0
    for (const ring of SWIRL_RINGS)
      for (let i = 0; i < 30; i++) {
        const th = (2 * Math.PI * i) / 30
        m.compose(new Vector3(ring.Z * CM, ring.R * CM * Math.cos(th), ring.R * CM * Math.sin(th)), q, one)
        mesh.setMatrixAt(k++, m)
      }
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [])
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, 60]} visible={!hidden} onClick={onClick}>
      <PartMaterial id="swirl_cups" kind="hot" selected={selected} cut />
    </instancedMesh>
  )
}

export const fuelNozzleInfo = {
  id: 'fuel_nozzles',
  label: 'Iniettori (30)',
  note: "30 iniettori a doppia punta su un unico stelo, uno per coppia di swirler pilota/main; ogni punta è un atomizzatore a pressione duplex con valvola di dosaggio indipendente, e lo stelo è protetto da uno schermo termico (CR-168219 p.61). Inclinazione dello stelo digitalizzata dalla Fig. 1 di CR-169301.",
}

/** 30 steli inclinati che attraversano la cassa esterna e arrivano alle cupole. */
export function FuelNozzles() {
  const { selected, hidden, onClick } = useSelectable('fuel_nozzles', true)
  const ref = useRef<InstancedMesh>(null)
  const [[z0, r0], [z1, r1]] = combustorGeometry.fuelNozzleStem
  const len = Math.hypot(z1 - z0, r1 - r0) * CM
  const geometry = useMemo(() => new CylinderGeometry(0.9 * CM, 0.9 * CM, len, 12), [len])
  useLayoutEffect(() => {
    const mesh = ref.current!
    const m = new Matrix4()
    const one = new Vector3(1, 1, 1)
    const dirMer = new Vector3(z1 - z0, r1 - r0, 0).normalize()
    for (let i = 0; i < 30; i++) {
      const th = (2 * Math.PI * i) / 30
      // Direzione dello stelo nel piano meridiano ruotato di θ attorno all'asse X.
      const dir = new Vector3(dirMer.x, dirMer.y * Math.cos(th), dirMer.y * Math.sin(th))
      const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir)
      const zm = ((z0 + z1) / 2) * CM
      const rm = ((r0 + r1) / 2) * CM
      m.compose(new Vector3(zm, rm * Math.cos(th), rm * Math.sin(th)), q, one)
      mesh.setMatrixAt(i, m)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [z0, r0, z1, r1])
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, 30]} visible={!hidden} onClick={onClick}>
      <PartMaterial id="fuel_nozzles" kind="steel" selected={selected} cut />
    </instancedMesh>
  )
}
