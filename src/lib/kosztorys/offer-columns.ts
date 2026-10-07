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
