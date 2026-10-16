import { describe, expect, it } from 'vitest'
import { bypassedByGlobalDiscount, columnLabelForView } from '@/lib/kosztorys/columns/column-config'
import { POLISH_GRID } from '@/lib/i18n/translations'

const DISCOUNTED_LABELS = {
  plannedNet: 'Wartość przedmiaru netto — po rabacie',
  plannedGross: 'Wartość przedmiaru brutto — po rabacie',
  currentPlannedNet: 'Wartość netto aktualizacji przedmiaru — po rabacie',
  currentPlannedGross: 'Wartość brutto aktualizacji przedmiaru — po rabacie',
}

describe('columnLabelForView — „— po rabacie"', () => {
  it('suffixes the four przedmiar values when the kosztorys has a rabat', () => {
    for (const [id, label] of Object.entries(DISCOUNTED_LABELS)) {
      expect(columnLabelForView(id, 'client', POLISH_GRID, { hasDiscount: true }), id).toBe(label)
    }
  })

  it('leaves them unsuffixed on an offer without a rabat', () => {
    for (const id of Object.keys(DISCOUNTED_LABELS)) {
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
