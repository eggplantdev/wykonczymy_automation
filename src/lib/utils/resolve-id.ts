/** Resolve a Payload relationship to its numeric ID — raw at depth 0, populated object at depth ≥ 1. */
export const resolveId = (value: unknown): number | undefined => {
  if (typeof value === 'number') return value
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return (value as { id: number }).id
  }
  return undefined
}
