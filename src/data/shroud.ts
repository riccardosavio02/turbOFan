import { fanRows, fanShroudSpan } from './fan'
import type { RevolvedBody } from './flowpath'
import { meridionalAt } from '../geometry/blade'

const fanRotor = fanRows.find((r) => r.id === 'R1_fan_rotor')!

/**
 * Lo shroud a metà pala del fan, che nel motore assemblato forma un anello continuo,
 * rappresentato come anello sottile (stima: spessore e corda dello shroud non sono tabulati).
 */
export const shroudRing: RevolvedBody = {
  id: 'fan_shroud',
  cut: true,
  label: 'Shroud a metà pala del fan',
  material: 'titanium',
  spool: 'LP',
  note: `Posizione al ${Math.round(fanShroudSpan * 100)}% dell'altezza della pala (CR-165148 p.3). Rappresentato come anello continuo; corda e spessore stimati.`,
  profile: [0.3, 0.7, 0.7, 0.3].map((s, i) => {
    const [z, r] = meridionalAt(fanRotor.quad, fanShroudSpan, s)
    return { p: [z, r + (i < 2 ? 0.004 : -0.004)] as [number, number], src: 'estimate' as const }
  }),
}

