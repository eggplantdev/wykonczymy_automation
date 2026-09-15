// The subset of the Navigation API „Wróć" needs. Not in TS's DOM lib yet, and absent in some
// browsers — hence the `undefined` arm below rather than a hard dependency.
export type NavigationHistoryLikeT = {
  currentEntry: { index: number } | null
  entries: () => { url?: string }[]
}

/**
 * Whether `history.back()` would land on a page of this app rather than outside it.
 *
 * `history.length` cannot answer that: a fresh tab that has just navigated already reports 2,
 * because the tab's initial blank document is entry 1. That is why the old `length <= 1` guard
 * never fired on a direct load and „Wróć" walked the reader to `about:blank`. The previous
 * entry's URL answers it exactly — `about:blank` and a foreign site are both „not this app".
 *
 * Narrower than „the previous history STEP", and knowingly so: `entries()` omits cross-origin
 * entries and compacts the indices, so a reader who left for another site in this tab and came back
 * through the address bar sees the app page from before the excursion as their previous entry.
 * „Wróć" then walks them out — the very defect this replaced — but only on that path, and the
 * editor's outbound links open a new tab, so nothing in the app produces it.
 */
export function hasInAppHistory(
  navigation: NavigationHistoryLikeT | undefined,
  origin: string,
  historyLength: number,
): boolean {
  const index = navigation?.currentEntry?.index
  if (navigation === undefined || index === undefined || index < 0) return historyLength > 1
  const previous = navigation.entries()[index - 1]
  if (!previous?.url) return false
  try {
    return new URL(previous.url).origin === origin
  } catch {
    return false
  }
}
