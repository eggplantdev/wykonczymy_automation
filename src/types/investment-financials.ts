export type CategoryCostT = {
  categoryId: number
  total: number
}

export type InvestmentFinancialsT = {
  categoryCosts: CategoryCostT[]
  /** Everything the client is billed for as materiały: `materialsGrossBase + materialsNetBilled`.
   *  Both bilanses read this one figure, so the netto type counts at its netto here. */
  totalMaterialCosts: number
  /** The brutto-billed material sum — the ONLY part the global kosztorys „wszystko netto"
   *  toggle may reduce. Keeping the netto type out of it makes a double cut impossible. */
  materialsGrossBase: number
  /** Σ `netAmount` of the netto expense type: already a netto figure, frozen against the toggle. */
  materialsNetBilled: number
  totalIncome: number
  totalLaborCosts: number
  totalPayouts: number
  totalDiscount: number
  totalLoss: number
  totalSettled: number
  /** What the company gives away by billing materiały netto instead of at the brutto receipt:
   *  `materialsGrossBase − materialsGrossBase / (1 + rate)`, or 0 where no rate is set or the
   *  investment is settled brutto. Two-sided like a rabat — it lowers marża and raises bilans.
   *  Non-optional on purpose: an `undefined` here would poison both figures with NaN. */
  materialsNetDiscount: number
  settledCategoryCosts: CategoryCostT[]
  /** The netto-billed subset of `categoryCosts` — a subset, not a sibling total. It travels with
   *  `categoryCosts` because that array alone cannot say which plane a category's `total` stands
   *  on, so any consumer pricing a category would have to guess. */
  netCategoryCosts: CategoryCostT[]
}

/** An investment nobody has booked a transfer against. Typed rather than spelled out at each
 *  fallback: a field added above then fails to compile here instead of going silently missing on
 *  the no-transfers path, which is how a zero would masquerade as a real figure. */
export const ZERO_FINANCIALS: InvestmentFinancialsT = {
  categoryCosts: [],
  totalMaterialCosts: 0,
  materialsGrossBase: 0,
  materialsNetBilled: 0,
  totalIncome: 0,
  totalLaborCosts: 0,
  totalPayouts: 0,
  totalDiscount: 0,
  totalLoss: 0,
  totalSettled: 0,
  materialsNetDiscount: 0,
  settledCategoryCosts: [],
  netCategoryCosts: [],
}

/** One row of the kosztorys „Materiały" split — a per-expense-category cost (`id` = the
 *  category), or the uncategorised remainder (`id` = null). Σ net === totalMaterialCosts.
 *  `net` is a legacy name: on a `gross` row it holds the recorded BRUTTO. `origin` says which
 *  bucket the row came from, because the two are valued differently — a `netBilled` row carries
 *  both amounts off the invoice and no rate may reprice either (owner, 2026-09-23). A category
 *  with rows in both buckets yields two rows, so the toggle can't reach the netto half. */
export type MaterialsBreakdownRowT = { id: number | null; label: string; net: number } & (
  | { origin: 'gross' }
  | { origin: 'netBilled'; recordedGross: number }
)

export type CategoryTypeSettledRowT = {
  categoryId: number
  type: string
  settled: boolean
  total: number
  netTotal?: number
}

export type CategoryBreakdownsT = {
  /** Billed materiały per category — the netto type counts at its `netAmount` here, so
   *  Σ categoryCosts still reconciles with `totalMaterialCosts`. */
  categoryCosts: CategoryCostT[]
  /** The netto-billed subset of `categoryCosts`, so a consumer can freeze exactly that
   *  part against the global toggle instead of re-deriving it from types. */
  netCategoryCosts: CategoryCostT[]
  /** The same netto-billed rows at their invoice BRUTTO (Σ `amount`). Display only — nothing is
   *  billed on it — so it feeds the „… netto" rows and never reaches `InvestmentFinancialsT`. */
  netCategoryGrossCosts: CategoryCostT[]
  settledCategoryCosts: CategoryCostT[]
}

/** Raw per-(type, settled) sum for one investment — the input both code paths feed
 *  into deriveFinancials(). `netTotal` is Σ `net_amount`, non-null only for the type
 *  whose spec row bills at `netAmount`. */
export type TypeSettledTotalT = {
  type: string
  settled: boolean
  total: number
  netTotal?: number
}

/** One tile in the investment's financial stat grid: a figure with its formatted display value. */
export type FinancialFieldT = {
  label: string
  value: string
  amount: number
}
