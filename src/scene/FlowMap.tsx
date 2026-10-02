import { useMemo } from 'react'
import { BufferGeometry, DoubleSide, Float32BufferAttribute } from 'three'
import { flowPaths, SCALES, type FlowPoint } from '../physics/flowmap'
import { useCycle } from '../physics/useCycle'
import { useView } from '../store'

/** Punti ricampionati lungo il condotto, così il colore sfuma tra le stazioni. */
function resample(path: FlowPoint[], perSegment = 6): FlowPoint[] {
  const out: FlowPoint[] = [path[0]]
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]
    const b = path[i]
    for (let k = 1; k <= perSegment; k++) {
      const w = k / perSegment
      out.push({
        z: a.z + (b.z - a.z) * w,
        rh: a.rh + (b.rh - a.rh) * w,
        rt: a.rt + (b.rt - a.rt) * w,
        T: a.T + (b.T - a.T) * w,
        P: a.P * (b.P / a.P) ** w,
      })
    }
  }
  return out
}

/**
 * Striscia colorata tra mozzo e apice del condotto, posata sui due semipiani di taglio
 * (z = 0 con y > 0, y = 0 con z > 0). Semitrasparente: lascia intravedere le pale dietro.
 */
function stripGeometry(path: FlowPoint[], color: (p: FlowPoint) => [number, number, number]): BufferGeometry {
  const pts = resample(path)
  const pos: number[] = []
  const col: number[] = []
  const idx: number[] = []
  for (const plane of [0, 1]) {
    const base = pos.length / 3
    for (const p of pts) {
      const c = color(p)
      for (const r of [p.rh, p.rt]) {
        if (plane === 0) pos.push(p.z, r, 0.0005)
        else pos.push(p.z, 0.0005, r)
        col.push(...c)
      }
    }
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = base + 2 * i
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  return g
}

export function FlowMap() {
  const mode = useView((s) => s.flowMap)
  const cutaway = useView((s) => s.cutaway)
  const exploded = useView((s) => s.explode > 0.01)
  const { out } = useCycle()
  const geometries = useMemo(() => {
    if (mode === 'none') return []
    const paths = flowPaths(out)
    const color = (p: FlowPoint) => (mode === 'T' ? SCALES.T.color(p.T) : SCALES.P.color(p.P))
    return [paths.core, paths.bypass, paths.mixed].map((p) => stripGeometry(p, color))
  }, [mode, out])
  if (mode === 'none' || !cutaway || exploded) return null
  return (
    <>
      {geometries.map((g, i) => (
        <mesh key={i} geometry={g} raycast={() => null} renderOrder={2}>
          <meshBasicMaterial vertexColors side={DoubleSide} transparent opacity={0.82} depthWrite={false} />
        </mesh>
      ))}
    </>
  )
}
