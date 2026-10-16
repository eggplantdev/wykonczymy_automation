import { parseReportQty } from '@/lib/kosztorys/worker-report/parse-report-qty'
import type {
  AcceptReportInputT,
  AcceptTargetT,
  ReportLineT,
  WorkerReportT,
} from '@/lib/kosztorys/worker-report/types'
import { formatQty } from '@/lib/kosztorys/format'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'
import {
  indexCatalogue,
  itemsHoldingEntry,
} from '@/lib/kosztorys/work-catalogue/resolve-catalogue-entry'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'
import { decimalText } from '@/lib/utils/decimal-text'
import { round6 } from '@/lib/utils/round'

export type LineDraftT = {
  isTicked: boolean
  // Odrzucona — never ticked at the same time. Neither = the line still waits for a decision.
  isRejected: boolean
  qty: string
  itemId: number | undefined
  // A rozpiska line whose pozycja is gone, moved to „Spoza rozpiski” to be added to the rozpiska anew.
  isExtra: boolean
  catalogueId: number | undefined
  matchedItemIds: number[]
}

export type LineGroupT = 'rozpiska' | 'extra'

export type ItemFiguresT = {
  stageQty: number
  measuredQty: number
  plannedQty: number
  currentPlannedQty: number
}

// Every digit the figure has: a rounded one would be sent back as a change nobody made.
export const qtyInputText = (qty: number) => decimalText(round6(qty))

export function lineGroup(line: Pick<ReportLineT, 'kind'>, draft: LineDraftT): LineGroupT {
  if (draft.matchedItemIds.length > 0) return 'rozpiska'
  return line.kind === 'extra' || draft.isExtra ? 'extra' : 'rozpiska'
}

export function catalogueSwap(
  entry: Pick<WorkCatalogueItemT, 'id' | 'matchKey'>,
  rows: Pick<KosztorysV2RowT, 'id' | 'description' | 'unit' | 'catalogueItemId'>[],
  catalogue: readonly Pick<WorkCatalogueItemT, 'id' | 'matchKey'>[],
): Pick<LineDraftT, 'catalogueId' | 'matchedItemIds' | 'itemId'> {
  const matchedItemIds = itemsHoldingEntry(indexCatalogue(catalogue), rows, entry.id).map(
    (row) => row.id,
  )
  return {
    catalogueId: entry.id,
    matchedItemIds,
    itemId: matchedItemIds.length === 1 ? matchedItemIds[0] : undefined,
  }
}

export const UNDO_CATALOGUE_SWAP: Partial<LineDraftT> = {
  isTicked: false,
  catalogueId: undefined,
  matchedItemIds: [],
  itemId: undefined,
}

export function acceptedQty(draft: LineDraftT): number {
  if (!draft.isTicked) return 0
  const parsed = parseReportQty(draft.qty)
  return parsed.kind === 'value' ? parsed.value : 0
}

export function qtyChange(line: Pick<ReportLineT, 'acceptedQty'>, draft: LineDraftT): number {
  return acceptedQty(draft) - (line.acceptedQty ?? 0)
}

// The etap and pomiar columns: an accepted line whose etap or pozycja is gone takes nothing back
// on save, so the columns must not show it going down either.
export function previewQtyChange(
  line: Pick<ReportLineT, 'acceptedQty'>,
  draft: LineDraftT,
  isFigureLive: boolean,
): number {
  if (line.acceptedQty !== undefined && !isFigureLive) return 0
  return qtyChange(line, draft)
}

export function acceptedQtyNote(
  line: Pick<ReportLineT, 'acceptedQty'>,
  draft: LineDraftT,
  isFigureLive: boolean,
): string | undefined {
  if (line.acceptedQty === undefined || qtyChange(line, draft) === 0) return undefined
  const was = formatQty(line.acceptedQty)
  if (draft.isTicked) return `było ${was}`
  return isFigureLive ? `cofasz ${was}` : 'nie ma już czego cofnąć'
}

export function isLineReady(
  line: Pick<ReportLineT, 'kind' | 'acceptedQty'>,
  draft: LineDraftT,
  itemId: number | undefined,
): boolean {
  if (!draft.isTicked) return true
  if (parseReportQty(draft.qty).kind !== 'value') return false
  if (line.acceptedQty !== undefined) return true
  return lineGroup(line, draft) === 'rozpiska' && itemId !== undefined
}

export function lineItemId(
  line: Pick<ReportLineT, 'kind' | 'itemId'>,
  draft: LineDraftT,
  isLive: (itemId: number) => boolean,
): number | undefined {
  if (line.kind === 'extra' || draft.matchedItemIds.length > 0) return draft.itemId
  return line.itemId !== undefined && isLive(line.itemId) ? line.itemId : draft.itemId
}

