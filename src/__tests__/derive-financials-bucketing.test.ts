import { describe, it, expect } from 'vitest'
import { deriveFinancials, deriveCategoryBreakdowns } from '@/lib/db/investment-financials'
import { billedAmountFor, TRANSFER_TYPES, type TransferTypeT } from '@/lib/constants/transfers'
import { partitionExpenseRows, sumBilled } from '@/lib/kosztorys/expense-datasets'
import type { InvestmentFinancialsT } from '@/types/investment-financials'
import type { InvoiceFileT, MaterialTransactionRowT } from '@/types/transfers'

// CHARACTERIZATION SUITE (EX-573 phase 0) — the bucketing rule, pinned before phase 2
// rewrites deriveFinancials to read the spec table.
//
// Shape: feed ONE (type, settled) pair at a time and assert which buckets pick it up.
// A whole-distribution snapshot would let two compensating errors cancel out; a single
// pair per run makes every cell of the matrix independently observable, and a failure
// names the exact pair that moved.

const AMOUNT = 100

// Invoice fields null throughout — the bucketing reconciles amounts, and a row's attached invoice
// has no bearing on which bucket it lands in.
const ROW_BASE = {
  date: '2026-07-26',
  label: 'Materiały',
  description: null,
  invoices: [] as InvoiceFileT[],
  invoiceNote: null,
} as const

type BucketNameT = Exclude<
  keyof InvestmentFinancialsT,
  'categoryCosts' | 'settledCategoryCosts' | 'netCategoryCosts'
>

/** Which (type, settled) pairs land in each bucket today. Hand-typed, not derived. */
const BUCKET_MEMBERSHIP: Record<BucketNameT, [string, boolean][]> = {
  // The headline the two bilanses read — the sum of the two material buckets below.
  totalMaterialCosts: [
    ['INVESTMENT_EXPENSE', false],
    ['CORRECTION', false],
    ['INVESTMENT_EXPENSE_NET', false],
    ['INVESTMENT_EXPENSE_NET', true],
  ],
  materialsGrossBase: [
    ['INVESTMENT_EXPENSE', false],
    ['CORRECTION', false],
  ],
  // Ignores `settled` (like the deposit buckets): the netto type is `settleable: false`,
  // so a settled netto row cannot be written — and were one ever forged, dropping it here
  // would hide it from every figure instead of surfacing it.
  materialsNetBilled: [
    ['INVESTMENT_EXPENSE_NET', false],
    ['INVESTMENT_EXPENSE_NET', true],
  ],
  // The deposit buckets ignore `settled` entirely — a settled deposit is not a concept,
  // but the predicate does not exclude it, and that tolerance is the pinned behaviour.
  totalIncome: [
    ['INVESTOR_DEPOSIT', false],
    ['INVESTOR_DEPOSIT', true],
    ['COMPANY_FUNDING', false],
    ['COMPANY_FUNDING', true],
    ['OTHER_DEPOSIT', false],
    ['OTHER_DEPOSIT', true],
  ],
  // Since the write-switch (EX-555) this bucket is the FALLBACK rule, not the listing rule: an
  // investment with kosztorys rows reads robocizna from the kosztorys and never reaches here. What
  // is pinned below is what a legacy, kosztorys-less investment still bills at.
  totalLaborCosts: [
    ['LABOR_COST', false],
    ['LABOR_COST', true],
  ],
  totalPayouts: [
    ['PAYOUT', false],
    ['PAYOUT', true],
  ],
  // Fallback rule, same as totalLaborCosts above — the kosztorys branch supplies rabat itself.
  totalDiscount: [
    ['RABAT', false],
    ['RABAT', true],
  ],
  totalLoss: [
    ['LOSS', false],
    ['LOSS', true],
  ],
  totalSettled: [
    ['INVESTMENT_EXPENSE', true],
    ['CORRECTION', true],
  ],
  // Derived from materialsGrossBase and the investment's rate, which this matrix never supplies, so
  // every pair must leave it at 0. Its own arithmetic lives in lib/db/investment-financials.test.ts.
  materialsNetDiscount: [],
}

