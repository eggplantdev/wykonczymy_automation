import { describe, it, expect } from 'vitest'
import { deriveFinancials, deriveCategoryBreakdowns } from '@/lib/db/investment-financials'
import { billedAmountFor, TRANSFER_TYPES, type TransferTypeT } from '@/lib/constants/transfers'
import { partitionExpenseRows, sumBilled } from '@/lib/kosztorys/expense-datasets'
import type { InvestmentFinancialsT } from '@/types/investment-financials'
import type { MaterialTransactionRowT } from '@/types/transfers'
import type { PreviewFileT } from '@/types/media'

const AMOUNT = 100

const ROW_BASE = {
  date: '2026-07-26',
  label: 'Materiały',
  description: null,
  invoices: [] as PreviewFileT[],
  invoiceNote: null,
} as const

type BucketNameT = Exclude<
  keyof InvestmentFinancialsT,
  'categoryCosts' | 'settledCategoryCosts' | 'netCategoryCosts'
>

const BUCKET_MEMBERSHIP: Record<BucketNameT, [string, boolean][]> = {
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
  materialsNetBilled: [
    ['INVESTMENT_EXPENSE_NET', false],
    ['INVESTMENT_EXPENSE_NET', true],
  ],
  totalIncome: [
    ['INVESTOR_DEPOSIT', false],
    ['INVESTOR_DEPOSIT', true],
    ['COMPANY_FUNDING', false],
    ['COMPANY_FUNDING', true],
    ['OTHER_DEPOSIT', false],
    ['OTHER_DEPOSIT', true],
  ],
  totalLaborCosts: [
    ['LABOR_COST', false],
    ['LABOR_COST', true],
  ],
  totalPayouts: [
    ['PAYOUT', false],
    ['PAYOUT', true],
  ],
  totalDiscount: [
    ['RABAT', false],
    ['RABAT', true],
  ],
  totalLoss: [
    ['LOSS', false],
    ['LOSS', true],
  ],
  // Its own bucket and nothing else: a premia lands in `totalPayouts`, `totalLoss` or
  // `totalDiscount` and it reaches the investor's bilans.
  totalBonus: [
    ['BONUS', false],
    ['BONUS', true],
  ],
  totalSettled: [
    ['INVESTMENT_EXPENSE', true],
    ['CORRECTION', true],
  ],
  // Derived from materialsGrossBase and the investment's rate, which this matrix never supplies, so
  // every pair must leave it at 0.
  materialsNetDiscount: [],
}

const ALL_PAIRS: [string, boolean][] = TRANSFER_TYPES.flatMap((type) => [
  [type, false] as [string, boolean],
  [type, true] as [string, boolean],
])

const isMember = (bucket: BucketNameT, [type, settled]: [string, boolean]) =>
  BUCKET_MEMBERSHIP[bucket].some(([t, s]) => t === type && s === settled)

describe('deriveFinancials — bucketing matrix (transactions plane)', () => {
  it('covers every bucket', () => {
    const financials = deriveFinancials([])
    const buckets = Object.keys(financials).filter(
      (k) => k !== 'categoryCosts' && k !== 'settledCategoryCosts' && k !== 'netCategoryCosts',
    )
    expect(buckets.sort()).toEqual(Object.keys(BUCKET_MEMBERSHIP).sort())
  })

  it('covers every (type × settled) pair', () => {
    expect(ALL_PAIRS).toHaveLength(28)
  })

  for (const pair of ALL_PAIRS) {
    const [type, settled] = pair
    describe(`${type} · settled=${settled}`, () => {
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

  // 8% apart here, because a 23% pair is exactly what a rate-derived brutto would reproduce.
  describe('netCategoryGrossCosts — the invoice brutto of the netto rows', () => {
    const netRow = {
      categoryId: 7,
      type: 'INVESTMENT_EXPENSE_NET',
      total: 4809.6,
      netTotal: 4453.33,
    }

    it('sums the recorded amount per category, beside the netto', () => {
      const { netCategoryCosts, netCategoryGrossCosts } = deriveCategoryBreakdowns([
        { ...netRow, settled: false },
        { ...netRow, categoryId: 8, settled: false, total: 108, netTotal: 100 },
      ])
      expect(netCategoryCosts).toEqual([
        { categoryId: 7, total: 4453.33 },
        { categoryId: 8, total: 100 },
      ])
      expect(netCategoryGrossCosts).toEqual([
        { categoryId: 7, total: 4809.6 },
        { categoryId: 8, total: 108 },
      ])
    })

    it('counts a settled netto row, as netCategoryCosts does', () => {
      const { netCategoryGrossCosts } = deriveCategoryBreakdowns([{ ...netRow, settled: true }])
      expect(netCategoryGrossCosts).toEqual([{ categoryId: 7, total: 4809.6 }])
    })

    it('never takes a brutto-billed row', () => {
      const { netCategoryGrossCosts } = deriveCategoryBreakdowns([
        { categoryId: 7, type: 'INVESTMENT_EXPENSE', settled: false, total: 200 },
        { categoryId: 7, type: 'CORRECTION', settled: false, total: 50 },
      ])
      expect(netCategoryGrossCosts).toEqual([])
    })
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

describe('the wydatki tabs partition the billed total', () => {
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
