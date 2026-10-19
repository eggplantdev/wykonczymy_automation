'use client'

import { planGridChanges } from '@/lib/kosztorys/grid-change-plan'
import { itemFieldLane, stageLane } from '@/lib/kosztorys/save-lanes'
import { applyReviewRules } from '@/lib/kosztorys/review-status'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import { setStageProgressAction } from '@/lib/actions/kosztorys-stages'
import type { StageChangeT } from '@/lib/kosztorys/undo-coalesce'
import type { EditorActionsT } from '@/components/kosztorys/editor/actions/editor-actions'
import type { EditorRowsT } from '@/components/kosztorys/editor/hooks/use-editor-rows'
import type { UndoBurstsT } from '@/components/kosztorys/editor/hooks/use-undo-bursts'
import type { useDebouncedSave } from '@/components/kosztorys/editor/hooks/use-debounced-save'
import type { ItemPatchT, KosztorysV2RowT } from '@/lib/kosztorys/types'

type ArgsT = {
  preview: boolean
  aiDraft: boolean
  onPreviewChange?: (stageChanges: StageChangeT[]) => void
  editorRows: Pick<EditorRowsT, 'setRows' | 'prevById' | 'revertOne'>
  actions: EditorActionsT
  save: ReturnType<typeof useDebouncedSave>['save']
  undoBursts: Pick<UndoBurstsT, 'bufferBurst' | 'dropPendingField' | 'dropPendingStage'>
}

export function useGridChangePipeline({
  preview,
  aiDraft,
  onPreviewChange,
  editorRows,
  actions,
  save,
  undoBursts,
}: ArgsT) {
  const { setRows, prevById, revertOne } = editorRows
  const { bufferBurst, dropPendingField, dropPendingStage } = undoBursts

  function applyPreviewChanges(
    next: KosztorysV2RowT[],
    report: (stageChanges: StageChangeT[]) => void,
  ) {
    const { stageChanges, changedById } = planGridChanges(next, prevById.current)
    report(stageChanges)
    for (const row of next) if (prevById.current.has(row.id)) prevById.current.set(row.id, row)
    if (changedById.size > 0) setRows((master) => master.map((r) => changedById.get(r.id) ?? r))
  }

  function onChange(gridRows: KosztorysV2RowT[]) {
    if (preview) {
      if (onPreviewChange) applyPreviewChanges(gridRows, onPreviewChange)
      return
    }
    const next = applyReviewRules(gridRows, prevById.current, aiDraft)
    const { fieldChanges, stageChanges, changedById } = planGridChanges(next, prevById.current)
    for (const c of fieldChanges) {
      const key = c.field as keyof KosztorysV2RowT
      save(
        itemFieldLane(c.id, c.field),
        () => actions.updateItemField(c.id, { [c.field]: c.after } as ItemPatchT),
        () => {
          revertOne(c.id, key, c.before, c.after)
          dropPendingField(c.id, c.field)
        },
      )
    }
    for (const c of stageChanges) {
      const key = stageKey(c.stageId) as keyof KosztorysV2RowT
      save(
        stageLane(c.id, c.stageId),
        () => setStageProgressAction(c.id, c.stageId, c.after),
        () => {
          revertOne(c.id, key, c.before, c.after)
          dropPendingStage(c.id, c.stageId)
        },
      )
    }
    for (const row of next) if (prevById.current.has(row.id)) prevById.current.set(row.id, row)
    bufferBurst(fieldChanges, stageChanges)
    if (changedById.size > 0) {
      // Merge by id so filter/sort don't lose hidden rows.
      setRows((master) => master.map((r) => changedById.get(r.id) ?? r))
    }
  }

  return { onChange }
}
