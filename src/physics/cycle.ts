/**
 * Modello di ciclo 0D del GE E3 (bialbero, flussi misti), in un punto di funzionamento.
 *
 * Ingressi: tutti dalla specifica (rapporti di pressione, BPR, T41, rendimenti, perdite, spillamenti) e la
 * portata corretta del fan misurata al banco. Uscite: T e P totali, portata e FAR alle stazioni SAE,
 * spinta e consumo specifico. Il modello NON viene tarato: le grandezze calcolate (T25, P25, T49, Δh/T delle
 * turbine, portate corrette, sfc, spinta) si confrontano con quelle pubblicate nei report (cycle.test.ts).
 *
 * Ipotesi (dichiarate):
 *  - presa d'aria con recupero 100% (regola dei report E3 per i punti di rating, CR-168219 p.33);
 *  - entalpia lungo il compressore HP crescente in modo uniforme per stadio (per gli spillamenti di 5° e 7° stadio);
 *  - raffreddamento CDP "non caricabile" miscelato prima del rotore 1 HPT, quello "caricabile" e il 7° stadio
 *    dopo la HPT, il 5° stadio all'ingresso della LPT (CR-168219 Tab. XI e p.88);
 *  - mixer: spinta = spinta a flussi separati + efficacia × (spinta a flussi completamente miscelati − separati);
 *  - ugello convergente-divergente adattato (espansione completa) con coefficiente di velocità Cv;
 *  - rendimento meccanico degli alberi 0,995, nessuna estrazione di potenza né spillamento cliente.
 */
import { LHV, R_GAS, atmosphere, enthalpy, gamma, isentropicPR, isentropicTemp, tempFromEnthalpy } from './thermo'

export interface CycleInput {
  name: string
  mach: number
  altM: number
  dTisa: number
  /** Portata corretta totale all'ingresso del fan [kg/s]. */
  W2c: number
  BPR: number
  prFanBypass: number
  prFanHub: number
  prHpc: number
  /** Temperatura all'ingresso del rotore HPT [K]. */
  T41: number
  etaFanBypass: number
  etaFanHub: number
  etaHpc: number
  etaHpt: number
  etaLpt: number
  etaComb: number
  dpComb: number
  /** Perdita nel condotto di transizione fan → HPC (CR-165148 p.3). */
  dpCoreInlet: number
  dpFanDuct: number
  dpCoreDuct: number
  dpNozzleDuct: number
  /** Spillamenti in frazione di W25. */
  coolNonChargeable: number
  coolChargeable: number
  bleed7: number
  bleed5: number
  mixerEffectiveness: number
  cv: number
  etaMech?: number
}

export interface Station {
  id: string
  label: string
  T: number
  P: number
  W: number
  far: number
}

export interface CycleResult {
  input: CycleInput
  stations: Record<string, Station>
  /** Stazioni nell'ordine del flusso (le chiavi numeriche di un oggetto JS verrebbero riordinate). */
  order: string[]
  thrust: number
  fuelFlow: number
  /** kg/(N·h) */
  sfc: number
  /** Potenze degli alberi [W]. */
  power: { fan: number; hpc: number; hpt: number; lpt: number }
  /** Grandezze confrontabili con i report. */
  derived: {
    OPR: number
    hptDhOverT: number
    lptDhOverT: number
    hptCorrFlow: number
    lptCorrFlow: number
    V0: number
    V9mix: number
    /** Portata corretta all'ingresso del compressore HP [kg/s]. */
    W25c: number
  }
}

/** Velocità di uscita di un ugello adattato a Ps, con coefficiente di velocità cv. */
function jetVelocity(Tt: number, Pt: number, far: number, Ps: number, cv: number): number {
  const pr = Ps / Pt
  if (pr >= 1) return 0
  const Ts = isentropicTemp(Tt, pr, far)
  return cv * Math.sqrt(2 * (enthalpy(Tt, far) - enthalpy(Ts, far)))
}

function compress(T1: number, pr: number, eta: number) {
  const h1 = enthalpy(T1)
  const h2 = h1 + (enthalpy(isentropicTemp(T1, pr)) - h1) / eta
  return { T: tempFromEnthalpy(h2, 0, T1 * pr ** 0.3), dh: h2 - h1 }
}

