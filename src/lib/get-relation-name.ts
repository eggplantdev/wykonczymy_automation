/**
 * Extracts the `name` field from a Payload relation that may be
 * a populated object (depth ≥ 1) or a raw ID (depth 0).
 */
export function getRelationName(field: unknown, fallback = '—'): string {
  if (typeof field === 'object' && field !== null && 'name' in field) {
    return (field as { name: string }).name
  }
  return fallback
}
