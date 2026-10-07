import type { KosztorysItemT, ReviewStatusT } from '@/lib/kosztorys/types'

export const REVIEW_STATUSES = ['accepted', 'rejected', 'edited', 'added'] as const

export const isReviewStatus = (value: unknown): value is ReviewStatusT =>
  (REVIEW_STATUSES as readonly unknown[]).includes(value)

type ReviewFieldsT = Pick<KosztorysItemT, 'aiPlannedQty' | 'plannedQty' | 'reviewStatus'>

// An „AI kosztorys" is one an agent draft was loaded into. Without one, AI przedmiar is NULL on every
// row and none of the review machinery applies — an ordinary kosztorys must not grow statuses.
export function hasAiDraft(rows: readonly Pick<KosztorysItemT, 'aiPlannedQty'>[]): boolean {
  return rows.some((row) => row.aiPlannedQty !== null)
}

// Only rows the agent offered work on await a verdict — one it left out (0) or never saw (NULL) does not.
export const aiOffered = (row: Pick<KosztorysItemT, 'aiPlannedQty'>): boolean =>
  (row.aiPlannedQty ?? 0) > 0

// Asked only on an AI kosztorys: a praca the agent never saw (added later with „Nowa praca") reads as
// Dodana without anyone picking it, so it is reviewed — and asked for a Powód zmiany — like the rest.
export function effectiveReviewStatus(row: ReviewFieldsT): ReviewStatusT | null {
  if (row.reviewStatus) return row.reviewStatus
  if (row.aiPlannedQty === null && row.plannedQty > 0) return 'added'
  return null
}

function statusForTypedQty(row: ReviewFieldsT): ReviewStatusT | null {
  if (aiOffered(row)) {
    if (row.plannedQty === row.aiPlannedQty) return 'accepted'
    return row.plannedQty === 0 ? 'rejected' : 'edited'
  }
  return row.plannedQty > 0 ? 'added' : null
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
    let patched = row
    if (prev.reviewStatus !== row.reviewStatus) {
      if (aiOffered(row) && row.plannedQty === prev.plannedQty) {
        if (row.reviewStatus === 'accepted') patched = { ...row, plannedQty: row.aiPlannedQty! }
        else if (row.reviewStatus === 'rejected') patched = { ...row, plannedQty: 0 }
      }
    } else if (row.plannedQty !== prev.plannedQty) {
      const status = statusForTypedQty(row)
      if (status !== row.reviewStatus) patched = { ...row, reviewStatus: status }
    }
    if (patched !== row) {
      out ??= next.slice()
      out[i] = patched
    }
  })
  return out ?? next
}
