import type { SnapshotKindT } from '@/lib/kosztorys/snapshot-format'
import type { DayT } from '@/lib/utils/days'
import type { GlobalDiscountT, KosztorysStageT, KosztorysTreeT } from '@/lib/kosztorys/types'

// A row stored before the investor history shipped has no rabat at all. `known: false` is that
// state, and it is never read as 0 zł: a rabat of 0 is a claim, and nobody made it.
export type HistoryDiscountT = ({ known: true } & GlobalDiscountT) | { known: false }

export type HistoryVersionT = { tree: KosztorysTreeT; discount: HistoryDiscountT }

export type ItemRefT = {
  id: number
  sectionName: string
  description: string | null
  unit: string | null
  plannedQty: number
}

export type FieldChangeT =
  | { field: 'plannedQty' | 'price' | 'plannedNet' | 'net'; before: number; after: number }
  // The STORED value, so „follows the ofertowy" (`null`) → a typed number is a change of its own,
  // even when the number equals the ofertowy it was following.
  | { field: 'currentPlannedQty'; before: number | null; after: number | null }
  // `stageId` is the column the past grid renders: the past etap's id, or the current one's for an
  // etap that did not exist yet (`VersionDiffT.addedStages`).
  | { field: 'stageQty'; stageId: number; stageLabel: string; before: number; after: number }

export type ItemChangeT = { item: ItemRefT; fields: FieldChangeT[] }

// Each side carries the stawka VAT of its own version, so its brutto reads as it did back then.
export type DiscountAtVatT = GlobalDiscountT & { vatRate: number }

export type DiscountChangeT =
  | { state: 'unknown' }
  | { state: 'same' }
  | { state: 'changed'; before: DiscountAtVatT; after: DiscountAtVatT }

export type VersionDiffT = {
  added: ItemRefT[]
  removed: ItemRefT[]
  // Keyed by the PAST item id, because the past tree is what the grid renders.
  changed: Map<number, ItemChangeT>
  addedStages: KosztorysStageT[]
  discount: DiscountChangeT
}

export type HistoryKindT = Exclude<SnapshotKindT, 'manual'>

export type HistoryMetaT = { id: number; kind: HistoryKindT; label: string | null; takenAt: Date }

export type HistoryEntryT = {
  id: number
  label: string | null
  day: DayT
  summary: string
}

export type PastVersionT = {
  tree: KosztorysTreeT
  id: number
  label: string | null
  day: DayT
  diff: VersionDiffT
}

export type InvestorHistoryT = { entries: HistoryEntryT[]; version: PastVersionT | null }
