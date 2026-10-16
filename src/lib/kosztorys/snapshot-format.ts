import type {
  GlobalDiscountT,
  KosztorysItemT,
  KosztorysSectionT,
  KosztorysStageT,
  StageProgressT,
  StageSplitT,
} from '@/lib/kosztorys/types'
import { normalizeStageSplit, oneWorkerSplit } from '@/lib/kosztorys/stage-split'
import { toDescriptionTranslations } from '@/lib/i18n/description-translations'
import { aiDraftOf } from '@/lib/kosztorys/ai-draft'

export type SnapshotKindT = 'manual' | 'auto' | 'named' | 'daily'

// A new column that is NOT NULL *without* a default (`kosztorys_sections.name`,
// `kosztorys_stages.ordinal` are the two today) has no meaningful fallback, so adding one IS a
// breaking change for every stored payload, additive or not.
//
// A BUMP IS NOT DONE UNTIL THE EXISTING ROWS ARE DEALT WITH. NEVER `daily`/`named`: those are the
// investor's change history, and a day deleted from it cannot be re-accumulated.
export const SNAPSHOT_SCHEMA_VERSION = 1 as const

export function assertReadableSchemaVersion(version: number, kind: 'preset' | 'snapshot'): void {
  if (version === SNAPSHOT_SCHEMA_VERSION) return
  const label = kind === 'preset' ? 'szablonu' : 'wersji'
  throw new Error(
    `Nie można wczytać ${label}: zapisano w formacie ${version}, aplikacja obsługuje ${SNAPSHOT_SCHEMA_VERSION}.`,
  )
}

// The global discount is NOT one of them: restoring a version must not reset the live amount discount.
export type SnapshotSettingsT = {
  wToolsCoeff: number
  ownToolsCoeff: number
  vatRate: number
}

// `id`/`sectionId`/`itemId`/`stageId` are the OLD ids — restore mints new ones and remaps children.
export type SnapshotPayloadT = {
  schemaVersion: number
  sections: KosztorysSectionT[]
  items: KosztorysItemT[]
  stages: KosztorysStageT[]
  progress: StageProgressT[]
  settings: SnapshotSettingsT
  // Display-only (the investor's history shows the rabat a version had); restore never reads it.
  globalDiscount?: GlobalDiscountT
}

export type KosztorysSnapshotPayloadT = SnapshotPayloadT & { globalDiscount: GlobalDiscountT }

export function emptySnapshotPayload(settings: SnapshotSettingsT): SnapshotPayloadT {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    sections: [],
    items: [],
    stages: [],
    progress: [],
    settings,
  }
}

// The optional set is the list of columns the restore path has to fill for itself, and it must grow
// whenever one is added.
type TolerantT<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export type StoredSnapshotPayloadT = {
  schemaVersion: number
  sections: TolerantT<KosztorysSectionT, 'displayOrder'>[]
  items: TolerantT<
    KosztorysItemT,
    | 'displayOrder'
    | 'plannedQty'
    | 'currentPlannedQty'
    | 'discountValue'
    | 'clientPrice'
    | 'wToolsOverrideValue'
    | 'ownToolsOverrideValue'
    | 'wToolsOverrideCoeff'
    | 'ownToolsOverrideCoeff'
    | 'descriptionTranslations'
    | 'aiPlannedQty'
    | 'aiMissingData'
    | 'aiAssumptions'
    | 'aiNewInformation'
    | 'aiRecheck'
    | 'catalogueItemId'
    | 'changeReason'
    | 'reviewStatus'
  >[]
  stages: StoredStageT[]
  progress: TolerantT<StageProgressT, 'qtyDone'>[]
  settings?: Partial<SnapshotSettingsT>
  // Absent on every row written before the investor history shipped: an UNKNOWN rabat, not 0 zł.
  globalDiscount?: GlobalDiscountT
}

export type StoredStageT = Omit<KosztorysStageT, 'split' | 'completed'> & {
  split?: StageSplitT | null
  workerId?: number | null
  completed?: boolean
}

export function storedStageSplit(stage: StoredStageT): StageSplitT | null {
  if (stage.split !== undefined) return normalizeStageSplit(stage.split)
  return stage.workerId == null ? null : oneWorkerSplit(stage.workerId)
}

// An absent key is NOT the same as a stored null: the `sql` tag emits NOTHING for `undefined`, so the
// tuple loses a placeholder and the INSERT dies on a syntax error — and where the column is NOT NULL
// DEFAULT 0, binding an explicit NULL would not draw the default either (23502).
//
// `displayOrder` takes the row's INDEX rather than 0: it is the natural key remapNewIds joins
// RETURNING on, so a constant would tie it batch-wide, drop the remap to positional, and restore the
// tree flattened to one position.
export function itemWithColumnDefaults(
  item: StoredSnapshotPayloadT['items'][number],
  index: number,
): KosztorysItemT {
  return {
    ...item,
    displayOrder: item.displayOrder ?? index,
    plannedQty: item.plannedQty ?? 0,
    currentPlannedQty: item.currentPlannedQty ?? null,
    discountValue: item.discountValue ?? 0,
    clientPrice: item.clientPrice ?? 0,
    wToolsOverrideValue: item.wToolsOverrideValue ?? null,
    ownToolsOverrideValue: item.ownToolsOverrideValue ?? null,
    // `?? 0` would invent a stawka of zero złotych.
    wToolsOverrideCoeff: item.wToolsOverrideCoeff ?? null,
    ownToolsOverrideCoeff: item.ownToolsOverrideCoeff ?? null,
    descriptionTranslations: toDescriptionTranslations(item.descriptionTranslations),
    ...aiDraftOf(item),
    catalogueItemId: item.catalogueItemId ?? null,
    changeReason: item.changeReason ?? null,
    reviewStatus: item.reviewStatus ?? null,
  }
}