// A pozycja deleted and re-added by hand (or by a restore) comes back under a new id; the same opis
// and j.m. is the one match safe enough to preselect.
export function exactItemMatch(
  line: Pick<ReportLineT, 'description' | 'unit'>,
  rows: Pick<KosztorysV2RowT, 'id' | 'description' | 'unit'>[],
): number | undefined {
  const matches = rows.filter(
    (row) => row.description === line.description && row.unit === line.unit,
  )
  return matches.length === 1 ? matches[0].id : undefined
}

export function initialDrafts(
  report: Pick<WorkerReportT, 'lines'>,
  rows: Pick<KosztorysV2RowT, 'id' | 'description' | 'unit'>[],
): Record<number, LineDraftT> {
  const liveIds = new Set(rows.map((row) => row.id))
  const isLive = (itemId: number | undefined): itemId is number =>
    itemId !== undefined && liveIds.has(itemId)
  return Object.fromEntries(
    report.lines.map((line) => {
      const isGone = line.kind === 'rozpiska' && !isLive(line.itemId)
      const draft: LineDraftT = {
        isTicked: line.acceptedQty !== undefined,
        isRejected: line.isRejected,
        qty: qtyInputText(line.acceptedQty ?? line.reportedQty),
        itemId: isLive(line.createdItemId)
          ? line.createdItemId
          : line.kind === 'extra' && isLive(line.itemId)
            ? line.itemId
            : isGone && line.acceptedQty === undefined
              ? exactItemMatch(line, rows)
              : undefined,
        isExtra: line.kind === 'rozpiska' && line.createdItemId !== undefined,
        catalogueId: line.catalogueItemId,
        matchedItemIds: isLive(line.createdItemId)
          ? [line.createdItemId]
          : line.kind === 'extra' && isLive(line.itemId)
            ? [line.itemId]
            : [],
      }
      return [line.id, draft]
    }),
  )
}

export function partitionLines(lines: ReportLineT[], drafts: Record<number, LineDraftT>) {
  const accepted = lines.filter((line) => line.acceptedQty !== undefined)
  return {
    rejected: lines.filter((line) => !line.isRejected && drafts[line.id].isRejected),
    unrejected: lines.filter(
      (line) => line.isRejected && !drafts[line.id].isRejected && !drafts[line.id].isTicked,
    ),
    open: lines.filter((line) => line.acceptedQty === undefined),
    ticked: lines.filter((line) => line.acceptedQty === undefined && drafts[line.id].isTicked),
    accepted,
    changed: accepted.filter(
      (line) => drafts[line.id].isTicked && qtyChange(line, drafts[line.id]) !== 0,
    ),
    undone: accepted.filter((line) => !drafts[line.id].isTicked),
  }
}

export function decisionSummary(lines: ReportLineT[], drafts: Record<number, LineDraftT>) {
  const acceptedCount = lines.filter((line) => drafts[line.id].isTicked).length
  const decidedCount = lines.filter(
    (line) => drafts[line.id].isTicked || drafts[line.id].isRejected,
  ).length
  if (decidedCount < lines.length) {
    return decidedCount === 0 ? '' : `Rozpatrzono ${decidedCount} z ${lines.length}.`
  }
  if (acceptedCount === 0) return 'Wszystkie pozycje odrzucone.'
  return `Przyjęto ${acceptedCount} z ${lines.length}.`
}

export type StageCellT = { itemId: number; stageId: number }

export function buildAccept(
  report: Pick<WorkerReportT, 'id' | 'investmentId' | 'lines' | 'target'>,
  drafts: Record<number, LineDraftT>,
  target: AcceptTargetT,
  itemIdOf: (line: ReportLineT) => number | undefined,
): { input: AcceptReportInputT; cells: StageCellT[] } {
  const { ticked, changed, undone, rejected, unrejected } = partitionLines(report.lines, drafts)
  const input: AcceptReportInputT = {
    investmentId: report.investmentId,
    reportId: report.id,
    target,
    lines: changed.map((line) => ({
      lineId: line.id,
      acceptedQty: acceptedQty(drafts[line.id]),
      seenQty: line.acceptedQty,
    })),
    undone: undone.map((line) => line.id),
    rejected: rejected.map((line) => line.id),
    unrejected: unrejected.map((line) => line.id),
  }
  const cells: StageCellT[] = []
  const recordedStageId = report.target?.stageId
  for (const line of [...changed, ...undone]) {
    const itemId = line.createdItemId ?? line.itemId
    if (itemId !== undefined && recordedStageId !== undefined) {
      cells.push({ itemId, stageId: recordedStageId })
    }
  }
  // `isLineReady` lets only a line with a pozycja be ticked into an accept.
  for (const line of ticked) {
    const itemId = itemIdOf(line) as number
    if (target.kind === 'stage') cells.push({ itemId, stageId: target.stageId })
    input.lines.push({
      lineId: line.id,
      acceptedQty: acceptedQty(drafts[line.id]),
      itemId: itemId === line.itemId ? undefined : itemId,
    })
  }
  return { input, cells }
}
