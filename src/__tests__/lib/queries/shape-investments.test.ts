import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { shapeInvestments } from '@/lib/queries/shape-investments'
import type { InvestmentWithDetailsT } from '@/types/reference-data'
import { NO_INVESTMENT_DETAILS } from '@/lib/investments/investment-details'
import type {
  DepositPlaneSumsMapT,
  InvestmentFinancialsMapT,
  KosztorysClientTotalsMapT,
} from '@/lib/queries/balances'
import { DEFAULT_VAT } from '@/lib/kosztorys/constants'
import { ZERO_FINANCIALS } from '@/types/investment-financials'

const NO_MAP = {}
// The map carries no default on purpose: omitted, it shapes a row whose bilans silently drops every
// wpłata.
const NO_DEPOSITS: DepositPlaneSumsMapT = {}
const paidNet = (amount: number): DepositPlaneSumsMapT => ({
  '5': { paidNet: amount, paidGrossNet: 0, paidGross: 0, paidNetCount: 1 },
})
const kosztorysTotals: KosztorysClientTotalsMapT = {
  '5': {
    doneNet: 4500,
    laborCostsNetFromKosztorys: 5000,
    discountNetFromKosztorys: 500,
    globalDiscountNet: 0,
  },
}

const baseInv: InvestmentWithDetailsT = {
  ...NO_INVESTMENT_DETAILS,
  id: 5,
  name: 'Grojecka',
  status: 'active',
  address: 'Grójecka 1',
  phone: '123',
  email: 'g@x.pl',
  contactPerson: 'Pan G',
  notes: '',
  reviewRequested: false,
  hasSheet: false,
  aiStage: null,
  aiNotes: '',
  createdAt: '2026-01-15T10:00:00.000Z',
  materialsNetRate: null,
  settlementMode: 'NET',
  vatRate: DEFAULT_VAT,
  active: true,
}

