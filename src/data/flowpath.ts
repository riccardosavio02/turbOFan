/**
 * Superfici di rivoluzione del motore: profili meridionali chiusi (Z, R) in metri.
 *
 * I punti con `src: 'data'` vengono da tabelle o quote dei report (bordi delle schiere, prediffusore,
 * dimensioni della gondola). I punti con `src: 'estimate'` completano il profilo dove i report danno
 * solo disegni: ogni corpo dichiara nella nota da quale figura sono stati ricavati.
 */
import { fanDesignPoint, fanStations, type Meridional, type Spool } from './fan'
import { hpcQuads } from './hpc'
import { envelope, hptRows, lptRows } from './turbines'
import comb from '../../engines/ge-e3.combustor.json'

export interface ProfilePoint {
  p: Meridional
  src: 'data' | 'estimate'
}

export interface RevolvedBody {
  id: string
  label: string
  material: 'casing' | 'spinner' | 'composite' | 'titanium' | 'hot' | 'steel' | 'nickel'
  /** Profilo chiuso, oppure aperto con estremi sull'asse. */
  profile: ProfilePoint[]
  /** Altri profili che appartengono allo stesso componente (es. i dischi di un rotore). */
  extra?: ProfilePoint[][]
  /** Albero su cui ruota; assente = statico. */
  spool?: Exclude<Spool, null>
  /** Viene sezionato dal taglio a 90°. */
  cut?: boolean
  note: string
}

const CM = 0.01
const st = fanStations
const d = (p: Meridional): ProfilePoint => ({ p, src: 'data' })
const e = (zCm: number, rCm: number): ProfilePoint => ({ p: [zCm * CM, rCm * CM], src: 'estimate' })
const dc = ([zCm, rCm]: number[]): ProfilePoint => ({ p: [zCm * CM, rCm * CM], src: 'data' })

/**
 * Guscio sottile: la polilinea data (una parete del condotto) più la stessa spostata radialmente
 * di `t` metri (verso l'asse se t > 0), chiusa in un profilo. Così le pareti hanno spessore reale
 * e lo spaccato mostra lo spazio vuoto sotto il condotto, dove stanno dischi e alberi.
 */
export function shell(line: ProfilePoint[], t: number): ProfilePoint[] {
  const back = [...line].reverse().map((q) => ({ p: [q.p[0], Math.max(q.p[1] - t, 0)] as Meridional, src: q.src }))
  return [...line, ...back]
}

/** Apice dell'ogiva: cono di semiapertura nota che passa per il mozzo al bordo d'attacco del fan. */
const spinnerHalfAngle = (fanDesignPoint.spinner_cone_half_angle_deg.v * Math.PI) / 180
const hubLE = st.R1_fan_rotor.hubLE
const spinnerApex: Meridional = [hubLE[0] - hubLE[1] / Math.tan(spinnerHalfAngle), 0]

/** Piano di riferimento delle turbine [cm]. */
const HPT0 = hptRows[0].quad.tipLE[0] * 100
/** Fine dell'anello del mozzo del turbine frame [cm]. */
export const LPT_END = Math.max(lptRows.at(-1)!.quad.tipTE[0], lptRows.at(-1)!.quad.hubTE[0]) * 100
/** Flangia posteriore della cassa del turbine frame [cm]. */
export const FRAME_FLANGE = lptRows.at(-1)!.quad.tipTE[0] * 100
const hotRows = [...hptRows, ...lptRows]
const hotTips = hotRows.flatMap((r) => [d(r.quad.tipLE), d(r.quad.tipTE)])
const hotHubs = hotRows.flatMap((r) => [d(r.quad.hubLE), d(r.quad.hubTE)])
const hpcExit = hpcQuads.at(-1)!

/** Prediffusore (CR-169301 Fig. 90): X dal bordo d'uscita delle OGV del compressore [cm]. */
const pd = comb.prediffuser_Fig90
const PD_X0 = hpcExit.tipTE[0] * 100
const pdCol = (k: number) =>
  pd.rows.filter((r) => r[k] !== null).map((r) => dc([PD_X0 + (r[0] as number), r[k] as number]))
const G = comb.geometry
const geo = (pts: number[][]) => pts.map(dc)

