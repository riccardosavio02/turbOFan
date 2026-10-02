import { Fragment, useEffect, useMemo, useRef, useState, useDeferredValue } from 'react'
import story from '../content/story.json'
import { facts, fill } from '../content/facts'
import { Viewer } from '../scene/Viewer'
import { GROUPS, framing } from '../scene/focus'
import { explodedFraming, moduleForGroup } from '../scene/explode'
import { ExplodeLabels } from '../scene/ExplodeLabels'
import { useView, type CameraGoal, type FlowMapMode } from '../store'
import { Citations } from '../ui/Citations'
import { TopBar } from '../ui/TopBar'
import { TsDiagram } from '../ui/CycleTab'
import { TriangleExplorer } from '../ui/Triangles'
import { href } from '../router'
import { solveByContinuation, T41_RANGE } from '../physics/offdesign'
import { calibration, ratingPrediction } from '../physics/useCycle'

type Section = (typeof story.sections)[number]

const OVERVIEW: CameraGoal = { position: [-3.6, 2.6, 6.8], target: [1.3, 0, 0] }
/** Vista laterale sul piano di taglio, per leggere i colori del condotto. */
const SIDE: CameraGoal = { position: [1.95, 0.55, 6.2], target: [1.95, 0.42, 0] }
/** Vista d'insieme del motore esploso: abbastanza lontana da contenere tutti i moduli. */
const EXPLODED_OVERVIEW: CameraGoal = { position: [-1.9, 2.8, 13.0], target: [3.0, 0.7, 0] }

/**
 * Capitoli sui singoli componenti, raccontati sul motore esploso: il blocco continuo di capitoli con un modulo
 * a partire dal primo. I capitoli successivi (ad esempio i triangoli, che inquadrano il compressore) restano
 * sul motore intero.
 */
const COMPONENT_IDS = (() => {
  const hasModule = (s: Section) => !!s.focus && !!moduleForGroup(s.focus)
  const start = story.sections.findIndex(hasModule)
  const ids = new Set<string>()
  for (let i = start; i >= 0 && i < story.sections.length && hasModule(story.sections[i]); i++) ids.add(story.sections[i].id)
  return ids
})()
const isComponent = (s: Section) => COMPONENT_IDS.has(s.id)

function applyScene(id: string) {
  const set = useView.getState().setScene
  if (id === 'hero') {
    set({ focusIds: null, cameraGoal: OVERVIEW, cutaway: true, hidden: {}, flowMap: 'none', spinning: true, explodeTarget: 0 })
    return
  }
  // Tratti di apertura e chiusura: l'esplosione segue lo scorrimento (vedi onScroll), qui solo la vista.
  if (id === 'opening') {
    set({ focusIds: null, cameraGoal: EXPLODED_OVERVIEW, hidden: {}, flowMap: 'none', spinning: false, cutaway: true })
    return
  }
  if (id === 'closing') {
    set({ focusIds: null, cameraGoal: OVERVIEW, hidden: {}, flowMap: 'none', spinning: false, cutaway: true })
    return
  }
  const s = story.sections.find((x) => x.id === id)!
  const sc = s.scene as { cutaway: boolean; nacelle: boolean; spinning: boolean; flowMap?: FlowMapMode }
  if (isComponent(s)) {
    const m = moduleForGroup(s.focus!)!
    set({
      focusIds: m.ids,
      cameraGoal: explodedFraming(m, m.key === 'nacelle' ? 0.8 : 1.1),
      cutaway: true,
      hidden: {},
      flowMap: 'none',
      spinning: false,
      explodeTarget: 1,
      rating: 'max_climb',
    })
    return
  }
  const ids = s.focus ? GROUPS[s.focus] : null
  const camera = ids ? framing(ids) : sc.flowMap ? SIDE : OVERVIEW
  set({
    focusIds: ids,
    cameraGoal: camera,
    cutaway: sc.cutaway,
    hidden: sc.nacelle ? {} : { fan_casing: true, core_nacelle: true },
    flowMap: sc.flowMap ?? 'none',
    spinning: sc.spinning,
    explodeTarget: 0,
    // Nella sezione fuori progetto la mappa segue la manetta interattiva.
    rating: s.id === 'offdesign' ? 'custom' : 'max_climb',
  })
}

/** Manetta interattiva al suolo: la soluzione fuori progetto si ricalcola a ogni spostamento. */
function MiniThrottle() {
  const [T41, setT41] = useState(1550)
  const t = useDeferredValue(T41)
  const sol = useMemo(() => solveByContinuation(calibration(), { mach: 0, altM: 0, dTisa: 0 }, t), [t])
  useEffect(() => {
    useView.getState().setCustom({ mach: 0, altM: 0, dTisa: 0, T41: t })
  }, [t])
  const o = sol.out
  const it = (x: number, d = 1) => x.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d })
  return (
    <div className="throttle">
      <label>
        Manetta — T41 = <b>{T41} K</b> (livello del mare, ISA, fermo)
        <input type="range" min={T41_RANGE.min} max={T41_RANGE.max} step={10} value={T41} onChange={(e) => setT41(+e.target.value)} />
      </label>
      <div className="kpis">
        <div>
          <b>{it(o.thrust / 1000)}</b>
          <span>kN spinta</span>
        </div>
        <div>
          <b>{it(o.sfc, 4)}</b>
          <span>kg/(N·h)</span>
        </div>
        <div>
          <b>{it(o.derived.OPR, 1)}</b>
          <span>OPR</span>
        </div>
        <div>
          <b>{it(o.input.BPR, 2)}</b>
          <span>BPR</span>
        </div>
      </div>
    </div>
  )
}

