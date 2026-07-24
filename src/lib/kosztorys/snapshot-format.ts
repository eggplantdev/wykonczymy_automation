import type {
  KosztorysItemT,
  KosztorysSectionT,
  KosztorysStageT,
  StageProgressT,
} from '@/lib/kosztorys/types'

// Bump only on a non-additive payload change (a renamed/dropped field). Additive fields need no
// bump — the restore mapper defaults anything missing, so an old snapshot still restores. See
// restore-kosztorys.ts for the tolerant deserialization contract.
export const SNAPSHOT_SCHEMA_VERSION = 1 as const

// Gate a stored payload at read time. Because the version bumps ONLY on a non-additive change, any
// mismatch (an old row written before that change, or a future row from newer code) means the
// tolerant mapper would seed wrong/missing columns — so reject loudly instead of silently applying.
// Never bumped yet, so this rejects nothing today; it's the guard that arms on the first bump.
export function assertReadableSchemaVersion(version: number, kind: 'preset' | 'snapshot'): void {
  if (version === SNAPSHOT_SCHEMA_VERSION) return
  const label = kind === 'preset' ? 'szablonu' : 'wersji'
  throw new Error(
    `Nie można wczytać ${label}: zapisano w formacie ${version}, aplikacja obsługuje ${SNAPSHOT_SCHEMA_VERSION}.`,
  )
}

// The investment editor-settings that shape computed prices — captured so a restore is faithful
// (restore rewrites them). Kept off the tree because they live on `investments`. The global discount
// is deliberately NOT captured: restoring a version must not reset the live amount discount.
export type SnapshotSettingsT = {
  wToolsCoeff: number
  ownToolsCoeff: number
  vatRate: number
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
