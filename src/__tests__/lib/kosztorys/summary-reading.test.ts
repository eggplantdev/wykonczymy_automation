import { describe, it, expect } from 'vitest'
import {
  financialsOnReading,
  readingFromKosztorys,
  readingFromTransactions,
} from '@/lib/kosztorys/summary-reading'
import type { KosztorysClientTotalsT } from '@/lib/kosztorys/settlement-client-totals'
import type { InvestmentFinancialsT } from '@/types/investment-financials'

const financials = {
  totalLaborCosts: 100_000,
  totalDiscount: 8_000,
  materialsGrossBase: 40_000,
  materialsNetBilled: 32_520,
} as InvestmentFinancialsT

const clientTotals = {
  laborCostsNetFromKosztorys: 90_000,
  discountNetFromKosztorys: 5_000,
} as KosztorysClientTotalsT

describe('summary reading projection', () => {
  it('lands both readings on the same POST-rabat axis', () => {
    expect(readingFromTransactions(financials)).toEqual({
      laborCostsNet: 92_000,
      discountAmount: 8_000,
    })
    expect(readingFromKosztorys(clientTotals)).toEqual({
      laborCostsNet: 85_000,
      discountAmount: 5_000,
    })
  })

  it('keeps robocizna + rabat addable back to the pre-rabat figure the pie draws', () => {
    const v1 = readingFromTransactions(financials)
    const v2 = readingFromKosztorys(clientTotals)

    expect(v1.laborCostsNet + v1.discountAmount).toBe(financials.totalLaborCosts)
    expect(v2.laborCostsNet + v2.discountAmount).toBe(clientTotals.laborCostsNetFromKosztorys)
  })

  it('reports no rabat when there is none to report', () => {
    expect(
      readingFromKosztorys({
        laborCostsNetFromKosztorys: 90_000,
        discountNetFromKosztorys: 0,
      } as KosztorysClientTotalsT),
    ).toEqual({ laborCostsNet: 90_000, discountAmount: 0 })
  })
})

describe('readingFromKosztorys without a kosztorys', () => {
  it('reads zero rather than the transactions plane', () => {
    expect(readingFromKosztorys(null)).toEqual({ laborCostsNet: 0, discountAmount: 0 })
    expect(readingFromKosztorys(undefined)).toEqual({ laborCostsNet: 0, discountAmount: 0 })
  })

  it('cannot be told apart from a kosztorys that sums to zero', () => {
    const nothingExecuted = {
      laborCostsNetFromKosztorys: 0,
      discountNetFromKosztorys: 0,
    } as KosztorysClientTotalsT

    expect(readingFromKosztorys(nothingExecuted)).toEqual(readingFromKosztorys(null))
  })
})

describe('financialsOnReading', () => {
  it('restores the pre-rabat robocizna the formulas expect', () => {
    const swapped = financialsOnReading(financials, readingFromKosztorys(clientTotals))

    expect(swapped.totalLaborCosts).toBe(90_000)
    expect(swapped.totalDiscount).toBe(5_000)
  })

  it('leaves every cash-movement figure alone', () => {
    const swapped = financialsOnReading(financials, readingFromKosztorys(clientTotals))
    const { totalLaborCosts: _labor, totalDiscount: _discount, ...untouched } = swapped
    const {
      totalLaborCosts: _originalLabor,
      totalDiscount: _originalDiscount,
      ...originalUntouched
    } = financials

    expect(untouched).toEqual(originalUntouched)
  })

  it('is a no-op on the transactions reading', () => {
    expect(financialsOnReading(financials, readingFromTransactions(financials))).toEqual(financials)
  })
})
