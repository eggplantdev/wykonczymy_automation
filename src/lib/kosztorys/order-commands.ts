import type { SortStateT } from '@/lib/kosztorys/row-view'

// Only a GLOBAL sort drops the bands, but ANY sort freezes the hand-made order of both planes, because
// the array no longer mirrors display_order. Kept together so a section-scoped sort cannot leave the
// order commands looking live while they do nothing.
export function sectionBandsVisible(sort: SortStateT | undefined): boolean {
  return sort?.scope !== 'global'
}

export function orderCommandsEnabled(sort: SortStateT | undefined): boolean {
  return sort == null
}
