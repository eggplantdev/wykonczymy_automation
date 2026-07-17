import type {
  DiscountTypeT,
  KosztorysItemT,
  KosztorysSectionT,
  KosztorysStageT,
  StageProgressT,
} from '@/lib/kosztorys/types'

// Bump only on a non-additive payload change (a renamed/dropped field). Additive fields need no
// bump — the restore mapper defaults anything missing, so an old snapshot still restores. See
// restore-kosztorys.ts for the tolerant deserialization contract.
export const SNAPSHOT_SCHEMA_VERSION = 1 as const

// The three investment editor-settings that shape computed prices — captured so a restore is
// faithful (restore rewrites them). Kept off the tree because they live on `investments`.
export type SnapshotSettingsT = {
  wToolsCoeff: number
  ownToolsCoeff: number
  vatRate: number
  globalDiscountType: DiscountTypeT | null
  globalDiscountValue: number
}

// One serialized kosztorys, flat (no nested items) so restore can rebuild the FK graph by remapping
// ids. Column-parity with the four tree tables + the three investment fields. `id`/`sectionId`/
// `itemId`/`stageId` are the OLD ids — restore mints new ones and remaps children.
export type SnapshotPayloadT = {
  schemaVersion: number
  sections: KosztorysSectionT[]
  items: KosztorysItemT[]
  stages: KosztorysStageT[]
  progress: StageProgressT[]
  settings: SnapshotSettingsT
}