/** Gondola: dimensioni di CR-159584 Tab. I [cm]. */
export const NAC = {
  inlet: envelope.inlet_length_from_fan_face_cm,
  maxR: envelope.max_nacelle_diameter_cm / 2,
  highlight: (envelope.highlight_to_max_diameter * envelope.max_nacelle_diameter_cm) / 2,
  /**
   * Raggio della gola della presa d'aria. Stima: rapporto di contrazione A_imbocco/A_gola = 1,25,
   * valore tipico delle prese subsoniche da crociera. Il test verifica che il Mach in gola risultante
   * (portata corretta di CR-168219) cada nell'intervallo usuale 0,6–0,75.
   */
  throatR: (envelope.highlight_to_max_diameter * envelope.max_nacelle_diameter_cm) / 2 / Math.sqrt(1.25),
  nozzleR: envelope.exhaust_nozzle_diameter_cm / 2,
  exit: envelope.overall_nacelle_length_cm - envelope.inlet_length_from_fan_face_cm,
}

/** Superficie esterna della gondola, dall'ugello all'imbocco [cm]: stimata dalla Fig. 1 di CR-159584. */
export const NACELLE_OUTER: [number, number][] = [
  [NAC.exit, NAC.nozzleR + 0.8],
  [390, 96.0],
  [300, 111.0],
  [200, 121.5],
  [80, NAC.maxR],
  [-20, 123.8],
  [-90, 119.5],
  [-135, 113.5],
  [-NAC.inlet + 4, NAC.highlight + 2.2],
  [-NAC.inlet + 0.8, NAC.highlight + 0.9],
]

/** Raggio esterno della gondola alla quota z [m], interpolato linearmente sui punti di NACELLE_OUTER. */
export function nacelleOuterRadius(z: number): number {
  const zc = z * 100
  const pts = [...NACELLE_OUTER].reverse()
  for (let i = 1; i < pts.length; i++)
    if (zc <= pts[i][0]) {
      const w = (zc - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0])
      return (pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * w) / 100
    }
  return pts.at(-1)![1] / 100
}

/** Mixer a 18 lobi (CR-168219 p.102): inizio, lunghezza e raggi stimati dalla Fig. 39 [cm]. */
export const MIXER = { z0: FRAME_FLANGE + 2, length: 48, r0: 66.5, lobes: 18, rMean: 61, amplitude: 10 }

/** Parete interna della presa d'aria: imbocco ellittico, gola, diffusore fino alla faccia del fan [cm]. */
function inletInnerWall(): ProfilePoint[] {
  const z0 = -NAC.inlet
  const lip: ProfilePoint[] = []
  // Quarto d'ellisse dal bordo d'attacco (imbocco) alla gola: semiasse assiale 12 cm.
  for (let k = 0; k <= 6; k++) {
    const a = (Math.PI / 2) * (k / 6)
    lip.push(e(z0 + 12 * (1 - Math.cos(a)), NAC.throatR + (NAC.highlight - NAC.throatR) * (1 - Math.sin(a))))
  }
  // Diffusore subsonico: dalla gola alla faccia del fan con raccordo dolce (smoothstep).
  const diff: ProfilePoint[] = []
  const zT = z0 + 12
  const zF = -10
  const rF = 105.3
  for (let k = 1; k <= 8; k++) {
    const s = k / 8
    const w = s * s * (3 - 2 * s)
    diff.push(e(zT + (zF - zT) * s, NAC.throatR + (rF - NAC.throatR) * w))
  }
  return [...lip, ...diff]
}

const inletWall = inletInnerWall()

