import { useDeferredValue, useMemo } from 'react'
import spec from '../../engines/ge-e3.json'
import { runCycle } from './cycle'
import { ratingInput, type Rating } from './ratings'
import { calibrate, predictRating, solveByContinuation, type Calibration } from './offdesign'
import type { Prediction } from './validation'
import { useView } from '../store'

let cal: Calibration | null = null
/** Taratura del modello fuori progetto (una volta sola). */
export const calibration = () => (cal ??= calibrate())

const cache = new Map<Rating, Prediction>()

/** Punto di rating: progetto a max climb, previsione fuori progetto per crociera e decollo. */
export function ratingPrediction(r: Rating): Prediction {
  if (!cache.has(r)) {
    if (r === 'max_climb') {
      const out = runCycle(ratingInput(r))
      cache.set(r, { std: out, hot: out })
    } else {
      const p = predictRating(calibration(), r, spec.cycle.T41_HPT_rotor_inlet[r])
      cache.set(r, { std: p.std.out, hot: p.hot.out })
    }
  }
  return cache.get(r)!
}

/** Risultato mostrato: un punto di rating oppure il punto libero scelto con manetta e condizioni di volo. */
export function useCycle() {
  const rating = useView((s) => s.rating)
  // Il punto libero si ricalcola con priorità bassa: i cursori restano fluidi durante il trascinamento.
  const custom = useDeferredValue(useView((s) => s.custom))
  return useMemo(() => {
    if (rating !== 'custom') {
      const p = ratingPrediction(rating)
      return { rating, out: p.std, prediction: p, converged: true }
    }
    const sol = solveByContinuation(calibration(), custom, custom.T41)
    return { rating, out: sol.out, prediction: null, converged: sol.converged }
  }, [rating, custom])
}
