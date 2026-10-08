import { parseReportQty } from '@/lib/kosztorys/worker-report/parse-report-qty'
import type {
  AcceptReportInputT,
  AcceptTargetT,
  ReportLineT,
  WorkerReportT,
} from '@/lib/kosztorys/worker-report/types'
import { formatQty } from '@/lib/kosztorys/format'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import {
  indexCatalogue,
  resolveCatalogueEntry,
} from '@/lib/kosztorys/work-catalogue/resolve-catalogue-entry'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'
import { decimalText, moneyText } from '@/lib/utils/decimal-text'
import { parseDecimalInput } from '@/lib/utils/parse-decimal-input'
import { round6 } from '@/lib/utils/round'

export type LineDraftT = {
  isTicked: boolean
  qty: string
  // The pozycja a line is re-pointed to once its own was deleted.
  itemId: number | undefined
  // A rozpiska line whose pozycja is gone may be accepted as a praca spoza rozpiski instead.
  isExtra: boolean
  sectionId: string
  unitPrice: string
  catalogueId: number | undefined
  // The pozycje the picked katalog praca already sits in. Any at all and the line adds to one of them
  // instead of minting a second copy of the same praca.
  matchedItemIds: number[]
}

export type LineGroupT = 'rozpiska' | 'extra'

// What the rozpiska holds for a reported pozycja right now; `undefined` once it was deleted.
export type ItemFiguresT = { stageQty: number; measuredQty: number; currentPlannedQty: number }

// Every digit the figure has: a rounded one would be sent back as a change nobody made.
export const qtyInputText = (qty: number) => decimalText(round6(qty))

export function lineGroup(line: Pick<ReportLineT, 'kind'>, draft: LineDraftT): LineGroupT {
  if (draft.matchedItemIds.length > 0) return 'rozpiska'
  return line.kind === 'extra' || draft.isExtra ? 'extra' : 'rozpiska'
}

// Resolved as „Ukryj już dodane" resolves it — the remembered entry first, then the klucz. A praca in
// several sekcje is left for the kierownik to point at one — guessing would add the work to the
// wrong pokój.
export function catalogueSwap(
  entry: Pick<WorkCatalogueItemT, 'id' | 'clientPrice' | 'matchKey'>,
  rows: Pick<KosztorysV2RowT, 'id' | 'description' | 'unit' | 'catalogueItemId'>[],
  catalogue: readonly Pick<WorkCatalogueItemT, 'id' | 'matchKey'>[],
): Partial<LineDraftT> {
  const index = indexCatalogue(catalogue)
  const matchedItemIds = rows
    .filter((row) => row.description?.trim())
    .filter(
      (row) =>
        resolveCatalogueEntry(index, row.catalogueItemId, () =>
          catalogueKey(row.description ?? '', row.unit),
        )?.id === entry.id,
    )
    .map((row) => row.id)
  return {
    catalogueId: entry.id,
    matchedItemIds,
    itemId: matchedItemIds.length === 1 ? matchedItemIds[0] : undefined,
    unitPrice: matchedItemIds.length > 0 ? '' : moneyText(entry.clientPrice),
  }
}

export const UNDO_CATALOGUE_SWAP: Partial<LineDraftT> = {
  catalogueId: undefined,
  matchedItemIds: [],
  itemId: undefined,
  unitPrice: '',
}

export function acceptedQty(draft: LineDraftT): number {
  if (!draft.isTicked) return 0
  const parsed = parseReportQty(draft.qty)
  return parsed.kind === 'value' ? parsed.value : 0
}

// What saving does to the etap: an accepted line moves it only by the difference to what it went in at.
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

