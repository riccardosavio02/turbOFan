import { useMemo } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import type { RevolvedBody } from '../data/flowpath'
import { revolve, sectionCaps } from '../geometry/revolve'
import { useView } from '../store'
import { PartMaterial, passThroughClick } from './materials'

/** Corpo di rivoluzione (ogiva, cofani, casse, dischi, alberi): uno o più profili, un solo componente. */
export function Body({ body }: { body: RevolvedBody }) {
  const geometries = useMemo(
    () =>
      [body.profile, ...(body.extra ?? [])].map((pr) => {
        // Segmenti in circonferenza proporzionati al raggio: 160 per la gondola, 48 per un albero.
        const rMax = Math.max(...pr.map((q) => q.p[1]))
        return revolve(pr.map((q) => q.p), Math.round(Math.min(160, Math.max(48, rMax * 160))), pr.at(-1)!.p[1] > 0)
      }),
    [body],
  )
  const selected = useView((s) => s.selected === body.id)
  const hidden = useView((s) => s.hidden[body.id])
  const select = useView((s) => s.select)
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (passThroughClick(e, body.cut)) return
    e.stopPropagation()
    select(body.id)
  }
  return (
    <>
      {geometries.map((g, i) => (
        <mesh key={i} geometry={g} visible={!hidden} onClick={onClick}>
          <PartMaterial id={body.id} kind={body.material} selected={selected} cut={body.cut} />
        </mesh>
      ))}
    </>
  )
}

/**
 * Facce di taglio di un corpo sezionato. Vanno montate fuori dai gruppi rotanti: il corpo è
 * assialsimmetrico, quindi la sua sezione resta ferma anche mentre l'albero gira.
 */
export function BodyCaps({ body }: { body: RevolvedBody }) {
  const geometries = useMemo(
    () => [body.profile, ...(body.extra ?? [])].flatMap((pr) => sectionCaps(pr.map((q) => q.p))),
    [body],
  )
  const cutaway = useView((s) => s.cutaway)
  const selected = useView((s) => s.selected === body.id)
  const hidden = useView((s) => s.hidden[body.id])
  const select = useView((s) => s.select)
  const focus = useView((s) => s.focusIds)
  // In modalità fuoco le facce di taglio delle parti attenuate si nascondono del tutto.
  if (!body.cut || !cutaway || hidden || (focus && !focus.includes(body.id))) return null
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    select(body.id)
  }
  return (
    <>
      {geometries.map((g, i) => (
        <mesh key={i} geometry={g} onClick={onClick}>
          <PartMaterial id={body.id} kind={body.material} selected={selected} section />
        </mesh>
      ))}
    </>
  )
}
