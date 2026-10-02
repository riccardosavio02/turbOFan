import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { fanRows } from '../data/fan'
import { shroudRing } from '../data/shroud'
import { hpcRows } from '../data/hpc'
import { hptRows, lptRows } from '../data/turbines'
import { FuelNozzles, Mixer, SwirlCups } from './Extras'
import { Ex } from './explode'
import { structureBodies } from '../data/structure'
import raw from '../../engines/ge-e3.json'
import { fanBodies } from '../data/flowpath'
import { useView } from '../store'
import { BladeRow } from './BladeRow'
import { Body, BodyCaps } from './Body'

/** Velocità di rotazione visiva dell'albero LP [rad/s]: il vero regime (~3.500 rpm) è rallentato. */
const LP_VISUAL_SPEED = 0.5
/** L'albero HP mantiene il rapporto di giri reale a max climb (CR-168219 Tab. XVIII e XXI). */
const HP_TO_LP = raw.speeds.N_HP_max_climb.v / raw.speeds.N_LP_max_climb.v
const allRows = [...fanRows, ...hpcRows, ...hptRows, ...lptRows]

const allBodies = [...fanBodies, ...structureBodies]

export function Engine() {
  const lp = useRef<Group>(null)
  const hp = useRef<Group>(null)
  const spinning = useView((s) => s.spinning)
  useFrame((_, dt) => {
    if (!lp.current || !hp.current) return
    // Con il motore esploso gli alberi devono essere fermi e a rotazione nulla: alcuni pezzi rotanti
    // (l'albero LP) traslano verso il basso, e la traslazione avviene nel riferimento del gruppo rotante.
    if (useView.getState().explode > 0.001) {
      lp.current.rotation.x = 0
      hp.current.rotation.x = 0
      return
    }
    if (!spinning) return
    // Entrambi gli alberi ruotano nello stesso verso (CR-168219 p.10).
    lp.current.rotation.x += dt * LP_VISUAL_SPEED
    hp.current.rotation.x += dt * LP_VISUAL_SPEED * HP_TO_LP
  })

  return (
    <group>
      <group ref={lp}>
        {allRows.filter((r) => r.spool === 'LP').map((r) => (
          <Ex key={r.id} id={r.id}>
            <BladeRow row={r} />
          </Ex>
        ))}
        <Ex id={shroudRing.id}>
          <Body body={shroudRing} />
        </Ex>
        {allBodies.filter((b) => b.spool === 'LP').map((b) => (
          <Ex key={b.id} id={b.id}>
            <Body body={b} />
          </Ex>
        ))}
      </group>
      <group ref={hp}>
        {allRows.filter((r) => r.spool === 'HP').map((r) => (
          <Ex key={r.id} id={r.id}>
            <BladeRow row={r} />
          </Ex>
        ))}
        {allBodies.filter((b) => b.spool === 'HP').map((b) => (
          <Ex key={b.id} id={b.id}>
            <Body body={b} />
          </Ex>
        ))}
      </group>
      {allRows.filter((r) => r.spool === null).map((r) => (
        <Ex key={r.id} id={r.id}>
            <BladeRow row={r} />
          </Ex>
      ))}
      {allBodies.filter((b) => !b.spool).map((b) => (
        <Ex key={b.id} id={b.id}>
            <Body body={b} />
          </Ex>
      ))}
      {[...allBodies, shroudRing].map((b) => (
        <Ex key={`cap-${b.id}`} id={b.id}>
          <BodyCaps body={b} />
        </Ex>
      ))}
      <Ex id="swirl_cups">
        <SwirlCups />
      </Ex>
      <Ex id="fuel_nozzles">
        <FuelNozzles />
      </Ex>
      <Ex id="mixer">
        <Mixer />
      </Ex>
    </group>
  )
}
