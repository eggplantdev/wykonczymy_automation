import { describe, expect, it } from 'vitest'
import {
  ALL_SUMMARY_VIEWS as ALL,
  allowedSummaryViews,
  type SummaryViewT,
} from '@/components/kosztorys/summary/model/summary-views'

const OWNER = { preview: false, hasMarginInputs: true, hasInvestmentInfo: true }
const CLIENT = { preview: true, hasMarginInputs: true, hasInvestmentInfo: true }

function allowed(views: SummaryViewT[], disclosure: typeof OWNER) {
  return allowedSummaryViews(views, disclosure).map(({ value }) => value)
}

describe('allowedSummaryViews', () => {
  it('właściciel widzi wszystko, co host oferuje', () => {
    expect(allowed(ALL, OWNER)).toEqual([
      'summary',
      'expenses',
      'stages',
      'subcontractors',
      'margin',
      'investment',
    ])
  })

  // Hiding the tab is not what protects the client document — it never receives these figures at
  // all. This filter is the second barrier, not the only one.
  it('podgląd klienta gubi „Podwykonawcy" i „Marża", nawet gdy liczby przyszły', () => {
    expect(allowed(ALL, CLIENT)).toEqual(['summary', 'expenses', 'stages'])
  })

  it('host oferujący podzbiór dostaje tylko swoje zakładki', () => {
    expect(allowed(['summary', 'expenses', 'margin'], OWNER)).toEqual([
      'summary',
      'expenses',
      'margin',
    ])
  })

  it('bez kompletu liczb „Marża" znika, a „Podwykonawcy" zostaje', () => {
    expect(
      allowed(ALL, {
        preview: false,
        hasMarginInputs: false,
        hasInvestmentInfo: true,
      }),
    ).toEqual(['summary', 'expenses', 'stages', 'subcontractors', 'investment'])
  })

  // The szablon workbench prices rows that belong to no investment — the tab would render nothing.
  it('bez rekordu inwestycji „Inwestycja" znika, reszta zostaje', () => {
    expect(
      allowed(ALL, {
        preview: false,
        hasMarginInputs: true,
        hasInvestmentInfo: false,
      }),
    ).toEqual(['summary', 'expenses', 'stages', 'subcontractors', 'margin'])
  })
})
