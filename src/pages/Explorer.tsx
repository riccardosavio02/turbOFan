import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Viewer } from '../scene/Viewer'
import { framing } from '../scene/focus'
import { useView } from '../store'
import { catalog } from '../ui/catalog'
import { CycleTab } from '../ui/CycleTab'
import { Info } from '../ui/Info'
import { TopBar } from '../ui/TopBar'

type Tab = 'components' | 'view' | 'cycle'

function ComponentsTab() {
  const { selected, hidden, select, toggleHidden, flyTo } = useView(
    useShallow((s) => ({ selected: s.selected, hidden: s.hidden, select: s.select, toggleHidden: s.toggleHidden, flyTo: s.flyTo })),
  )
  return (
    <div className="tab">
      <p className="small">Clic su un nome per selezionarlo e inquadrarlo; la casella lo mostra o lo nasconde.</p>
      {catalog.map((g) => (
        <details key={g.title}>
          <summary>
            <h3>{g.title}</h3>
          </summary>
          <ul>
            {g.items.map((it) => (
              <li key={it.id} className={selected === it.id ? 'active' : ''}>
                <input type="checkbox" checked={!hidden[it.id]} onChange={() => toggleHidden(it.id)} aria-label={`Mostra ${it.label}`} />
                <button
                  onClick={() => {
                    select(it.id)
                    flyTo(framing([it.id]))
                  }}
                >
                  {it.label}
                  {it.detail && <small>{it.detail}</small>}
                </button>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  )
}

function ViewTab() {
  const v = useView(
    useShallow((s) => ({
      cutaway: s.cutaway,
      spinning: s.spinning,
      hidden: s.hidden,
      focusIds: s.focusIds,
      setCutaway: s.setCutaway,
      setSpinning: s.setSpinning,
      toggleHidden: s.toggleHidden,
      setFocus: s.setFocus,
      flyTo: s.flyTo,
    })),
  )
  const Toggle = ({ label, on, set, hint }: { label: string; on: boolean; set: (v: boolean) => void; hint: string }) => (
    <label className="toggle">
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />
      <span>
        {label}
        <small>{hint}</small>
      </span>
    </label>
  )
  return (
    <div className="tab">
      <Toggle label="Sezione a 90°" on={v.cutaway} set={v.setCutaway} hint="Taglia un quarto del motore, come nei modelli da museo." />
      <Toggle label="Rotazione degli alberi" on={v.spinning} set={v.setSpinning} hint="Alberi LP e HP con il rapporto di giri reale (circa 1 : 3,6), rallentati." />
      <Toggle
        label="Gondola"
        on={!v.hidden.fan_casing}
        set={() => {
          v.toggleHidden('fan_casing')
          v.toggleHidden('core_nacelle')
        }}
        hint="Gondola, cassa del fan e cofano del core."
      />
      <Toggle label="Isola la selezione" on={!!v.focusIds} set={(on) => !on && v.setFocus(null)} hint="Si attiva dalla scheda di un componente; qui si disattiva." />
      <button className="wide" onClick={() => v.flyTo({ position: [-3.6, 2.6, 6.8], target: [1.3, 0, 0] })}>
        Vista d'insieme
      </button>
      <p className="small">Trascina per ruotare, rotella per lo zoom, tasto destro per spostare la vista.</p>
    </div>
  )
}

export function Explorer() {
  const [tab, setTab] = useState<Tab>('components')
  const [open, setOpen] = useState(true)
  return (
    <div className="explorer">
      <TopBar route="explore" />
      <div className="explorer-stage">
        <Viewer />
      </div>
      <aside className={`panel drawer ${open ? '' : 'closed'}`}>
        <div className="drawer-head">
          <div className="seg tabs" role="tablist">
            {(
              [
                ['components', 'Componenti'],
                ['view', 'Vista'],
                ['cycle', 'Ciclo'],
              ] as [Tab, string][]
            ).map(([t, l]) => (
              <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
                {l}
              </button>
            ))}
          </div>
          <button className="ghost" onClick={() => setOpen(!open)} aria-label={open ? 'Chiudi il menu' : 'Apri il menu'}>
            {open ? '‹' : '›'}
          </button>
        </div>
        {open && (tab === 'components' ? <ComponentsTab /> : tab === 'view' ? <ViewTab /> : <CycleTab />)}
      </aside>
      <Info />
    </div>
  )
}
