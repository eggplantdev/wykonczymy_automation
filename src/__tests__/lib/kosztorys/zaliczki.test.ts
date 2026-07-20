import { describe, expect, it } from 'vitest'
import { sumZaliczkiByStage, type ZaliczkaRowT } from '@/lib/kosztorys/zaliczki'

describe('sumZaliczkiByStage', () => {
  it('sums several tagged deposits per etap', () => {
    const rows: ZaliczkaRowT[] = [
      { type: 'INVESTOR_DEPOSIT', amount: 1000, kosztorysStage: 1 },
      { type: 'OTHER_DEPOSIT', amount: 500, kosztorysStage: 1 },
      { type: 'COMPANY_FUNDING', amount: 300, kosztorysStage: 2 },
    ]
    const byStage = sumZaliczkiByStage(rows)
    expect(byStage.get(1)).toBe(1500)
    expect(byStage.get(2)).toBe(300)
  })

  it('excludes untagged deposits', () => {
    const rows: ZaliczkaRowT[] = [
      { type: 'INVESTOR_DEPOSIT', amount: 1000, kosztorysStage: null },
      { type: 'INVESTOR_DEPOSIT', amount: 250, kosztorysStage: undefined },
      { type: 'INVESTOR_DEPOSIT', amount: 400, kosztorysStage: 1 },
    ]
    const byStage = sumZaliczkiByStage(rows)
    expect(byStage.get(1)).toBe(400)
    expect(byStage.size).toBe(1)
  })

  it('excludes non-deposit types even when tagged', () => {
    const rows: ZaliczkaRowT[] = [
      { type: 'INVESTMENT_EXPENSE', amount: 999, kosztorysStage: 1 },
      { type: 'LABOR_COST', amount: 999, kosztorysStage: 1 },
      { type: 'INVESTOR_DEPOSIT', amount: 100, kosztorysStage: 1 },
    ]
    expect(sumZaliczkiByStage(rows).get(1)).toBe(100)
  })

  it('returns an empty map for no rows', () => {
    expect(sumZaliczkiByStage([]).size).toBe(0)
  })
})
