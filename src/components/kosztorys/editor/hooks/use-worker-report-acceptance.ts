'use client'

import { acceptWorkerReportAction, rejectWorkerReportAction } from '@/lib/actions/worker-report'
import { stageLane } from '@/lib/kosztorys/save-lanes'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'
import type { AcceptReportInputT, AcceptReportResultT } from '@/lib/kosztorys/worker-report/types'
import { settleAction } from '@/lib/utils/settle-action'
import type { ActionErrorCodeT } from '@/types/action'

type ArgsT = {
  investmentId: number
  flushUndoBuffer: () => void
  drain: (keys: string[]) => Promise<void>
  adoptStage: (stage: KosztorysStageT) => void
  // `newStages` because the etap adopted a moment earlier is not in the rows builder's closure yet.
  appendItems: (
    slice: AcceptReportResultT['appended'][number],
    newStages: KosztorysStageT[],
  ) => void
  patchRows: (
    match: (row: KosztorysV2RowT) => boolean,
    patch: (row: KosztorysV2RowT) => KosztorysV2RowT,
  ) => void
  pruneByIds: (ids: number[]) => void
  adoptRevision: (revision: string) => void
  reportFailure: (error: string, code?: ActionErrorCodeT) => void
}

/**
 * The accepting window's side of an accept. The server ADDS to the etap, so every cell it touched must
 * be quiet before the call — an absolute autosave landing after the addition would erase it — and
 * afterwards the grid takes the server's figure rather than adding locally.
 */
export function useWorkerReportAcceptance({
  investmentId,
  flushUndoBuffer,
  drain,
  adoptStage,
  appendItems,
  patchRows,
  pruneByIds,
  adoptRevision,
  reportFailure,
}: ArgsT) {
  // `itemIds` are the pozycje the rozpiska lines add to — the only cells with a lane to drain.
  async function acceptReport(input: AcceptReportInputT, itemIds: number[]): Promise<boolean> {
    flushUndoBuffer()
    if (input.target.kind === 'stage') {
      const { stageId } = input.target
      await drain(itemIds.map((itemId) => stageLane(itemId, stageId)))
    }
    const res = await settleAction(() => acceptWorkerReportAction(input))
    if (!res.success) {
      reportFailure(res.error, res.code)
      return false
    }
    const { stage, appended, cells, revision } = res.data
    if (stage) adoptStage(stage)
    for (const slice of appended) appendItems(slice, stage ? [stage] : [])
    const qtyByItem = new Map(cells.map((cell) => [cell.itemId, cell]))
    patchRows(
      (row) => qtyByItem.has(row.id),
      (row) => {
        const cell = qtyByItem.get(row.id) as AcceptReportResultT['cells'][number]
        return { ...row, [stageKey(cell.stageId)]: cell.qtyDone }
      },
    )
    // An undo of an earlier edit to one of these cells would write its old absolute figure back
    // over the addition.
    pruneByIds([...qtyByItem.keys()])
    adoptRevision(revision)
    return true
  }

  async function rejectReport(reportId: number): Promise<boolean> {
    const res = await settleAction(() => rejectWorkerReportAction(investmentId, reportId))
    if (!res.success) {
      reportFailure(res.error, res.code)
      return false
    }
    return true
  }

  return { acceptReport, rejectReport }
}
