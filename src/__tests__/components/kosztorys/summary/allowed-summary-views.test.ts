import { describe, expect, it } from 'vitest'
import { allowedSummaryViews } from '@/components/kosztorys/summary/allowed-summary-views'
import type { SummaryViewT } from '@/components/kosztorys/summary/hooks/use-summary-view'

const ALL: SummaryViewT[] = [
  'summary',
  'expenses',
  'stages',
  'subcontractors',
  'margin',
  'investment',
]

const OWNER = { preview: false, hasMarginInputs: true, hasInvestmentInfo: true }
const CLIENT = { preview: true, hasMarginInputs: true, hasInvestmentInfo: true }

describe('allowedSummaryViews', () => {
  it('właściciel widzi wszystko, co host oferuje', () => {
    expect(allowedSummaryViews(ALL, OWNER)).toEqual(ALL)
  })

  // Hiding the tab is not what protects the client document — it never receives these figures at
  // all. This filter is the second barrier, not the only one.
  it('podgląd klienta gubi „Podwykonawcy" i „Marża", nawet gdy liczby przyszły', () => {
    expect(allowedSummaryViews(ALL, CLIENT)).toEqual(['summary', 'expenses', 'stages'])
  })

  it('bez kompletu liczb „Marża" znika, a „Podwykonawcy" zostaje', () => {
    expect(
      allowedSummaryViews(ALL, {
        preview: false,
        hasMarginInputs: false,
        hasInvestmentInfo: true,
      }),
    ).toEqual(['summary', 'expenses', 'stages', 'subcontractors', 'investment'])
  })

  // The szablon workbench prices rows that belong to no investment — the tab would render nothing.
  it('bez rekordu inwestycji „Inwestycja" znika, reszta zostaje', () => {
    expect(
      allowedSummaryViews(ALL, {
        preview: false,
        hasMarginInputs: true,
        hasInvestmentInfo: false,
      }),
    ).toEqual(['summary', 'expenses', 'stages', 'subcontractors', 'margin'])
  })
})
