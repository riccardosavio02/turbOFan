import { useEffect, useState } from 'react'

export type Route = 'story' | 'explore'

/** Navigazione con l'hash dell'URL (#/ e #/esplora): funziona anche su GitHub Pages senza server. */
// Il vecchio indirizzo #/esploso porta alla storia, che ora contiene la vista esplosa.
const parse = (): Route => (location.hash.startsWith('#/esplora') ? 'explore' : 'story')

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parse)
  useEffect(() => {
    const on = () => setRoute(parse())
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return route
}

export const href = (r: Route) => (r === 'explore' ? '#/esplora' : '#/')
