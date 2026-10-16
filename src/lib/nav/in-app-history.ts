export type NavigationHistoryLikeT = {
  currentEntry: { index: number } | null
  entries: () => { url?: string }[]
}

/**
 * `history.length` lies (a fresh tab already
 * reports 2), so this checks the previous entry's URL against `origin` instead
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
