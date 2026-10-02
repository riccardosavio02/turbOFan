import { useShallow } from 'zustand/react/shallow'
import { useView, type FlowMapMode } from '../store'
import { useCycle } from '../physics/useCycle'
import { RATING_LABEL, type Rating } from '../physics/ratings'
import { checks, relErr } from '../physics/validation'
import { SCALES } from '../physics/flowmap'
import { R_GAS, entropyFn } from '../physics/thermo'
import { T41_RANGE } from '../physics/offdesign'
import type { CycleResult } from '../physics/cycle'
import { MapCharts } from './MapChart'
import { TriangleExplorer } from './Triangles'

const fmt = (x: number, d = 1) => x.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d })

const RATINGS: [Rating | 'custom', string][] = [
  ['max_climb', 'Salita'],
  ['max_cruise', 'Crociera'],
  ['takeoff', 'Decollo'],
  ['custom', 'Libero'],
]
const MAPS: [FlowMapMode, string][] = [
  ['none', 'Nessuna'],
  ['T', 'Temperatura'],
  ['P', 'Pressione'],
]

/** Stazioni del flusso primario per il diagramma T–s, nell'ordine del ciclo. */
const TS_STATIONS = ['2', '23', '25', '3', '4', '41', '42', '49', '5', '7']

export function TsDiagram({ out }: { out: CycleResult }) {
  const pts = TS_STATIONS.map((id) => {
    const s = out.stations[id]
    return { id, T: s.T, s: entropyFn(s.T, s.far) - R_GAS * Math.log(s.P / 101325) }
  })
  const s0 = Math.min(...pts.map((p) => p.s))
  const s1 = Math.max(...pts.map((p) => p.s))
  const W = 320
  const H = 190
  const pad = 26
  const x = (s: number) => pad + ((s - s0) / (s1 - s0 || 1)) * (W - 2 * pad)
  const y = (T: number) => H - pad - ((T - 200) / 1500) * (H - 2 * pad)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ts" role="img" aria-label="Diagramma temperatura-entropia del flusso primario">
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} className="axis" />
      <line x1={pad} y1={pad} x2={pad} y2={H - pad} className="axis" />
      {[500, 1000, 1500].map((T) => (
        <g key={T}>
          <line x1={pad} x2={W - pad} y1={y(T)} y2={y(T)} className="gridline" />
          <text x={pad - 4} y={y(T) + 3} textAnchor="end">
            {T}
          </text>
        </g>
      ))}
      <text x={W / 2} y={H - 6} textAnchor="middle">
        entropia s →
      </text>
      <text x={8} y={pad - 10}>
        T [K]
      </text>
      <polyline points={pts.map((p) => `${x(p.s)},${y(p.T)}`).join(' ')} className="ts-line" />
      {pts.map((p) => (
        <g key={p.id}>
          <circle cx={x(p.s)} cy={y(p.T)} r={3} fill={SCALES.css(SCALES.T.color(p.T))} />
          <text x={x(p.s) + 5} y={y(p.T) - 4} className="st">
            {p.id}
          </text>
        </g>
      ))}
    </svg>
  )
}

function Legend({ mode }: { mode: FlowMapMode }) {
  if (mode === 'none') return null
  const sc = mode === 'T' ? SCALES.T : SCALES.P
  const stops = Array.from({ length: 9 }, (_, i) => {
    const v = mode === 'T' ? sc.min + ((sc.max - sc.min) * i) / 8 : 1000 * sc.min * (sc.max / sc.min) ** (i / 8)
    return SCALES.css(sc.color(v))
  })
  return (
    <div className="legend">
      <span>{sc.label}</span>
      <div className="bar" style={{ background: `linear-gradient(90deg, ${stops.join(',')})` }} />
      <div className="ends">
        <span>
          {sc.min} {sc.unit}
        </span>
        <span>
          {sc.max} {sc.unit}
          {mode === 'P' && ' (scala log.)'}
        </span>
      </div>
    </div>
  )
}

function Slider(p: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) {
  return (
    <label className="slider">
      <span>
        {p.label} <b>{fmt(p.value, p.step < 1 ? 2 : 0)} {p.unit}</b>
      </span>
      <input type="range" min={p.min} max={p.max} step={p.step} value={p.value} onChange={(e) => p.onChange(+e.target.value)} />
    </label>
  )
}

