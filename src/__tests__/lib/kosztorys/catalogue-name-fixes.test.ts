import { fold } from '@/lib/kosztorys/fold'
import { describe, it, expect } from 'vitest'
import { CATALOGUE_NAME_FIXES } from '@/lib/kosztorys/catalogue-name-fixes'
import { foldDescription } from '@/lib/kosztorys/sheet-import/item-key'

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

  it('settles every corrected name in one pass', () => {
    const chained = [...CATALOGUE_NAME_FIXES.values()].filter(
      (value) => foldDescription(foldDescription(value)) !== foldDescription(value),
    )
    expect(chained).toEqual([])
  })
})
