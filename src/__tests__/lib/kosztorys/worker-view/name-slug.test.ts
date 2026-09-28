import { describe, expect, it } from 'vitest'
import {
  workerIdFromSegment,
  workerNameSlug,
  workerPreviewSegment,
} from '@/lib/kosztorys/worker-view/name-slug'

describe('workerNameSlug', () => {
  it('spells a Polish name in plain URL letters, keeping its capitals', () => {
    expect(workerNameSlug('Łukasz Żółtowski-Kęś')).toBe('Lukasz-Zoltowski-Kes')
  })

  it('collapses anything that is not a letter or digit into one dash', () => {
    expect(workerNameSlug('  Jan   Kowalski (ekipa 2) ')).toBe('Jan-Kowalski-ekipa-2')
  })
})

describe('worker podgląd segment', () => {
  it('reads the id back off the name it travels with', () => {
    const segment = workerPreviewSegment('Jan Kowalski 2', 59)

    expect(segment).toBe('Jan-Kowalski-2-59')
    expect(workerIdFromSegment(segment)).toBe(59)
  })

  it('falls back to the bare id for a name with nothing URL-safe in it', () => {
    expect(workerPreviewSegment(' — ', 59)).toBe('59')
    expect(workerIdFromSegment('59')).toBe(59)
  })

  it('resolves by the id alone, whatever name precedes it', () => {
    expect(workerIdFromSegment('Stare-Nazwisko-59')).toBe(59)
    expect(workerIdFromSegment('Nikolajewicz')).toBeUndefined()
  })
})
