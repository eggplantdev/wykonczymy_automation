import { OVERRIDE_COEFF_FIELDS, OVERRIDE_FIELDS } from '@/lib/kosztorys/constants'
import type {
  GlobalDiscountT,
  KosztorysGlobalCoeffsT,
  KosztorysItemT,
  PriceSourceT,
  ToolPlaneT,
  ViewPricingT,
} from '@/lib/kosztorys/types'

// VAT: a single rate per investment (vatRate), carried on the row. No section→item cascade.

// Half a grosz — two money figures closer than this differ by float noise, not by a decision anyone
// made, so nothing may report them as disagreeing. Money only: a quantity tolerance is a different
// axis (`QTY_TOLERANCE`), and so is the one guarding a subcontractor rate.
export const MONEY_TOLERANCE = 0.005

// The pricing layer: what a row is worth per unit, and what ANY quantity of it is worth at that
// price. Pure functions over ViewPricingT — we persist only the inputs and compute everything live.
//
// Structurally stage-blind, on purpose. Which quantity is the truth is a settlement question (the
// stages answer it), so it is decided one layer up in v2-rows.ts, which knows stages and imports
// this. Here every figure takes its quantity as a PARAMETER — nothing in this file reads a qty off
// the row except rowPlannedNetForView, the offer figure, whose quantity is the przedmiar by
// definition.
//
// Discount ("rabat"): discountValue for 'percent' = percentage points (10 => 10%), for
// 'amount' = an amount in PLN subtracted from the net value.

// The MODE decides the replacement, not the amount: „Kwotowy" suppresses per-item rabat at any value,
// including 0. It used to also require `value > 0`, which made 0 zł resurrect every per-item rabat —
// so typing 0 to kill the rabat instead made it jump back to Σ rabatów per pozycja. „Wyłączony"
// (type null) is the one way back to per-item rabaty. The explicit mode check still fails closed on a
// persisted value that isn't 'amount' (a legacy 'percent' row, or an out-of-band write).
export function isGlobalDiscountActive({ type }: GlobalDiscountT): boolean {
  return type === 'amount'
}

// What entering a rabat-globalny mode has to persist. Since the MODE decides the replacement, picking
// „Kwotowy" must write immediately — waiting for an amount left the select promising a suppression the
// engine wasn't performing (EX-605).
//
// The seed is the per-item rabat total the global one is replacing, so switching moves no figure: the
// user opts into the mechanism first and changes the number second. Seeding 0 would work too, but it
// makes „Kwotowy" read as „skasuj rabaty" at the moment of the click.
//
// Reversible either way — the per-item rabaty are never written, only bypassed, so „Wyłączony" brings
// them all back. That is why this can activate on selection at all.
export function globalDiscountForMode(
  mode: 'off' | 'amount' | 'percent',
  perItemDiscountTotal: number,
): GlobalDiscountT {
  return mode === 'amount'
    ? { type: 'amount', value: perItemDiscountTotal }
    : { type: null, value: 0 }
}

function applyDiscount(gross: number, item: ViewPricingT): number {
  // Global discount overrides per-item rabat: when it is active the row prices gross-of-its-own
  // discount (the per-item fields stay in the DB, untouched), and the global discount is subtracted
  // once at the total level. Short-circuit BEFORE reading discountType so nothing per-item applies.
  if (item.globalDiscountActive) return gross
  if (item.discountType === 'percent') return gross * (1 - (item.discountValue || 0) / 100)
  if (item.discountType === 'amount') return gross - (item.discountValue || 0)
  return gross
}

// --- Price views (one dataset → three views: client / subcontractor with/without tools) ---
export type PriceViewT = 'client' | ToolPlaneT

// Exported for the source switch (subcontractor-price-edit.ts): entering „własny mnożnik" seeds the
// cell with what the row was already being paid at, and on „auto" that IS the investment's own
// współczynnik.
export function effectiveCoeff(row: ViewPricingT, view: ToolPlaneT): number {
  return view === 'w_tools' ? row.globalWToolsCoeff : row.globalOwnToolsCoeff
}

