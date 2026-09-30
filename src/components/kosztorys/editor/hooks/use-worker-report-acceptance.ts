'use client'

import {
  acceptWorkerReportAction,
  rejectWorkerReportAction,
} from '@/lib/actions/accept-worker-report'
import type { StageCellT } from '@/components/kosztorys/editor/dialogs/worker-reports/line-draft'
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
  // `cells` are the existing ones the save moves — a pozycja or an etap it creates has no lane yet.
  async function acceptReport(input: AcceptReportInputT, cells: StageCellT[]): Promise<boolean> {
    flushUndoBuffer()
    await drain(cells.map((cell) => stageLane(cell.itemId, cell.stageId)))
    const res = await settleAction(() => acceptWorkerReportAction(input))
    if (!res.success) {
      reportFailure(res.error, res.code)
      return false
    }
    const { stage, appended, revision } = res.data
    if (stage) adoptStage(stage)
    for (const slice of appended) appendItems(slice, stage ? [stage] : [])
    // One pozycja may move in two etapy: an untick out of the old one, an accept into a new one.
    const cellsByItem = Map.groupBy(res.data.cells, (cell) => cell.itemId)
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