export function Story() {
  const f = useMemo(() => facts(), [])
  const [active, setActive] = useState<string>('hero')
  const refs = useRef<Record<string, HTMLElement | null>>({})

  useEffect(() => {
    // Sezione attiva = quella che contiene la linea centrale dello schermo. Calcolata a ogni scorrimento
    // (una volta per frame): più affidabile di IntersectionObserver quando il rendering 3D è pesante.
    let raf = 0
    const update = () => {
      raf = 0
      // Su schermi stretti il modello occupa la parte alta: la linea di riferimento è al centro del testo visibile.
      const narrow = matchMedia('(max-width: 860px)').matches
      const mid = narrow ? (56 + 0.42 * innerHeight + innerHeight) / 2 : innerHeight / 2
      // Nei tratti di apertura e chiusura l'esplosione segue lo scorrimento in modo continuo.
      for (const [id, dir] of [
        ['opening', 1],
        ['closing', -1],
      ] as const) {
        const r = refs.current[id]?.getBoundingClientRect()
        if (r && r.top <= mid && r.bottom > mid) {
          const p = Math.min(1, Math.max(0, (mid - r.top) / (r.height * 0.8)))
          const e = p * p * (3 - 2 * p)
          useView.setState({ explodeTarget: dir > 0 ? e : 1 - e })
        }
      }
      for (const [id, el] of Object.entries(refs.current)) {
        const r = el?.getBoundingClientRect()
        if (r && r.top <= mid && r.bottom > mid) {
          setActive(id)
          return
        }
      }
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    addEventListener('scroll', onScroll, { passive: true })
    update()
    return () => {
      removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  useEffect(() => {
    applyScene(active)
  }, [active])

  // All'uscita dalla pagina fuoco ed esplosione vanno tolti, altrimenti resterebbero nella pagina Esplora.
  useEffect(
    () => () => {
      useView.getState().setScene({ focusIds: null, cameraGoal: null, hidden: {}, flowMap: 'none', explodeTarget: 0 })
      useView.setState({ explode: 0, spinning: true })
    },
    [],
  )

  const activeModule = (() => {
    const s = story.sections.find((x) => x.id === active)
    return s && isComponent(s) ? moduleForGroup(s.focus!)!.key : null
  })()
  const firstComponent = story.sections.findIndex(isComponent)
  const lastComponent = story.sections.length - 1 - [...story.sections].reverse().findIndex(isComponent)

  return (
    <div className="story">
      <TopBar route="story" />
      <div className="story-stage">
        <Viewer interactive={false}>
          <ExplodeLabels active={activeModule} />
        </Viewer>
      </div>
      <main className="story-text">
        <section id="hero" className="hero" ref={(el) => void (refs.current.hero = el)}>
          <p className="eyebrow">NASA/GE Energy Efficient Engine (E³)</p>
          <h1>
            Turb<span>(OF)</span>an
          </h1>
          <p className="lead">
            L'anatomia di un turbofan ricostruita dai documenti tecnici originali della NASA. Pale e condotti vengono dalle
            tabelle e dai disegni dei report di progetto e di prova; dove i report non bastano, le stime sono dichiarate.
            Numeri e citazioni sono verificati con controlli automatici.
          </p>
          <p className="lead small">
            Scorri per attraversare il motore dalla presa d'aria all'ugello, oppure{' '}
            <a href={href('explore')}>esplora il modello liberamente</a>.
          </p>
          <div className="scroll-cue" aria-hidden>
            ↓
          </div>
        </section>
        {story.sections.map((s, i) => (
          <Fragment key={s.id}>
          {i === firstComponent && (
            <section id="opening" className="chapter on transition" ref={(el) => void (refs.current.opening = el)}>
              <p className="eyebrow">Vista esplosa</p>
              <h2>Smontiamo il motore</h2>
              <p>
                Per guardare dentro ogni componente il motore si apre: i moduli scivolano lungo l'asse, la gondola si
                solleva, gli alberi scendono. Gli spostamenti servono solo a separare i pezzi e non hanno significato
                fisico; i gusci che attraversano più moduli (casse del combustore e delle turbine, cofano del core)
                restano nascosti finché il motore è aperto.
              </p>
            </section>
          )}
          <section id={s.id} className={`chapter ${active === s.id ? 'on' : ''}`} ref={(el) => void (refs.current[s.id] = el)}>
            <p className="eyebrow">{s.kicker}</p>
            <h2>{s.title}</h2>
            {s.paragraphs.map((p, i) => (
              <p key={i}>{fill(p.text, f)}</p>
            ))}
            {s.id === 'cycle' && <TsDiagram out={ratingPrediction('max_climb').std} />}
            {s.id === 'offdesign' && <MiniThrottle />}
            {s.id === 'triangles' && <TriangleExplorer />}
            <Citations
              keys={[...new Set(s.paragraphs.flatMap((p) => p.cites))]}
              refs={[...new Set(s.paragraphs.flatMap((p) => (p as { refs?: string[] }).refs ?? []))]}
            />
          </section>
          {i === lastComponent && (
            <section id="closing" className="chapter on transition" ref={(el) => void (refs.current.closing = el)}>
              <p className="eyebrow">Di nuovo intero</p>
              <h2>Rimontiamo il motore</h2>
              <p>
                Visti i componenti uno per uno, il motore si richiude: per seguire l'aria attraverso il ciclo
                termodinamico servono di nuovo tutti i pezzi al loro posto.
              </p>
            </section>
          )}
          </Fragment>
        ))}
        <footer className="story-end">
          <a className="cta" href={href('explore')}>
            Esplora il modello →
          </a>
          <p className="small">
            Ricostruzione didattica non ufficiale, basata su report NASA di pubblico dominio. Non affiliata a NASA o
            General Electric.
          </p>
        </footer>
      </main>
    </div>
  )
}
