import { Html } from '@react-three/drei'
import { EXPLODE_MODULES, moduleAnchor } from './explode'
import { useView } from '../store'

/** Etichette 3D dei moduli, visibili quando il motore è aperto. */
export function ExplodeLabels({ active }: { active: string | null }) {
  const explode = useView((s) => s.explode)
  if (explode < 0.6) return null
  return (
    <>
      {EXPLODE_MODULES.map((m) => (
        <Html key={m.key} position={moduleAnchor(m)} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`xlabel ${active === m.key ? 'on' : ''}`} style={{ opacity: Math.min(1, (explode - 0.6) / 0.3) }}>
            {m.label}
          </div>
        </Html>
      ))}
    </>
  )
}