describe('shapeInvestments', () => {
  it('computes balance and margin from financials', () => {
    const financials: InvestmentFinancialsMapT = {
      '5': {
        categoryCosts: [],
        totalMaterialCosts: 1000,
        materialsGrossBase: 1000,
        materialsNetBilled: 0,
        totalIncome: 9547,
        totalLaborCosts: 0,
        totalPayouts: 1000,
        totalDiscount: 0,
        totalLoss: 0,
        totalBonus: 0,
        totalSettled: 0,
        materialsNetDiscount: 0,
        settledCategoryCosts: [],
        netCategoryCosts: [],
      },
    }
    const [row] = shapeInvestments(
      [baseInv],
      financials,
      {
        '5': {
          doneNet: 3900,
          laborCostsNetFromKosztorys: 3900,
          discountNetFromKosztorys: 0,
          globalDiscountNet: 0,
        },
      },
      NO_MAP,
      paidNet(9547),
    )
    expect(row.balance).toBe(4647) // 9547 wpłat − (1000 materiałów + 3900 robocizny)
    // Bilans is on the kosztorys plane, marża v1 on the transactions one — here the 3900 exists
    // ONLY in the kosztorys, so v1 sees wypłaty with no robocizna behind them.
    expect(row.margin).toBe(-1000)
    expect(row).toMatchObject({ id: 5, name: 'Grojecka', status: 'active', hasSheet: false })
  })

  it('defaults to zeroed financials when investment has no entry', () => {
    const [row] = shapeInvestments([baseInv], {}, NO_MAP, NO_MAP, NO_DEPOSITS)
    expect(row).toMatchObject({
      totalMaterialCosts: 0,
      totalIncome: 0,
      totalLaborCosts: 0,
      totalPayouts: 0,
      totalInvestmentExpense: 0,
      margin: 0,
    })
    expect(row.balance).toBeCloseTo(0, 10)
  })

  it('folds material with no category into the total', () => {
    const financials: InvestmentFinancialsMapT = {
      '5': {
        categoryCosts: [
          { categoryId: 1, total: 800 },
          { categoryId: 2, total: 400 },
        ],
        totalMaterialCosts: 1150, // (800 + 400) + (-50) uncategorised
        materialsGrossBase: 1150,
        materialsNetBilled: 0,
        totalIncome: 0,
        totalLaborCosts: 0,
        totalPayouts: 0,
        totalDiscount: 0,
        totalLoss: 0,
        totalBonus: 0,
        totalSettled: 0,
        materialsNetDiscount: 0,
        settledCategoryCosts: [],
        netCategoryCosts: [],
      },
    }
    const [row] = shapeInvestments([baseInv], financials, NO_MAP, NO_MAP, NO_DEPOSITS)
    expect(row.totalInvestmentExpense).toBe(1150)
  })

  it('prices each bucket on the plane it was recorded on when a rate is set', () => {
    const financials: InvestmentFinancialsMapT = {
      '5': {
        // Category 1 mixes planes: 1150 brutto receipts + 100 already billed netto.
        categoryCosts: [{ categoryId: 1, total: 1250 }],
        netCategoryCosts: [{ categoryId: 1, total: 100 }],
        totalMaterialCosts: 1250,
        materialsGrossBase: 1150,
        materialsNetBilled: 100,
        totalIncome: 0,
        totalLaborCosts: 0,
        totalPayouts: 0,
        totalDiscount: 0,
        totalLoss: 0,
        totalBonus: 0,
        totalSettled: 0,
        materialsNetDiscount: 230,
        settledCategoryCosts: [],
      },
    }
    const [row] = shapeInvestments(
      [{ ...baseInv, materialsNetRate: 0.25 }],
      financials,
      NO_MAP,
      NO_MAP,
      NO_DEPOSITS,
    )
    // 1150 ÷ 1,25 = 920, plus the 100 netto at face value — the netto part is NOT divided again.
    expect(row.totalInvestmentExpense).toBe(1020)
  })

  it('leaves the saved rate inert under rozliczenie brutto', () => {
    const financials: InvestmentFinancialsMapT = {
      '5': {
        categoryCosts: [{ categoryId: 1, total: 1250 }],
        netCategoryCosts: [{ categoryId: 1, total: 100 }],
        totalMaterialCosts: 1250,
        materialsGrossBase: 1150,
        materialsNetBilled: 100,
        totalIncome: 0,
        totalLaborCosts: 0,
        totalPayouts: 0,
        totalDiscount: 0,
        totalLoss: 0,
        totalBonus: 0,
        totalSettled: 0,
        materialsNetDiscount: 0,
        settledCategoryCosts: [],
      },
    }
    const [row] = shapeInvestments(
      [{ ...baseInv, materialsNetRate: 0.25, settlementMode: 'GROSS' }],
      financials,
      NO_MAP,
      NO_MAP,
      NO_DEPOSITS,
    )
    expect(row.totalInvestmentExpense).toBe(1250)
  })

  it('grosses the bilans on the prace alone and passes the settled spend through', () => {
    const financials: InvestmentFinancialsMapT = {
      '5': {
        categoryCosts: [],
        netCategoryCosts: [],
        totalMaterialCosts: 1000,
        materialsGrossBase: 1000,
        materialsNetBilled: 0,
        totalIncome: 9547,
        totalLaborCosts: 0,
        totalPayouts: 0,
        totalDiscount: 0,
        totalLoss: 0,
        totalBonus: 0,
        totalSettled: 250,
        materialsNetDiscount: 0,
        settledCategoryCosts: [],
      },
    }
    const [row] = shapeInvestments(
      [{ ...baseInv, vatRate: 0.23 }],
      financials,
      {
        '5': {
          doneNet: 3900,
          laborCostsNetFromKosztorys: 3900,
          discountNetFromKosztorys: 0,
          globalDiscountNet: 0,
        },
      },
      NO_MAP,
      NO_DEPOSITS,
    )
    expect(row.totalSettled).toBe(250)
    // VAT is another charge on the client, so it DEDUCTS from a balance where negative = owed.
    // The 1000 materiały are not grossed.
    expect(row.balanceGross).toBeCloseTo(row.balance - 897, 10)
  })

  it('grosses the prace net of the rabat, not the raw labour', () => {
    const [row] = shapeInvestments(
      [{ ...baseInv, vatRate: 0.05 }],
      {
        '5': {
          categoryCosts: [],
          netCategoryCosts: [],
          totalMaterialCosts: 0,
          materialsGrossBase: 0,
          materialsNetBilled: 0,
          totalIncome: 0,
          totalLaborCosts: 0,
          totalPayouts: 0,
          totalDiscount: 0,
          totalLoss: 0,
          totalBonus: 0,
          totalSettled: 0,
          materialsNetDiscount: 0,
          settledCategoryCosts: [],
        },
      },
      {
        '5': {
          doneNet: 170951,
          laborCostsNetFromKosztorys: 270951,
          discountNetFromKosztorys: 100000,
          globalDiscountNet: 100000,
        },
      },
      NO_MAP,
      NO_DEPOSITS,
    )
    // The client never pays VAT on money they were discounted: 5% × (270951 − 100000).
    expect(row.balanceGross).toBeCloseTo(row.balance - 8547.55, 8)
  })

  it('falls back to the default VAT when the investment carries none', () => {
    const [row] = shapeInvestments(
      [baseInv],
      {
        '5': {
          categoryCosts: [],
          netCategoryCosts: [],
          totalMaterialCosts: 0,
          materialsGrossBase: 0,
          materialsNetBilled: 0,
          totalIncome: 0,
          totalLaborCosts: 0,
          totalPayouts: 0,
          totalDiscount: 0,
          totalLoss: 0,
          totalBonus: 0,
          totalSettled: 0,
          materialsNetDiscount: 0,
          settledCategoryCosts: [],
        },
      },
      {
        '5': {
          doneNet: 1000,
          laborCostsNetFromKosztorys: 1000,
          discountNetFromKosztorys: 0,
          globalDiscountNet: 0,
        },
      },
      NO_MAP,
      NO_DEPOSITS,
    )
    expect(row.balanceGross).toBeCloseTo(row.balance - DEFAULT_VAT * 1000, 10)
  })

  it('keeps material with no category inside wydatki inwestycyjne', () => {
    const financials: InvestmentFinancialsMapT = {
      '5': {
        categoryCosts: [
          { categoryId: 1, total: 1250 },
          { categoryId: 2, total: 500 },
        ],
        netCategoryCosts: [{ categoryId: 1, total: 100 }],
        totalMaterialCosts: 1990, // the two categories plus a 240 uncategorised correction
        materialsGrossBase: 1890,
        materialsNetBilled: 100,
        totalIncome: 0,
        totalLaborCosts: 0,
        totalPayouts: 0,
        totalDiscount: 0,
        totalLoss: 0,
        totalBonus: 0,
        totalSettled: 0,
        materialsNetDiscount: 378,
        settledCategoryCosts: [],
      },
    }
    const [row] = shapeInvestments(
      [{ ...baseInv, materialsNetRate: 0.25 }],
      financials,
      NO_MAP,
      NO_MAP,
      NO_DEPOSITS,
    )
    // 1890/1.25 + 100. The 240 booked to no category is in there — priced through the same rate,
    // it contributes the 192 that separates this from the two categories' 1420.
    expect(row.totalInvestmentExpense).toBeCloseTo(1612, 10)
  })
})

