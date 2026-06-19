import { describe, it, expect } from 'vitest'
import { extractFigures } from '@/lib/investment-figures'
import type { InvestmentFinancialsT } from '@/lib/db/sum-transfers'

const base: InvestmentFinancialsT = {
  categoryCosts: [],
  totalMaterialCosts: 0,
  totalCorrections: 0,
  totalIncome: 0,
  totalLaborCosts: 0,
  totalPayouts: 0,
  totalRabat: 0,
  totalLoss: 0,
  totalSettled: 0,
  settledCategoryCosts: [],
}

describe('extractFigures', () => {
  it('derives the six display figures from financials', () => {
    const fin: InvestmentFinancialsT = {
      ...base,
      categoryCosts: [
        { categoryId: 1, total: 3000 },
        { categoryId: 2, total: 2000 },
      ],
      totalMaterialCosts: 5000,
      totalIncome: 12000,
      totalLaborCosts: 800,
      totalPayouts: 300,
      totalRabat: 200,
      totalLoss: 150,
      totalSettled: 100,
    }
    expect(extractFigures(fin)).toEqual({
      // bilans = income - (materialy + labor) + rabat = 12000 - 5800 + 200
      bilans: 6400,
      // marza = labor - payouts - rabat - loss - settled = 800 - 300 - 200 - 150 - 100
      marza: 50,
      materialy: 5000,
      // wydatki inwestycyjne = sum of categoryCosts
      wydatkiInwestycyjne: 5000,
      wyplaty: 300,
      settled: 100,
    })
  })
})
