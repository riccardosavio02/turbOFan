import { useLayoutEffect, useMemo, useRef } from 'react'
import { Matrix4, type InstancedMesh } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import type { BladeRowSpec } from '../data/fan'
import { bladeAngles, buildBladeGeometry, meshResolution } from '../geometry/blade'
import { useView } from '../store'
import { PartMaterial, materialKindOf, passThroughClick } from './materials'

/**
 * Una schiera: una sola geometria di pala, replicata con l'instancing. Le pale nel quadrante tolto
 * dallo spaccato vengono tagliate come i gusci, altrimenti nasconderebbero dischi e alberi.
 */
export function BladeRow({ row }: { row: BladeRowSpec }) {
  const geometry = useMemo(() => buildBladeGeometry(row, meshResolution(row)), [row])
  const angles = useMemo(() => bladeAngles(row), [row])
  const ref = useRef<InstancedMesh>(null)
  const selected = useView((s) => s.selected === row.id)
  const hidden = useView((s) => s.hidden[row.id])
  const select = useView((s) => s.select)

  useLayoutEffect(() => {
    const mesh = ref.current!
    const m = new Matrix4()
    angles.forEach((a, i) => mesh.setMatrixAt(i, m.makeRotationX(a)))
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [angles])

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (passThroughClick(e, true)) return
    e.stopPropagation()
    select(row.id)
  }

  return (
    <instancedMesh ref={ref} args={[geometry, undefined, angles.length]} visible={!hidden} onClick={onClick}>
      <PartMaterial id={row.id} kind={materialKindOf(row.material)} selected={selected} cut />
    </instancedMesh>
  )
}
