import { describe, it, expect } from 'vitest'
import { CATALOGUE_NAME_FIXES } from '@/lib/kosztorys/catalogue-name-fixes'
import { fold } from '@/lib/kosztorys/sheet-import/columns'
import { foldDescription } from '@/lib/kosztorys/sheet-import/item-key'
import { hasLegacyMarker } from '@/lib/kosztorys/work-catalogue/legacy-marker'

// The table was pasted in from a deleted TSV, so nothing about its shape can be argued
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

  // Idempotence of both consumers rests on this: a corrected name that is itself a key would be
  // rewritten twice. Asserted through `foldDescription` rather than against the raw keys, because
  // that is the composition the code actually applies — substring rules, then the whole-name map.
  it('settles every corrected name in one pass', () => {
    const chained = [...CATALOGUE_NAME_FIXES.values()].filter(
      (value) => foldDescription(foldDescription(value)) !== foldDescription(value),
    )
    expect(chained).toEqual([])
  })
})
