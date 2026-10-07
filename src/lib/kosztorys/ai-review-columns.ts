export const AI_REVIEW_COLUMN_IDS = [
  'aiPlannedQty',
  'reviewStatus',
  'changeReason',
  'workNote',
] as const

const AI_REVIEW_COLUMNS: ReadonlySet<string> = new Set(AI_REVIEW_COLUMN_IDS)

export const isAiReviewColumn = (id: string): boolean => AI_REVIEW_COLUMNS.has(id)

// „Oferta": the columns the owner leaves visible on the offer the client receives
// (context/reference/kosztorys-sheet/offer-view-rows.png).
export const OFFER_VISIBLE_COLUMNS: ReadonlySet<string> = new Set([
  'actions',
  'description',
  'plannedQty',
  'unit',
  'price',
  'plannedNet',
])