export const fanBodies: RevolvedBody[] = [
  {
    id: 'spinner_hub',
    label: 'Ogiva e mozzo del fan',
    material: 'spinner',
    spool: 'LP',
    cut: true,
    note: "Ogiva conica a 32° (CR-165148 p.3) e mozzo per i bordi delle schiere fino alle OGV interne. Guscio di 1,2 cm: sotto c'è il disco del fan.",
    profile: shell(
      [
        { p: spinnerApex, src: 'data' },
        d(st.R1_fan_rotor.hubLE),
        d(st.R1_fan_rotor.hubTE),
        d(st.S1_booster_vane.hubLE),
        d(st.S1_booster_vane.hubTE),
        d(st.R2_quarter_stage.hubLE),
        d(st.R2_quarter_stage.hubTE),
        d(st.S2IN_core_ogv.hubLE),
        d(st.S2IN_core_ogv.hubTE),
      ],
      0.012,
    ),
  },
  {
    id: 'core_inner',
    label: 'Parete interna del condotto e mozzo HPC',
    material: 'casing',
    cut: true,
    note: "Parete interna del condotto a collo d'oca tra OGV interne e IGV, poi mozzo del compressore HP per i bordi di tutte le schiere (CR-165558 Tab. XXI). Forma del collo d'oca stimata dalla Fig. 13 di CR-168219.",
    profile: shell(
      [d(st.S2IN_core_ogv.hubTE), e(66, 44.5), e(80, 33.5), e(92, 22.0), ...hpcQuads.flatMap((q) => [d(q.hubLE), d(q.hubTE)])],
      0.009,
    ),
  },
  {
    id: 'island',
    cut: true,
    label: 'Isola del quarter-stage',
    material: 'composite',
    note: "Lato inferiore dai bordi d'apice di statore 1 e quarter-stage (App. A); naso, dorso e coda stimati dalla Fig. 2 di CR-165148.",
    profile: [
      e(20.5, 67.4),
      e(24, 69.4),
      e(36, 70.1),
      e(50, 69.9),
      e(63.6, 68.5),
      e(55, 67.2),
      d(st.R2_quarter_stage.tipTE),
      d(st.R2_quarter_stage.tipLE),
      d(st.S1_booster_vane.tipTE),
      d(st.S1_booster_vane.tipLE),
      e(21.2, 66.6),
    ],
  },
  {
    id: 'core_cowl',
    cut: true,
    label: 'Splitter, fan frame interno e cassa HPC',
    material: 'casing',
    note: "Parete interna: apice delle OGV interne (CR-165148 App. A), condotto di transizione (stimato) e apici di tutte le schiere del compressore HP (CR-165558 Tab. XXI). Parete esterna dal mozzo delle OGV di bypass; labbro dello splitter e cofano dietro il fan frame stimati.",
    profile: [
      e(54.5, 59.6),
      e(58, 60.8),
      d(st.S2OUT_bypass_ogv_lower.hubLE),
      d(st.S2OUT_bypass_ogv_lower.hubTE),
      e(118, 63.6),
      e(118, 46.0),
      e(150, 41.0),
      e(184, 32.5),
      ...[...hpcQuads].reverse().flatMap((q) => [d(q.tipTE), d(q.tipLE)]),
      e(90, 40.0),
      e(76, 48.5),
      d(st.S2IN_core_ogv.tipTE),
      d(st.S2IN_core_ogv.tipLE),
    ],
  },
  {
    id: 'fan_casing',
    cut: true,
    label: 'Gondola, presa d\'aria e condotto di bypass',
    material: 'casing',
    note: "Lunghezza della presa d'aria (159,0 cm), diametro massimo (248,9 cm), lunghezza totale (603,3 cm) e diametro dell'ugello (159,0 cm) da CR-159584 Tab. I; diametro d'imbocco = 0,86 × diametro massimo (CR-159584 p.6). La presa d'aria è un diffusore subsonico: imbocco ellittico, gola con rapporto di contrazione 1,25 (stima) e condotto divergente fino alla faccia del fan, dove l'aria arriva rallentata a Mach ≈ 0,6 e con una prima risalita di pressione statica. Pareti interne per gli apici di fan e OGV (CR-165148 App. A).",
    profile: [
      ...inletWall,
      d(st.R1_fan_rotor.tipLE),
      d(st.R1_fan_rotor.tipTE),
      d(st.OGV_bypass_upper.tipLE),
      d(st.OGV_bypass_upper.tipTE),
      e(160, 102.4),
      e(250, 100.0),
      e(330, 94.5),
      e(400, 86.5),
      e(NAC.exit, NAC.nozzleR),
      ...NACELLE_OUTER.map(([z, r]) => e(z, r)),
    ],
  },
  {
    id: 'core_nacelle',
    cut: true,
    label: 'Cofano del core (parete interna del bypass)',
    material: 'composite',
    note: "Superficie che separa il bypass dal vano del core, dal fan frame al mixer. Raggi stimati dalla Fig. 1 di CR-168219 in modo da contenere combustore (R ≈ 41 cm) e turbina LP (R ≈ 60 cm).",
    profile: [
      e(95, 63.9),
      e(160, 62.6),
      e(230, 62.0),
      e(280, 64.5),
      e(MIXER.z0, MIXER.r0),
      e(MIXER.z0, MIXER.r0 - 1.2),
      e(280, 63.2),
      e(230, 60.7),
      e(160, 61.3),
      e(118, 62.2),
    ],
  },
  {
    id: 'prediffuser_splitter',
    cut: true,
    label: 'Prediffusore a doppio condotto (splitter)',
    material: 'nickel',
    note: "Il prediffusore divide la portata del compressore: 48% verso la cupola pilota esterna, 52% verso la cupola main interna. Coordinate dello splitter da CR-169301 Fig. 90 (tabella in cm).",
    profile: [...pdCol(2), ...[...pdCol(3)].reverse()],
  },
  {
    id: 'combustor_casing',
    cut: true,
    label: 'Casse di combustore e turbine',
    material: 'hot',
    note: "Parete esterna del prediffusore da CR-169301 Fig. 90; cassa esterna del combustore digitalizzata dalla Fig. 1 di CR-169301 (R ≈ 41 cm); parete esterna delle turbine per gli apici di tutte le schiere (CR-167955 Fig. 3, LPT Fig. 8).",
    profile: [
      ...pdCol(4),
      e(193, 40.4),
      ...geo(G.outer_casing).slice(1, 2),
      e(HPT0 - 0.6, 40.7),
      e(HPT0 - 0.3, 37.6),
      ...hotTips,
      e(LPT_END, 57.8),
      e(LPT_END, 60.3),
      ...[...hotTips]
        .reverse()
        .filter((q) => q.p[0] > HPT0 / 100 + 0.02)
        .map((q) => ({ p: [q.p[0], q.p[1] + 0.025] as Meridional, src: 'estimate' as const })),
      e(HPT0, 43.0),
      e(192, 42.8),
      e(PD_X0 + 0.3, 31.5),
    ],
  },
  {
    id: 'hot_inner',
    cut: true,
    label: 'Cassa interna del combustore e mozzi delle turbine',
    material: 'hot',
    note: "Parete interna del prediffusore da CR-169301 Fig. 90, cassa interna del combustore digitalizzata dalla Fig. 1 di CR-169301, mozzo del condotto delle turbine per i bordi di tutte le schiere (CR-167955 Fig. 3, LPT Fig. 8). Guscio di 1 cm: sotto passano gli alberi.",
    profile: shell([...pdCol(1), ...geo(G.inner_casing).slice(1, -1), e(HPT0 - 0.3, 29.5), ...hotHubs, e(LPT_END, 35.56)], 0.01),
  },
  {
    id: 'combustor_liner',
    cut: true,
    label: 'Liner esterno e interno',
    material: 'hot',
    note: "Liner a doppia parete: supporto lavorato più tre file di shingle per zona, raffreddati a impingement e film (CR-168219 p.61). Profili digitalizzati dalla Fig. 1 di CR-169301 scalata sul prediffusore e sui raggi d'ingresso HPT.",
    profile: shell(geo(G.outer_liner), -0.008),
    extra: [shell(geo(G.inner_liner), 0.008)],
  },
  {
    id: 'combustor_dome',
    cut: true,
    label: 'Cupole pilota e main',
    material: 'hot',
    note: "Due cupole sovrapposte: la pilota esterna, sempre accesa e ottimizzata per bassi rapporti aria/combustibile, e la main interna, che si accende ad alta potenza (CR-168219 p.57). Posizioni digitalizzate dalla Fig. 1 di CR-169301.",
    profile: shell(geo(G.pilot_dome_face), -0.006),
    extra: [shell(geo(G.main_dome_face), -0.006)],
  },
  {
    id: 'combustor_centerbody',
    cut: true,
    label: 'Corpo centrale tra i due anelli',
    material: 'hot',
    note: "Separa la zona pilota esterna dalla zona main interna e porta i fori di diluizione (CR-169301 Fig. 1). Profilo digitalizzato dalla stessa figura.",
    profile: geo(G.centerbody),
  },
  {
    id: 'centerbody',
    cut: true,
    label: 'Cono di scarico e tubo di sfiato',
    material: 'hot',
    note: "Cono centrale dietro il turbine frame, con il tubo di sfiato centrale che sporge oltre il piano dell'ugello (CR-168219 p.101). Forma stimata dalla Fig. 1 di CR-168219.",
    profile: shell([e(LPT_END, 35.56), e(335, 33.8), e(370, 27.0), e(405, 15.5), e(428, 5.0), e(470, 4.0)], 0.01),
  },
]

/** Raggi del condotto del combustore per altri moduli [cm]. */
export const combustorGeometry = {
  swirlers: G.swirler_rings,
  fuelNozzleStem: G.fuel_nozzle_stem,
}
