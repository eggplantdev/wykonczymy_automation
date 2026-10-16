'use client'

import { acceptWorkerReportAction } from '@/lib/actions/accept-worker-report'
import type { StageCellT } from '@/components/kosztorys/editor/dialogs/worker-reports/line-draft'
import { stageLane } from '@/lib/kosztorys/save-lanes'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'
import type { AcceptReportInputT } from '@/lib/kosztorys/worker-report/types'
import { settleAction } from '@/lib/utils/settle-action'
import type { ActionErrorCodeT } from '@/types/action'

type ArgsT = {
  flushUndoBuffer: () => void
  drain: (keys: string[]) => Promise<void>
  adoptStage: (stage: KosztorysStageT) => void
  patchRows: (
    match: (row: KosztorysV2RowT) => boolean,
    patch: (row: KosztorysV2RowT) => KosztorysV2RowT,
  ) => void
  pruneByIds: (ids: number[]) => void
  adoptRevision: (revision: string) => void
  reportFailure: (error: string, code?: ActionErrorCodeT) => void
}

// The server ADDS to the etap, so every cell it touched must
// be quiet before the call — an absolute autosave landing after the addition would erase it
export function useWorkerReportAcceptance({
  flushUndoBuffer,
  drain,
  adoptStage,
  patchRows,
  pruneByIds,
  adoptRevision,
  reportFailure,
}: ArgsT) {
  async function acceptReport(input: AcceptReportInputT, cells: StageCellT[]): Promise<boolean> {
    flushUndoBuffer()
    await drain(cells.map((cell) => stageLane(cell.itemId, cell.stageId)))
    const res = await settleAction(() => acceptWorkerReportAction(input))
    if (!res.success) {
      reportFailure(res.error, res.code)
      return false
    }
    const { stage, revision } = res.data
    if (stage) adoptStage(stage)
    const cellsByItem = Map.groupBy(res.data.cells, (cell) => cell.itemId)
    if (cellsByItem.size > 0) {
      patchRows(
        (row) => cellsByItem.has(row.id),
        (row) => ({
          ...row,
          ...Object.fromEntries(
            (cellsByItem.get(row.id) ?? []).map((cell) => [stageKey(cell.stageId), cell.qtyDone]),
          ),
        }),
      )
      // An undo of an earlier edit to one of these cells would write its old absolute figure back
      // over the addition.
      pruneByIds([...cellsByItem.keys()])
    }
    if (revision) adoptRevision(revision)
    return true
  }

  return { acceptReport }
}
