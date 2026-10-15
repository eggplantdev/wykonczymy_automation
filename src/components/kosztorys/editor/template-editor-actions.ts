import type { EditorActionsT } from '@/components/kosztorys/editor/editor-actions'
import {
  appendPresetSectionsToTemplateAction,
  reloadTemplateFromPresetAction,
  saveTemplateAsPresetAction,
} from '@/lib/actions/kosztorys-presets'
import {
  listTemplateSnapshotsAction,
  restoreTemplateSnapshotAction,
  saveTemplateSnapshotAction,
  templateSnapshotAction,
} from '@/lib/actions/template-snapshots'
import {
  addTemplateItemAction,
  addTemplateSectionAction,
  createTemplateSectionWithCatalogueItemsAction,
  insertCatalogueItemsIntoTemplateAction,
  insertTemplateSectionAction,
  removeTemplateItemAction,
  removeTemplateSectionAction,
  updateTemplateItemFieldAction,
  updateTemplateSectionFieldAction,
} from '@/lib/actions/template-structure'
import { fillTemplateTranslationsAction } from '@/lib/actions/template-translations'
import {
  clearTemplateAction,
  readTemplateRevisionAction,
  renumberTemplateOrderAction,
  writeTemplateLayoutAction,
} from '@/lib/actions/template-tree'

export const templateEditorActions: EditorActionsT = {
  updateItemField: updateTemplateItemFieldAction,
  updateSectionField: updateTemplateSectionFieldAction,
  addSection: addTemplateSectionAction,
  insertSection: insertTemplateSectionAction,
  removeSection: removeTemplateSectionAction,
  addItem: addTemplateItemAction,
  removeItem: removeTemplateItemAction,
  insertCatalogueItems: insertCatalogueItemsIntoTemplateAction,
  createSectionWithCatalogueItems: createTemplateSectionWithCatalogueItemsAction,
  renumberOrder: renumberTemplateOrderAction,
  writeLayout: writeTemplateLayoutAction,
  clear: clearTemplateAction,
  autoSnapshot: templateSnapshotAction,
  saveSnapshot: saveTemplateSnapshotAction,
  listSnapshots: listTemplateSnapshotsAction,
  restoreSnapshot: restoreTemplateSnapshotAction,
  fillTranslations: fillTemplateTranslationsAction,
  readRevision: readTemplateRevisionAction,
  savePreset: saveTemplateAsPresetAction,
  reloadFromPreset: reloadTemplateFromPresetAction,
  appendPresetSections: appendPresetSectionsToTemplateAction,
}