const ALL_PAIRS: [string, boolean][] = TRANSFER_TYPES.flatMap((type) => [
  [type, false] as [string, boolean],
  [type, true] as [string, boolean],
])

const isMember = (bucket: BucketNameT, [type, settled]: [string, boolean]) =>
  BUCKET_MEMBERSHIP[bucket].some(([t, s]) => t === type && s === settled)

// `deriveFinancials` is the TRANSACTIONS plane. For robocizna and rabat that plane is now only the
// fallback the listing takes when an investment has no kosztorys rows (EX-555); every other bucket
// here is a cash movement the kosztorys knows nothing about and is still the one rule.
describe('deriveFinancials — bucketing matrix (transactions plane)', () => {
  it('covers every bucket', () => {
    const financials = deriveFinancials([])
    const buckets = Object.keys(financials).filter(
      (k) => k !== 'categoryCosts' && k !== 'settledCategoryCosts' && k !== 'netCategoryCosts',
    )
    expect(buckets.sort()).toEqual(Object.keys(BUCKET_MEMBERSHIP).sort())
  })

  it('covers every (type × settled) pair', () => {
    expect(ALL_PAIRS).toHaveLength(26)
  })

  for (const pair of ALL_PAIRS) {
    const [type, settled] = pair
    describe(`${type} · settled=${settled}`, () => {
      // Both columns carry AMOUNT so the matrix stays one number wide; which column a
      // type actually bills at is pinned separately, below.
      const financials = deriveFinancials([{ type, settled, total: AMOUNT, netTotal: AMOUNT }])
      for (const bucket of Object.keys(BUCKET_MEMBERSHIP) as BucketNameT[]) {
        const expected = isMember(bucket, pair) ? AMOUNT : 0
        it(`${bucket} → ${expected}`, () => {
          expect(financials[bucket]).toBe(expected)
        })
      }
    })
  }
})

describe('deriveFinancials — the netto type bills at netTotal, never at total', () => {
  // The whole point of the type: brutto leaves the register, netto bills the investor.
  // Reading `total` here would bill the client the VAT the owner reclaims.
  const financials = deriveFinancials([
    { type: 'INVESTMENT_EXPENSE_NET', settled: false, total: 1230, netTotal: 1000 },
  ])

  it('materialsNetBilled is the netto figure', () => {
    expect(financials.materialsNetBilled).toBe(1000)
  })

  it('materialsGrossBase is untouched — the toggle can never reach the netto figure', () => {
    expect(financials.materialsGrossBase).toBe(0)
  })

  it('totalSettled is untouched — the netto figure never reaches marża', () => {
    expect(financials.totalSettled).toBe(0)
  })

  it('a netto row with no netAmount bills 0 rather than falling back to brutto', () => {
    const orphan = deriveFinancials([
      { type: 'INVESTMENT_EXPENSE_NET', settled: false, total: 1230 },
    ])
    expect(orphan.totalMaterialCosts).toBe(0)
  })
})

describe('deriveFinancials — unknown type falls into no bucket', () => {
  it.each(['UNKNOWN_TYPE', '', 'investment_expense'])('%j contributes nothing', (type) => {
    for (const settled of [false, true]) {
      const financials = deriveFinancials([{ type, settled, total: AMOUNT, netTotal: AMOUNT }])
      for (const bucket of Object.keys(BUCKET_MEMBERSHIP) as BucketNameT[]) {
        expect(financials[bucket], `${type}/${settled} leaked into ${bucket}`).toBe(0)
      }
    }
  })
})

