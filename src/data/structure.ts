/**
 * Struttura rotante e di supporto: dischi, tamburi, alberi LP e HP, cuscinetti e supporti dei sump.
 *
 * Dati dai report: architettura (CR-168219 p.10, p.96–98): bialbero co-rotante, 5 cuscinetti in 2 sump.
 * LP su 3 cuscinetti (No.1 a sfere, No.2 a rulli nel sump anteriore, No.5 sul turbine frame).
 * HP su un reggispinta anteriore (No.3) e su un cuscinetto a rulli interalbero (No.4) tra HPT e LPT.
 * HPC: tamburo anteriore e posteriore saldati per attrito inerziale, uniti da un'unica flangia (p.52).
 * LPT: dischi con braccetti distanziali imbullonati, cono principale tra i dischi 3 e 4 (p.87).
 * Fan: disco ad anello ad alto foro in titanio, spool del booster in un pezzo (CR-165148 p.1).
 *
 * Le dimensioni dei dischi derivano dal condotto (raggio e larghezza assiale del mozzo di ogni rotore);
 * spessori di anima, raggi dei fori e degli alberi e posizioni dei cuscinetti sono STIME.
 */
import type { BladeRowSpec, Meridional } from './fan'
import { fanRows } from './fan'
import { hpcRows } from './hpc'
import { hptRows, lptRows } from './turbines'
import type { ProfilePoint, RevolvedBody } from './flowpath'

const e = (z: number, r: number): ProfilePoint => ({ p: [z, r], src: 'estimate' })
const box = (z0: number, z1: number, r0: number, r1: number) => [e(z0, r0), e(z1, r0), e(z1, r1), e(z0, r1)]
/** Tubo o cono sottile lungo una polilinea [m]. */
const tube = (pts: Meridional[], t: number) => [...pts.map(([z, r]) => e(z, r)), ...[...pts].reverse().map(([z, r]) => e(z, r - t))]

/** Raggi stimati degli alberi [m]. */
export const SHAFTS = {
  /** Albero LP in acciaio (CR-165148 p.1): esterno / interno. */
  lpOuter: 0.056,
  lpInner: 0.046,
  /** Tubo di sfiato centrale (CR-168219 p.96–101). */
  vent: 0.03,
}

interface DiskOptions {
  bore: number
}

/** Rim del disco: sotto la piattaforma delle pale, con l'attacco a coda di rondine. */
function rimTop(row: BladeRowSpec) {
  return Math.min(row.quad.hubLE[1], row.quad.hubTE[1]) - 0.008
}

/** Profilo di un disco: corona, anima sottile, mozzo (bore) ingrossato. */
function disk(row: BladeRowSpec, { bore }: DiskOptions): ProfilePoint[] {
  const z0 = Math.min(row.quad.hubLE[0], row.quad.tipLE[0])
  const z1 = Math.max(row.quad.hubTE[0], row.quad.tipTE[0])
  const w = z1 - z0
  const zc = (z0 + z1) / 2
  const top = rimTop(row)
  const rimDepth = 0.25 * w + 0.008
  const web = Math.max(0.12 * w, 0.0035)
  const bw = 0.32 * w + 0.004
  const hb = 0.08 * (top - bore) + 0.008
  return [
    e(z0 + 0.04 * w, top),
    e(z1 - 0.04 * w, top),
    e(z1 - 0.04 * w, top - rimDepth),
    e(zc + web, top - rimDepth - 0.006),
    e(zc + web, bore + hb),
    e(zc + bw, bore + 0.6 * hb),
    e(zc + bw, bore),
    e(zc - bw, bore),
    e(zc - bw, bore + 0.6 * hb),
    e(zc - web, bore + hb),
    e(zc - web, top - rimDepth - 0.006),
    e(z0 + 0.04 * w, top - rimDepth),
  ]
}

/** Braccetti distanziali / tamburo tra dischi consecutivi dello stesso rotore. */
function spacers(rows: BladeRowSpec[], t = 0.004): ProfilePoint[][] {
  const out: ProfilePoint[][] = []
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i]
    const b = rows[i + 1]
    const za = Math.max(a.quad.hubTE[0], a.quad.tipTE[0])
    const zb = Math.min(b.quad.hubLE[0], b.quad.tipLE[0])
    const wa = za - Math.min(a.quad.hubLE[0], a.quad.tipLE[0])
    const wb = Math.max(b.quad.hubTE[0], b.quad.tipTE[0]) - zb
    const ra = rimTop(a) - 0.25 * wa - 0.008
    const rb = rimTop(b) - 0.25 * wb - 0.008
    out.push(tube([[za - 0.04 * wa, ra], [zb + 0.04 * wb, rb]], t))
  }
  return out
}

