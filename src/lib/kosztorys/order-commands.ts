import type { SortStateT } from '@/lib/kosztorys/row-view'

// Two rules that must never disagree: only a GLOBAL sort drops the bands, but ANY sort freezes the
// hand-made order of both planes — pozycje inside a sekcja and the sekcje themselves — because the
// array no longer mirrors display_order. Read apart, that gap is a menu whose order commands look
// live under a section-scoped sort and silently do nothing.
export function sectionBandsVisible(sort: SortStateT | undefined): boolean {
  return sort?.scope !== 'global'
}

export function orderCommandsEnabled(sort: SortStateT | undefined): boolean {
  return sort == null
}
