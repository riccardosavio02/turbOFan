import { useMemo, useState } from 'react'
import { useCycle } from '../physics/useCycle'
import { rotorTriangles, type RotorTriangles, type Velocities } from '../physics/triangles'

const fmt = (x: number, d = 1) => x.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d })

/**
 * Un triangolo di velocità: U (tangenziale), V assoluta e W relativa con origine comune, convenzione
 * dei testi di turbomacchine. Asse assiale verso il basso, direzione di rotazione verso destra.
 */
function Triangle({ v, scale, label, height }: { v: Velocities; scale: number; label: string; height: number }) {
  const W = 150
  const H = height
  const ox = W / 2
  const oy = 16
  const k = scale
  // Componenti tangenziali positive nel verso di rotazione; V = W + U vale per compressori e turbine.
  const Vt = v.Vt
  const Wt = v.Vt - v.U
  const p = (t: number, z: number) => [ox + t * k, oy + z * k] as const
  const [vx, vy] = p(Vt, v.Vz)
  const [wx, wy] = p(Wt, v.Vz)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="tri" role="img" aria-label={`Triangolo di velocità ${label}`}>
      <defs>
        <marker id="ah" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0,0 L6,3 L0,6 z" fill="currentColor" />
        </marker>
      </defs>
      <text x={4} y={11} className="tlabel">
        {label}
      </text>
      <line x1={wx} y1={wy} x2={vx} y2={vy} className="u" markerEnd="url(#ah)" />
      <line x1={ox} y1={oy} x2={vx} y2={vy} className="vabs" markerEnd="url(#ah)" />
      <line x1={ox} y1={oy} x2={wx} y2={wy} className="vrel" markerEnd="url(#ah)" />
      <line x1={ox} y1={oy} x2={ox} y2={H - 4} className="axisline" />
      <text x={(vx + wx) / 2} y={vy + 11} textAnchor="middle" className="tu">
        U
      </text>
      <text x={vx + (vx >= ox ? 4 : -4)} y={(oy + vy) / 2} textAnchor={vx >= ox ? 'start' : 'end'} className="tv">
        V
      </text>
      <text x={wx + (wx >= ox ? 4 : -4)} y={(oy + wy) / 2} textAnchor={wx >= ox ? 'start' : 'end'} className="tw">
        W
      </text>
    </svg>
  )
}

function Rows({ t }: { t: RotorTriangles }) {
  const r = [
    ['U [m/s]', t.in.U, t.out.U, 0],
    ['Vz [m/s]', t.in.Vz, t.out.Vz, 0],
    ['Vθ [m/s]', t.in.Vt, t.out.Vt, 0],
    ['α assoluto [°]', t.in.alpha, t.out.alpha, 1],
    ['β relativo [°]', t.in.beta, t.out.beta, 1],
    ['M assoluto', t.in.Mabs, t.out.Mabs, 2],
    ['M relativo', t.in.Mrel, t.out.Mrel, 2],
  ] as const
  return (
    <table>
      <thead>
        <tr>
          <th></th>
          <th>Ingresso</th>
          <th>Uscita</th>
        </tr>
      </thead>
      <tbody>
        {r.map(([l, a, b, d]) => (
          <tr key={l}>
            <td>{l}</td>
            <td>{fmt(a, d)}</td>
            <td>{fmt(b, d)}</td>
          </tr>
        ))}
        {t.metal && (
          <tr>
            <td>{t.kind === 'turbine' ? 'β della Tab. II [°]' : 'β metallico [°]'}</td>
            <td>{fmt(t.metal.beta1)}</td>
            <td>{fmt(t.metal.beta2)}</td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

export function TrianglePanel({ id }: { id: string }) {
  const { out } = useCycle()
  const all = useMemo(() => rotorTriangles(out), [out])
  const t = all.get(id)
  if (!t) return null
  const turbine = t.kind === 'turbine'
  const vmax = Math.max(t.in.U, t.out.U, t.in.V, t.out.V, t.in.Wrel, t.out.Wrel)
  const scale = 105 / vmax
  // Altezza del disegno adattata alla componente assiale più lunga.
  const h = Math.round(16 + Math.max(t.in.Vz, t.out.Vz) * scale + 22)
  return (
    <div className="card">
      <p className="eyebrow">Triangoli di velocità a metà portata</p>
      <div className="tripair">
        <Triangle v={t.in} scale={scale} label="Ingresso" height={h} />
        <Triangle v={t.out} scale={scale} label="Uscita" height={h} />
      </div>
      <p className="small">
        <span className="kv">V</span> assoluta, <span className="kw">W</span> relativa alla pala,{' '}
        <span className="ku">U</span> velocità periferica (rotazione verso destra, flusso verso il basso). Regime{' '}
        {fmt(t.rpm, 0)} rpm.
      </p>
      <Rows t={t} />
      <dl className="facts">
        {t.incidence !== undefined && (
          <>
            <dt>Incidenza</dt>
            <dd>{fmt(t.incidence)}°</dd>
            <dt>Deviazione</dt>
            <dd>{fmt(t.deviation!)}°</dd>
          </>
        )}
        <dt>De Haller W₂/W₁</dt>
        <dd>
          {fmt(t.deHaller, 2)}
          {!turbine && t.deHaller < 0.72 ? ' (diffusione spinta)' : ''}
        </dd>
        <dt>Lavoro di Eulero</dt>
        <dd>{fmt(t.work / 1000)} kJ/kg</dd>
        {t.workCycle !== undefined && (
          <>
            <dt>Salto entalpico del ciclo</dt>
            <dd>
              {fmt(t.workCycle / 1000)} kJ/kg ({fmt((t.work / t.workCycle) * 100, 0)}%)
            </dd>
          </>
        )}
      </dl>
      <p className="src">
        {t.source} Velocità dal punto di funzionamento del menu «Ciclo».
        {t.workCycle !== undefined &&
          ' Nelle turbine gli angoli sono dati del report e il lavoro di Eulero che ne risulta è un controllo indipendente: più si avvicina al 100% del salto entalpico del ciclo, più dati e modello sono coerenti.'}
        {t.incidence !== undefined &&
          " Incidenza e deviazione sono riferite agli angoli metallici della pala: un'incidenza negativa indica un flusso più assiale del profilo."}
      </p>
    </div>
  )
}

/** Selettore del rotore + triangoli: usato nel menu «Ciclo» e nella storia. */
export function TriangleExplorer({ initial = 'HPC_R1' }: { initial?: string }) {
  const { out } = useCycle()
  const all = useMemo(() => rotorTriangles(out), [out])
  const [id, setId] = useState(initial)
  const groups: [string, string][] = [
    ['R1_fan_rotor', 'Fan'],
    ...[...all.keys()].filter((k) => k.startsWith('HPC_')).map((k) => [k, `HPC rotore ${k.slice(5)}`] as [string, string]),
    ...[...all.keys()].filter((k) => k.startsWith('HPT_')).map((k) => [k, `HPT rotore ${k.slice(5)}`] as [string, string]),
    ...[...all.keys()].filter((k) => k.startsWith('LPT_')).map((k) => [k, `LPT rotore ${k.slice(5)}`] as [string, string]),
  ]
  return (
    <div>
      <label className="slider">
        <span>Rotore</span>
        <select value={id} onChange={(e) => setId(e.target.value)}>
          {groups.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <TrianglePanel id={id} />
    </div>
  )
}
