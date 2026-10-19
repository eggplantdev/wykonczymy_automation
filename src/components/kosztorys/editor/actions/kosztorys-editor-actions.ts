import type { EditorActionsT } from '@/components/kosztorys/editor/actions/editor-actions'
import {
  appendPresetSectionsAction,
  reloadFromPresetAction,
  savePresetAction,
} from '@/lib/actions/kosztorys-presets'
import {
  createSectionWithCatalogueItemsAction,
  insertCatalogueItemsAction,
} from '@/lib/actions/catalogue-to-kosztorys'
import {
  addItemAction,
  removeItemAction,
  renumberKosztorysOrderAction,
  updateItemFieldAction,
} from '@/lib/actions/kosztorys-items'
import {
  addSectionAction,
  insertSectionAction,
  removeSectionAction,
  updateSectionFieldAction,
  writeKosztorysLayoutAction,
} from '@/lib/actions/kosztorys-sections'
import { clearKosztorysAction } from '@/lib/actions/kosztorys-settings'
import {
  restoreSnapshotAction,
  saveSnapshotAction,
  snapshotAction,
} from '@/lib/actions/kosztorys-snapshots'
import { fillKosztorysTranslationsAction } from '@/lib/actions/kosztorys-translations'
import { readKosztorysRevision } from '@/lib/queries/kosztorys-revision'
import { fetchKosztorysSnapshots } from '@/lib/queries/snapshot-list'

export const kosztorysEditorActions: EditorActionsT = {
  isTemplate: false,
  updateItemField: updateItemFieldAction,
  updateSectionField: updateSectionFieldAction,
  addSection: addSectionAction,
  insertSection: insertSectionAction,
  removeSection: removeSectionAction,
  addItem: addItemAction,
  removeItem: removeItemAction,
  insertCatalogueItems: insertCatalogueItemsAction,
  createSectionWithCatalogueItems: createSectionWithCatalogueItemsAction,
  renumberOrder: renumberKosztorysOrderAction,
  writeLayout: writeKosztorysLayoutAction,
  clear: clearKosztorysAction,
  autoSnapshot: snapshotAction,
  saveSnapshot: saveSnapshotAction,
  listSnapshots: fetchKosztorysSnapshots,
  restoreSnapshot: restoreSnapshotAction,
  fillTranslations: fillKosztorysTranslationsAction,
  readRevision: readKosztorysRevision,
  savePreset: savePresetAction,
  reloadFromPreset: reloadFromPresetAction,
  appendPresetSections: appendPresetSectionsAction,
}
