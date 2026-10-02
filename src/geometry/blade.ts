/**
 * Generatore della pala 3D di una schiera.
 *
 * Ogni sezione 2D (airfoil.ts) è ruotata del calettamento nel piano (assiale, tangenziale) e
 * collocata nel quadrilatero meridionale della schiera (LE/TE al mozzo e all'apice, CR-165148 App. A):
 * la coordinata assiale lungo la corda è normalizzata sulla corda assiale c·cos(stagger) e
 * interpolata bilinearmente tra i bordi, la coordinata tangenziale diventa un angolo t/R.
 * Così la pala si adatta esattamente al condotto, anche con mozzo inclinato o palette a freccia.
 */
import { BufferGeometry, Float32BufferAttribute } from 'three'
import { airfoilContour, type SectionParams } from './airfoil'
import type { BladeRowSpec, Meridional, RowKind, RowQuad, SpanSection } from '../data/fan'

const DEG = Math.PI / 180

/** Interpolazione lineare dei parametri di sezione alla frazione di altezza `span`. */
export function interpolateSection(sections: SpanSection[], span: number): SectionParams {
  const s = [...sections].sort((a, b) => a.span - b.span)
  let i = s.findIndex((q) => q.span >= span)
  if (i <= 0) i = i === 0 ? 1 : s.length - 1
  const a = s[i - 1]
  const b = s[i]
  const w = Math.min(Math.max((span - a.span) / (b.span - a.span), 0), 1)
  const lerp = (x: number, y: number) => x + (y - x) * w
  return {
    chord: lerp(a.chord, b.chord),
    staggerDeg: lerp(a.staggerDeg, b.staggerDeg),
    camberDeg: lerp(a.camberDeg, b.camberDeg),
    tmc: lerp(a.tmc, b.tmc),
    xtm: a.xtm !== undefined && b.xtm !== undefined ? lerp(a.xtm, b.xtm) : undefined,
  }
}

/** Punto meridionale alla frazione di altezza `span` e frazione di corda assiale `s`. */
export function meridionalAt(q: RowQuad, span: number, s: number): Meridional {
  const le: Meridional = [q.hubLE[0] + (q.tipLE[0] - q.hubLE[0]) * span, q.hubLE[1] + (q.tipLE[1] - q.hubLE[1]) * span]
  const te: Meridional = [q.hubTE[0] + (q.tipTE[0] - q.hubTE[0]) * span, q.hubTE[1] + (q.tipTE[1] - q.hubTE[1]) * span]
  return [le[0] + (te[0] - le[0]) * s, le[1] + (te[1] - le[1]) * s]
}

/**
 * Sezione nel piano (a assiale, t tangenziale), con origine nel bordo d'attacco in `a` e nel
 * punto medio della corda in `t` (impilamento sulla mezzeria della corda: stima).
 * Convenzione: la pala ruota verso +t. In un rotore di compressore la corda va contro la
 * rotazione e il lato concavo guarda il verso di rotazione; uno statore è speculare.
 */
export function sectionCascade(p: SectionParams, kind: RowKind, n = 40, turbine = false): [number, number][] {
  const g = p.staggerDeg * DEG
  // Riferimento della schiera: angoli positivi verso sign·t. Le turbine hanno il verso opposto.
  const sign = (kind === 'rotor' ? -1 : 1) * (turbine ? -1 : 1)
  const tMid = sign * (p.chord / 2) * Math.sin(g)
  return airfoilContour(p, n).map(([x, y]) => [
    x * Math.cos(g) - y * Math.sin(g),
    sign * (x * Math.sin(g) + y * Math.cos(g)) - tMid,
  ])
}

