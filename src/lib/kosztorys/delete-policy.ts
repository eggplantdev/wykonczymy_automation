import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// Deleting the last item of a section takes the section with it, so no orphaned 0-row section is
// left behind — the one thing a caller must know before removing an item. Pure so the handler and
// its confirm dialog can't disagree about which of the two deletes is about to happen.
//
// Emptying the kosztorys down to nothing this way is INTENDED — the „≥1 pozycja" floor was removed
// deliberately (owner ruling; roadmap S-08 + context/archive/2026-07-17-kosztorys-delete-confirm/).
// There is no last-item or last-section guard anywhere, in the UI or at the action, and its absence
// is not an oversight to be repaired: reviews have twice read it as one.
export function isLastItemInSection(rows: KosztorysV2RowT[], row: KosztorysV2RowT): boolean {
  return !rows.some((r) => r.sectionId === row.sectionId && r.id !== row.id)
}