const rotors = (rows: BladeRowSpec[]) => rows.filter((r) => r.kind === 'rotor')
const fanRotors = rotors(fanRows)
const hpc = rotors(hpcRows)
const hpt = rotors(hptRows)
const lpt = rotors(lptRows)

const hpcBore = (r: BladeRowSpec) => 0.1 + 0.15 * (rimTop(r) - 0.17)
const zMid = (r: BladeRowSpec) => (r.quad.hubLE[0] + r.quad.hubTE[0]) / 2

/** Posizioni stimate dei cuscinetti [m]. */
const Z_BRG = {
  no1: 0.3,
  no2: 0.5,
  no3: zMid(hpc[0]) - 0.16,
  no4: hptRows.at(-1)!.quad.hubTE[0] + 0.04,
  no5: lptRows.at(-1)!.quad.hubTE[0] - 0.01,
}
const lpt34 = (Math.max(lpt[2].quad.hubTE[0], lpt[2].quad.tipTE[0]) + Math.min(lpt[3].quad.hubLE[0], lpt[3].quad.tipLE[0])) / 2

export const structureBodies: RevolvedBody[] = [
  {
    id: 'lp_fan_disks',
    label: 'Disco del fan e spool del booster',
    material: 'titanium',
    spool: 'LP',
    cut: true,
    note: "Disco del fan ad anello ad alto foro in titanio, scelto per la rigidezza del modo accoppiato pala-disco e per l'accesso all'interno; spool del quarter-stage in un unico pezzo di titanio (CR-165148 p.1). Profili stimati.",
    profile: disk(fanRotors[0], { bore: 0.24 }),
    extra: [disk(fanRotors[1], { bore: 0.4 }), ...spacers(fanRotors, 0.006)],
  },
  {
    id: 'lp_shaft',
    label: 'Albero LP e cono del fan',
    material: 'steel',
    spool: 'LP',
    cut: true,
    note: "Albero LP in acciaio dal fan alla turbina LP, coassiale e interno all'albero HP; dentro passa il tubo di sfiato dei sump (CR-165148 p.1, CR-168219 p.96). Il cono collega il disco del fan all'albero; un secondo cono collega l'albero ai dischi della turbina LP tra gli stadi 3 e 4 (CR-168219 p.87). Raggi stimati.",
    profile: box(0.24, Z_BRG.no5 + 0.06, SHAFTS.lpInner, SHAFTS.lpOuter),
    extra: [
      tube([[zMid(fanRotors[0]), 0.25], [0.2, 0.15], [0.26, SHAFTS.lpOuter + 0.004]], 0.008),
      tube([[lpt34, rimTop(lpt[2]) - 0.05], [lpt34 - 0.12, 0.18], [Z_BRG.no4 + 0.05, SHAFTS.lpOuter + 0.004]], 0.007),
    ],
  },
  {
    id: 'vent_tube',
    label: 'Tubo di sfiato centrale',
    material: 'steel',
    cut: true,
    note: "Tubo statico che scarica l'aria dei sump e delle cavità delle turbine oltre il piano dell'ugello (CR-168219 p.96–101). Raggio stimato.",
    profile: box(0.2, 4.7, SHAFTS.vent - 0.003, SHAFTS.vent),
  },
  {
    id: 'hpc_rotor',
    label: 'Rotore HPC: dischi e tamburo saldato',
    material: 'titanium',
    spool: 'HP',
    cut: true,
    note: "10 dischi: tamburo anteriore in titanio e posteriore in René 95 da polveri, saldati per attrito inerziale e uniti da un'unica flangia imbullonata; il foro è raffreddato con aria del fan (CR-168219 p.52–56). Sotto: albero anteriore verso il reggispinta No.3 e albero posteriore verso la turbina HP. Profili stimati.",
    profile: disk(hpc[0], { bore: hpcBore(hpc[0]) }),
    extra: [
      ...hpc.slice(1).map((r) => disk(r, { bore: hpcBore(r) })),
      ...spacers(hpc, 0.005),
      tube([[zMid(hpc[0]), hpcBore(hpc[0]) + 0.01], [Z_BRG.no3 + 0.04, 0.1], [Z_BRG.no3 - 0.02, 0.1]], 0.008),
      tube(
        [
          [zMid(hpc.at(-1)!), rimTop(hpc.at(-1)!) - 0.05],
          [zMid(hpc.at(-1)!) + 0.08, 0.17],
          [zMid(hpt[0]) - 0.06, 0.17],
          [zMid(hpt[0]), 0.2],
        ],
        0.008,
      ),
    ],
  },
  {
    id: 'hpt_rotor',
    label: 'Rotore HPT: dischi e albero posteriore',
    material: 'nickel',
    spool: 'HP',
    cut: true,
    note: "Dischi in René 95 senza fori nella parte strutturale, disco interstadio per la tenuta e trattenimento delle pale senza bulloni (CR-168219 p.72). L'albero posteriore porta l'anello interno del cuscinetto interalbero No.4 (p.98). Profili stimati.",
    profile: disk(hpt[0], { bore: 0.1 }),
    extra: [
      disk(hpt[1], { bore: 0.1 }),
      ...spacers(hpt, 0.006),
      tube([[zMid(hpt[1]), 0.12], [Z_BRG.no4 - 0.01, 0.08], [Z_BRG.no4 + 0.02, 0.075]], 0.008),
    ],
  },
  {
    id: 'lpt_rotor',
    label: 'Rotore LPT: 5 dischi e distanziali',
    material: 'nickel',
    spool: 'LP',
    cut: true,
    note: "Rotore non raffreddato: dischi in Inco 718 con braccetti distanziali integrali e giunti imbullonati tra gli stadi (CR-168219 p.87). Profili stimati.",
    profile: disk(lpt[0], { bore: 0.16 }),
    extra: [...lpt.slice(1).map((r) => disk(r, { bore: 0.16 })), ...spacers(lpt, 0.005)],
  },
  {
    id: 'bearings',
    label: 'Cuscinetti No.1–5',
    material: 'steel',
    cut: true,
    note: "5 cuscinetti in 2 sump (CR-168219 p.96–98). Sump anteriore: No.1 a sfere (reggispinta LP), No.2 a rulli, No.3 a sfere (reggispinta HP, con molla di centraggio e smorzatore a film d'olio). Sump posteriore: No.4 a rulli interalbero (tra albero HP e albero LP, evita un telaio caldo) e No.5 a rulli sul turbine frame. Posizioni e dimensioni stimate.",
    profile: box(Z_BRG.no1 - 0.015, Z_BRG.no1 + 0.015, SHAFTS.lpOuter, SHAFTS.lpOuter + 0.02),
    extra: [
      box(Z_BRG.no2 - 0.015, Z_BRG.no2 + 0.015, SHAFTS.lpOuter, SHAFTS.lpOuter + 0.018),
      box(Z_BRG.no3 - 0.015, Z_BRG.no3 + 0.015, 0.1, 0.125),
      box(Z_BRG.no4 - 0.012, Z_BRG.no4 + 0.012, SHAFTS.lpOuter, 0.075),
      box(Z_BRG.no5 - 0.015, Z_BRG.no5 + 0.015, SHAFTS.lpOuter, SHAFTS.lpOuter + 0.02),
    ],
  },
  {
    id: 'sump_supports',
    label: 'Supporti dei sump (fan frame e turbine frame)',
    material: 'steel',
    cut: true,
    note: "Coni statici che portano i carichi dei cuscinetti ai due telai: il fan frame composito davanti (reagisce le spinte di No.1 e No.3) e il turbine frame dietro (No.5), con rigidezza di circa 1,75·10⁶ N/cm (CR-168219 p.10, p.90). Forme stimate.",
    profile: tube([[0.68, 0.43], [0.55, 0.2], [Z_BRG.no2, SHAFTS.lpOuter + 0.03], [Z_BRG.no1, SHAFTS.lpOuter + 0.03]], 0.007),
    extra: [
      tube([[0.88, 0.25], [Z_BRG.no3 + 0.02, 0.14], [Z_BRG.no3, 0.13]], 0.007),
      tube(
        [
          [lptRows.at(-1)!.quad.hubLE[0], lptRows.at(-1)!.quad.hubLE[1] - 0.01],
          [Z_BRG.no5 - 0.03, 0.15],
          [Z_BRG.no5, SHAFTS.lpOuter + 0.03],
        ],
        0.008,
      ),
    ],
  },
]
