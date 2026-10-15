import type { TranslationFillResultT } from '@/lib/actions/kosztorys-translations'
import type { SavePresetInputT } from '@/lib/actions/kosztorys-presets'
import type { RestoreResultT, SnapshotListItemT } from '@/lib/actions/kosztorys-snapshots'
import type { AddItemInputT } from '@/lib/kosztorys/add-item-schema'
import type { AppendedSliceT } from '@/lib/kosztorys/append-preset-sections'
import type { CreatedSectionT } from '@/lib/kosztorys/create-section'
import type { InsertDirectionT } from '@/lib/kosztorys/display-order'
import type { KosztorysLayoutT } from '@/lib/kosztorys/reorder-layout'
import type { ReloadFromPresetResultT } from '@/lib/kosztorys/reload-from-preset'
import type { SectionPatchT } from '@/lib/kosztorys/section-patch-schema'
import type { ItemPatchT, KosztorysItemT } from '@/lib/kosztorys/types'
import type {
  AppendedCatalogueSliceT,
  NewSectionCatalogueSliceT,
} from '@/lib/kosztorys/work-catalogue/types'
import type { ActionResultT } from '@/types/action'

/**
 * The route hands in the set for its plane — a kosztorys id and a szablon id share one number
 * space, so a szablon calling a kosztorys action would write into whichever investment carries its
 * id. `ownerId` is the kosztorys's investment or the szablon. Writes a szablon never shows (etapy,
 * rozliczenie, arkusz) stay direct imports.
 */
export type EditorActionsT = {
  // The editor's plane is read from here, never passed beside the set, so the two can't disagree.
  isTemplate: boolean
  updateItemField: (itemId: number, patch: ItemPatchT) => Promise<ActionResultT>
  updateSectionField: (sectionId: number, patch: SectionPatchT) => Promise<ActionResultT>
  addSection: (ownerId: number) => Promise<ActionResultT<CreatedSectionT>>
  insertSection: (
    anchorSectionId: number,
    dir: InsertDirectionT,
  ) => Promise<ActionResultT<CreatedSectionT>>
  removeSection: (sectionId: number) => Promise<ActionResultT>
  addItem: (input: AddItemInputT) => Promise<ActionResultT<{ item: KosztorysItemT }>>
  removeItem: (itemId: number) => Promise<ActionResultT>
  insertCatalogueItems: (
    sectionId: number,
    catalogueItemIds: number[],
  ) => Promise<ActionResultT<AppendedCatalogueSliceT>>
  createSectionWithCatalogueItems: (
    ownerId: number,
    sectionName: string,
    catalogueItemIds: number[],
  ) => Promise<ActionResultT<NewSectionCatalogueSliceT>>
  renumberOrder: (ownerId: number, orderedItemIds: number[]) => Promise<ActionResultT>
  writeLayout: (ownerId: number, layout: KosztorysLayoutT) => Promise<ActionResultT>
  clear: (ownerId: number) => Promise<ActionResultT>
  autoSnapshot: (ownerId: number) => Promise<ActionResultT>
  saveSnapshot: (ownerId: number, label: string) => Promise<ActionResultT>
  listSnapshots: (ownerId: number) => Promise<ActionResultT<SnapshotListItemT[]>>
  restoreSnapshot: (
    snapshotId: number,
    ownerId: number,
  ) => Promise<ActionResultT<RestoreResultT>>
  fillTranslations: (ownerId: number) => Promise<ActionResultT<TranslationFillResultT>>
  readRevision: (ownerId: number) => Promise<string | undefined>
  savePreset: (ownerId: number, input: SavePresetInputT) => Promise<ActionResultT>
  reloadFromPreset: (
    ownerId: number,
    presetId: number,
  ) => Promise<ActionResultT<ReloadFromPresetResultT>>
  appendPresetSections: (
    ownerId: number,
    sectionIds: number[],
  ) => Promise<ActionResultT<AppendedSliceT>>
}
