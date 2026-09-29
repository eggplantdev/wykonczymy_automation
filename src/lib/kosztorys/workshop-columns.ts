import { ALL_PLANE_PRICE_KEYS } from '@/lib/kosztorys/plane-price-keys'

// The workbench's column list — exactly what a szablon carries to the next job. The rest of the
// grid (przedmiar, etapy, rabat, wartości, postęp) is not „hidden" here and not „read-only": it is
// simply absent, because a value typed into a szablon would arrive nowhere — `serializeKosztorysAsPreset`
// zeroes it on every save. A column added later is absent from the workbench until someone
// deliberately writes it in here, and that is the intended default side.
//
// This list is BOTH the ceiling and the floor (see `selectV2Columns`): the map of hidden columns is
// one per browser, so a tick set on an ordinary kosztorys must neither add a column here nor take
// one away — the workbench has no picker to answer it with.
//
// Full ids, never the base key (see `basePriceKey`) — hence `ALL_PLANE_PRICE_KEYS`, so a third plane
// cannot arrive with one of its two columns missing. Both halves, because a NADPISANA stawka travels:
// `serializeKosztorysAsPreset` zeroes only the per-job fields, and the mode is derived from that same
// nullable override — so the source is a control the workbench could otherwise neither show nor type
// a value for. An un-overridden stawka is `clientPrice ×` the coefficient and travels no better than
// `priceGross` below; typing into the cell is what creates the override that does.
//
// No `priceGross` either (owner ruling, 2026-09-22), and for a sharper reason than „not needed": it
// is a COMPUTED column, netto × the row's VAT — and a preset's `settings` are retained but ignored
// on apply, so that VAT is the workbench's own and never travels to the next budowa. The figure
// would therefore be right on this screen and wrong everywhere the szablon is used.
//
// `actions` is on the list despite carrying nothing to the next budowa: the grid runs `lockRows`, so
// the „Akcje" menu is the only route to usuń / przesuń / wstaw a pozycja. This list reads as "what a
// szablon carries", which is why a column that is pure affordance was missed once already.
export const WORKSHOP_VISIBLE_COLUMNS: ReadonlySet<string> = new Set([
  'actions',
  'sectionName',
  'description',
  'unit',
  'price',
  ...ALL_PLANE_PRICE_KEYS,
  'note',
])
