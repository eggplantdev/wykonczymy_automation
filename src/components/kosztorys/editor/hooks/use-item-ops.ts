'use client'

import { useRef } from 'react'
import {
  applyAddItem,
  applyInsertItem,
  applyKosztorysOrder,
  applyRemoveItem,
  applyRestoreItem,
} from '@/lib/kosztorys/row-ops'
import { orderCommandsEnabled } from '@/lib/kosztorys/order-commands'
import { DEFAULT_SECTION_NAME } from '@/lib/kosztorys/constants'
import { orderRowsBySections } from '@/lib/kosztorys/section-list'
import { sortValueGetter } from '@/lib/kosztorys/columns/sort-value'
import { planKosztorysRenumber } from '@/lib/kosztorys/display-order-plan'
import { settleAction } from '@/lib/utils/settle-action'
import type { EditorActionsT } from '@/components/kosztorys/editor/actions/editor-actions'
import type { EditorRowsT } from '@/components/kosztorys/editor/hooks/use-editor-rows'
import type { SectionCrudT } from '@/components/kosztorys/editor/hooks/use-section-crud'
import type { UndoBurstsT } from '@/components/kosztorys/editor/hooks/use-undo-bursts'
import type { UndoRedoApiT } from '@/components/kosztorys/editor/hooks/use-undo-redo'
import type { useStaleTreeRecovery } from '@/components/kosztorys/editor/hooks/use-stale-tree-recovery'
import type { SortStateT } from '@/lib/kosztorys/row-view'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import type {
  KosztorysItemT,
  KosztorysTreeT,
  KosztorysV2RowT,
  NewItemPlacementT,
} from '@/lib/kosztorys/types'

type ArgsT = {
  investmentId: number
  stages: KosztorysTreeT['stages']
  sort: SortStateT
  view: PriceViewT
  editorRows: EditorRowsT
  sectionCrud: Pick<SectionCrudT, 'sectionMeta' | 'sectionsRef' | 'rowsFromSections'>
  actions: EditorActionsT
  reportFailure: ReturnType<typeof useStaleTreeRecovery>['reportFailure']
  flushUndoBuffer: UndoBurstsT['flushUndoBuffer']
  pushCommand: UndoBurstsT['pushCommand']
  pruneByIds: UndoRedoApiT['pruneByIds']
  dropHeight: (...keys: string[]) => void
  unfoldSection: (sectionId: number) => void
}

export function useItemOps({
  investmentId,
  stages,
  sort,
  view,
  editorRows,
  sectionCrud,
  actions,
  reportFailure,
  flushUndoBuffer,
  pushCommand,
  pruneByIds,
  dropHeight,
  unfoldSection,
}: ArgsT) {
  const { setRows, rowsRef, prevById } = editorRows
  const { sectionMeta, sectionsRef, rowsFromSections } = sectionCrud
  // A ref, not state: opening the dialog must not re-render the grid.
  const newItemDialogRef = useRef<
    ((placement: NewItemPlacementT, description?: string) => void) | null
  >(null)

  function handleAddItem(sectionId: number, description?: string) {
    newItemDialogRef.current?.({ kind: 'end', sectionId }, description)
  }

  function handleInsertItem(anchorRow: KosztorysV2RowT, dir: 'above' | 'below') {
    if (!orderCommandsEnabled(sort)) return
    newItemDialogRef.current?.({ kind: 'next-to', anchorItemId: anchorRow.id, dir })
  }

  function placeNewItem(item: KosztorysItemT, placement: NewItemPlacementT) {
    const meta = sectionMeta(item.sectionId)
    const [row] = rowsFromSections([
      {
        id: item.sectionId,
        name: meta?.sectionName ?? DEFAULT_SECTION_NAME,
        displayOrder: 0,
        color: meta?.sectionColor ?? null,
        items: [item],
      },
    ])
    if (placement.kind === 'next-to') {
      setRows((rs) => applyInsertItem(rs, placement.anchorItemId, row, placement.dir))
    } else {
      // Asked of the updater's rows, not rowsRef:
      // a delete of the section's last pozycja can land while the dialog is open.
      const order = sectionsRef.current
      setRows((rs) => {
        const next = applyAddItem(rs, row)
        return rs.some((r) => r.sectionId === item.sectionId)
          ? next
          : orderRowsBySections(next, order)
      })
    }
    unfoldSection(item.sectionId)
  }

  async function handleRemoveItem(row: KosztorysV2RowT) {
    const rowsAtRemoval = rowsRef.current
    const removedAt = rowsAtRemoval.findIndex((r) => r.id === row.id)
    const afterId = removedAt > 0 ? rowsAtRemoval[removedAt - 1].id : null
    prevById.current.delete(row.id)
    dropHeight(String(row.id))
    setRows((rs) => applyRemoveItem(rs, row.id))
    // Flush first, then drop every stack command touching the deleted row — undoing one would write
    // against a dead id, and `setStageProgressAction` (an absolute upsert) could recreate an orphan.
    flushUndoBuffer()
    pruneByIds([row.id])
    const res = await settleAction(() => actions.removeItem(row.id))
    if (!res.success) {
      prevById.current.set(row.id, row)
      setRows((rs) => applyRestoreItem(rs, row, afterId))
      reportFailure(res.error, res.code)
    }
  }

  async function runKosztorysRenumber(next: number[], revertTo: number[]) {
    setRows((rs) => applyKosztorysOrder(rs, next))
    const res = await settleAction(() => actions.renumberOrder(investmentId, next))
    if (!res.success) {
      setRows((rs) => applyKosztorysOrder(rs, revertTo))
      reportFailure(res.error, res.code)
    }
  }

  function handlePersistKosztorysOrder() {
    if (!sort) return
    const { before, after } = planKosztorysRenumber(
      rowsRef.current,
      sortValueGetter(sort.field, view, stages),
      sort.dir,
    )
    if (after.length === 0) return
    void runKosztorysRenumber(after, before)
    pushCommand({
      label: 'Zapisanie kolejności',
      undo: () => void runKosztorysRenumber(before, after),
      redo: () => void runKosztorysRenumber(after, before),
      touchedIds: after,
    })
  }

  return {
    newItemDialogRef,
    handleAddItem,
    handleInsertItem,
    placeNewItem,
    handleRemoveItem,
    handlePersistKosztorysOrder,
  }
}