describe('deriveFinancials — breakdowns pass through untouched', () => {
  it('returns the category arrays it was given', () => {
    const live = [{ categoryId: 1, total: 10 }]
    const settled = [{ categoryId: 2, total: 20 }]
    const net = [{ categoryId: 1, total: 4 }]
    const financials = deriveFinancials([], live, settled, null, 'NET', net)
    expect(financials.categoryCosts).toEqual(live)
    expect(financials.settledCategoryCosts).toEqual(settled)
    expect(financials.netCategoryCosts).toEqual(net)
  })

  it('defaults all three to empty', () => {
    const financials = deriveFinancials([])
    expect(financials.categoryCosts).toEqual([])
    expect(financials.settledCategoryCosts).toEqual([])
    expect(financials.netCategoryCosts).toEqual([])
  })
})

describe('deriveCategoryBreakdowns — same membership, split by settled', () => {
  it.each(TRANSFER_TYPES)('%s', (type) => {
    const isMaterial =
      type === 'INVESTMENT_EXPENSE' || type === 'CORRECTION' || type === 'INVESTMENT_EXPENSE_NET'
    // The netto type ignores `settled` — deriveFinancials folds it into materialsNetBilled
    // unconditionally, so honouring the flag here would leave the category with a
    // netCategoryCosts entry and no matching cost, which renders as a negative brutto row.
    const followsSettled = isMaterial && type !== 'INVESTMENT_EXPENSE_NET'
    const row = { categoryId: 7, type, total: AMOUNT, netTotal: AMOUNT }
    const cost = [{ categoryId: 7, total: AMOUNT }]
    const live = deriveCategoryBreakdowns([{ ...row, settled: false }])
    const settled = deriveCategoryBreakdowns([{ ...row, settled: true }])

    expect(live.categoryCosts).toEqual(isMaterial ? cost : [])
    expect(live.settledCategoryCosts).toEqual([])
    expect(settled.settledCategoryCosts).toEqual(followsSettled ? cost : [])
    expect(settled.categoryCosts).toEqual(followsSettled ? [] : isMaterial ? cost : [])
  })

  // netCategoryCosts is a SUBSET of categoryCosts, not a sibling total: the netto rows are
  // counted once in the headline and named here only so a consumer can freeze that part
  // against the global „wszystko netto" toggle.
  it('names the netto share per category without removing it from categoryCosts', () => {
    const { categoryCosts, netCategoryCosts } = deriveCategoryBreakdowns([
      { categoryId: 7, type: 'INVESTMENT_EXPENSE', settled: false, total: 200 },
      {
        categoryId: 7,
        type: 'INVESTMENT_EXPENSE_NET',
        settled: false,
        total: 1230,
        netTotal: 1000,
      },
    ])
    expect(categoryCosts).toEqual([{ categoryId: 7, total: 1200 }])
    expect(netCategoryCosts).toEqual([{ categoryId: 7, total: 1000 }])
  })

  it('leaves netCategoryCosts empty when no netto row exists', () => {
    const { netCategoryCosts } = deriveCategoryBreakdowns([
      { categoryId: 7, type: 'INVESTMENT_EXPENSE', settled: false, total: 200 },
    ])
    expect(netCategoryCosts).toEqual([])
  })

  it('sums repeated rows per category', () => {
    const { categoryCosts } = deriveCategoryBreakdowns([
      { categoryId: 7, type: 'INVESTMENT_EXPENSE', settled: false, total: 10 },
      { categoryId: 7, type: 'CORRECTION', settled: false, total: 5 },
      { categoryId: 8, type: 'INVESTMENT_EXPENSE', settled: false, total: 3 },
    ])
    expect(categoryCosts).toEqual([
      { categoryId: 7, total: 15 },
      { categoryId: 8, total: 3 },
    ])
  })

  // Σ settledCategoryCosts must equal totalSettled by construction — the invariant the
  // „Materiały wliczone w robociznę" buttons rely on to sum to the headline figure.
  it('reconciles with deriveFinancials over a mixed distribution', () => {
    const rows = [
      { categoryId: 1, type: 'INVESTMENT_EXPENSE', settled: false, total: 100 },
      { categoryId: 1, type: 'INVESTMENT_EXPENSE', settled: true, total: 40 },
      { categoryId: 2, type: 'CORRECTION', settled: false, total: 25 },
      { categoryId: 2, type: 'CORRECTION', settled: true, total: 5 },
      { categoryId: 3, type: 'PAYOUT', settled: false, total: 999 },
      {
        categoryId: 1,
        type: 'INVESTMENT_EXPENSE_NET',
        settled: false,
        total: 1230,
        netTotal: 1000,
      },
    ]
    const breakdowns = deriveCategoryBreakdowns(rows)
    const financials = deriveFinancials(
      rows.map(({ type, settled, total, netTotal }) => ({ type, settled, total, netTotal })),
      breakdowns.categoryCosts,
      breakdowns.settledCategoryCosts,
    )
    const sum = (costs: { total: number }[]) => costs.reduce((a, c) => a + c.total, 0)

    expect(sum(breakdowns.categoryCosts)).toBe(financials.totalMaterialCosts)
    expect(sum(breakdowns.netCategoryCosts)).toBe(financials.materialsNetBilled)
    expect(sum(breakdowns.settledCategoryCosts)).toBe(financials.totalSettled)
  })
})