/**
 * This plane's own nadpisanie, or `null` for „auto". `null` is the load-bearing answer — it is what
 * „the row said nothing, derive it from the global współczynnik" looks like, and what a cennik
 * „auto" means one layer up. `0` is not that: it is a kwota someone set to zero.
 */
export function overrideValueFor(
  row: Pick<ViewPricingT, 'wToolsOverrideValue' | 'ownToolsOverrideValue'>,
  view: ToolPlaneT,
): number | null {
  return row[OVERRIDE_FIELDS[view]]
}

/**
 * This plane's own MULTIPLIER, or `null` for „no multiplier here". Twin of `overrideValueFor`, and
 * `null` carries the same weight: `0` is a multiplier someone set to zero — a stawka of zero złotych
 * — not an absence.
 */
export function overrideCoeffFor(
  row: Pick<ViewPricingT, 'wToolsOverrideCoeff' | 'ownToolsOverrideCoeff'>,
  view: ToolPlaneT,
): number | null {
  return row[OVERRIDE_COEFF_FIELDS[view]]
}

/**
 * Whether a nadpisanie column actually NAMES a figure — the one test every źródło switch asks.
 *
 * A positive test, not `!== null`, because the list of things that are not a figure is open-ended
 * while the list of things that are is one item long. `!== null` asks „is it the absence I expect",
 * so a payload one key short (`undefined`) or a broken import (`NaN`) walks through claiming to be a
 * deliberate mnożnik — the strongest statement in the chain — when it is the weakest thing there is.
 * A cennik served from a cache entry written before the mnożnik columns existed did exactly that, and
 * printed „×0" over rows carrying a kwota stała (2026-09-23). Unknown belongs at the BOTTOM of the
 * precedence: „auto" is the answer that claims nothing.
 *
 * `0` is unaffected and still a figure — a stawka someone set to zero is a decision, not an absence.
 */
export const namesFigure = (value: number | null): value is number => Number.isFinite(value)

/**
 * Where this plane's stawka comes from — the ONLY place the precedence coeff > kwota > global
 * współczynnik is decided. Four surfaces branch on the answer (siatka, sufit, filtry, katalog); each
 * re-deriving it from `!== null` checks is how they drift apart.
 *
 * The multiplier wins a row carrying both. That pair is unreachable through the app — the action
 * normalizes every write — but raw SQL and `/admin` reach it, and a tie needs a rule rather than a
 * throw.
 */
export function priceSourceOf(
  row: Pick<
    ViewPricingT,
    | 'wToolsOverrideValue'
    | 'ownToolsOverrideValue'
    | 'wToolsOverrideCoeff'
    | 'ownToolsOverrideCoeff'
  >,
  view: ToolPlaneT,
): PriceSourceT {
  if (namesFigure(overrideCoeffFor(row, view))) return 'coeff'
  if (namesFigure(overrideValueFor(row, view))) return 'amount'
  return 'auto'
}

/**
 * A `KosztorysItemT` seen as a priceable row. The globals default to 0 for callers that price only
 * planes carrying their OWN nadpisanie — a kwota stała reads no global, so there the zeros are inert
 * rather than a stand-in for a real współczynnik.
 */
export function asViewPricing(
  item: KosztorysItemT,
  coeffs: KosztorysGlobalCoeffsT = { wTools: 0, ownTools: 0 },
): ViewPricingT {
  return {
    ...item,
    globalDiscountActive: false,
    globalWToolsCoeff: coeffs.wTools,
    globalOwnToolsCoeff: coeffs.ownTools,
  }
}

/**
 * The mnożnik a row SHOWS in the „Mnożnik" column: its own at „własny mnożnik", the investment's at
 * „auto" (the row IS priced by a multiplier there, just not one of its own), and nothing at „kwota
 * stała" — a frozen kwota does not track the cena j.m., so a ratio there would promise a link the
 * next price change breaks.
 *
 * Here rather than in the cell, because three surfaces read it and the cell is only one of them:
 * the komórka, `copyValue`, and `columnSortValue`. Sorting off `overrideCoeffFor` while the cell
 * rendered this put a row showing 0,65 under a row showing 0,4.
 */