// The figures below are chosen so the two planes DISAGREE — a listing that silently kept reading
// transactions would still produce plausible numbers, just the old ones.
describe('shapeInvestments robocizna source', () => {
  const transactionFinancials: InvestmentFinancialsMapT = {
    '5': {
      categoryCosts: [],
      netCategoryCosts: [],
      totalMaterialCosts: 1000,
      materialsGrossBase: 1000,
      materialsNetBilled: 0,
      totalIncome: 9547,
      totalLaborCosts: 3900,
      totalPayouts: 1000,
      totalDiscount: 0,
      totalLoss: 0,
      totalBonus: 0,
      totalSettled: 0,
      materialsNetDiscount: 0,
      settledCategoryCosts: [],
    },
  }

  it('builds bilans and marża from the kosztorys pair', () => {
    const [row] = shapeInvestments(
      [baseInv],
      transactionFinancials,
      kosztorysTotals,
      NO_MAP,
      paidNet(9547),
    )

    expect(row.totalLaborCosts).toBe(5000)
    // 9547 wpłat − (1000 materiałów + 4500 wykonanej roboty netto po rabacie).
    expect(row.balance).toBe(4047)
  })

  it('carries the transactions plane beside the kosztorys one', () => {
    const [row] = shapeInvestments(
      [baseInv],
      transactionFinancials,
      kosztorysTotals,
      NO_MAP,
      NO_DEPOSITS,
    )

    expect(row.totalLaborCostsFromTransactions).toBe(3900)
    expect(row.balanceFromTransactions).toBe(4647) // 9547 − (1000 + 3900), no rabat on this plane
    expect(row.margin).toBe(2900) // 3900 − 1000 wypłat
  })

  it('grosses the bilans on the kosztorys pair, not the transactions one', () => {
    const [row] = shapeInvestments(
      [{ ...baseInv, vatRate: 0.23 }],
      transactionFinancials,
      kosztorysTotals,
      NO_MAP,
      NO_DEPOSITS,
    )

    expect(row.balanceGross).toBeCloseTo(row.balance - 0.23 * 4500, 10)
  })

  it('reads zero robocizny for an investment with no kosztorys', () => {
    const [missingMap] = shapeInvestments(
      [baseInv],
      transactionFinancials,
      NO_MAP,
      NO_MAP,
      NO_DEPOSITS,
    )
    const [emptyMap] = shapeInvestments([baseInv], transactionFinancials, {}, NO_MAP, NO_DEPOSITS)

    expect(emptyMap).toEqual(missingMap)
    expect(emptyMap.totalLaborCosts).toBe(0)
    expect(emptyMap.totalLaborCostsFromTransactions).toBe(3900)
    expect(emptyMap.margin).toBe(2900) // 3900 − 1000 wypłat, same as with a kosztorys
    // Same map, different investment: the lookup must key on the id, not merely on the map existing.
    expect(
      shapeInvestments([{ ...baseInv, id: 6 }], {}, kosztorysTotals, NO_MAP, NO_DEPOSITS)[0]
        .totalLaborCosts,
    ).toBe(0)
  })

  it('tells an absent kosztorys from one that sums to zero', () => {
    const [zeroProgress] = shapeInvestments(
      [baseInv],
      transactionFinancials,
      {
        '5': {
          doneNet: 0,
          laborCostsNetFromKosztorys: 0,
          discountNetFromKosztorys: 0,
          globalDiscountNet: 0,
        },
      },
      NO_MAP,
      NO_DEPOSITS,
    )
    const [absent] = shapeInvestments([baseInv], transactionFinancials, {}, NO_MAP, NO_DEPOSITS)

    expect(zeroProgress.hasKosztorys).toBe(true)
    expect(absent.hasKosztorys).toBe(false)
    expect({
      ...zeroProgress,
      hasKosztorys: false,
      subcontractorRemaining: undefined,
    }).toEqual(absent)
  })

  it('reads presence off the entry, not off the figure it carries', () => {
    const [withWork] = shapeInvestments(
      [baseInv],
      transactionFinancials,
      kosztorysTotals,
      NO_MAP,
      NO_DEPOSITS,
    )

    expect(withWork.hasKosztorys).toBe(true)
    expect(
      shapeInvestments([{ ...baseInv, id: 6 }], {}, kosztorysTotals, NO_MAP, NO_DEPOSITS)[0]
        .hasKosztorys,
    ).toBe(false)
  })

  it('shows the stored stage, whatever the kosztorys carries', () => {
    const step = (inv: InvestmentWithDetailsT) =>
      shapeInvestments([inv], transactionFinancials, kosztorysTotals, NO_MAP, NO_DEPOSITS)[0]
        .aiProgress

    expect(step(baseInv)).toBe('none')
    expect(step({ ...baseInv, aiStage: 'ready_for_analysis' })).toBe('ready_for_analysis')
    expect(step({ ...baseInv, aiStage: 'review_done' })).toBe('review_done')
  })
})

