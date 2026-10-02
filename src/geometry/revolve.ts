import { LatheGeometry, Shape, ShapeGeometry, Vector2, type BufferGeometry } from 'three'
import type { Meridional } from '../data/fan'

/**
 * Superficie di rivoluzione attorno all'asse motore (X della scena) da un profilo (Z, R).
 * Un profilo chiuso viene richiuso ripetendo il primo punto.
 */
export function revolve(profile: Meridional[], segments = 160, closed = true): LatheGeometry {
  const pts = profile.map(([z, r]) => new Vector2(r, z))
  if (closed && profile[0][1] > 0) pts.push(pts[0].clone())
  const g = new LatheGeometry(pts, segments)
  g.rotateZ(-Math.PI / 2) // asse di rivoluzione Y → X
  g.computeVertexNormals()
  return g
}

/**
 * Facce di taglio di un corpo di rivoluzione sezionato a 90°: sono esattamente il profilo meridiano
 * posato sui due semipiani di taglio (y = 0 con z > 0, e z = 0 con y > 0). Riempiono la sezione
 * come nei modelli sezionati da museo, invece di lasciare vedere solo le superfici interne.
 */
export function sectionCaps(profile: Meridional[]): BufferGeometry[] {
  const shape = new Shape(profile.map(([z, rr]) => new Vector2(z, rr)))
  const onXY = new ShapeGeometry(shape) // x = Z, y = R: semipiano z = 0, y > 0
  const onXZ = onXY.clone().rotateX(Math.PI / 2) // (x, y, 0) → (x, 0, y): semipiano y = 0, z > 0
  return [onXY, onXZ]
}