export function shownCoeff(row: ViewPricingT, view: ToolPlaneT): number | null {
  switch (priceSourceOf(row, view)) {
    case 'coeff':
      return overrideCoeffFor(row, view)
    case 'auto':
      return effectiveCoeff(row, view)
    default:
      return null
  }
}

/**
 * Three sources, one number. The multiplier — like „auto" — multiplies the price BEFORE rabat: the
 * rabat is the company handing back its own marża, not a markdown of the crew's work, so no
 * subcontractor figure in this file has ever seen one.
 */
export function subcontractorPrice(row: ViewPricingT, view: ToolPlaneT): number {
  switch (priceSourceOf(row, view)) {
    case 'coeff':
      return row.clientPrice * overrideCoeffFor(row, view)!
    case 'amount':
      return overrideValueFor(row, view)!
    default:
      return row.clientPrice * effectiveCoeff(row, view)
  }
}

export function viewPrice(row: ViewPricingT, view: PriceViewT): number {
  if (view === 'w_tools' || view === 'own_tools') return subcontractorPrice(row, view)
  return row.clientPrice
}

/**
 * Brutto from any netto figure. VAT applies to the POST-discount net, and one rate covers the whole
 * investment — so this is a render transform, never a stored field. Here rather than inline at each
 * column so a future rounding rule (grosze) is one edit, not six.
 */
export function toGross(net: number, vatRate: number): number {
  return net * (1 + vatRate)
}

/**
 * The inverse, beside its twin so the crossing is one pair rather than a named direction and three
 * hand-written divisions. Divides rather than `× (1 − rate)`: at 23% a 123 zł brutto is 100 zł netto,
 * and 123 × 0,77 = 94,71 is a different figure.
 */
export function toNet(gross: number, vatRate: number): number {
  return gross / (1 + vatRate)
}

/**
 * What any quantity of this row is worth at the view's price, post-discount. Zero quantity is worth
 * zero: `> 0` rather than a truthiness check because a cleared cell writes null, and an 'amount' rabat
 * would otherwise turn `applyDiscount(0)` into −discountValue — a row priced at zero reading negative.
 *
 * Rabat is a CLIENT concession, absorbed by the company margin and never passed to the subcontractor
 * (see settlement-client-totals.ts sumSectionSubtotalsNet). So the discount applies in the client view only; the
 * two subcontractor views price gross of any per-item or global rabat. This zeroes every
 * subcontractor discount figure at its single source — rowDiscountForView, stage values, subtotals —
 * so the crew is billed its full price everywhere the grid or summary shows one.
 */
export function netForQtyForView(row: ViewPricingT, qty: number, view: PriceViewT): number {
  if (!(qty > 0)) return 0
  const gross = qty * viewPrice(row, view)
  return view === 'client' ? applyDiscount(gross, row) : gross
}

/**
 * Row value at the PLANNED qty ("wartość netto przedmiar") — the OFFER figure, the sheet's
 * S = N×Q − N×Q×R. It prices the przedmiar and carries the rabat, exactly like the settlement figure
 * (v2-rows' rowValueForView) prices the stage sum; the two differ only in which quantity they read.
 *
 * The rabat is IN by construction: this goes through netForQtyForView, so the offer figure has no
 * arithmetic of its own and cannot drift from the sheet by silently dropping the discount.
 *
 * Owner flagged the "rabat in the offer" call as a small open question (2026-07-16, EX-495) — a
 * revert is one commit, so nothing downstream leans on it.
 */
export function rowPlannedNetForView(row: ViewPricingT, view: PriceViewT): number {
  return netForQtyForView(row, row.plannedQty, view)
}

