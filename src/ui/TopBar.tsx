import { href, type Route } from '../router'

export function TopBar({ route }: { route: Route }) {
  return (
    <header className="topbar">
      <a className="logo" href={href('story')}>
        Turb<span>(OF)</span>an
      </a>
      <nav>
        <a className={route === 'story' ? 'on' : ''} href={href('story')}>
          Storia
        </a>
        <a className={route === 'explore' ? 'on' : ''} href={href('explore')}>
          Esplora
        </a>
      </nav>
    </header>
  )
}