/** Vertici 3D di una sezione. Asse motore = X della scena; Y verso l'alto. */
export function section3D(row: Pick<BladeRowSpec, 'kind' | 'quad' | 'sections' | 'turbine'>, span: number, n = 40): number[][] {
  const p = interpolateSection(row.sections, span)
  const axialChord = p.chord * Math.cos(p.staggerDeg * DEG)
  return sectionCascade(p, row.kind, n, row.turbine).map(([a, t]) => {
    const [z, r] = meridionalAt(row.quad, span, a / axialChord)
    const phi = t / r
    return [z, r * Math.cos(phi), r * Math.sin(phi)]
  })
}

export interface BladeMeshOptions {
  spanSteps?: number
  pointsPerSide?: number
  /** Affondamento della radice sotto il mozzo, in frazione di altezza: evita la coincidenza delle superfici. */
  rootEmbed?: number
}

/** Superficie chiusa di una pala (dorso, ventre, tappi di mozzo e apice). */
export function buildBladeGeometry(
  row: Pick<BladeRowSpec, 'kind' | 'quad' | 'sections' | 'turbine'>,
  { spanSteps = 28, pointsPerSide = 36, rootEmbed = 0.02 }: BladeMeshOptions = {},
): BufferGeometry {
  const rings: number[][][] = []
  for (let j = 0; j <= spanSteps; j++) {
    const span = -rootEmbed + ((1 + rootEmbed) * j) / spanSteps
    rings.push(section3D(row, span, pointsPerSide))
  }
  const P = rings[0].length
  const pos: number[] = rings.flat(2)
  const idx: number[] = []
  const v = (j: number, i: number) => j * P + i

  for (let j = 0; j < spanSteps; j++)
    for (let i = 0; i < P - 1; i++) {
      idx.push(v(j, i), v(j + 1, i), v(j, i + 1))
      idx.push(v(j, i + 1), v(j + 1, i), v(j + 1, i + 1))
    }
  // Tappi: il contorno va dorso TE→LE→ventre TE, quindi il punto k è affacciato al punto P-1-k.
  const cap = (j: number, flip: boolean) => {
    const le = (P - 1) / 2
    if (flip) idx.push(v(j, le - 1), v(j, le), v(j, le + 1))
    else idx.push(v(j, le - 1), v(j, le + 1), v(j, le))
    for (let k = 0; k < le - 1; k++) {
      const a = v(j, k)
      const b = v(j, k + 1)
      const c = v(j, P - 2 - k)
      const d = v(j, P - 1 - k)
      if (flip) idx.push(a, b, d, b, c, d)
      else idx.push(a, d, b, b, d, c)
    }
  }
  cap(0, false)
  cap(spanSteps, true)

  const geom = new BufferGeometry()
  geom.setAttribute('position', new Float32BufferAttribute(pos, 3))
  geom.setIndex(idx)
  geom.computeVertexNormals()
  return geom
}

/**
 * Risoluzione della mesh proporzionata alla pala: le ~4.500 pale del motore a piena risoluzione
 * darebbero decine di milioni di triangoli. Pale grandi (fan): fino a 24 × 30; pale di pochi
 * centimetri (compressore HP, turbina LP): 8 × 10. La forma resta la stessa, cambia solo il campionamento.
 */
export function meshResolution(row: Pick<BladeRowSpec, 'quad' | 'sections'>): BladeMeshOptions {
  const height = Math.hypot(row.quad.tipLE[1] - row.quad.hubLE[1], row.quad.tipLE[0] - row.quad.hubLE[0])
  const chord = Math.max(...row.sections.map((s) => s.chord))
  return {
    spanSteps: Math.round(Math.min(24, Math.max(6, height / 0.012))),
    pointsPerSide: Math.round(Math.min(30, Math.max(10, chord / 0.004))),
  }
}

/** Angoli delle pale: quelli dati dalla schiera oppure passo uniforme. */
export function bladeAngles(row: Pick<BladeRowSpec, 'count' | 'angles'>): number[] {
  return row.angles ?? Array.from({ length: row.count }, (_, k) => (2 * Math.PI * k) / row.count)
}
