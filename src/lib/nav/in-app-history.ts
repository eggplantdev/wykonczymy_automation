// The subset of the Navigation API „Wróć" needs. Not in TS's DOM lib yet, and absent in some
// browsers — hence the `undefined` arm below rather than a hard dependency.
export type NavigationHistoryLikeT = {
  currentEntry: { index: number } | null
  entries: () => { url?: string }[]
}

/**
 * Whether `history.back()` lands back in this app. `history.length` lies (a fresh tab already
 * reports 2), so this checks the previous entry's URL against `origin` instead — `entries()` omits
 * cross-origin steps, but the editor's outbound links open a new tab, so that gap never matters here.
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