/**
 * The przedmiar at the view's price, PRE-rabat — the forecast's basis (EX-649).
 *
 * Sits beside rowPlannedNetForView rather than reusing it because the two differ by exactly the
 * rabat, and the forecast must not carry one: a rabat is not granted up front (owner, 2026-08-18),
 * so a prognoza is the przedmiar at full price. Routing the forecast through the offer figure would
 * discount only its client half — the rabat never reaches a subcontractor plane — and inflate the
 * forecast margin by the whole rabat.
 *
 * On either subcontractor plane the two agree by construction; the client view is the only place
 * the choice between them is observable.
 */
export function rowPlannedNetPreDiscountForView(row: ViewPricingT, view: PriceViewT): number {
  return row.plannedQty > 0 ? row.plannedQty * viewPrice(row, view) : 0
}

/**
 * Discount actually taken off the row, in PLN at the view's price. Derived rather than read from
 * discountValue, which is only the raw input: under 'percent' it holds percentage points, and under
 * either type it says nothing until it meets a price — which changes per view.
 */
export function rowDiscountForView(row: ViewPricingT, qty: number, view: PriceViewT): number {
  return qty * viewPrice(row, view) - netForQtyForView(row, qty, view)
}

/**
 * Value of a single stage at the view's price: the stage's qty SHARE of what the whole stage sum
 * (`totalQty`, handed in by the settlement layer) is worth.
 *
 * The share is what makes an 'amount' rabat behave — it discounts the whole row (owner,
 * 2026-07-15), so charging the full amount against every stage would subtract it once per stage:
 * an untouched stage rendered negative, and the stage values stopped summing to the row's value —
 * the reconciliation the sheet's V–AE block exists to allow. Written as a share of the net, that
 * reconciliation holds by construction rather than by cancellation. 'percent' is unaffected: being
 * multiplicative, its share was always proportional (asserted in kosztorys-calc.test.ts).
 *
 * Not sheet parity — the sheet's V = D*$Q-(D*$Q*$R) is rate-based, so it only ever knew percent.
 * The 'amount' rabat is ours, and this is its rule.
 */
export function stageValueForView(
  row: ViewPricingT,
  qtyDoneInStage: number,
  totalQty: number,
  view: PriceViewT,
): number {
  // A zero sum means every stage in it is zero, this one included — so 0 is the stage's actual
  // value, not a fallback. `> 0` rather than `=== 0`: a cleared cell writes null, which strict
  // equality walks past into a divide.
  if (!(totalQty > 0)) return 0
  return netForQtyForView(row, totalQty, view) * (qtyDoneInStage / totalQty)
}

/**
 * How much of the OFFER this row has delivered, as a fraction (0.75 = 75%) — `null` when there is
 * no denominator to divide by, so render code never divides and never fakes a 0%.
 *
 * The denominator is the przedmiar, not the stage sum: against the stage sum the row would read 100%
 * everywhere, being a number divided by itself.
 *
 * View-independent because it is a ratio of QUANTITIES — nothing here reads a price, so no view and
 * no rabat can move it, and the one figure the grid shows means the same thing in all of them.
 *
 * Deliberately unclamped: stages routinely overshoot the przedmiar, and a >100% reading is the row
 * saying so. The grid pairs it with a red cell (hasStagesOverPlanned); clamping would erase both.
 *
 * The guard is `> 0`, not `=== 0`: clearing the Przedmiar cell writes `null` (the grid's float
 * column is `Column<number|null>`), which a strict-equality check walks straight past into
 * `qty / null` — NaN or Infinity rendered verbatim in the cell. Also covers `undefined` and a
 * negative przedmiar.
 */
export function rowDoneFraction(row: ViewPricingT, totalQtyDone: number): number | null {
  if (!(row.plannedQty > 0)) return null
  return totalQtyDone / row.plannedQty
}

/**
 * The global (whole-kosztorys) discount in PLN off the executed total. 'amount' is flat, none/zero
 * is 0. Not distributed onto rows or stages — subtracted once here so
 * `do zapłaty = totalNet − globalDiscountAmount(totalNet, discount)`. Not clamped below zero; a
 * discount larger than the total is bad input to surface, not to silently floor.
 */
export function globalDiscountAmount(totalNet: number, discount: GlobalDiscountT): number {
  if (discount.type === 'amount') return discount.value
  return 0
}
