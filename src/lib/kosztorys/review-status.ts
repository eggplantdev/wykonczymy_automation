import type { KosztorysItemT, ReviewStatusT } from '@/lib/kosztorys/types'

export const REVIEW_STATUSES = ['accepted', 'rejected', 'edited', 'added'] as const

export const isReviewStatus = (value: unknown): value is ReviewStatusT =>
  (REVIEW_STATUSES as readonly unknown[]).includes(value)

type ReviewFieldsT = Pick<
  KosztorysItemT,
  'aiPlannedQty' | 'plannedQty' | 'reviewStatus' | 'aiRecheck'
>

// An „AI kosztorys" is one an agent draft was loaded into. Without one, AI przedmiar is NULL on every
// row and none of the review machinery applies — an ordinary kosztorys must not grow statuses.
export function hasAiDraft(rows: readonly Pick<KosztorysItemT, 'aiPlannedQty'>[]): boolean {
  return rows.some((row) => row.aiPlannedQty !== null)
}

// Only rows the agent offered work on await a verdict — one it left out (0) or never saw (NULL) does not.
export const aiOffered = (row: Pick<KosztorysItemT, 'aiPlannedQty'>): boolean =>
  (row.aiPlannedQty ?? 0) > 0

// Asked only on an AI kosztorys: what the quantities say with nothing picked. A praca the agent left
// out (0) or never saw (added later with „Nowa praca") reads as Dodana once it has a Przedmiar, so it
// is asked for a Powód zmiany like the rest. The agent drafts blind to the Przedmiar already typed, so
// landing on the same number is a verdict already given: Zaakceptowana, not one more pozycja to check.
export function derivedReviewStatus(row: ReviewFieldsT): ReviewStatusT | null {
  if (aiOffered(row)) return row.plannedQty === row.aiPlannedQty ? 'accepted' : null
  return row.plannedQty > 0 ? 'added' : null
}

export const effectiveReviewStatus = (row: ReviewFieldsT): ReviewStatusT | null =>
  row.reviewStatus ?? derivedReviewStatus(row)

function statusForTypedQty(row: ReviewFieldsT): ReviewStatusT | null {
  const derived = derivedReviewStatus(row)
  if (derived || !aiOffered(row)) return derived
  return row.plannedQty === 0 ? 'rejected' : 'edited'
}

// Status and Przedmiar are one concept in two columns: picking Zaakceptowana/Odrzucona writes the
// quantity, typing a quantity writes the status. Both changes land in the same onChange batch, so
// undo restores them together. A round's „Do ponownego sprawdzenia" flag (EX-1057) rides the same
// batch: `pickStatus` lowers it on any pick — so re-picking the status already stored counts as a
// pick and copies the round's new AI przedmiar — and a typed quantity lowers it here.
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
    const flagLowered = prev.aiRecheck === true && row.aiRecheck !== true
    if (prev.reviewStatus !== row.reviewStatus || flagLowered) {
      // A round that dropped the work (AI przedmiar 0) still has a figure to copy.
      const copiesAi = flagLowered ? row.aiPlannedQty !== null : aiOffered(row)
      if (copiesAi && row.plannedQty === prev.plannedQty) {
        if (row.reviewStatus === 'accepted') patched = { ...row, plannedQty: row.aiPlannedQty! }
        else if (row.reviewStatus === 'rejected') patched = { ...row, plannedQty: 0 }
      }
    } else if (row.plannedQty !== prev.plannedQty) {
      const status = statusForTypedQty(row)
      if (status !== row.reviewStatus) patched = { ...patched, reviewStatus: status }
      if (row.aiRecheck === true) patched = { ...patched, aiRecheck: false }
    }
    if (patched !== row) {
      out ??= next.slice()
      out[i] = patched
    }
  })
  return out ?? next
}

// Any pick lowers a later round's flag — the same status re-picked included, which is how the owner
// says „seen, still right".
export const pickStatus = <RowT extends ReviewFieldsT>(
  row: RowT,
  status: ReviewStatusT | null,
): RowT =>
  row.aiRecheck
    ? { ...row, reviewStatus: status, aiRecheck: false }
    : { ...row, reviewStatus: status }
