import { describe, expect, it } from 'vitest'
import story from './story.json'
import { facts, fill } from './facts'
import { GROUPS, ALL_IDS } from '../scene/focus'
import components from './components.json'

describe('contenuti della storia', () => {
  const f = facts()
  it('ogni segnaposto numerico ha un valore', () => {
    for (const s of story.sections)
      for (const p of s.paragraphs) expect(fill(p.text, f)).not.toMatch(/⟦/)
  })
  it('ogni citazione usata è definita e ogni citazione definita è usata', () => {
    const used = new Set([
      ...story.sections.flatMap((s) => s.paragraphs.flatMap((p) => p.cites)),
      ...Object.values(components.groups).flatMap((g) => g.cites),
    ])
    const defined = new Set(Object.keys(story.citations))
    expect([...used].filter((k) => !defined.has(k))).toEqual([])
    expect([...defined].filter((k) => !used.has(k))).toEqual([])
  })
  it('ogni fuoco della camera punta a un gruppo esistente, fatto di componenti esistenti', () => {
    for (const s of story.sections) if (s.focus) expect(GROUPS[s.focus]).toBeDefined()
    for (const ids of Object.values(GROUPS)) for (const id of ids) expect(ALL_IDS.has(id)).toBe(true)
  })
  it('ogni riferimento bibliografico è definito', () => {
    for (const s of story.sections)
      for (const p of s.paragraphs as { refs?: string[] }[]) for (const r of p.refs ?? []) expect(story.refs).toHaveProperty(r)
  })
})

describe('schede dei componenti', () => {
  const f = facts()
  it('usano solo citazioni verificate e gruppi esistenti, con segnaposto validi', () => {
    for (const [g, c] of Object.entries(components.groups)) {
      expect(GROUPS[g]).toBeDefined()
      for (const k of c.cites) expect(story.citations).toHaveProperty(k)
      expect(fill(c.what + c.function, f)).not.toMatch(/⟦/)
    }
  })
})
