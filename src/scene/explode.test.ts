import { describe, expect, it } from 'vitest'
import { EXPLODE_MODULES, SPANNING } from './explode'
import { ALL_IDS } from './focus'
import components from '../content/components.json'

describe('vista esplosa', () => {
  it('assegna ogni componente del motore a un solo modulo (o lo nasconde se attraversa più moduli)', () => {
    const assigned = EXPLODE_MODULES.flatMap((m) => m.ids)
    expect(new Set(assigned).size).toBe(assigned.length)
    const covered = new Set([...assigned, ...SPANNING])
    expect([...ALL_IDS].filter((id) => !covered.has(id))).toEqual([])
  })
  it('usa per ogni modulo una scheda descrittiva esistente', () => {
    for (const m of EXPLODE_MODULES) expect(components.groups).toHaveProperty(m.card)
  })
  it('separa i moduli coassiali in ordine lungo l\'asse', () => {
    const axial = EXPLODE_MODULES.filter((m) => m.dy === 0).map((m) => m.dx)
    expect([...axial].sort((a, b) => a - b)).toEqual(axial)
  })
})
