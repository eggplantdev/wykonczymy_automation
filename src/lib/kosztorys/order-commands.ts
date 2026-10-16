import type { SortStateT } from '@/lib/kosztorys/row-view'

// Only a GLOBAL sort drops the bands, but ANY sort freezes the hand-made order of both planes, because
// the array no longer mirrors display_order.
export function sectionBandsVisible(sort: SortStateT | undefined): boolean {
  return sort?.scope !== 'global'
}

export function orderCommandsEnabled(sort: SortStateT | undefined): boolean {
  return sort == null
}
