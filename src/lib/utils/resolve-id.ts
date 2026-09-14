/**
 * Resolve a Payload relationship to its numeric ID — raw at depth 0, populated object at depth ≥ 1.
 *
 * The string branch is not cosmetic: a REST body sends `{"investment":"99"}`, and callers that gate
 * on the resolved id (the investment lock) treat `undefined` as „no investment touched" — so
 * dropping a string id would open the gate rather than close it.
 */
export const resolveId = (value: unknown): number | undefined => {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return resolveId((value as { id: unknown }).id)
  }
  return undefined
}