export function CycleTab() {
  const { rating, setRating, flowMap, setFlowMap, custom, setCustom } = useView(
    useShallow((s) => ({
      rating: s.rating,
      setRating: s.setRating,
      flowMap: s.flowMap,
      setFlowMap: s.setFlowMap,
      custom: s.custom,
      setCustom: s.setCustom,
    })),
  )
  const { out, prediction, converged } = useCycle()
  const s = out.stations
  const list = prediction && rating !== 'custom' ? checks(rating, prediction) : []
  return (
    <div className="tab cycle-tab">
      <div className="seg" role="group" aria-label="Punto di funzionamento">
        {RATINGS.map(([r, l]) => (
          <button key={r} className={r === rating ? 'on' : ''} onClick={() => setRating(r)}>
            {l}
          </button>
        ))}
      </div>
      {rating !== 'custom' ? (
        <p className="small">
          {RATING_LABEL[rating]}
          {rating !== 'max_climb' && ' — previsione del modello fuori progetto, giornata ISA a spinta di rating.'}
        </p>
      ) : (
        <div className="sliders">
          <Slider label="T41 (manetta)" value={custom.T41} min={T41_RANGE.min} max={T41_RANGE.max} step={10} unit="K" onChange={(v) => setCustom({ T41: v })} />
          <Slider label="Mach di volo" value={custom.mach} min={0} max={0.85} step={0.05} unit="" onChange={(v) => setCustom({ mach: v })} />
          <Slider label="Quota" value={custom.altM} min={0} max={12000} step={250} unit="m" onChange={(v) => setCustom({ altM: v })} />
          <Slider label="Scostamento ISA" value={custom.dTisa} min={-20} max={30} step={1} unit="K" onChange={(v) => setCustom({ dTisa: v })} />
          {!converged && <p className="warn">Il modello non converge in queste condizioni: i valori mostrati non sono affidabili.</p>}
          <p className="small">
            Campo di validità: T41 da {T41_RANGE.min} a {T41_RANGE.max} K. Sotto, le turbine non sono più strozzate e le
            ipotesi del modello cadono.
          </p>
        </div>
      )}
      <h3>Colora il condotto</h3>
      <div className="seg" role="group" aria-label="Colorazione del condotto">
        {MAPS.map(([m, l]) => (
          <button key={m} className={m === flowMap ? 'on' : ''} onClick={() => setFlowMap(m)}>
            {l}
          </button>
        ))}
      </div>
      <Legend mode={flowMap} />
      <div className="kpis">
        <div>
          <b>{fmt(out.thrust / 1000)}</b>
          <span>kN spinta netta</span>
        </div>
        <div>
          <b>{fmt(out.sfc, 4)}</b>
          <span>kg/(N·h) sfc</span>
        </div>
        <div>
          <b>{fmt(out.derived.OPR, 1)}</b>
          <span>OPR</span>
        </div>
        <div>
          <b>{fmt(out.input.BPR, 2)}</b>
          <span>BPR</span>
        </div>
      </div>
      <TsDiagram out={out} />
      <h3>Mappe dei componenti</h3>
      <MapCharts out={out} />
      <h3>Triangoli di velocità</h3>
      <TriangleExplorer />
      {list.length > 0 && (
        <>
          <h3>Confronto con i report</h3>
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Modello</th>
                <th>Report</th>
                <th>Scarto</th>
              </tr>
            </thead>
            <tbody>
              {list.map((k) => (
                <tr key={k.label} title={k.src}>
                  <td>
                    {k.label} {k.unit && <small>[{k.unit}]</small>}
                  </td>
                  <td>{fmt(k.model, k.digits)}</td>
                  <td>{fmt(k.report, k.digits)}</td>
                  <td className={Math.abs(relErr(k)) <= k.tol ? 'ok' : 'bad'}>
                    {relErr(k) >= 0 ? '+' : ''}
                    {fmt(relErr(k) * 100, 1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <h3>Stazioni (SAE ARP755)</h3>
      <table>
        <thead>
          <tr>
            <th>Stazione</th>
            <th>T [K]</th>
            <th>P [kPa]</th>
            <th>W [kg/s]</th>
          </tr>
        </thead>
        <tbody>
          {out.order.map((id) => (
            <tr key={id}>
              <td>
                <b>{id}</b> {s[id].label}
              </td>
              <td>{fmt(s[id].T, 0)}</td>
              <td>{fmt(s[id].P / 1000, 1)}</td>
              <td>{fmt(s[id].W, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="src">
        Salita: ciclo di progetto con ingressi da CR-168219 Tab. XII, senza tarature. Crociera, decollo e punto libero:
        modello fuori progetto (turbine strozzate, aree fisse di mixer e ugello) tarato solo a max climb. Dettagli in
        docs/cycle-model.md.
      </p>
    </div>
  )
}
