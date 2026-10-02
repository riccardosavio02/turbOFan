/**
 * Proprietà termodinamiche di aria secca e prodotti di combustione del cherosene, a gas semi-perfetto:
 * cp dipende dalla temperatura e dal rapporto combustibile/aria (FAR), R è costante.
 * Polinomi di Walsh & Fletcher, *Gas Turbine Performance*, 2ª ed., cap. 3 (Tz = T/1000, cp in kJ/kg·K).
 * Verifica: cp aria = 1,004 kJ/kg·K a 300 K, 1,141 a 1000 K, 1,211 a 1500 K (vedi thermo.test.ts).
 */

const A = [0.992313, 0.236688, -1.852148, 6.083152, -8.893933, 7.097112, -3.234725, 0.794571, -0.081873]
const B = [-0.718874, 8.747481, -15.863157, 17.254096, -10.233795, 3.081778, -0.361112, -0.003919]

/** Costante del gas [J/kg·K]; la dipendenza dal FAR è trascurabile (−0,0099·FAR). */
export const R_GAS = 287.05
/** Potere calorifico inferiore del cherosene [J/kg]. */
export const LHV = 43.124e6

const poly = (c: number[], f: (a: number, i: number) => number) => c.reduce((s, a, i) => s + f(a, i), 0)
const share = (far: number) => far / (1 + far)

/** Calore specifico a pressione costante [J/kg·K]. */
export function cp(T: number, far = 0): number {
  const tz = T / 1000
  return 1000 * (poly(A, (a, i) => a * tz ** i) + share(far) * poly(B, (b, i) => b * tz ** i))
}

/** Entalpia [J/kg], riferita a 0 K: integrale analitico del polinomio. */
export function enthalpy(T: number, far = 0): number {
  const tz = T / 1000
  return 1e6 * (poly(A, (a, i) => (a * tz ** (i + 1)) / (i + 1)) + share(far) * poly(B, (b, i) => (b * tz ** (i + 1)) / (i + 1)))
}

/** Funzione entropia φ(T) = ∫cp/T dT [J/kg·K]: s2 − s1 = φ(T2) − φ(T1) − R·ln(P2/P1). */
export function entropyFn(T: number, far = 0): number {
  const tz = T / 1000
  const term = (c: number[]) => c[0] * Math.log(T) + poly(c.slice(1), (a, i) => (a * tz ** (i + 1)) / (i + 1))
  return 1000 * (term(A) + share(far) * term(B))
}

/** Temperatura che dà l'entalpia h (Newton). */
export function tempFromEnthalpy(h: number, far = 0, guess = 600): number {
  let T = guess
  for (let k = 0; k < 40; k++) {
    const dT = (enthalpy(T, far) - h) / cp(T, far)
    T -= dT
    if (Math.abs(dT) < 1e-7) break
  }
  return T
}

/** Temperatura dopo una trasformazione isentropica da (T1, P1) al rapporto di pressione pr (Newton). */
export function isentropicTemp(T1: number, pr: number, far = 0): number {
  const target = entropyFn(T1, far) + R_GAS * Math.log(pr)
  let T = T1 * pr ** (R_GAS / cp(T1, far))
  for (let k = 0; k < 40; k++) {
    const dT = ((entropyFn(T, far) - target) * T) / cp(T, far)
    T -= dT
    if (Math.abs(dT) < 1e-7) break
  }
  return T
}

/** Rapporto di pressione tra due temperature lungo un'isentropica. */
export function isentropicPR(T1: number, T2: number, far = 0): number {
  return Math.exp((entropyFn(T2, far) - entropyFn(T1, far)) / R_GAS)
}

/** Rapporto dei calori specifici. */
export const gamma = (T: number, far = 0) => cp(T, far) / (cp(T, far) - R_GAS)

/** Atmosfera standard ISA (troposfera e bassa stratosfera) con scostamento di temperatura. */
export function atmosphere(altM: number, dTisa = 0): { Ts: number; Ps: number } {
  const T11 = 216.65
  const tStd = altM <= 11000 ? 288.15 - 0.0065 * altM : T11
  const Ps =
    altM <= 11000 ? 101325 * (tStd / 288.15) ** 5.25588 : 22632.06 * Math.exp((-9.80665 * (altM - 11000)) / (287.053 * T11))
  return { Ts: tStd + dTisa, Ps }
}