// Regression: the „Wydatki inwestycyjne" list mapped every row to its brutto `amount`, so a netto
// row showed the client the VAT-inclusive figure and the list's Σ overshot the breakdown above it.
// The list's per-row rule (billedAmountFor) and the aggregate rule (deriveFinancials) must agree.
describe('per-row billed figure reconciles with the aggregate', () => {
  it('Σ billedAmountFor over the unsettled material rows === totalMaterialCosts', () => {
    const rows = [
      { type: 'INVESTMENT_EXPENSE', settled: false, amount: 100, netAmount: null },
      { type: 'CORRECTION', settled: false, amount: 25, netAmount: null },
      { type: 'INVESTMENT_EXPENSE_NET', settled: false, amount: 1230, netAmount: 1000 },
    ]
    const listTotal = rows.reduce(
      (acc, r) => acc + billedAmountFor(r.type, r.amount, r.netAmount),
      0,
    )
    const financials = deriveFinancials(
      rows.map((r) => ({
        type: r.type,
        settled: r.settled,
        total: r.amount,
        netTotal: r.netAmount ?? undefined,
      })),
    )

    expect(listTotal).toBe(financials.totalMaterialCosts)
    expect(listTotal).toBe(1125)
  })
})

// The wydatki list splits into three mutually exclusive tabs, so no single tab's Σ equals the
// breakdown's „Razem" any more — the two expense tabs must add up to it instead. Without this the
// tab filter could silently drop or double-count a type and no figure on screen would contradict it.
// (The split's own behaviour is pinned in lib/kosztorys/expense-datasets.test.ts; this is the seam.)
describe('the wydatki tabs partition the billed total', () => {
  // `type` narrowed to required: deriveFinancials has no stale-cache tolerance to exercise here.
  const rows: (MaterialTransactionRowT & { type: TransferTypeT })[] = [
    { ...ROW_BASE, id: 1, type: 'INVESTMENT_EXPENSE', amount: 100, billed: 100, settled: false },
    { ...ROW_BASE, id: 2, type: 'CORRECTION', amount: -25, billed: -25, settled: false },
    {
      ...ROW_BASE,
      id: 3,
      type: 'INVESTMENT_EXPENSE_NET',
      amount: 1230,
      billed: 1000,
      settled: false,
    },
    { ...ROW_BASE, id: 4, type: 'INVESTMENT_EXPENSE', amount: 40, billed: 40, settled: true },
  ]

  it('Σ billed over the two expense tabs === totalMaterialCosts', () => {
    const { gross, net, settled } = partitionExpenseRows(rows)
    const financials = deriveFinancials(
      rows.map((row) => ({
        type: row.type,
        settled: row.settled,
        total: row.amount,
        netTotal: row.billed,
      })),
    )

    expect(sumBilled(gross) + sumBilled(net)).toBe(financials.totalMaterialCosts)
    expect(sumBilled(settled)).toBe(financials.totalSettled)
  })
})
