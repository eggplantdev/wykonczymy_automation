// A praca pulled in from an old investment sheet carries a visible note at the end of its
// `description`, which the owner deletes by hand while reviewing the katalog — no column, on
// purpose (owner ruling, 2026-09-01). A SUFFIX rather than a prefix so the listing, which sorts by
// `description`, stands the imported praca next to its wzór twin instead of piling every import
// under „[".
export const LEGACY_SUFFIX = ' [stary arkusz]'

/**
 * The note is display text, never identity: a marked row that keyed on the note would stop matching
 * the same praca elsewhere in the app — it would miss its twin in „Porównaj z katalogiem", the
 * picker would not know it was already added, and an insert-only wsad, finding no such key, would
 * add a second copy. `catalogueKey` therefore calls this itself, so identity is marker-blind for
 * readers and writers alike; the only other callers are the ones that RENDER the note.
 */
export function stripLegacyMarker(description: string): string {
  return description.replace(/\s*\[stary arkusz\]\s*$/u, '')
}

export function hasLegacyMarker(description: string): boolean {
  return stripLegacyMarker(description) !== description
}
