// What a missing relation prints — and what a reader compares against to tell it is missing.
export const EMPTY_RELATION_NAME = '—'

/**
 * Extracts the `name` field from a Payload relation that may be
 * a populated object (depth ≥ 1) or a raw ID (depth 0).
 */
export function getRelationName(field: unknown, fallback = EMPTY_RELATION_NAME): string {
  if (typeof field === 'object' && field !== null && 'name' in field) {
    return (field as { name: string }).name
  }
  return fallback
}