// Under the ilość of an accepted line: what saving does to the figure already in the etap. A deleted
// etap or pozycja took that figure with it, so an untick then clears only the record.
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
  line: Pick<ReportLineT, 'kind' | 'acceptedQty' | 'unit'>,
  draft: LineDraftT,
  itemId: number | undefined,
): boolean {
  if (!draft.isTicked) return true
  if (parseReportQty(draft.qty).kind !== 'value') return false
  // Its pozycja already exists; only the ilość is still the kierownik's to change.
  if (line.acceptedQty !== undefined) return true
  if (lineGroup(line, draft) === 'rozpiska') return itemId !== undefined
  if (draft.sectionId === '') return false
  // A scanned praca whose j.m. was in no list: the new pozycja takes the katalog's.
  if (line.unit.trim() === '') return draft.catalogueId !== undefined
  return draft.catalogueId !== undefined || parseDecimalInput(draft.unitPrice).kind === 'value'
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
  rows: Pick<KosztorysV2RowT, 'id' | 'sectionId' | 'description' | 'unit'>[],
): Record<number, LineDraftT> {
  const sectionOfItem = new Map(rows.map((row) => [row.id, String(row.sectionId)]))
  const isLive = (itemId: number | undefined) => itemId !== undefined && sectionOfItem.has(itemId)
  return Object.fromEntries(
    report.lines.map((line) => {
      const isGone = line.kind === 'rozpiska' && !isLive(line.itemId)
      const draft: LineDraftT = {
        isTicked: line.acceptedQty !== undefined,
        qty: qtyInputText(line.acceptedQty ?? line.reportedQty),
        itemId: isGone && line.acceptedQty === undefined ? exactItemMatch(line, rows) : undefined,
        isExtra: line.kind === 'rozpiska' && line.createdItemId !== undefined,
        sectionId:
          line.createdItemId === undefined ? '' : (sectionOfItem.get(line.createdItemId) ?? ''),
        unitPrice: '',
        catalogueId: line.catalogueItemId,
        // A praca spoza rozpiski accepted into a pozycja the rozpiska already held.
        matchedItemIds: line.kind === 'extra' && isLive(line.itemId) ? [line.itemId as number] : [],
      }
      return [line.id, draft]
    }),
  )
}

export function partitionLines(lines: ReportLineT[], drafts: Record<number, LineDraftT>) {
  const accepted = lines.filter((line) => line.acceptedQty !== undefined)
  return {
    // Not yet in an etap — odrzucona too, which can still be przyjęta.
    open: lines.filter((line) => line.acceptedQty === undefined),
    ticked: lines.filter((line) => line.acceptedQty === undefined && drafts[line.id].isTicked),
    accepted,
    changed: accepted.filter(
      (line) => drafts[line.id].isTicked && qtyChange(line, drafts[line.id]) !== 0,
    ),
    undone: accepted.filter((line) => !drafts[line.id].isTicked),
  }
}

export type StageCellT = { itemId: number; stageId: number }

// A first accept goes to the chosen etap; a change or an untick moves the etap the report already
// went to. `cells` are the existing ones the save moves, for the editor to quiet first.
export function buildAccept(
  report: Pick<WorkerReportT, 'id' | 'investmentId' | 'lines' | 'target'>,
  drafts: Record<number, LineDraftT>,
  target: AcceptTargetT,
  itemIdOf: (line: ReportLineT) => number | undefined,
): { input: AcceptReportInputT; cells: StageCellT[] } {
  const { ticked, changed, undone } = partitionLines(report.lines, drafts)
  const input: AcceptReportInputT = {
    investmentId: report.investmentId,
    reportId: report.id,
    target,
    lines: changed.map((line) => ({
      lineId: line.id,
      acceptedQty: acceptedQty(drafts[line.id]),
      seenQty: line.acceptedQty,
    })),
    extras: [],
    undone: undone.map((line) => line.id),
  }
  const cells: StageCellT[] = []
  const recordedStageId = report.target?.stageId
  for (const line of [...changed, ...undone]) {
    const itemId = line.createdItemId ?? line.itemId
    if (itemId !== undefined && recordedStageId !== undefined) {
      cells.push({ itemId, stageId: recordedStageId })
    }
  }
  for (const line of ticked) {
    const draft = drafts[line.id]
    if (lineGroup(line, draft) === 'rozpiska') {
      const itemId = itemIdOf(line) as number
      if (target.kind === 'stage') cells.push({ itemId, stageId: target.stageId })
      input.lines.push({
        lineId: line.id,
        acceptedQty: acceptedQty(draft),
        itemId: itemId === line.itemId ? undefined : itemId,
      })
      continue
    }
    const price = parseDecimalInput(draft.unitPrice)
    input.extras.push({
      lineId: line.id,
      acceptedQty: acceptedQty(draft),
      sectionId: Number(draft.sectionId),
      clientPrice:
        draft.catalogueId === undefined && price.kind === 'value' ? price.value : undefined,
      catalogueItemId: draft.catalogueId,
    })
  }
  return { input, cells }
}
