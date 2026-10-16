import { describe, expect, it } from 'vitest'
import { bypassedByGlobalDiscount, columnLabelForView } from '@/lib/kosztorys/columns/column-config'
import { POLISH_GRID } from '@/lib/i18n/translations'

const DISCOUNTED_VALUES = ['plannedNet', 'plannedGross', 'currentPlannedNet', 'currentPlannedGross']

describe('columnLabelForView — „— po rabacie"', () => {
  it('suffixes the four przedmiar values when the kosztorys has a rabat', () => {
    for (const id of DISCOUNTED_VALUES) {
      const label = columnLabelForView(id, 'client', POLISH_GRID, { hasDiscount: true })
      expect(label, id).toBe(`${columnLabelForView(id, 'client')} — po rabacie`)
    }
    expect(columnLabelForView('plannedNet', 'client', POLISH_GRID, { hasDiscount: true })).toBe(
      'Wartość przedmiaru netto — po rabacie',
    )
  })

  it('leaves them unsuffixed on an offer without a rabat', () => {
    for (const id of DISCOUNTED_VALUES) {
      expect(columnLabelForView(id, 'client'), id).not.toContain('po rabacie')
    }
  })

  it('never suffixes the executed value — it has its own rabat column', () => {
    for (const id of ['net', 'gross']) {
      expect(columnLabelForView(id, 'client', POLISH_GRID, { hasDiscount: true })).not.toContain(
        'po rabacie',
      )
    }
  })

  it('never suffixes a crew plane — the rabat is a client concession', () => {
    expect(
      columnLabelForView('plannedNet', 'w_tools', POLISH_GRID, { hasDiscount: true }),
    ).not.toContain('po rabacie')
  })

  it('names the rabat on przedmiar', () => {
    expect(columnLabelForView('plannedDiscountAmount', 'client')).toBe(
      'Rabat kwota netto (przedmiar)',
    )
    expect(columnLabelForView('plannedDiscountAmountGross', 'client')).toBe(
      'Rabat kwota brutto (przedmiar)',
    )
  })
})

describe('bypassedByGlobalDiscount', () => {
  it('bypasses the rabat on przedmiar under a rabat globalny', () => {
    for (const id of ['plannedDiscountAmount', 'plannedDiscountAmountGross']) {
      expect(bypassedByGlobalDiscount(id, true), id).toBe(true)
      expect(bypassedByGlobalDiscount(id, false), id).toBe(false)
    }
  })
})
