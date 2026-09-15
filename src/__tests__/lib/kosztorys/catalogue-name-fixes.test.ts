import { describe, it, expect } from 'vitest'
import { CATALOGUE_NAME_FIXES } from '@/lib/kosztorys/catalogue-name-fixes'
import { fold } from '@/lib/kosztorys/sheet-import/columns'
import { hasLegacyMarker } from '@/lib/kosztorys/work-catalogue/legacy-marker'

// The table is 915 lines pasted in from a deleted TSV, so nothing about its shape can be argued
// from reading the code — every invariant the two consumers stand on has to be machine-checked.
describe('CATALOGUE_NAME_FIXES', () => {
  it('carries every correction the owner prepared, deduplicated by opis', () => {
    expect(CATALOGUE_NAME_FIXES.size).toBe(915)
  })

  // A key that is not already folded is a key `foldDescription` can never produce, so its
  // correction would silently never fire.
  it('keys in the shape `foldDescription` hands it', () => {
    const unstable = [...CATALOGUE_NAME_FIXES.keys()].filter((key) => fold(key) !== key)
    expect(unstable).toEqual([])
  })

  // The note is a katalog review artifact; it reaches a client's oferta through the button.
  it('never hands back the „[stary arkusz]" note', () => {
    const marked = [...CATALOGUE_NAME_FIXES.values()].filter(hasLegacyMarker)
    expect(marked).toEqual([])
  })

  // Idempotence of both consumers rests on this: a value that is also a key would rewrite twice,
  // and the raw TSV does contain 8 such chains — they survive only via identity entries, which the
  // derivative drops. That is a property of today's data, not of the construction.
  it('has no chains left once the identity entries are filtered out', () => {
    const derived = [...CATALOGUE_NAME_FIXES].filter(([key, value]) => fold(value) !== key)
    const keys = new Set(derived.map(([key]) => key))
    const chained = derived.filter(([, value]) => keys.has(fold(value)))
    expect(chained).toEqual([])
  })
})