/** Espansione con salto entalpico assegnato: restituisce temperatura e rapporto di pressione P1/P2. */
function expand(T1: number, far: number, dh: number, eta: number) {
  const h1 = enthalpy(T1, far)
  const T2 = tempFromEnthalpy(h1 - dh, far, T1 * 0.8)
  const T2is = tempFromEnthalpy(h1 - dh / eta, far, T1 * 0.8)
  return { T: T2, pr: isentropicPR(T2is, T1, far) }
}

/** Miscela adiabatica di correnti: entalpia media pesata sulla portata, FAR dalla massa di combustibile. */
function mix(streams: { W: number; T: number; far: number }[]) {
  const W = streams.reduce((s, x) => s + x.W, 0)
  const fuel = streams.reduce((s, x) => s + (x.W * x.far) / (1 + x.far), 0)
  const far = fuel / (W - fuel)
  const h = streams.reduce((s, x) => s + x.W * enthalpy(x.T, x.far), 0) / W
  return { W, far, T: tempFromEnthalpy(h, far, streams[0].T) }
}

export function runCycle(inp: CycleInput): CycleResult {
  const etaMech = inp.etaMech ?? 0.995
  const st: Record<string, Station> = {}
  const order: string[] = []
  const put = (id: string, label: string, T: number, P: number, W: number, far = 0) => {
    order.push(id)
    st[id] = { id, label, T, P, W, far }
  }

  // 0 → 2: aria libera e presa d'aria
  const { Ts, Ps } = atmosphere(inp.altM, inp.dTisa)
  const V0 = inp.mach * Math.sqrt(gamma(Ts) * R_GAS * Ts)
  const T2 = tempFromEnthalpy(enthalpy(Ts) + V0 ** 2 / 2, 0, Ts)
  const P2 = Ps * isentropicPR(Ts, T2)
  const W2 = (inp.W2c * (P2 / 101325)) / Math.sqrt(T2 / 288.15)
  put('0', 'Aria libera (statica)', Ts, Ps, W2)
  put('2', 'Ingresso fan', T2, P2, W2)

  // Fan: bypass e mozzo + booster
  const Wcore = W2 / (1 + inp.BPR)
  const Wbyp = W2 - Wcore
  const fanB = compress(T2, inp.prFanBypass, inp.etaFanBypass)
  const fanH = compress(T2, inp.prFanHub, inp.etaFanHub)
  put('13', 'Uscita fan, bypass', fanB.T, P2 * inp.prFanBypass, Wbyp)
  put('23', 'Uscita fan mozzo e booster', fanH.T, P2 * inp.prFanHub, Wcore)
  const P25 = st['23'].P * (1 - inp.dpCoreInlet)
  put('25', 'Ingresso compressore HP', fanH.T, P25, Wcore)

  // Compressore HP con spillamenti di 5° e 7° stadio
  const hpc = compress(fanH.T, inp.prHpc, inp.etaHpc)
  const h25 = enthalpy(fanH.T)
  const h3 = h25 + hpc.dh
  const h5 = h25 + 0.5 * hpc.dh
  const h7 = h25 + 0.7 * hpc.dh
  const W5b = inp.bleed5 * Wcore
  const W7b = inp.bleed7 * Wcore
  const Wnc = inp.coolNonChargeable * Wcore
  const Wch = inp.coolChargeable * Wcore
  const powerHpc = Wcore * hpc.dh - W5b * (h3 - h5) - W7b * (h3 - h7)
  const P3 = P25 * inp.prHpc
  put('3', 'Uscita compressore HP', hpc.T, P3, Wcore - W5b - W7b)

  // Combustore: FAR tale che, dopo la miscela col raffreddamento non caricabile, T41 sia quella richiesta
  const W31 = Wcore - W5b - W7b - Wnc - Wch
  const P4 = P3 * (1 - inp.dpComb)
  let farLo = 0
  let farHi = 0.05
  let T4 = 0
  let far4 = 0
  for (let k = 0; k < 60; k++) {
    far4 = (farLo + farHi) / 2
    const h4 = (h3 + far4 * inp.etaComb * LHV) / (1 + far4)
    T4 = tempFromEnthalpy(h4, far4, 1600)
    const m = mix([
      { W: W31 * (1 + far4), T: T4, far: far4 },
      { W: Wnc, T: hpc.T, far: 0 },
    ])
    if (m.T < inp.T41) farLo = far4
    else farHi = far4
  }
  const Wf = W31 * far4
  put('4', 'Uscita combustore', T4, P4, W31 + Wf, far4)
  const s41 = mix([
    { W: W31 + Wf, T: T4, far: far4 },
    { W: Wnc, T: hpc.T, far: 0 },
  ])
  put('41', 'Ingresso rotore HPT', s41.T, P4, s41.W, s41.far)

  // Turbina HP: lavoro = lavoro del compressore HP
  const hpt = expand(s41.T, s41.far, powerHpc / etaMech / s41.W, inp.etaHpt)
  put('42', 'Uscita HPT', hpt.T, P4 / hpt.pr, s41.W, s41.far)

  // Raffreddamenti caricabili, 7° e 5° stadio → ingresso LPT
  const s49 = mix([
    { W: s41.W, T: hpt.T, far: s41.far },
    { W: Wch, T: hpc.T, far: 0 },
    { W: W7b, T: tempFromEnthalpy(h7), far: 0 },
    { W: W5b, T: tempFromEnthalpy(h5), far: 0 },
  ])
  put('49', 'Ingresso LPT', s49.T, st['42'].P, s49.W, s49.far)

  // Turbina LP: lavoro = lavoro del fan (bypass + mozzo)
  const powerFan = Wbyp * fanB.dh + Wcore * fanH.dh
  const lpt = expand(s49.T, s49.far, powerFan / etaMech / s49.W, inp.etaLpt)
  put('5', 'Uscita LPT', lpt.T, st['49'].P / lpt.pr, s49.W, s49.far)

  // Scarico: condotti, mixer, ugello
  const P56 = st['5'].P * (1 - inp.dpCoreDuct)
  const P16 = st['13'].P * (1 - inp.dpFanDuct)
  put('56', 'Piano di miscelamento, core', lpt.T, P56, s49.W, s49.far)
  put('16', 'Piano di miscelamento, bypass', fanB.T, P16, Wbyp)
  const nozzleLoss = 1 - inp.dpNozzleDuct
  const Vc = jetVelocity(lpt.T, P56 * nozzleLoss, s49.far, Ps, inp.cv)
  const Vb = jetVelocity(fanB.T, P16 * nozzleLoss, 0, Ps, inp.cv)
  const Fsep = s49.W * Vc + Wbyp * Vb
  const m7 = mix([
    { W: s49.W, T: lpt.T, far: s49.far },
    { W: Wbyp, T: fanB.T, far: 0 },
  ])
  // Pressione della corrente miscelata: media logaritmica pesata (miscela a pressione circa costante).
  const P7 = Math.exp((s49.W * Math.log(P56) + Wbyp * Math.log(P16)) / m7.W)
  put('7', 'Ingresso ugello (miscelato)', m7.T, P7, m7.W, m7.far)
  const Vmix = jetVelocity(m7.T, P7 * nozzleLoss, m7.far, Ps, inp.cv)
  const Fmix = m7.W * Vmix
  const gross = Fsep + inp.mixerEffectiveness * (Fmix - Fsep)
  const V9 = gross / m7.W
  const T9 = m7.T - V9 ** 2 / (2 * 1150)
  put('9', 'Uscita ugello (statica)', T9, Ps, m7.W, m7.far)

  const thrust = gross - W2 * V0
  const sfc = (Wf / thrust) * 3600
  return {
    input: inp,
    stations: st,
    order,
    thrust,
    fuelFlow: Wf,
    sfc,
    power: { fan: powerFan, hpc: powerHpc, hpt: powerHpc / etaMech, lpt: powerFan / etaMech },
    derived: {
      OPR: P3 / P2,
      hptDhOverT: powerHpc / etaMech / s41.W / s41.T,
      lptDhOverT: powerFan / etaMech / s49.W / s49.T,
      hptCorrFlow: ((s41.W * Math.sqrt(s41.T)) / P4) * 1000,
      lptCorrFlow: ((s49.W * Math.sqrt(s49.T)) / st['49'].P) * 1000,
      V0,
      V9mix: V9,
      W25c: (Wcore * Math.sqrt(st['25'].T / 288.15)) / (st['25'].P / 101325),
    },
  }
}
