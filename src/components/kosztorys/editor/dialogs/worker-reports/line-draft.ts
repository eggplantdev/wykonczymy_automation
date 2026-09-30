import { parseReportQty } from '@/lib/kosztorys/worker-report/parse-report-qty'
import type { ReportLineT } from '@/lib/kosztorys/worker-report/types'
import { formatQty } from '@/lib/kosztorys/format'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'
import { parseDecimalInput } from '@/lib/utils/parse-decimal-input'

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
}

export type LineGroupT = 'rozpiska' | 'extra'

// What the rozpiska holds for a reported pozycja right now; `undefined` once it was deleted.
export type ItemFiguresT = { stageQty: number; measuredQty: number; plannedQty: number }

export const qtyInputText = (qty: number) => formatQty(qty).replace(/\s/g, '')

export const lineGroup = (line: Pick<ReportLineT, 'kind'>, draft: LineDraftT): LineGroupT =>
  line.kind === 'extra' || draft.isExtra ? 'extra' : 'rozpiska'

export function acceptedQty(draft: LineDraftT): number {
  if (!draft.isTicked) return 0
  const parsed = parseReportQty(draft.qty)
  return parsed.kind === 'value' ? parsed.value : 0
}

// A praca spoza rozpiski becomes a new pozycja: it needs a home, and a price — from the katalog or
// typed by the kierownik. A rozpiska line needs a live pozycja to add to.
export function isLineReady(
  line: Pick<ReportLineT, 'kind'>,
  draft: LineDraftT,
  itemId: number | undefined,
): boolean {
  if (!draft.isTicked) return true
  if (parseReportQty(draft.qty).kind !== 'value') return false
  if (lineGroup(line, draft) === 'rozpiska') return itemId !== undefined
  if (draft.sectionId === '') return false
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
