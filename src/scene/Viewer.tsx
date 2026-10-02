import { useEffect, useRef, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { Engine } from './Engine'
import { FlowMap } from './FlowMap'
import { Livery } from './Livery'
import { ExplodeAnimator } from './explode'
import { useView } from '../store'

/**
 * Vola verso cameraGoal con un'interpolazione esponenziale (morbida e indipendente dal frame rate).
 * Quando l'utente trascina la vista, il volo si interrompe.
 */
function CameraRig() {
  const goal = useView((s) => s.cameraGoal)
  const flyTo = useView((s) => s.flyTo)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const pos = useRef(new Vector3())
  const tgt = useRef(new Vector3())
  useEffect(() => {
    if (!goal) return
    pos.current.set(...goal.position)
    tgt.current.set(...goal.target)
    const stop = () => flyTo(null)
    controls?.addEventListener('start', stop)
    return () => controls?.removeEventListener('start', stop)
  }, [goal, controls, flyTo])
  useFrame((_, dt) => {
    if (!goal || !controls) return
    const k = 1 - Math.exp(-dt * 2.6)
    camera.position.lerp(pos.current, k)
    controls.target.lerp(tgt.current, k)
    controls.update()
  })
  return null
}

export function Viewer({ interactive = true, children }: { interactive?: boolean; children?: ReactNode }) {
  const select = useView((s) => s.select)
  // Nelle pagine guidate il modello è solo da guardare: niente selezione, e nessuna selezione rimasta.
  useEffect(() => {
    useView.setState({ pickable: interactive, ...(interactive ? {} : { selected: null }) })
    return () => useView.setState({ pickable: true })
  }, [interactive])
  return (
    <Canvas
      camera={{ position: [-3.6, 2.6, 6.8], fov: 38, near: 0.01, far: 50 }}
      dpr={[1, 1.5]}
      onCreated={({ gl, camera, get }) => {
        gl.localClippingEnabled = true
        // Accesso alla camera per i test visivi automatici, solo in sviluppo.
        if (import.meta.env.DEV) Object.assign(window, { __camera: camera, __view: useView, __three: get })
      }}
      onPointerMissed={() => interactive && select(null)}
    >
      <color attach="background" args={['#0b0f15']} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[3, 4, 2]} intensity={1.6} />
      <directionalLight position={[-3, -1, -2]} intensity={0.5} />
      {/* Ambiente di riflessione generato localmente, senza file HDR esterni. */}
      <Environment resolution={256}>
        <Lightformer intensity={2} position={[0, 4, 0]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} />
        <Lightformer intensity={1.2} position={[5, 1, 2]} rotation-y={-Math.PI / 2} scale={[6, 3, 1]} />
        <Lightformer intensity={0.8} position={[-5, 0, -2]} rotation-y={Math.PI / 2} scale={[6, 3, 1]} />
      </Environment>
      <Engine />
      <FlowMap />
      <Livery />
      <OrbitControls
        makeDefault
        target={[1.3, 0, 0]}
        enableDamping
        enableZoom={interactive}
        enablePan={interactive}
        minDistance={0.15}
        maxDistance={14}
      />
      <CameraRig />
      <ExplodeAnimator />
      {children}
    </Canvas>
  )
}
