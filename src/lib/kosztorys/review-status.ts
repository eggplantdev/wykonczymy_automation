import type { KosztorysItemT, ReviewStatusT } from '@/lib/kosztorys/types'

type ReviewFieldsT = Pick<KosztorysItemT, 'aiPlannedQty' | 'plannedQty' | 'reviewStatus'>

export const REVIEW_STATUS_LABELS: Record<ReviewStatusT, string> = {
  accepted: 'Zaakceptowana',
  rejected: 'Odrzucona',
  edited: 'Edytowana',
  added: 'Dodana',
}

export const REVIEW_STATUS_UNSET_LABEL = 'Do sprawdzenia'

// An „AI kosztorys" is one an agent draft was loaded into. Without one, AI przedmiar is NULL on every
// row and none of the review machinery applies — an ordinary kosztorys must not grow statuses.
export function hasAiDraft(rows: readonly Pick<KosztorysItemT, 'aiPlannedQty'>[]): boolean {
  return rows.some((row) => row.aiPlannedQty !== null)
}

// A praca the agent never saw (added later with „Nowa praca") reads as Dodana without anyone picking
// it, so it is reviewed — and asked for a Powód zmiany — like the rows the agent did see.
export function effectiveReviewStatus(
  row: ReviewFieldsT,
  aiDraft: boolean,
): ReviewStatusT | null {
  if (row.reviewStatus) return row.reviewStatus
  if (aiDraft && row.aiPlannedQty === null && row.plannedQty > 0) return 'added'
  return null
}

function statusForTypedQty(ai: number | null, qty: number): ReviewStatusT | null {
  if (ai !== null && ai > 0) {
    if (qty === ai) return 'accepted'
    return qty === 0 ? 'rejected' : 'edited'
  }
  return qty > 0 ? 'added' : null
}

// Status and Przedmiar are one concept in two columns: picking Zaakceptowana/Odrzucona writes the
// quantity, typing a quantity writes the status. Both changes land in the same onChange batch, so
// undo restores them together.
export function applyReviewRules<RowT extends ReviewFieldsT & { id: number }>(
  next: readonly RowT[],
  prevById: ReadonlyMap<number, RowT>,
  aiDraft: boolean,
): readonly RowT[] {
  if (!aiDraft) return next
  let out: RowT[] | null = null
  next.forEach((row, i) => {
    const prev = prevById.get(row.id)
    if (!prev) return
    const ai = row.aiPlannedQty
    let patched = row
    if (prev.reviewStatus !== row.reviewStatus) {
      if (ai !== null && row.plannedQty === prev.plannedQty) {
        if (row.reviewStatus === 'accepted') patched = { ...row, plannedQty: ai }
        else if (row.reviewStatus === 'rejected') patched = { ...row, plannedQty: 0 }
      }
    } else if (row.plannedQty !== prev.plannedQty) {
      const status = statusForTypedQty(ai, row.plannedQty)
      if (status !== row.reviewStatus) patched = { ...row, reviewStatus: status }
    }
    if (patched !== row) {
      out ??= next.slice()
      out[i] = patched
    }
  })
  return out ?? next
}
