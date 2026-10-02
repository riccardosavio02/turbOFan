/**
 * Profilo alare 2D di una sezione di schiera.
 *
 * I report NASA danno per ogni sezione: corda, calettamento (stagger), camber,
 * spessore massimo t/c e angoli metallici. Non danno le coordinate del profilo,
 * quindi la forma è ricostruita (stima dichiarata):
 *  - linea media ad arco di circonferenza con angolo di camber totale θ
 *    (tangenti in LE e TE inclinate di ±θ/2 rispetto alla corda);
 *  - spessore con la legge NACA 4 cifre a bordo d'uscita chiuso, riscalata su t/c e,
 *    se la tabella la fornisce, deformata per portare il massimo nella posizione xtm.
 */

export interface SectionParams {
  chord: number // [m]
  staggerDeg: number
  camberDeg: number
  tmc: number // spessore massimo / corda
  /** Posizione dello spessore massimo in frazione di corda (default 0.3, come NACA 4 cifre). */
  xtm?: number
}

const DEG = Math.PI / 180

/** Ascissa con spaziatura coseno, fitta ai bordi d'attacco e d'uscita. */
function cosineSpacing(n: number): number[] {
  return Array.from({ length: n }, (_, i) => 0.5 * (1 - Math.cos((Math.PI * i) / (n - 1))))
}

/** Semispessore NACA 4 cifre normalizzato: vale 0.5 nel punto di spessore massimo. */
function halfThickness(x: number): number {
  return 5 * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x ** 2 + 0.2843 * x ** 3 - 0.1036 * x ** 4)
}
const HALF_THICKNESS_MAX = Math.max(...cosineSpacing(400).map(halfThickness))

/**
 * Linea media ad arco di circonferenza su corda unitaria: quota y(x) e pendenza dy/dx.
 * Per θ→0 degenera nella corda.
 */
export function camberLine(x: number, camberDeg: number): { y: number; slope: number } {
  const half = (camberDeg * DEG) / 2
  if (Math.abs(half) < 1e-6) return { y: 0, slope: 0 }
  const R = 1 / (2 * Math.sin(half))
  const dx = x - 0.5
  const root = Math.sqrt(Math.max(R * R - dx * dx, 0))
  return { y: Math.sign(R) * root - R * Math.cos(half), slope: -dx / (Math.sign(R) * root) }
}

/**
 * Contorno chiuso del profilo nel riferimento della corda (x lungo la corda da LE a TE,
 * y normale, lato convesso positivo), in metri.
 * Ordine: dorso da TE a LE, poi ventre da LE a TE. `n` punti per lato.
 */
export function airfoilContour(p: SectionParams, n = 40): [number, number][] {
  const xs = cosineSpacing(n)
  // x → x^k sposta il massimo da 0.3 a xtm lasciando fissi i bordi.
  const k = p.xtm ? Math.log(0.3) / Math.log(p.xtm) : 1
  const upper: [number, number][] = []
  const lower: [number, number][] = []
  for (const x of xs) {
    const { y, slope } = camberLine(x, p.camberDeg)
    const t = (halfThickness(x ** k) / HALF_THICKNESS_MAX) * (p.tmc / 2)
    const norm = Math.hypot(1, slope)
    const nx = -slope / norm
    const ny = 1 / norm
    upper.push([(x + t * nx) * p.chord, (y + t * ny) * p.chord])
    lower.push([(x - t * nx) * p.chord, (y - t * ny) * p.chord])
  }
  return [...upper.reverse(), ...lower.slice(1)]
}
