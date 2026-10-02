import { fanRows, type BladeRowSpec } from '../data/fan'
import { hpcRows } from '../data/hpc'
import { hptRows, lptRows } from '../data/turbines'
import { fuelNozzleInfo, mixerInfo, swirlerInfo } from '../scene/Extras'
import { structureBodies } from '../data/structure'
import { fanBodies, type RevolvedBody } from '../data/flowpath'
import { interpolateSection, meridionalAt } from '../geometry/blade'
import { shroudRing } from '../data/shroud'
import { useView } from '../store'
import { GROUPS, framing } from '../scene/focus'
import components from '../content/components.json'
import { facts, fill } from '../content/facts'
import { Citations } from './Citations'
import { TrianglePanel } from './Triangles'

const FACTS = facts()
/** Gruppo didattico di un componente (il primo che lo contiene, nell'ordine del motore). */
const groupOf = (id: string) => Object.keys(GROUPS).find((g) => GROUPS[g].includes(id))

function GroupCard({ id }: { id: string }) {
  const g = groupOf(id)
  const card = g ? (components.groups as Record<string, { title: string; what: string; function: string; cites: string[] }>)[g] : null
  if (!card) return null
  return (
    <div className="card">
      <p className="eyebrow">{card.title}</p>
      <p>
        <b>Che cos'è.</b> {fill(card.what, FACTS)}
      </p>
      <p>
        <b>A che cosa serve.</b> {fill(card.function, FACTS)}
      </p>
      <Citations keys={card.cites} />
    </div>
  )
}

const fmt = (x: number, d = 1) => x.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d })

function RowInfo({ row }: { row: BladeRowSpec }) {
  const spans = [0, 0.5, 1]
  const sec = spans.map((s) => interpolateSection(row.sections, s))
  const solidity = spans.map((s, i) => {
    const r = meridionalAt(row.quad, s, 0.5)[1]
    const n = row.id.startsWith('OGV_bypass_') ? 34 : row.count
    return sec[i].chord / ((2 * Math.PI * r) / n)
  })
  const q = row.quad
  const cm = (p: [number, number]) => `${fmt(p[0] * 100)} / ${fmt(p[1] * 100)}`
  return (
    <>
      <dl className="facts">
        <dt>{row.kind === 'rotor' ? 'Pale' : 'Palette'}</dt>
        <dd>{row.count}</dd>
        <dt>Materiale</dt>
        <dd>{row.material}</dd>
      </dl>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Mozzo</th>
            <th>50%</th>
            <th>Apice</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Corda [cm]</td>
            {sec.map((s, i) => <td key={i}>{fmt(s.chord * 100)}</td>)}
          </tr>
          <tr>
            <td>Calettamento [°]</td>
            {sec.map((s, i) => <td key={i}>{fmt(s.staggerDeg)}</td>)}
          </tr>
          <tr>
            <td>Camber [°]</td>
            {sec.map((s, i) => <td key={i}>{fmt(s.camberDeg)}</td>)}
          </tr>
          <tr>
            <td>t/c</td>
            {sec.map((s, i) => <td key={i}>{fmt(s.tmc, 3)}</td>)}
          </tr>
          <tr>
            <td>Solidità σ</td>
            {solidity.map((s, i) => <td key={i}>{fmt(s, 2)}</td>)}
          </tr>
        </tbody>
      </table>
      <p className="small">
        Bordi (Z / R, cm) — attacco: mozzo {cm(q.hubLE)}, apice {cm(q.tipLE)}; uscita: mozzo {cm(q.hubTE)}, apice {cm(q.tipTE)}.
      </p>
      <p className="src">
        Fonte: {row.source}
        {row.module === 'fan' && '. Bordi da CR-165148 App. A'}
        {row.module === 'hpc' && '. Bordi da CR-165558 Tab. XXI'}. Forma del profilo (arco di circonferenza + spessore
        NACA){row.turbine && ', angoli metallici posti uguali agli angoli di flusso'} e impilamento sulla mezzeria della
        corda: <b>stima</b>.
      </p>
    </>
  )
}

function BodyInfo({ body }: { body: RevolvedBody }) {
  const data = body.profile.filter((p) => p.src === 'data').length
  return (
    <>
      <p>{body.note}</p>
      <p className="src">
        Profilo: {data} punti da dati del report, {body.profile.length - data} stimati.
      </p>
    </>
  )
}

export function Info() {
  const selected = useView((s) => s.selected)
  const select = useView((s) => s.select)
  const focusIds = useView((s) => s.focusIds)
  const setFocus = useView((s) => s.setFocus)
  const flyTo = useView((s) => s.flyTo)
  if (!selected) return null
  const row = [...fanRows, ...hpcRows, ...hptRows, ...lptRows].find((r) => r.id === selected)
  const extra = [mixerInfo, swirlerInfo, fuelNozzleInfo].find((x) => x.id === selected)
  const body = [...fanBodies, ...structureBodies, shroudRing].find((b) => b.id === selected)
  const group = groupOf(selected)
  const isolated = !!focusIds
  return (
    <aside className="panel info">
      <header>
        <h2>{row?.label ?? body?.label ?? extra?.label}</h2>
        <button className="ghost" onClick={() => select(null)} aria-label="Chiudi">
          ×
        </button>
      </header>
      <div className="actions">
        <button onClick={() => flyTo(framing([selected]))}>Inquadra</button>
        <button className={isolated ? 'on' : ''} onClick={() => setFocus(isolated ? null : group ? GROUPS[group] : [selected])}>
          {isolated ? 'Mostra tutto' : 'Isola il modulo'}
        </button>
      </div>
      <GroupCard id={selected} />
      {row?.kind === 'rotor' && <TrianglePanel id={selected} />}
      <h3>Dati del componente</h3>
      {row && <RowInfo row={row} />}
      {body && <BodyInfo body={body} />}
      {extra && <p>{extra.note}</p>}
    </aside>
  )
}
