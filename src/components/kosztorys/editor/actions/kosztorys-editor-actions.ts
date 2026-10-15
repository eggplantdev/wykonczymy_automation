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
  addSectionAction,
  clearKosztorysAction,
  insertSectionAction,
  removeItemAction,
  removeSectionAction,
  renumberKosztorysOrderAction,
  updateItemFieldAction,
  updateSectionFieldAction,
  writeKosztorysLayoutAction,
} from '@/lib/actions/kosztorys'
import {
  listSnapshotsAction,
  restoreSnapshotAction,
  saveSnapshotAction,
  snapshotAction,
} from '@/lib/actions/kosztorys-snapshots'
import { fillKosztorysTranslationsAction } from '@/lib/actions/kosztorys-translations'
import { readKosztorysRevision } from '@/lib/queries/kosztorys-revision'

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
  listSnapshots: listSnapshotsAction,
  restoreSnapshot: restoreSnapshotAction,
  fillTranslations: fillKosztorysTranslationsAction,
  readRevision: readKosztorysRevision,
  savePreset: savePresetAction,
  reloadFromPreset: reloadFromPresetAction,
  appendPresetSections: appendPresetSectionsAction,
}
