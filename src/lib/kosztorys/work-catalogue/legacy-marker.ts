// The note lives in `description` and the owner deletes it by hand — no column, on purpose (owner
// ruling, 2026-09-01). A SUFFIX so the listing, which sorts by `description`, stands the imported
// praca next to its wzór twin instead of piling every import under „[.
export const LEGACY_SUFFIX = ' [stary arkusz]'

const LEGACY_MARKER = /\s*\[stary arkusz\]\s*$/u

/**
 * The note is display text, never identity: a row keyed on it would miss its twin in „Porównaj
 * z katalogiem", and an insert-only wsad would add a second copy. `catalogueKey` calls this itself,
 * so identity is marker-blind; the only other callers are the ones that RENDER the note.
 */
export function stripLegacyMarker(description: string): string {
  return description.replace(LEGACY_MARKER, '')
}

// `test` rather than comparing a strip against its input: the katalog asks this per row on every
// redraw of ~950 rows, and the comparison allocates a throwaway string to answer a boolean.
export function hasLegacyMarker(description: string): boolean {
  return LEGACY_MARKER.test(description)
}
