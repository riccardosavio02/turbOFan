import { useState } from 'react'
import { MAPS, fanOnMap, hpcOnMap } from '../physics/maps'
import { calibration } from '../physics/useCycle'
import type { CycleResult } from '../physics/cycle'

type Pt = [number, number]
const fmt = (x: number, d = 1) => x.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d })

interface Frame {
  x0: number
  x1: number
  y0: number
  y1: number
  xTicks: number[]
  yTicks: number[]
  xLabel: string
  yLabel: string
}

function Chart({
  frame,
  lines,
  stall,
  operating,
  ratings,
  point,
}: {
  frame: Frame
  lines: { label: string; pts: Pt[] }[]
  stall: Pt[]
  operating: Pt[][]
  ratings: { label: string; p: Pt }[]
  point: Pt
}) {
  const W = 340
  const H = 230
  const L = 38
  const B = 30
  const x = (v: number) => L + ((v - frame.x0) / (frame.x1 - frame.x0)) * (W - L - 8)
  const y = (v: number) => H - B - ((v - frame.y0) / (frame.y1 - frame.y0)) * (H - B - 8)
  const path = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mapchart" role="img" aria-label="Mappa del componente con il punto di funzionamento">
      {frame.xTicks.map((t) => (
        <g key={`x${t}`}>
          <line x1={x(t)} x2={x(t)} y1={8} y2={H - B} className="gridline" />
          <text x={x(t)} y={H - B + 12} textAnchor="middle">
            {t}
          </text>
        </g>
      ))}
      {frame.yTicks.map((t) => (
        <g key={`y${t}`}>
          <line x1={L} x2={W - 8} y1={y(t)} y2={y(t)} className="gridline" />
          <text x={L - 4} y={y(t) + 3} textAnchor="end">
            {t}
          </text>
        </g>
      ))}
      <text x={(W + L) / 2} y={H - 4} textAnchor="middle">
        {frame.xLabel}
      </text>
      <text x={10} y={H / 2} textAnchor="middle" transform={`rotate(-90 10 ${H / 2})`}>
        {frame.yLabel}
      </text>
      {lines.map((l) => (
        <g key={l.label}>
          <path d={path(l.pts)} className="speedline" />
          <text x={x(l.pts.at(-1)![0]) + 2} y={y(l.pts.at(-1)![1]) + 9} className="speedlabel">
            {l.label}
          </text>
        </g>
      ))}
      <path d={path(stall)} className="stall" />
      {operating.map((o, i) => (
        <path key={i} d={path(o)} className="opline" />
      ))}
      {ratings.map((r) => (
        <g key={r.label}>
          <rect x={x(r.p[0]) - 3} y={y(r.p[1]) - 3} width={6} height={6} className="rating" />
        </g>
      ))}
      <circle cx={x(point[0])} cy={y(point[1])} r={5} className="op" />
    </svg>
  )
}

export function MapCharts({ out }: { out: CycleResult }) {
  const [which, setWhich] = useState<'fan' | 'hpc'>('fan')
  const cal = calibration()
  const fan = fanOnMap(out.input.W2c, out.input.prFanBypass, cal.fanRef)
  const hpc = hpcOnMap(out.derived.W25c, out.input.prHpc, cal.hpcRef)
  const p = which === 'fan' ? fan : hpc
  const fm = MAPS.fan
  const hm = MAPS.hpc
  return (
    <div className="maps">
      <div className="seg" role="group" aria-label="Mappa">
        <button className={which === 'fan' ? 'on' : ''} onClick={() => setWhich('fan')}>
          Fan (bypass)
        </button>
        <button className={which === 'hpc' ? 'on' : ''} onClick={() => setWhich('hpc')}>
          Compressore HP
        </button>
      </div>
      {which === 'fan' ? (
        <Chart
          frame={{ x0: 350, x1: 1550, y0: 1.0, y1: 2.05, xTicks: [400, 800, 1200], yTicks: [1.2, 1.4, 1.6, 1.8, 2.0], xLabel: 'portata corretta totale [lb/s]', yLabel: 'β bypass' }}
          lines={Object.entries(fm.speed_lines)
            .filter(([n]) => n !== '97.8')
            .map(([n, v]) => ({ label: `${n}%`, pts: v.pr as Pt[] }))}
          stall={fm.stall_line as Pt[]}
          operating={[fm.operating_lines.sls as Pt[], fm.operating_lines.altitude_cruise as Pt[]]}
          ratings={Object.entries(fm.rating_points_TabVI)
            .filter(([k]) => k !== 'src')
            .map(([k, v]) => ({ label: k, p: v as Pt }))}
          point={[p.flow, p.pr]}
        />
      ) : (
        <Chart
          frame={{ x0: 0, x1: 130, y0: 1, y1: 28, xTicks: [20, 60, 100], yTicks: [5, 10, 15, 20, 25], xLabel: 'portata corretta [lbm/s]', yLabel: 'β HPC' }}
          lines={Object.entries(hm.speed_stubs).map(([n, v]) => ({ label: `${n}%`, pts: v as Pt[] }))}
          stall={hm.stall_line as Pt[]}
          operating={[hm.operating_line_FPS as Pt[]]}
          ratings={[]}
          point={[p.flow, p.pr]}
        />
      )}
      <div className="kpis three">
        <div>
          <b>{fmt(p.speedPct, 1)}%</b>
          <span>velocità corretta</span>
        </div>
        <div>
          <b>{fmt(p.stallMargin * 100, 1)}%</b>
          <span>margine di stallo (portata cost.)</span>
        </div>
        <div>
          <b>{fmt(p.etaMap, 3)}</b>
          <span>rendimento di mappa (banco)</span>
        </div>
      </div>
      {p.outside && <p className="warn">Il punto cade fuori dalla zona coperta dalla mappa pubblicata: valori estrapolati.</p>}
      <p className="src">
        {which === 'fan'
          ? 'Mappa del bypass: CR-168070 Fig. 3 (prova al banco 1981), digitalizzata. Quadrati: punti di rating della Tab. VI. Linea rossa: stallo obiettivo; tratteggio: linee operative al suolo e in quota.'
          : 'Mappa del compressore HP: CR-168069 Fig. 91 (prova del core), digitalizzata. Sono pubblicati solo tratti delle linee di velocità vicino alla linea operativa (tratteggio).'}{' '}
        Il punto del ciclo è riportato in coordinate di mappa con la scalatura attorno a max climb; il rendimento del
        ciclo varia in proporzione a quello di mappa.
      </p>
    </div>
  )
}
