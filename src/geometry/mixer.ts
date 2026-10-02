import { BufferGeometry, Float32BufferAttribute } from 'three'

export interface MixerParams {
  /** Inizio e lunghezza [m]. */
  z0: number
  length: number
  /** Raggio all'inizio, dove il mixer si raccorda al cofano del core [m]. */
  r0: number
  /** Raggio medio e semi-ampiezza dei lobi all'uscita [m]. */
  rMean: number
  amplitude: number
  lobes: number
}

/**
 * Mixer lobato: superficie r(θ, z) = r̄(z) + A(z)·cos(nθ), con A che cresce da 0 (anello circolare)
 * all'ampiezza piena all'uscita. I lobi esterni portano il gas caldo nel bypass, quelli interni
 * l'aria fredda verso il centro: così i due flussi si mescolano prima dell'ugello.
 */
export function buildMixerGeometry(p: MixerParams, segTheta = 360, segZ = 24): BufferGeometry {
  const pos: number[] = []
  const idx: number[] = []
  for (let j = 0; j <= segZ; j++) {
    const s = j / segZ
    const ease = s * s * (3 - 2 * s)
    const z = p.z0 + p.length * s
    const rBar = p.r0 + (p.rMean - p.r0) * ease
    const a = p.amplitude * ease
    for (let i = 0; i <= segTheta; i++) {
      const th = (2 * Math.PI * i) / segTheta
      const r = rBar + a * Math.cos(p.lobes * th)
      pos.push(z, r * Math.cos(th), r * Math.sin(th))
    }
  }
  const W = segTheta + 1
  for (let j = 0; j < segZ; j++)
    for (let i = 0; i < segTheta; i++) {
      const a = j * W + i
      idx.push(a, a + W, a + 1, a + 1, a + W, a + W + 1)
    }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}