// The transactions plane sets 1000 zł of wypłat and the kosztorys says 800 zł is owed for the work
// actually done — the two figures must NOT coincide, or a column that kept reading
// `totalPayouts` would pass.
describe('shapeInvestments marża v2', () => {
  const transactionFinancials: InvestmentFinancialsMapT = {
    '5': {
      categoryCosts: [],
      netCategoryCosts: [],
      totalMaterialCosts: 1000,
      materialsGrossBase: 1000,
      materialsNetBilled: 0,
      totalIncome: 9547,
      totalLaborCosts: 3900,
      totalPayouts: 1000,
      totalDiscount: 0,
      totalLoss: 200,
      totalBonus: 0,
      totalSettled: 300,
      materialsNetDiscount: 400,
      settledCategoryCosts: [],
    },
  }

  it('prices the crew from the kosztorys, not from the wypłaty', () => {
    const [row] = shapeInvestments(
      [baseInv],
      transactionFinancials,
      kosztorysTotals,
      {
        '5': { due: 800, hasUnconfirmedPlane: false },
      },
      NO_DEPOSITS,
    )

    expect(row.marginV2).toBe(3200) // 5000 − 500 rabatu − 800 ekipie − 300 wliczonych − 200 straty
    expect(row.margin).toBe(2000) // 3900 − 1000 wypłat − 200 straty − 300 wliczonych − 400 obniżki
  })

  it('withholds the figure when an etap carries work with no rozliczenie', () => {
    const [row] = shapeInvestments(
      [baseInv],
      transactionFinancials,
      kosztorysTotals,
      {
        '5': { due: 800, hasUnconfirmedPlane: true },
      },
      NO_DEPOSITS,
    )

    // `undefined`, not `null` — the row type carries the absence that way because TanStack's
    // `sortUndefined` is what keeps a withheld row out of the numeric comparator.
    expect(row.marginV2).toBeUndefined()
    expect(row.margin).toBe(2000)
  })

  it('owes nothing to a crew for an investment with no kosztorys', () => {
    const [row] = shapeInvestments([baseInv], transactionFinancials, NO_MAP, NO_MAP, NO_DEPOSITS)

    expect(row.marginV2).toBe(-500) // 0 robocizny − 300 wliczonych − 200 straty
  })
})

