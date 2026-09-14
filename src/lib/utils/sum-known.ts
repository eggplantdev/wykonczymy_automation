/**
 * `null` — not 0 — when nothing in the set carries a price; every caller renders that as „—". Zero
 * stays the true zero: an empty set, or work that really was free.
 *
 * Shared so that a footer reaches the same verdict as the totals above it; a hand-rolled `?? 0`
 * once printed „0,00 zł" under a column of dashes.
 */
export const sumKnown = (costs: readonly (number | null)[]): number | null => {
  if (costs.length > 0 && costs.every((cost) => cost === null)) return null

  return costs.reduce((total: number, cost) => total + (cost ?? 0), 0)
}
