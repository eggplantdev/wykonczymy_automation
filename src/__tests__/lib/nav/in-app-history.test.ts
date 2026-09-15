import { describe, expect, it } from 'vitest'
import { hasInAppHistory } from '@/lib/nav/in-app-history'

const ORIGIN = 'https://app.test'

function navigation(urls: (string | undefined)[], currentIndex: number) {
  return {
    currentEntry: { index: currentIndex },
    entries: () => urls.map((url) => ({ url })),
  }
}

describe('hasInAppHistory', () => {
  // The reproduced defect, explained in `in-app-history.ts`.
  it('says no when the only previous entry is the tab it opened in', () => {
    expect(
      hasInAppHistory(navigation(['about:blank', `${ORIGIN}/inwestycje/133`], 1), ORIGIN, 2),
    ).toBe(false)
  })

  it('says yes when the previous entry is a page of this app', () => {
    expect(
      hasInAppHistory(
        navigation([`${ORIGIN}/inwestycje`, `${ORIGIN}/inwestycje/133`], 1),
        ORIGIN,
        2,
      ),
    ).toBe(true)
  })

  it('says no when the previous entry belongs to another site', () => {
    expect(
      hasInAppHistory(
        navigation(['https://mail.test/thread', `${ORIGIN}/inwestycje/133`], 1),
        ORIGIN,
        2,
      ),
    ).toBe(false)
  })

  it('says no on the first entry of the session', () => {
    expect(hasInAppHistory(navigation([`${ORIGIN}/inwestycje/133`], 0), ORIGIN, 1)).toBe(false)
  })

  // The API is present but has not adopted an entry yet (and the same arm covers a negative index).
  // Falling through to `entries()[-1]` would read `undefined` and strand the reader on a real page.
  it('falls back to the history length when the API names no current entry', () => {
    expect(hasInAppHistory({ currentEntry: null, entries: () => [] }, ORIGIN, 2)).toBe(true)
    expect(hasInAppHistory({ currentEntry: null, entries: () => [] }, ORIGIN, 1)).toBe(false)
    expect(hasInAppHistory(navigation([`${ORIGIN}/a`], -1), ORIGIN, 2)).toBe(true)
  })

  // An entry whose URL the parser rejects is „not this app" — the same answer as a foreign site.
  it('says no when the previous entry carries an unparseable url', () => {
    expect(hasInAppHistory(navigation(['::not a url::', `${ORIGIN}/a`], 1), ORIGIN, 2)).toBe(false)
  })

  // Browsers without the Navigation API keep the old length test — it is wrong about a fresh tab,
  // but it is the only signal there is, and guessing "no history" would break the common case.
  it('falls back to the history length where the Navigation API is missing', () => {
    expect(hasInAppHistory(undefined, ORIGIN, 1)).toBe(false)
    expect(hasInAppHistory(undefined, ORIGIN, 2)).toBe(true)
  })
})