// The wypłaty (1000) differ from every należne below, so a figure reading the wrong operand fails.
describe('shapeInvestments pozostało do wypłaty', () => {
  const transactionFinancials: InvestmentFinancialsMapT = {
    '5': { ...ZERO_FINANCIALS, totalPayouts: 1000 },
  }
  const remainingFor = (
    due: number,
    {
      hasUnconfirmedPlane = false,
      totals = kosztorysTotals,
      financials = transactionFinancials,
    }: {
      hasUnconfirmedPlane?: boolean
      totals?: KosztorysClientTotalsMapT
      financials?: InvestmentFinancialsMapT
    } = {},
  ) =>
    shapeInvestments(
      [baseInv],
      financials,
      totals,
      { '5': { due, hasUnconfirmedPlane } },
      NO_DEPOSITS,
    )[0].subcontractorRemaining

  it('is what the crews are owed for executed work, less what they were paid', () => {
    expect(remainingFor(1750)).toBe(750)
  })

  it('goes negative when the crews were paid more than they executed', () => {
    expect(remainingFor(800)).toBe(-200)
  })

  it('withholds the figure when an etap carries work with no rozliczenie', () => {
    expect(remainingFor(1750, { hasUnconfirmedPlane: true })).toBeUndefined()
  })

  it('withholds the figure for an investment with no kosztorys', () => {
    // Otherwise it would read −wypłaty and sort legacy investments in among real overpayments.
    expect(remainingFor(1750, { totals: NO_MAP })).toBeUndefined()
  })

  it('reads −wypłaty for a kosztorys with no executed work yet', () => {
    const [row] = shapeInvestments(
      [baseInv],
      transactionFinancials,
      kosztorysTotals,
      NO_MAP,
      NO_DEPOSITS,
    )

    expect(row.subcontractorRemaining).toBe(-1000)
  })

  it('counts a premia as owed on top of the executed work', () => {
    const withBonus: InvestmentFinancialsMapT = {
      '5': { ...ZERO_FINANCIALS, totalPayouts: 1000, totalBonus: 200 },
    }

    expect(remainingFor(800, { financials: withBonus })).toBe(0)
  })

  it('rounds float residue to exactly zero grosz', () => {
    const paid030: InvestmentFinancialsMapT = { '5': { ...ZERO_FINANCIALS, totalPayouts: 0.3 } }

    expect(remainingFor(0.1 + 0.2, { financials: paid030 })).toBe(0)
  })
})

describe('shapeInvestments wpłaty', () => {
  const owes10k: KosztorysClientTotalsMapT = {
    '5': {
      doneNet: 10_000,
      laborCostsNetFromKosztorys: 10_000,
      discountNetFromKosztorys: 0,
      globalDiscountNet: 0,
    },
  }

  it('lowers each plane by what that plane was actually paid', () => {
    // 4000 gotówką — one kwota netto, no brutto — plus a przelew of 1230 brutto whose faktura
    // names 1000 netto.
    const deposits: DepositPlaneSumsMapT = {
      '5': {
        paidNet: 4000,
        paidGrossNet: 1000,
        paidGross: 1230,
        paidNetCount: 1,
      },
    }
    const [row] = shapeInvestments(
      [{ ...baseInv, vatRate: 0.23 }],
      { '5': ZERO_FINANCIALS },
      owes10k,
      NO_MAP,
      deposits,
    )

    expect(row.balance).toBeCloseTo(-(10_000 - 5000), 10)
    // Brutto deducts 1230 only: gotówka has no brutto kwota, which is why the listing hides this
    // column outside tryb brutto rather than showing a figure that under-counts the wpłaty.
    expect(row.balanceGross).toBeCloseTo(-(12_300 - 1230), 10)
  })

  it('deducts nothing on netto for a przelew whose faktura named no netto', () => {
    const netlessOnly: DepositPlaneSumsMapT = {
      '5': { paidNet: 0, paidGrossNet: 0, paidGross: 1230, paidNetCount: 0 },
    }
    const [row] = shapeInvestments(
      [{ ...baseInv, vatRate: 0.23 }],
      { '5': ZERO_FINANCIALS },
      owes10k,
      NO_MAP,
      netlessOnly,
    )

    expect(row.balance).toBeCloseTo(-10_000, 10)
    expect(row.balanceGross).toBeCloseTo(-(12_300 - 1230), 10)
  })

  it('carries the tryb the listing gates its two bilans columns on', () => {
    const carried = (mode: InvestmentWithDetailsT['settlementMode']) =>
      shapeInvestments(
        [{ ...baseInv, settlementMode: mode }],
        { '5': ZERO_FINANCIALS },
        owes10k,
        NO_MAP,
        NO_DEPOSITS,
      )[0].settlementMode

    expect(carried('NET')).toBe('NET')
    expect(carried('GROSS')).toBe('GROSS')
    expect(carried('MIXED')).toBe('MIXED')
  })
})

describe('shapeInvestments wpłaty osierocone przez tryb brutto', () => {
  const mixedDeposits: DepositPlaneSumsMapT = {
    '5': {
      paidNet: 4000,
      paidGrossNet: 1000,
      paidGross: 1230,
      paidNetCount: 2,
    },
  }

  const shape = (settlementMode: InvestmentWithDetailsT['settlementMode']) =>
    shapeInvestments(
      [{ ...baseInv, settlementMode, vatRate: 0.23 }],
      { '5': ZERO_FINANCIALS },
      NO_MAP,
      NO_MAP,
      mixedDeposits,
    )[0]

  it('carries how many wpłaty the brutto bilans drops, and what they are worth', () => {
    expect(shape('GROSS').strandedDeposits).toEqual({ count: 2, amount: 4000 })
  })

  it('leaves the row unmarked outside tryb brutto — there nothing is dropped', () => {
    expect(shape('NET').strandedDeposits).toBeUndefined()
    expect(shape('MIXED').strandedDeposits).toBeUndefined()
  })

  it('leaves the row unmarked in tryb brutto when every wpłata came przelewem', () => {
    const transfersOnly: DepositPlaneSumsMapT = {
      '5': { paidNet: 0, paidGrossNet: 1000, paidGross: 1230, paidNetCount: 0 },
    }
    const [row] = shapeInvestments(
      [{ ...baseInv, settlementMode: 'GROSS', vatRate: 0.23 }],
      { '5': ZERO_FINANCIALS },
      NO_MAP,
      NO_MAP,
      transfersOnly,
    )
    expect(row.strandedDeposits).toBeUndefined()
  })
})
